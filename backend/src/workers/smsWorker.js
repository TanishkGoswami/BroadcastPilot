const { Worker } = require('bullmq');
const twilio = require('twilio');
const supabase = require('../supabaseClient');
const { createRedisConnection } = require('../utils/redisConnection');
const { updateCampaignStatusFromLogs } = require('../services/campaignStatus');

const connection = createRedisConnection();

function createSmsConfigError(message) {
    const error = new Error(message);
    error.code = 'SMS_PROVIDER_CONFIG';
    return error;
}

function getTwilioPlatformConfig() {
    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();

    if (!accountSid || !authToken) {
        throw createSmsConfigError('Twilio platform credentials are missing. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend .env.');
    }

    if (!/^AC[a-f0-9]{32}$/i.test(accountSid)) {
        throw createSmsConfigError('Twilio platform credentials are invalid. TWILIO_ACCOUNT_SID must be a valid Account SID.');
    }

    return { accountSid, authToken };
}

function isTwilioAuthError(error) {
    return error?.status === 401
        || error?.code === 20003
        || String(error?.message || '').toLowerCase() === 'authenticate';
}

function isProviderConfigError(error) {
    return error?.code === 'SMS_PROVIDER_CONFIG' || isTwilioAuthError(error);
}

function getSafeSmsError(error) {
    if (error?.code === 'SMS_PROVIDER_CONFIG') return error.message;

    if (isTwilioAuthError(error)) {
        return 'Twilio authentication failed. Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend .env, then reactivate the SMS channel.';
    }

    return error.message || 'SMS delivery failed';
}

async function markSmsConnectionFailed(organizationId, safeError) {
    if (!organizationId) return;

    const { error } = await supabase
        .from('b_channel_connections')
        .update({
            status: 'failed',
            verification_status: 'provider_error',
            last_error: safeError,
            updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .eq('channel', 'sms')
        .eq('provider', 'twilio');

    if (error && error.code !== '42P01') {
        console.error('[SMS Worker] Failed to update SMS channel status:', error.message);
    }
}

// Process SMS jobs
const smsWorker = new Worker('smsQueue', async job => {
    const { leadId, organizationId, campaignId, toPhone, messageContent } = job.data;
    
    console.log(`[SMS Worker] Processing Job ${job.id} for lead ${leadId}`);

    try {
        // 1. Fetch Twilio Credentials for this organization (to get their assigned from_number)
        const { data: creds, error: credsError } = await supabase
            .from('b_sms_credentials')
            .select('*')
            .eq('organization_id', organizationId)
            .single();

        if (credsError || !creds) {
            throw new Error(`SMS assigned number not found for org ${organizationId}`);
        }

        // 2. Initialize Twilio client using platform-managed SaaS credentials.
        const { accountSid, authToken } = getTwilioPlatformConfig();
        const client = twilio(accountSid, authToken);

        // 3. Send SMS
        const message = await client.messages.create({
            body: messageContent,
            from: creds.from_number,
            to: toPhone
        });

        console.log(`[SMS Worker] Sent SMS to ${toPhone}. SID: ${message.sid}`);

        // 4. Log Success in b_delivery_logs
        await supabase
            .from('b_delivery_logs')
            .insert({
                campaign_id: campaignId,
                lead_id: leadId,
                channel: 'sms',
                contact: toPhone,
                message_id: message.sid,
                status: 'sent'
            });
        await updateCampaignStatusFromLogs(campaignId);

        return { success: true, messageId: message.sid };

    } catch (error) {
        const safeError = getSafeSmsError(error);

        if (isProviderConfigError(error)) {
            await markSmsConnectionFailed(organizationId, safeError);
        }

        console.error(`[SMS Worker] Failed Job ${job.id}:`, {
            message: safeError,
            providerStatus: error.status,
            providerCode: error.code,
            providerMoreInfo: error.moreInfo,
        });

        // 5. Log Failure in b_delivery_logs
        await supabase
            .from('b_delivery_logs')
            .insert({
                campaign_id: campaignId,
                lead_id: leadId,
                channel: 'sms',
                contact: toPhone,
                status: 'failed',
                error: safeError
            });
        await updateCampaignStatusFromLogs(campaignId);

        throw new Error(safeError); // Let BullMQ handle retries if configured
    }
}, { connection });

// Handle Worker Events
smsWorker.on('completed', job => {
    console.log(`[SMS Worker] Job ${job.id} completed successfully`);
});

smsWorker.on('failed', (job, err) => {
    console.error(`[SMS Worker] Job ${job.id} failed with error: ${err.message}`);
});

module.exports = smsWorker;
