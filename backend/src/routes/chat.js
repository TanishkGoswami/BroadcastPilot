const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../supabaseClient');

// Get Conversations for Org
router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;

        const { data, error } = await supabase
            .from('w_conversations')
            .select(`
                *,
                contacts:w_contacts(id, name, wa_id, custom_name, phone)
            `)
            .eq('organization_id', organization_id)
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        // Map them to include a 'channel' field for the frontend UI (defaulting to whatsapp)
        const conversations = data.map(conv => ({
            ...conv,
            channel: 'whatsapp'
        }));

        res.json(conversations);
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
            .from('w_messages')
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

module.exports = router;
