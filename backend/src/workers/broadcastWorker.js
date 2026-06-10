const { Queue, Worker } = require('bullmq');
const axios = require('axios');
const supabase = require('../supabaseClient');
const IORedis = require('ioredis');

// Ensure redis is running locally or provide a connection string
const redisConnection = new IORedis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
        // Prevent infinite fast retries that spam the console
        return Math.min(times * 2000, 10000); 
    }
});

redisConnection.on('error', (err) => {
    // Suppress console spam if Redis is not running locally for UI testing
    if(err.code === 'ECONNREFUSED') return;
    console.error('Redis Error:', err);
});

const broadcastQueue = new Queue('whatsapp-broadcast', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
    }
});

const worker = new Worker('whatsapp-broadcast', async (job) => {
    const { leadId, phone, creds, campaign } = job.data;
    
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${creds.phone_number_id}/messages`,
            {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'template',
                template: {
                    name: campaign.template_name,
                    language: { code: campaign.template_language }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${creds.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // Log Success
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaign.id,
            lead_id: leadId,
            phone: phone,
            meta_message_id: response.data.messages[0].id,
            status: 'SENT'
        });
        
    } catch (error) {
        // Extract Meta error
        const metaError = error.response?.data?.error?.message || error.message;
        
        // Log Failure
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaign.id,
            lead_id: leadId,
            phone: phone,
            status: 'FAILED',
            error: metaError
        });
        
        throw error; // Triggers BullMQ to retry if attempts < 3
    }
}, {
    connection: redisConnection,
    limiter: {
        max: 50,      // Max 50 messages
        duration: 1000 // per second
    }
});

worker.on('failed', (job, err) => {
    console.error(`${job.id} has failed with ${err.message}`);
});

module.exports = { broadcastQueue };
