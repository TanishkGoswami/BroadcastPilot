const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Get all conversations for an organization, including contact info
router.get('/conversations/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        
        const { data, error } = await supabase
            .from('b_conversations')
            .select(`
                *,
                b_contacts (
                    id,
                    name,
                    custom_name,
                    phone,
                    wa_id
                )
            `)
            .eq('organization_id', organizationId)
            .order('last_message_at', { ascending: false });

        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error("Error fetching conversations:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get messages for a specific conversation
router.get('/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        const { data, error } = await supabase
            .from('b_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true }); // Oldest to newest for chat flow

        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
