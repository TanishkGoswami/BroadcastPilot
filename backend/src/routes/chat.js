const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../supabaseClient');

// Get Conversations for Org
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;

        const { data, error } = await supabase
            .from('b_conversations')
            .select(`
                *,
                contacts:b_contacts(id, name, channel_user_id, custom_name, phone, channel_account_id, profile_pic)
            `)
            .eq('organization_id', organization_id)
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error("Failed to fetch conversations", err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Get Messages for Conversation
router.get('/messages/:conversationId', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        const { conversationId } = req.params;

        const { data, error } = await supabase
            .from('b_messages')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Simplify content field for the frontend to render text
        const messages = data.map(msg => ({
            ...msg,
            content: msg.content?.text || (msg.type === 'image' ? '[Image]' : '[Media]')
        }));

        res.json(messages);
    } catch (err) {
        console.error("Failed to fetch messages", err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send Message
router.post('/messages', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        const { conversationId, text } = req.body;

        if (!conversationId || !text) {
            return res.status(400).json({ error: 'Missing conversationId or text' });
        }

        const { data: conv, error: convErr } = await supabase
            .from('b_conversations')
            .select('*, contacts:b_contacts(channel_user_id)')
            .eq('id', conversationId)
            .eq('organization_id', organization_id)
            .single();

        if (convErr || !conv) return res.status(404).json({ error: 'Conversation not found' });

        const channel = conv.channel;
        const recipientId = conv.contacts.channel_user_id;
        let messageRemoteId = null;

        if (channel === 'messenger' || channel === 'instagram') {
            let connQuery = supabase.from('b_meta_connections').select('*').eq('organization_id', organization_id);
            if (channel === 'messenger') {
                connQuery = connQuery.eq('page_id', conv.channel_account_id);
            } else {
                connQuery = connQuery.eq('instagram_id', conv.channel_account_id);
            }
            const { data: conn, error: connErr } = await connQuery.single();
            
            if (connErr || !conn) return res.status(400).json({ error: 'Meta connection not found' });

            const axios = require('axios');
            const token = channel === 'instagram' && conn.instagram_access_token ? conn.instagram_access_token : conn.page_access_token;
            const baseUrl = channel === 'instagram' && conn.instagram_access_token ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v19.0';
            
            const payload = {
                recipient: { id: recipientId },
                message: { text: text }
            };
            if (channel === 'messenger') {
                payload.messaging_type = 'RESPONSE';
            }

            const response = await axios.post(`${baseUrl}/${conv.channel_account_id}/messages`, payload, {
                params: { access_token: token }
            });

            messageRemoteId = response.data.message_id;

        } else if (channel === 'whatsapp') {
            const whatsappService = require('../services/whatsappService');
            messageRemoteId = await whatsappService.sendMessage(`org_${organization_id}`, recipientId, text);
        }

        const { data: newMsg, error: insertErr } = await supabase.from('b_messages').insert({
            organization_id: organization_id,
            contact_id: conv.contact_id,
            conversation_id: conv.id,
            channel: channel,
            message_remote_id: messageRemoteId,
            direction: 'outbound',
            type: 'text',
            content: { text: text },
            status: 'sent',
            sender_type: 'human_agent'
        }).select().single();

        if (insertErr) throw insertErr;

        res.json(newMsg);

    } catch (err) {
        console.error("Failed to send message", err.response?.data || err);
        const errorMsg = err.response?.data?.error?.message || err.response?.data?.error_message || 'Failed to send message';
        res.status(500).json({ error: errorMsg });
    }
});

// Sync History
router.post('/sync-history', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        const { channel } = req.body;

        if (channel === 'messenger' || channel === 'instagram') {
            const { data: connections, error: connErr } = await supabase
                .from('b_meta_connections')
                .select('*')
                .eq('organization_id', organization_id);
            
            if (connErr || !connections || connections.length === 0) {
                return res.status(400).json({ error: 'No Meta pages connected' });
            }

            const IORedis = require('ioredis');
            const { Queue } = require('bullmq');
            const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
            const metaSyncQueue = new Queue('metaSync', { connection });

            for (const conn of connections) {
                if (channel === 'messenger') {
                    await metaSyncQueue.add('syncHistoricalMessengerChats', { pageId: conn.page_id });
                } else if (channel === 'instagram' && conn.instagram_id) {
                    await metaSyncQueue.add('syncHistoricalInstagramChats', { instagramId: conn.instagram_id });
                }
            }

            setTimeout(() => connection.quit(), 1000);

            return res.json({ success: true, message: 'Historical sync started in background' });
        }

        return res.status(400).json({ error: 'Unsupported channel for sync' });
    } catch (err) {
        console.error("Failed to enqueue sync history", err);
        res.status(500).json({ error: 'Failed to enqueue sync history' });
    }
});

module.exports = router;
