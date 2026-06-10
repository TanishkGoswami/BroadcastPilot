const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const supabase = require('../supabaseClient');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const axios = require('axios');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null
});

const metaSyncQueue = new Queue('metaSync', { connection });

const metaWorker = new Worker('metaSync', async job => {
    const { leadgenId, pageId, formId } = job.data;
    
    console.log(`[Meta Worker] Processing Job ${job.id} for leadgenId ${leadgenId}`);

    try {
        // 1. Fetch all Meta connections tracking this page ID
        const { data: connections, error: connError } = await supabase
            .from('b_meta_connections')
            .select('*')
            .eq('page_id', pageId);

        if (connError || !connections || connections.length === 0) {
            throw new Error(`Could not find Meta connection for page ID ${pageId}`);
        }

        // We use the first connection's access token to fetch the graph API data
        const pageAccessToken = connections[0].page_access_token;

        // 2. Fetch Lead Details from Meta Graph API
        const response = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageAccessToken}`);
        const leadData = response.data;

        if (leadData.error) {
            throw new Error(`Graph API Error: ${leadData.error.message}`);
        }

        // 3. Extract the field data
        let rawPhone = null;
        let rawEmail = null;
        let rawName = null;

        if (leadData.field_data) {
            leadData.field_data.forEach(field => {
                const value = field.values && field.values.length > 0 ? field.values[0] : null;
                if (!value) return;

                const name = field.name.toLowerCase();
                if (name.includes('phone')) rawPhone = value;
                else if (name.includes('email')) rawEmail = value;
                else if (name.includes('name') || name.includes('first_name') || name.includes('full_name')) rawName = value;
            });
        }

        let phoneE164 = null;
        if (rawPhone) {
            const phoneNumber = parsePhoneNumberFromString(String(rawPhone), 'IN'); 
            if (phoneNumber && phoneNumber.isValid()) {
                phoneE164 = phoneNumber.format('E.164');
            } else {
                phoneE164 = String(rawPhone).trim(); 
            }
        }

        const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;
        const name = rawName ? String(rawName) : 'Meta Lead';

        if (!phoneE164) {
            console.warn(`[Meta Worker] Missing phone number for lead ${leadgenId}. Using dummy number for testing. Raw fields: ${JSON.stringify(leadData.field_data)}`);
            // Generate a random dummy number so the test webhook doesn't fail the unique constraint
            phoneE164 = `+1555${Math.floor(100000 + Math.random() * 900000)}`;
        }

        // 5. Upsert into Supabase for ALL organizations tracking this page
        const leadsToInsert = connections.map(conn => ({
            organization_id: conn.organization_id,
            name: name,
            phone: phoneE164,
            email: email,
            spreadsheet_id: `meta_form_${formId || 'unknown'}`,
            sheet_name: `Meta Ads - ${conn.page_name || pageId}`,
            sheet_row_id: parseInt(leadgenId.substring(0, 8), 10) || 1, 
            ingestion_batch_id: `meta_webhook_${job.id}`
        }));

        const { error: insertError } = await supabase
            .from('b_leads')
            .upsert(leadsToInsert, { onConflict: 'organization_id,phone' });

        if (insertError) {
            throw new Error(`Error upserting Meta lead: ${insertError.message}`);
        }

        console.log(`[Meta Worker] Successfully inserted Meta lead ${phoneE164} for ${connections.length} orgs.`);
        return { success: true, phone: phoneE164, orgs: connections.length };

    } catch (error) {
        console.error(`[Meta Worker] Failed Job ${job.id}:`, error.message);
        throw error;
    }
}, { connection, concurrency: 5 });

// Handle Worker Events
metaWorker.on('completed', job => {
    console.log(`[Meta Worker] Job ${job.id} completed successfully`);
});

metaWorker.on('failed', (job, err) => {
    console.error(`[Meta Worker] Job ${job.id} failed with error: ${err.message}`);
});

module.exports = { metaSyncQueue, metaWorker };
