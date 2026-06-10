const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { sheetSyncQueue } = require('../workers/sheetWorker');

// Endpoint for Google Drive Push Notifications
// Setup instructions: You must register this URL in your Google Cloud Project
// and use the drive.files.watch API to subscribe to sheet changes.
router.post('/google-drive', async (req, res) => {
    try {
        // Google Drive sends headers starting with X-Goog-
        const channelId = req.header('X-Goog-Channel-ID');
        const resourceState = req.header('X-Goog-Resource-State');
        const fileId = req.header('X-Goog-Resource-ID');

        console.log(`[Webhook] Received Google Drive notification for channel ${channelId}, state: ${resourceState}`);

        // We only care about update events
        if (resourceState === 'update' || resourceState === 'change') {
            // Find the connection associated with this channelId or fileId
            // You will need to store channel_id in b_sheet_connections when you call watch()
            // For now, we will look it up by spreadsheet_id if we assume fileId is the spreadsheetId 
            // Note: X-Goog-Resource-ID is an opaque ID. We actually need to map channelId to our DB.
            
            const { data: conn, error } = await supabase
                .from('b_sheet_connections')
                .select('*')
                // Assuming you add 'webhook_channel_id' to b_sheet_connections
                .eq('webhook_channel_id', channelId) 
                .single();

            if (error || !conn) {
                console.error('[Webhook] Could not find sheet connection for channel:', channelId);
                return res.status(404).send('Not Found');
            }

            // Push to the queue
            await sheetSyncQueue.add('syncSheet', { conn });
            console.log(`[Webhook] Queued instant sync for sheet ${conn.spreadsheet_id}`);
        }

        // Must return 200 OK quickly so Google knows we received it
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Webhook] Error processing notification:', error);
        res.status(500).send('Error');
    }
});

module.exports = router;
