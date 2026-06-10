const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Get all team members for an organization
router.get('/', async (req, res) => {
    try {
        const { organization_id, role } = req.user;

        if (!organization_id) {
            return res.status(400).json({ error: 'No organization linked to user.' });
        }

        // Both owners and agents can view the team (or maybe just owners, but agents might need it for assignments)
        const { data, error } = await supabase
            .from('b_organization_members')
            .select(`
                id,
                organization_id,
                user_id,
                role,
                created_at,
                auth_users:user_id ( email )
            `)
            .eq('organization_id', organization_id);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Invite a new team member
router.post('/invite', async (req, res) => {
    try {
        const { organization_id, role } = req.user;
        const { email } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only owners can invite team members.' });
        }

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        // 1. Invite user via Supabase Auth (sends an invite email)
        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email);

        if (authError) {
            // If user already exists, admin.inviteUserByEmail might fail or return the user. 
            // In a real app we'd handle existing users gracefully. For now, we'll try to find them.
            if (authError.message.includes('already exists')) {
                 return res.status(400).json({ error: 'User already has an account. Support for adding existing users coming soon!' });
            }
            throw authError;
        }

        const newUserId = authData.user.id;

        // 2. Add them to b_organization_members
        const { error: memberError } = await supabase
            .from('b_organization_members')
            .upsert({ 
                organization_id, 
                user_id: newUserId, 
                role: 'agent' 
            }, { onConflict: 'organization_id,user_id' });

        if (memberError) throw memberError;

        res.json({ success: true, message: 'Invitation sent successfully!' });
    } catch (error) {
        console.error('Invite Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
