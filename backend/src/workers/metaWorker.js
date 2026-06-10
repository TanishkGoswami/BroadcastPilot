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
        // 1. Fetch the Page Access Token from the database
        const { data: conn, error: connError } = await supabase
            .from('b_meta_connections')
            .select('*')
            .eq('page_id', pageId)
            .single();

        if (connError || !conn) {
            throw new Error(`Could not find Meta connection for page ID ${pageId}`);
        }

        const pageAccessToken = conn.page_access_token;

        // 2. Fetch Lead Details from Meta Graph API
        const response = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageAccessToken}`);
        const leadData = response.data;

        if (leadData.error) {
            throw new Error(`Graph API Error: ${leadData.error.message}`);
        }

        // 3. Extract the field data
        // Meta returns an array of field_data objects: [{ name: "email", values: ["test@test.com"] }]
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
                // If it's a completely dummy number or fails strict validation, just save whatever they typed!
                phoneE164 = String(rawPhone).trim(); 
            }
        }

        const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;
        const name = rawName ? String(rawName) : 'Meta Lead';

        if (!phoneE164) {
            console.warn(`[Meta Worker] Ignored lead ${leadgenId} due to missing/invalid phone number.`);
            return { success: true, ignored: true, reason: 'Invalid phone' };
        }

        // 5. Upsert into Supabase
        const leadToInsert = {
            organization_id: conn.organization_id,
            name: name,
            phone: phoneE164,
            email: email,
            spreadsheet_id: `meta_form_${formId || 'unknown'}`,
            sheet_name: `Meta Ads - ${conn.page_name || pageId}`,
            sheet_row_id: parseInt(leadgenId.substring(0, 8), 10) || 1, // Dummy row ID
            ingestion_batch_id: `meta_webhook_${job.id}`
        };

        const { error: insertError } = await supabase
            .from('b_leads')
            .upsert([leadToInsert], { onConflict: 'organization_id,phone' });

        if (insertError) {
            throw new Error(`Error upserting Meta lead: ${insertError.message}`);
        }

        console.log(`[Meta Worker] Successfully inserted Meta lead: ${phoneE164}`);
        return { success: true, phone: phoneE164 };

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
