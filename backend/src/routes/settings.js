const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

router.get('/status', async (req, res) => {
    try {
        const { organization_id: organizationId } = req.user;

        if (!organizationId) {
            return res.status(400).json({ error: 'No organization linked to user.' });
        }

        const [emailResult, smsResult] = await Promise.all([
            supabase
                .from('b_email_credentials')
                .select('id, smtp_user, from_email, updated_at')
                .eq('organization_id', organizationId)
                .maybeSingle(),
            supabase
                .from('b_sms_credentials')
                .select('id, from_number, updated_at')
                .eq('organization_id', organizationId)
                .maybeSingle()
        ]);

        if (emailResult.error) throw emailResult.error;
        if (smsResult.error) throw smsResult.error;

        res.json({
            success: true,
            email: {
                connected: Boolean(emailResult.data?.from_email),
                senderName: emailResult.data?.smtp_user || '',
                senderEmail: emailResult.data?.from_email || '',
            },
            sms: {
                connected: Boolean(smsResult.data?.from_number),
                fromNumber: smsResult.data?.from_number || '',
            }
        });
    } catch (error) {
        console.error('Settings Status Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save or update the sender identity used for email broadcasts.
router.post('/email', async (req, res) => {
    try {
        const { organization_id: organizationId, role } = req.user;
        const { senderName, senderEmail } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only workspace owners can update channel settings' });
        }

        if (!organizationId || !senderName || !senderEmail) {
            return res.status(400).json({ error: 'Sender name and sender email are required' });
        }

        if (!isValidEmail(senderEmail)) {
            return res.status(400).json({ error: 'Enter a valid sender email address' });
        }

        const normalizedEmail = String(senderEmail).trim().toLowerCase();

        const { data, error } = await supabase
            .from('b_email_credentials')
            .upsert({
                organization_id: organizationId,
                smtp_user: senderName.trim(),
                from_email: normalizedEmail,
                smtp_host: '',
                smtp_port: 0,
                smtp_pass: '',
                updated_at: new Date().toISOString()
            }, { onConflict: 'organization_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Sender identity successfully saved',
            credentials: { id: data.id, organization_id: data.organization_id }
        });

    } catch (error) {
        console.error('Settings Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Twilio SMS Credentials
router.post('/sms', async (req, res) => {
    try {
        const { organization_id: organizationId, role } = req.user;
        const { accountSid, authToken, fromNumber } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only workspace owners can update channel settings' });
        }

        if (!organizationId || !accountSid || !authToken || !fromNumber) {
            return res.status(400).json({ error: 'Missing required Twilio credentials' });
        }

        const { data, error } = await supabase
            .from('b_sms_credentials')
            .upsert({
                organization_id: organizationId,
                provider: 'twilio',
                account_sid: accountSid,
                auth_token: authToken,
                from_number: fromNumber,
                updated_at: new Date().toISOString()
            }, { onConflict: 'organization_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'SMS credentials successfully saved'
        });

    } catch (error) {
        console.error('SMS Settings Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
