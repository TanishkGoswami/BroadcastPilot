const { Queue, Worker } = require('bullmq');
const axios = require('axios');
const supabase = require('../supabaseClient');
const { 
    normalizeTemplateHeaderMedia, 
    resolveTemplateButtonUrl, 
    getMetaSendErrorMessage 
} = require('../utils/broadcastUtils');
const { createRedisConnection } = require('../utils/redisConnection');

const redisConnection = createRedisConnection({
    retryStrategy: (times) => {
        // Prevent infinite fast retries that spam the console
        return Math.min(times * 2000, 10000); 
    }
});

redisConnection.on('error', (err) => {
    if(err.code === 'ECONNREFUSED') return;
    console.error('Redis Error:', err);
});

const broadcastQueue = new Queue('whatsapp-broadcast', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
    }
});

async function upsertConversation(orgId, waAccountId, contactId, updates) {
    const { data: existing, error: findErr } = await supabase
        .from('w_conversations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('wa_account_id', waAccountId)
        .eq('contact_id', contactId)
        .maybeSingle();

    if (existing) {
        await supabase.from('w_conversations').update({
            last_message_at: new Date().toISOString(),
            last_message_preview: updates.lastMessagePreview,
            status: 'open',
            unread_count: 0
        }).eq('id', existing.id);
        return existing;
    } else {
        const { data: newConv, error: insErr } = await supabase.from('w_conversations').insert({
            organization_id: orgId,
            wa_account_id: waAccountId,
            contact_id: contactId,
            status: 'open',
            last_message_preview: updates.lastMessagePreview,
            last_message_at: new Date().toISOString()
        }).select('id').single();
        if (insErr) console.error("Error creating conversation", insErr);
        return newConv;
    }
}

const worker = new Worker('whatsapp-broadcast', async (job) => {
    const { leadId, phone, creds, campaign, mapping = {}, organization_id, wa_account_id, name } = job.data;
    
    try {
        const components = [];
        let renderedText = mapping._template_body || `[Broadcast Template: ${campaign.template_name}]`;
        const parameters = [];
        const { type: headerMediaType, url: headerMediaUrl } = normalizeTemplateHeaderMedia(mapping);

        if (headerMediaType && !headerMediaUrl) {
            throw new Error(`Missing required ${headerMediaType} header media URL`);
        }

        if (headerMediaType && headerMediaUrl) {
            components.push({
                type: 'header',
                parameters: [
                    {
                        type: headerMediaType,
                        [headerMediaType]: { link: headerMediaUrl }
                    }
                ]
            });
        }

        const buttonUrlKeys = Object.keys(mapping)
            .map((key) => {
                const match = key.match(/^_?button_url_(\d+)$/);
                return match ? { key, index: match[1] } : null;
            })
            .filter(Boolean)
            .sort((a, b) => parseInt(a.index) - parseInt(b.index));

        const addedButtonIndexes = new Set();
        for (const item of buttonUrlKeys) {
            if (addedButtonIndexes.has(item.index)) continue;
            const text = String(mapping[`_button_url_${item.index}`] || mapping[`button_url_${item.index}`] || '').trim();
            if (!text) continue;

            components.push({
                type: 'button',
                sub_type: 'url',
                index: item.index,
                parameters: [{ type: 'text', text }]
            });
            addedButtonIndexes.add(item.index);
        }

        const templateVariableKeys = Array.isArray(mapping._template_variables)
            ? mapping._template_variables.map((key) => String(key).trim()).filter(Boolean)
            : Array.from(String(renderedText || '').matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)).map((match) => String(match[1] || '').trim()).filter(Boolean);
        
        const sortedKeys = Array.from(new Set(templateVariableKeys.length
            ? templateVariableKeys
            : Object.keys(mapping).filter(k => /^\d+$/.test(k)).sort((a, b) => parseInt(a) - parseInt(b))));

        for (const key of sortedKeys) {
            const field = mapping[key];
            let text = '';
            if (field === 'name') text = name || '';
            else if (field === 'phone') text = phone || '';
            else text = field || ''; 
            
            renderedText = renderedText.replace(new RegExp(`\\{\\{\\s*${String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g'), text);
            const parameter = { type: 'text', text: text || ' ' };
            if (!/^\d+$/.test(String(key))) {
                parameter.parameter_name = String(key);
            }
            parameters.push(parameter);
        }

        if (parameters.length > 0) {
            components.push({ type: 'body', parameters });
        }

        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
                name: campaign.template_name,
                language: { code: campaign.template_language },
                components: components
            }
        };

        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${creds.phone_number_id}/messages`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const wa_message_id = response.data.messages?.[0]?.id;

        // Log Success in BroadcastPilot table
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaign.id,
            lead_id: leadId,
            channel: 'whatsapp',
            contact: phone,
            message_id: wa_message_id,
            status: 'sent'
        });

        // Inbox Sync Logic
        if (organization_id && wa_account_id) {
            // First check if contact exists in w_contacts (since BroadcastPilot Inbox reads from w_contacts)
            let contactId = null;
            const { data: existingContacts } = await supabase
                .from('w_contacts')
                .select('id')
                .eq('organization_id', organization_id)
                .or(`wa_id.eq.${phone},phone.eq.${phone}`)
                .limit(1);

            if (existingContacts && existingContacts.length > 0) {
                contactId = existingContacts[0].id;
            } else {
                const { data: newContact, error: insertErr } = await supabase
                    .from('w_contacts')
                    .insert({
                        organization_id,
                        wa_account_id,
                        name: name || phone,
                        phone: phone,
                        wa_id: phone,
                        contact_type: 'individual'
                    })
                    .select('id')
                    .single();
                    
                if (newContact) contactId = newContact.id;
            }

            if (contactId) {
                const conv = await upsertConversation(organization_id, wa_account_id, contactId, {
                    lastMessagePreview: `[Broadcast] ${campaign.template_name}`
                });
                
                if (conv && conv.id) {
                    const templateButtons = Array.isArray(mapping._template_buttons)
                        ? mapping._template_buttons.map((button) => {
                            const type = String(button?.type || '').toUpperCase();
                            const buttonValue = mapping[`_button_url_${button.index}`] || mapping[`button_url_${button.index}`] || '';
                            return {
                                index: button.index,
                                type,
                                text: button?.text || `Button ${Number(button.index || 0) + 1}`,
                                url: type === 'URL' ? resolveTemplateButtonUrl(button?.url, buttonValue) : '',
                                phone_number: type === 'PHONE_NUMBER' ? (button?.phone_number || '') : ''
                            };
                        }).filter((button) => button.text)
                        : [];

                    await supabase.from('w_messages').insert({
                        organization_id,
                        conversation_id: conv.id,
                        contact_id: contactId,
                        wa_message_id: wa_message_id || `broadcast-${Date.now()}`,
                        direction: 'outbound',
                        type: 'template',
                        status: 'sent',
                        content: {
                            text: renderedText,
                            template: {
                                name: campaign.template_name,
                                language: campaign.template_language,
                                body: renderedText,
                                footer: mapping._template_footer || '',
                                header: headerMediaUrl ? {
                                    type: headerMediaType,
                                    media_url: headerMediaUrl
                                } : null,
                                buttons: templateButtons
                            }
                        },
                        sender_type: 'system',
                        automation_source: 'broadcast'
                    });
                }
            }
        }
        
    } catch (error) {
        // Extract Meta error
        const metaError = getMetaSendErrorMessage(error.response?.data?.error) || error.message;
        
        // Log Failure
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaign.id,
            lead_id: leadId,
            channel: 'whatsapp',
            contact: phone,
            status: 'failed',
            error: metaError
        });
        
        throw error; // Triggers BullMQ to retry if attempts < 3
    }
}, {
    connection: redisConnection,
    limiter: {
        max: 5,        // Max 5 messages (safe Meta rate limit)
        duration: 1000 // per second
    }
});

worker.on('failed', (job, err) => {
    console.error(`${job.id} has failed with ${err.message}`);
});

module.exports = { broadcastQueue };
