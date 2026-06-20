const cron = require('node-cron');
const supabase = require('../supabaseClient');
const { sheetSyncQueue } = require('./sheetWorker');

async function syncAllSheets() {
    console.log('[Cron] Starting Google Sheets Sync Job (Queueing)...');
    try {
        // 1. Fetch all active sheet connections
        const { data: connections, error } = await supabase
            .from('b_sheet_connections')
            .select('*');

        if (error) {
            console.error('[Cron] Error fetching connections:', error);
            return;
        }

        if (!connections || connections.length === 0) {
            console.log('[Cron] No active sheet connections found.');
            return;
        }

        console.log(`[Cron] Found ${connections.length} active connection(s). Queueing jobs...`);

        // 2. Queue each connection for the worker to process
        for (const conn of connections) {
            if (conn.spreadsheet_id === 'GLOBAL_OAUTH') continue;
            
            try {
                await sheetSyncQueue.add('syncSheet', { conn }, {
                    jobId: `sheet-sync-${conn.id}`,
                    removeOnComplete: true,
                    removeOnFail: false
                });
                console.log(`[Cron] Queued sync for sheet ${conn.spreadsheet_id}`);
            } catch (err) {
                console.error(`[Cron] Error queueing sheet connection ${conn.id}:`, err);
            }
        }
        
        console.log('[Cron] Google Sheets Sync Job Queueing Finished.');
    } catch (err) {
        console.error('[Cron] Fatal Error in Sync Job:', err);
    }
}

// Start the cron scheduler (Runs every 5 minutes as a fallback)
function startCron() {
    console.log('✅ Google Sheets Auto-Sync Scheduler Initialized (Runs every 5 minutes)');
    cron.schedule('*/5 * * * *', syncAllSheets);
    
    // Optional: Run it once immediately on startup just to be sure it's working
    // syncAllSheets(); 
}

module.exports = { startCron };

