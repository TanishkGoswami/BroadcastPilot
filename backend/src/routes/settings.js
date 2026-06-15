const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Save or Update Client Email Settings (Contact Info)
router.post('/email', async (req, res) => {
    try {
        const { organization_id: organizationId, role } = req.user;
        const { senderName, contactAddress, brandingEnabled } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only workspace owners can update channel settings' });
        }

        if (!organizationId || !senderName || !contactAddress) {
            return res.status(400).json({ error: 'Missing required contact information' });
        }

        const { data, error } = await supabase
            .from('b_email_credentials')
            .upsert({
                organization_id: organizationId,
                smtp_user: senderName, // Storing Sender Name here
                from_email: contactAddress, // Storing Contact Address here
                smtp_host: brandingEnabled ? 'true' : 'false', // Storing branding flag here
                smtp_port: 0, // Dummy value to satisfy NOT NULL
                smtp_pass: '', // Dummy value to satisfy NOT NULL
                updated_at: new Date().toISOString()
            }, { onConflict: 'organization_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Email credentials successfully saved',
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
