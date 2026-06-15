const { Worker } = require('bullmq');
const twilio = require('twilio');
const supabase = require('../supabaseClient');
const { createRedisConnection } = require('../utils/redisConnection');

const connection = createRedisConnection();

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

        // 2. Initialize Twilio client using MASTER SaaS Credentials
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        
        if (!accountSid || !authToken) {
            throw new Error('Master Twilio credentials not found in backend .env');
        }

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

        return { success: true, messageId: message.sid };

    } catch (error) {
        console.error(`[SMS Worker] Failed Job ${job.id}:`, error.message);

        // 5. Log Failure in b_delivery_logs
        await supabase
            .from('b_delivery_logs')
            .insert({
                campaign_id: campaignId,
                lead_id: leadId,
                channel: 'sms',
                contact: toPhone,
                status: 'failed',
                error: error.message
            });

        throw error; // Let BullMQ handle retries if configured
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
