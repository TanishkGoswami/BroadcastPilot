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
            .select('*')
            .eq('organization_id', organization_id);

        if (error) throw error;

        // Fetch emails from auth.users manually since cross-schema joins fail in PostgREST
        const teamWithEmails = await Promise.all(data.map(async (member) => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(member.user_id);
                return {
                    ...member,
                    auth_users: { email: user?.email || 'Unknown' }
                };
            } catch (err) {
                return { ...member, auth_users: { email: 'Unknown' } };
            }
        }));

        res.json(teamWithEmails);
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

        let newUserId = null;
        let finalLink = null;

        // 1. Generate an invite link (assumes new user)
        const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
            type: 'invite',
            email: email
        });

        if (authError) {
            // If user already exists, generateLink for invite throws "already been registered"
            if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
                // Generate a magic link instead. This gives us their user_id and a login link!
                const { data: magicData, error: magicError } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email
                });

                if (magicError) throw magicError;
                
                newUserId = magicData.user.id;
                finalLink = magicData.properties.action_link;
            } else {
                throw authError;
            }
        } else {
            newUserId = authData.user.id;
            finalLink = authData.properties.action_link;
        }

        // 2. Add them to b_organization_members
        const { error: memberError } = await supabase
            .from('b_organization_members')
            .upsert({ 
                organization_id, 
                user_id: newUserId, 
                role: 'agent' 
            }, { onConflict: 'organization_id,user_id' });

        if (memberError) throw memberError;

        res.json({ 
            success: true, 
            message: 'Agent added successfully!',
            link: finalLink
        });
    } catch (error) {
        console.error('Invite Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
