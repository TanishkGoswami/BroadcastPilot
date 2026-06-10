const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const supabase = require('../supabaseClient');
const xlsx = require('xlsx');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null
});

const sheetSyncQueue = new Queue('sheetSync', { connection });

const sheetWorker = new Worker('sheetSync', async job => {
    const { conn } = job.data;
    
    console.log(`[Sheet Worker] Processing Job ${job.id} for sheet ${conn.spreadsheet_id}`);

    try {
        const url = `https://docs.google.com/spreadsheets/d/${conn.spreadsheet_id}/export?format=csv`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch sheet ${conn.spreadsheet_id} (Status: ${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        if (!rows || rows.length <= 1) {
            console.log(`[Sheet Worker] No data found in sheet ${conn.spreadsheet_id}`);
            return { success: true, inserted: 0 };
        }

        const headers = rows[0] || [];
        const mapping = conn.mapping;

        const nameIdx = headers.indexOf(mapping.nameCol);
        const phoneIdx = headers.indexOf(mapping.phoneCol);
        const emailIdx = headers.indexOf(mapping.emailCol);

        const leadsToInsert = [];
        const batchId = `worker_batch_${Date.now()}`;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const name = nameIdx !== -1 ? row[nameIdx] : null;
            const phoneRaw = phoneIdx !== -1 ? row[phoneIdx] : null;
            const emailRaw = emailIdx !== -1 ? row[emailIdx] : null;

            if (!phoneRaw && !emailRaw) continue;

            let phoneE164 = null;
            if (phoneRaw) {
                const phoneNumber = parsePhoneNumberFromString(String(phoneRaw), 'IN');
                if (phoneNumber && phoneNumber.isValid()) {
                    phoneE164 = phoneNumber.format('E.164');
                }
            }

            const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;

            // Only insert if they have a valid phone number, 
            // otherwise the unique constraint (org_id, phone) gets bypassed by 'null' phones
            if (phoneE164) {
                leadsToInsert.push({
                    organization_id: conn.organization_id,
                    name: name ? String(name) : 'Unknown',
                    phone: phoneE164,
                    email: email,
                    spreadsheet_id: conn.spreadsheet_id,
                    sheet_name: sheetName,
                    sheet_row_id: i + 1,
                    ingestion_batch_id: batchId
                });
            }
        }

        if (leadsToInsert.length > 0) {
            // By omitting `status` from the payload and removing ignoreDuplicates, 
            // new rows will default to 'PENDING', and existing rows will get their name/email updated 
            // WITHOUT overwriting their current status!
            const { error: insertError } = await supabase
                .from('b_leads')
                .upsert(leadsToInsert, { onConflict: 'organization_id,phone' });

            if (insertError) {
                throw new Error(`Error upserting leads: ${insertError.message}`);
            } else {
                console.log(`[Sheet Worker] Processed sheet ${conn.spreadsheet_id}. Upserted ${leadsToInsert.length} leads.`);
                return { success: true, inserted: leadsToInsert.length };
            }
        }
        
        return { success: true, inserted: 0 };

    } catch (error) {
        console.error(`[Sheet Worker] Failed Job ${job.id}:`, error.message);
        throw error; // Let BullMQ handle retries if configured
    }
}, { connection, concurrency: 5 });

// Handle Worker Events
sheetWorker.on('completed', job => {
    console.log(`[Sheet Worker] Job ${job.id} completed successfully`);
});

sheetWorker.on('failed', (job, err) => {
    console.error(`[Sheet Worker] Job ${job.id} failed with error: ${err.message}`);
});

module.exports = { sheetSyncQueue, sheetWorker };
