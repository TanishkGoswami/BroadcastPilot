const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 12000;

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function getConfig() {
    const baseUrl = trimTrailingSlash(process.env.GAP_WHATSAPP_API_URL);

    return {
        enabled: process.env.GAP_WHATSAPP_ENABLED === 'true' && Boolean(baseUrl),
        baseUrl,
        apiKey: process.env.GAP_WHATSAPP_API_KEY || '',
        organizationIdOverride: process.env.GAP_WHATSAPP_ORGANIZATION_ID || '',
        timeoutMs: Number(process.env.GAP_WHATSAPP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
        messagesLimit: Number(process.env.GAP_WHATSAPP_MESSAGES_LIMIT || 200),
        conversationsPath: process.env.GAP_WHATSAPP_CONVERSATIONS_PATH || '/api/conversations',
        messagesPath: process.env.GAP_WHATSAPP_MESSAGES_PATH || '/api/messages/:conversationId',
        sendMessagePath: process.env.GAP_WHATSAPP_SEND_MESSAGE_PATH || '/api/conversations/:conversationId/send',
    };
}

function isEnabled() {
    return getConfig().enabled;
}

function getTargetOrganizationId(broadcastOrganizationId) {
    return getConfig().organizationIdOverride || broadcastOrganizationId;
}

function buildPath(pathTemplate, params = {}) {
    let path = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`;

    Object.entries(params).forEach(([key, value]) => {
        path = path.replace(`:${key}`, encodeURIComponent(String(value)));
    });

    return path;
}

function extractItems(payload, preferredKeys = []) {
    if (Array.isArray(payload)) return payload;

    for (const key of preferredKeys) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }

    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.results)) return payload.results;

    return [];
}

function pickText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.text_body === 'string') return value.text_body;
    if (typeof value.caption === 'string') return value.caption;
    if (typeof value.body === 'string') return value.body;
    if (typeof value.message === 'string') return value.message;
    if (typeof value.template?.body === 'string') return value.template.body;
    if (typeof value.template?.name === 'string') return `[Template] ${value.template.name}`;
    if (typeof value.interactive?.body?.text === 'string') return value.interactive.body.text;
    if (typeof value.button?.text === 'string') return value.button.text;
    return '[Media]';
}

function getContactFromConversation(conversation) {
    return (
        conversation.contact ||
        conversation.contacts ||
        conversation.customer ||
        conversation.lead ||
        {}
    );
}

function normalizeConversation(conversation) {
    const contact = getContactFromConversation(conversation);
    const contactId = contact.id || conversation.contact_id || conversation.wa_id || conversation.phone || conversation.id;
    const displayName = contact.name || contact.full_name || conversation.contact_name || conversation.name || contact.phone || conversation.phone || 'WhatsApp Contact';
    const phone = contact.phone || contact.wa_id || conversation.phone || conversation.wa_id || conversation.recipient_phone || '';
    const lastMessage = conversation.last_message_preview || conversation.last_message || conversation.preview || conversation.lastMessage || conversation.text_body || conversation.content || '';

    return {
        id: `gap:${conversation.id}`,
        external_id: conversation.id,
        source: 'gap_whatsapp',
        channel: 'whatsapp',
        unread_count: Number(conversation.unread_for_user || conversation.unread_count || conversation.unread || 0),
        last_message_at: conversation.last_message_at || conversation.updated_at || conversation.created_at || new Date().toISOString(),
        last_message_preview: pickText(lastMessage),
        contacts: {
            id: contactId,
            name: displayName,
            custom_name: contact.custom_name || null,
            phone,
            wa_id: contact.wa_id || phone,
            channel_user_id: contact.wa_id || phone,
            profile_pic: contact.profile_photo_url || contact.profile_pic || contact.avatar_url || null,
        },
    };
}

function normalizeMessage(message) {
    const direction = message.direction || (message.from_me || message.is_from_business ? 'outbound' : 'inbound');
    const content = pickText(message.text_body || message.content || message.text || message.body || message.message);

    return {
        id: `gap:${message.id || message.message_id || message.wa_message_id || Date.now()}`,
        external_id: message.id || message.message_id || message.wa_message_id,
        channel: 'whatsapp',
        direction,
        content,
        status: message.status || 'sent',
        created_at: message.created_at || message.timestamp || new Date().toISOString(),
    };
}

async function request({ method = 'GET', path, token, params, data }) {
    const config = getConfig();
    if (!config.enabled) {
        const error = new Error('GAP WhatsApp integration is not configured.');
        error.code = 'GAP_WHATSAPP_DISABLED';
        throw error;
    }

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (config.apiKey) headers['x-api-key'] = config.apiKey;

    const response = await axios({
        method,
        url: `${config.baseUrl}${path}`,
        params,
        data,
        headers,
        timeout: config.timeoutMs,
    });

    return response.data;
}

async function listConversations({ organizationId, token }) {
    const config = getConfig();
    const payload = await request({
        path: config.conversationsPath,
        token,
        params: {
            organization_id: getTargetOrganizationId(organizationId),
            channel: 'whatsapp',
        },
    });

    return extractItems(payload, ['conversations']).map(normalizeConversation);
}

async function listMessages({ conversationId, token }) {
    const config = getConfig();
    const externalConversationId = String(conversationId).replace(/^gap:/, '');
    const payload = await request({
        path: buildPath(config.messagesPath, { conversationId: externalConversationId }),
        token,
        params: {
            limit: config.messagesLimit,
        },
    });

    return extractItems(payload, ['messages']).map(normalizeMessage);
}

async function sendMessage({ conversationId, text, token, organizationId }) {
    const config = getConfig();
    const externalConversationId = String(conversationId).replace(/^gap:/, '');
    const payload = await request({
        method: 'POST',
        path: buildPath(config.sendMessagePath, { conversationId: externalConversationId }),
        token,
        data: {
            text,
            message: text,
            organization_id: getTargetOrganizationId(organizationId),
        },
    });

    const message = payload?.message || payload?.data || payload;
    return normalizeMessage({
        ...message,
        content: message?.content || message?.text || text,
        direction: message?.direction || 'outbound',
    });
}

module.exports = {
    isEnabled,
    listConversations,
    listMessages,
    sendMessage,
};
