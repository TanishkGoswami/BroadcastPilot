const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const {
    getEmailStatus,
    getSmsStatus,
    upsertEmailConnection,
    upsertSmsConnection,
} = require('../services/channelConnections');

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

        const [emailConnection, smsConnection] = await Promise.all([
            getEmailStatus(organizationId, emailResult.data),
            getSmsStatus(organizationId, smsResult.data),
        ]);

        res.json({
            success: true,
            email: {
                connected: emailConnection?.status === 'active',
                status: emailConnection?.status || 'not_connected',
                verificationStatus: emailConnection?.verification_status || 'not_started',
                senderName: emailConnection?.display_name || emailResult.data?.smtp_user || '',
                senderEmail: emailConnection?.sender_identity || emailResult.data?.from_email || '',
                lastError: emailConnection?.last_error || '',
                metadata: emailConnection?.metadata || {},
            },
            sms: {
                connected: smsConnection?.status === 'active',
                status: smsConnection?.status || 'not_connected',
                verificationStatus: smsConnection?.verification_status || 'not_started',
                fromNumber: smsConnection?.sender_identity || smsResult.data?.from_number || '',
                lastError: smsConnection?.last_error || '',
                metadata: smsConnection?.metadata || {},
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
        const emailConnection = await upsertEmailConnection(organizationId, {
            senderName,
            senderEmail: normalizedEmail,
        });

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
            credentials: { id: data.id, organization_id: data.organization_id },
            connection: emailConnection,
        });

    } catch (error) {
        console.error('Settings Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Twilio SMS Credentials
router.post('/sms', async (req, res) => {
    try {
        const { organization_id: organizationId, role, id: userId } = req.user;
        const {
            accountSid,
            authToken,
            fromNumber,
            businessName,
            website,
            useCase,
            sampleMessage,
            optInDescription,
        } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only workspace owners can update channel settings' });
        }

        const assignedNumber = fromNumber || process.env.TWILIO_PHONE_NUMBER;

        if (!organizationId || !assignedNumber) {
            return res.status(400).json({ error: 'No platform SMS number is configured for this workspace' });
        }

        const smsConnection = await upsertSmsConnection(organizationId, {
            fromNumber: assignedNumber,
            businessName,
            website,
            useCase,
            sampleMessage,
            optInDescription,
            requestedBy: userId,
        });

        const { data, error } = await supabase
            .from('b_sms_credentials')
            .upsert({
                organization_id: organizationId,
                provider: 'twilio',
                account_sid: accountSid || 'PLATFORM_TWILIO',
                auth_token: authToken || 'PLATFORM_MANAGED',
                from_number: assignedNumber,
                updated_at: new Date().toISOString()
            }, { onConflict: 'organization_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: smsConnection.status === 'active'
                ? 'SMS channel is active'
                : 'SMS compliance request saved. Complete verification before broadcasting.',
            connection: smsConnection,
            credentials: { id: data.id, organization_id: data.organization_id },
        });

    } catch (error) {
        console.error('SMS Settings Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
