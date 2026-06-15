const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../supabaseClient');
const { requireWorkspace } = require('../middleware/authMiddleware');

const INVITE_EXPIRY_DAYS = 7;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function hashInviteToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function getFrontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
}

// Accepting an invite must work before the user has a BroadcastPilot workspace.
router.post('/accept-invite', async (req, res) => {
    try {
        const { token } = req.body;
        const userEmail = normalizeEmail(req.user.email);

        if (!token) {
            return res.status(400).json({ error: 'Invite token is required.' });
        }

        if (!userEmail) {
            return res.status(400).json({ error: 'Your account does not have an email address.' });
        }

        const tokenHash = hashInviteToken(token);

        const { data: invite, error: inviteError } = await supabase
            .from('b_agent_invites')
            .select('*')
            .eq('token_hash', tokenHash)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        if (inviteError) throw inviteError;

        if (!invite) {
            return res.status(404).json({ error: 'This invite link is invalid or expired.' });
        }

        if (normalizeEmail(invite.email) !== userEmail) {
            return res.status(403).json({
                error: `This invite was sent to ${invite.email}. Please log in with that email address.`,
            });
        }

        const { error: memberError } = await supabase
            .from('b_organization_members')
            .upsert({
                organization_id: invite.organization_id,
                user_id: req.user.id,
                role: invite.role || 'agent',
            }, { onConflict: 'organization_id,user_id' });

        if (memberError) throw memberError;

        const { error: updateError } = await supabase
            .from('b_agent_invites')
            .update({
                accepted_at: new Date().toISOString(),
                accepted_by: req.user.id,
            })
            .eq('id', invite.id);

        if (updateError) throw updateError;

        res.json({
            success: true,
            organization_id: invite.organization_id,
            role: invite.role || 'agent',
            message: 'Invite accepted. Welcome to BroadcastPilot.',
        });
    } catch (error) {
        console.error('Accept Invite Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.use(requireWorkspace);

// Get all team members for an organization
router.get('/', async (req, res) => {
    try {
        const { organization_id, role } = req.user;

        if (!organization_id) {
            return res.status(400).json({ error: 'No organization linked to user.' });
        }

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only owners can view team settings.' });
        }

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

        const { data: pendingInvites, error: inviteError } = await supabase
            .from('b_agent_invites')
            .select('id, email, role, expires_at, created_at')
            .eq('organization_id', organization_id)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (inviteError) {
            if (inviteError.code === '42P01' || inviteError.message?.includes('b_agent_invites')) {
                console.warn('b_agent_invites table is missing. Run backend/supabase_schema.sql to enable agent invites.');
                return res.json(teamWithEmails);
            }

            throw inviteError;
        }

        const pendingMembers = (pendingInvites || []).map((invite) => ({
            id: invite.id,
            user_id: null,
            role: invite.role,
            created_at: invite.created_at,
            expires_at: invite.expires_at,
            pending: true,
            auth_users: { email: invite.email }
        }));

        res.json([...teamWithEmails, ...pendingMembers]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Invite a new team member
router.post('/invite', async (req, res) => {
    try {
        const { organization_id, role } = req.user;
        const email = normalizeEmail(req.body.email);

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only owners can invite team members.' });
        }

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const { error: inviteError } = await supabase
            .from('b_agent_invites')
            .insert({
                organization_id,
                email,
                role: 'agent',
                token_hash: hashInviteToken(token),
                invited_by: req.user.id,
                expires_at: expiresAt,
            });

        if (inviteError) {
            if (inviteError.code === '42P01' || inviteError.message?.includes('b_agent_invites')) {
                return res.status(500).json({
                    error: 'Agent invite table is not installed. Run backend/supabase_schema.sql in Supabase SQL Editor first.',
                });
            }

            throw inviteError;
        }

        const finalLink = `${getFrontendUrl().replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`;

        res.json({ 
            success: true, 
            message: 'Agent invite link generated successfully.',
            link: finalLink,
            expiresAt,
        });
    } catch (error) {
        console.error('Invite Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove an active agent membership or cancel a pending invite
router.delete('/members/:memberId', async (req, res) => {
    try {
        const { organization_id, role } = req.user;
        const { memberId } = req.params;
        const { pending } = req.query;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only owners can remove team members.' });
        }

        if (!memberId) {
            return res.status(400).json({ error: 'Member id is required.' });
        }

        if (pending === 'true') {
            const { data, error } = await supabase
                .from('b_agent_invites')
                .delete()
                .eq('id', memberId)
                .eq('organization_id', organization_id)
                .is('accepted_at', null)
                .select('id');

            if (error) throw error;

            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'Pending invite not found.' });
            }

            return res.json({ success: true, message: 'Pending invite cancelled.' });
        }

        const { data: member, error: memberLookupError } = await supabase
            .from('b_organization_members')
            .select('id, role, user_id')
            .eq('id', memberId)
            .eq('organization_id', organization_id)
            .maybeSingle();

        if (memberLookupError) throw memberLookupError;

        if (!member) {
            return res.status(404).json({ error: 'Team member not found.' });
        }

        if (member.role === 'owner') {
            return res.status(400).json({ error: 'Owner cannot be removed from their own workspace.' });
        }

        const { error: deleteError } = await supabase
            .from('b_organization_members')
            .delete()
            .eq('id', memberId)
            .eq('organization_id', organization_id);

        if (deleteError) throw deleteError;

        await supabase
            .from('b_leads')
            .update({ agent_id: null })
            .eq('organization_id', organization_id)
            .eq('agent_id', member.user_id);

        res.json({ success: true, message: 'Agent removed and their assigned leads were unassigned.' });
    } catch (error) {
        console.error('Remove Team Member Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
