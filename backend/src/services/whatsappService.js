const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const supabase = require('../supabaseClient');

// Store active sockets and QR codes in memory
const sessions = new Map();
const qrCodes = new Map();

async function upsertBaileysWaAccount(orgId, phone) {
    if (!orgId || !phone) return null;
    const cleanPhone = String(phone).replace(/\D+/g, '');
    
    const { data, error } = await supabase.from('w_wa_accounts').upsert({
        organization_id: orgId,
        phone_number_id: cleanPhone,
        display_phone_number: cleanPhone,
        name: 'WhatsApp Account',
        status: 'connected',
    }, { onConflict: 'phone_number_id' }).select('id').single();

    if (error) {
        console.error("Failed to upsert WA account:", error);
        return null;
    }
    return data.id;
}

async function upsertContact(orgId, waAccountId, contactWaId, name) {
    const { data, error } = await supabase.from('b_contacts').upsert({
        organization_id: orgId,
        channel: 'whatsapp',
        channel_user_id: contactWaId,
        channel_account_id: waAccountId,
        name: name || contactWaId,
    }, { onConflict: 'organization_id, channel, channel_user_id' }).select('id').single();
    
    if (error) console.error("Error upserting contact:", error);
    return data;
}

async function upsertConversation(orgId, waAccountId, contactId, previewText, direction) {
    const { data, error } = await supabase.from('b_conversations').upsert({
        organization_id: orgId,
        contact_id: contactId,
        channel: 'whatsapp',
        channel_account_id: waAccountId,
        last_message_at: new Date().toISOString(),
        last_message_preview: previewText.substring(0, 100),
        status: 'open'
    }, { onConflict: 'organization_id, contact_id, channel_account_id' }).select('id').single();
    
    if (error) console.error("Error upserting conversation:", error);
    return data;
}

async function initBaileysConnection(orgId, sessionId) {
    const sessionDir = path.join(__dirname, '..', '..', 'baileys_auth_info', sessionId);
    
    // Create dir if needed
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: true,
        emitOwnEvents: true,
    });

    sessions.set(sessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log(`[Baileys] New QR Code generated for ${sessionId}`);
            // Generate base64 QR to send to frontend
            const qrBase64 = await qrcode.toDataURL(qr);
            qrCodes.set(sessionId, qrBase64);
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[Baileys] Connection closed for ${sessionId}. Reconnecting: ${shouldReconnect}`);
            qrCodes.delete(sessionId);
            sessions.delete(sessionId);
            
            if (shouldReconnect) {
                setTimeout(() => initBaileysConnection(orgId, sessionId), 5000);
            } else {
                // Logged out - remove directory
                fs.rmSync(sessionDir, { recursive: true, force: true });
                // Also update DB status to disconnected
                if (sock.user?.id) {
                    const phone = sock.user.id.split(':')[0];
                    await supabase.from('w_wa_accounts').update({ status: 'disconnected' })
                        .eq('organization_id', orgId)
                        .eq('phone_number_id', phone);
                }
            }
        } else if (connection === 'open') {
            console.log(`[Baileys] Connected successfully for ${sessionId}`);
            qrCodes.delete(sessionId);
            
            // Save to database
            const phone = sock.user.id.split(':')[0];
            await upsertBaileysWaAccount(orgId, phone);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;
        const myPhone = sock.user?.id?.split(':')[0];
        
        // Ensure WA Account is tracked
        const waAccountId = await upsertBaileysWaAccount(orgId, myPhone);
        if (!waAccountId) return;

        for (const msg of messages) {
            try {
                const remoteJid = msg.key.remoteJid;
                if (!remoteJid || remoteJid === 'status@broadcast') continue;

                const isOutbound = msg.key.fromMe;
                const contactWaId = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
                
                let textContent = '';
                const msgType = Object.keys(msg.message || {})[0];
                
                if (msgType === 'conversation') textContent = msg.message.conversation;
                else if (msgType === 'extendedTextMessage') textContent = msg.message.extendedTextMessage.text;
                else if (msgType === 'imageMessage') textContent = msg.message.imageMessage.caption || '[Image]';
                else if (msgType === 'videoMessage') textContent = msg.message.videoMessage.caption || '[Video]';
                else if (msgType === 'documentMessage') textContent = msg.message.documentMessage.fileName || '[Document]';
                else if (msgType === 'audioMessage') textContent = '[Audio]';
                else if (msgType === 'stickerMessage') textContent = '[Sticker]';
                
                if (!textContent && !msgType) continue; // Skip unsupported or empty

                // 1. Store Contact
                const contact = await upsertContact(orgId, waAccountId, contactWaId, msg.pushName || contactWaId);

                // 2. Store Conversation
                const conv = await upsertConversation(orgId, waAccountId, contact.id, textContent, isOutbound ? 'outbound' : 'inbound');

                // 3. Store Message
                await supabase.from('b_messages').insert({
                    organization_id: orgId,
                    contact_id: contact.id,
                    conversation_id: conv.id,
                    channel: 'whatsapp',
                    message_remote_id: msg.key.id,
                    direction: isOutbound ? 'outbound' : 'inbound',
                    type: 'text', // simplification for now
                    content: { text: textContent },
                    status: isOutbound ? 'sent' : 'delivered',
                    sender_type: isOutbound ? 'human_agent' : 'customer'
                });
                
            } catch (err) {
                console.error("Error processing message:", err);
            }
        }
    });

    return sock;
}

function getQrCode(sessionId) {
    return qrCodes.get(sessionId) || null;
}

function isConnected(sessionId) {
    return sessions.has(sessionId);
}

async function logout(orgId, sessionId) {
    const sock = sessions.get(sessionId);
    if (sock) {
        sock.logout();
        sessions.delete(sessionId);
        qrCodes.delete(sessionId);
    }
    
    // Cleanup DB status
    const { data } = await supabase.from('w_wa_accounts').select('phone_number_id').eq('organization_id', orgId);
    if (data && data.length > 0) {
        for (const account of data) {
            await supabase.from('w_wa_accounts').update({ status: 'disconnected' })
                .eq('organization_id', orgId)
                .eq('phone_number_id', account.phone_number_id);
        }
    }
}

async function sendMessage(sessionId, to, text) {
    const sock = sessions.get(sessionId);
    if (!sock) throw new Error("WhatsApp not connected for this session.");
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text });
    return result?.key?.id;
}

module.exports = {
    initBaileysConnection,
    getQrCode,
    isConnected,
    logout,
    sendMessage
};
