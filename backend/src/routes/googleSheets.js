const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { google } = require('googleapis');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const supabase = require('../supabaseClient');
const { getNextAgentId, getAgentsList } = require('../utils/assignment');

const upload = multer({ storage: multer.memoryStorage() });

// 1. Ingest via File Upload (CSV/XLSX)
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { organizationId } = req.body;
        const file = req.file;

        if (!organizationId || !file) {
            return res.status(400).json({ error: 'Missing organizationId or file' });
        }

        // Parse Excel/CSV from buffer
        const workbook = xlsx.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; // Take first sheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays (header=1)
        const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length <= 1) {
            return res.status(400).json({ error: 'No data found in file' });
        }

        const leadsToInsert = [];
        const invalidRows = [];
        const batchId = `file_batch_${Date.now()}`;

        // Initialize Round Robin variables
        const agents = await getAgentsList(organizationId);
        let nextAgentIndex = 0;
        if (agents.length > 0) {
            const nextId = await getNextAgentId(organizationId);
            nextAgentIndex = agents.findIndex(a => a.user_id === nextId);
            if (nextAgentIndex === -1) nextAgentIndex = 0;
        }

        // Start at 1 to skip header (Assumes Col 0 is Name, Col 1 is Phone, Col 2 is Email)
        for (let i = 1; i < rows.length; i++) {
            const name = rows[i][0];
            const phoneRaw = rows[i][1];
            const emailRaw = rows[i][2];
            
            if (!phoneRaw && !emailRaw) continue;

            let phoneE164 = null;
            if (phoneRaw) {
                const phoneNumber = parsePhoneNumberFromString(String(phoneRaw), 'IN');
                if (phoneNumber && phoneNumber.isValid()) {
                    phoneE164 = phoneNumber.format('E.164');
                }
            }
            
            const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;

            if (phoneE164 || email) {
                let agent_id = null;
                if (agents.length > 0) {
                    agent_id = agents[nextAgentIndex].user_id;
                    nextAgentIndex = (nextAgentIndex + 1) % agents.length;
                }

                leadsToInsert.push({
                    organization_id: organizationId,
                    name: name ? String(name) : 'Unknown',
                    phone: phoneE164,
                    email: email,
                    status: 'PENDING',
                    agent_id: agent_id,
                    spreadsheet_id: 'FILE_UPLOAD',
                    sheet_name: file.originalname,
                    sheet_row_id: i + 1,
                    ingestion_batch_id: batchId
                });
            } else {
                invalidRows.push({ row: i + 1, phoneRaw, emailRaw });
            }
        }

        if (leadsToInsert.length > 0) {
            const { error } = await supabase
                .from('b_leads')
                .upsert(leadsToInsert, { onConflict: 'organization_id,phone', ignoreDuplicates: true });

            if (error) throw error;
        }

        res.json({
            success: true,
            insertedCount: leadsToInsert.length,
            invalidCount: invalidRows.length,
            invalidRows
        });

    } catch (error) {
        console.error('File Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Fetch Headers from Google Sheet
router.post('/headers', async (req, res) => {
    try {
        const { spreadsheetId } = req.body;
        if (!spreadsheetId) {
            return res.status(400).json({ error: 'Missing spreadsheetId' });
        }

        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(400).json({ error: 'Failed to fetch sheet. Make sure it is set to "Anyone with the link can view".' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'No data found in sheet' });
        }

        const headers = rows[0] || [];
        res.json({ success: true, headers });

    } catch (error) {
        console.error('Fetch Headers Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Ingest via Google Sheets ID with Mapping
router.post('/ingest', async (req, res) => {
    try {
        const { spreadsheetId, mapping } = req.body;
        const organizationId = req.user?.organization_id || req.body.organizationId;
        
        if (!spreadsheetId || !organizationId || !mapping) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(400).json({ error: 'Failed to fetch sheet.' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length <= 1) {
            return res.status(400).json({ error: 'No data found in sheet' });
        }

        const headers = rows[0] || [];
        
        // Find column indices based on mapping
        const nameIdx = headers.indexOf(mapping.nameCol);
        const phoneIdx = headers.indexOf(mapping.phoneCol);
        const emailIdx = headers.indexOf(mapping.emailCol);

        const leadsToInsert = [];
        const invalidRows = [];
        const batchId = `gsheet_batch_${Date.now()}`;

        // Initialize Round Robin variables
        const agents = await getAgentsList(organizationId);
        let nextAgentIndex = 0;
        if (agents.length > 0) {
            const nextId = await getNextAgentId(organizationId);
            nextAgentIndex = agents.findIndex(a => a.user_id === nextId);
            if (nextAgentIndex === -1) nextAgentIndex = 0;
        }

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
            
            if (phoneE164 || email) {
                let agent_id = null;
                if (agents.length > 0) {
                    agent_id = agents[nextAgentIndex].user_id;
                    nextAgentIndex = (nextAgentIndex + 1) % agents.length;
                }

                leadsToInsert.push({
                    organization_id: organizationId,
                    name: name ? String(name) : 'Unknown',
                    phone: phoneE164,
                    email: email,
                    status: 'PENDING',
                    agent_id: agent_id,
                    spreadsheet_id: spreadsheetId,
                    sheet_name: sheetName,
                    sheet_row_id: i + 1,
                    ingestion_batch_id: batchId
                });
            } else {
                invalidRows.push({ row: i + 1, phoneRaw, emailRaw });
            }
        }

        if (leadsToInsert.length > 0) {
            const { error } = await supabase
                .from('b_leads')
                .upsert(leadsToInsert, { onConflict: 'organization_id,phone', ignoreDuplicates: true });

            if (error) throw error;
        }

        // Save the connection for the cron job to poll
        const { error: connError } = await supabase
            .from('b_sheet_connections')
            .upsert({
                organization_id: organizationId,
                spreadsheet_id: spreadsheetId,
                mapping: mapping
            }, { onConflict: 'organization_id,spreadsheet_id' });
            
        if (connError) console.error("Failed to save sheet connection:", connError);

        // --- NEW: Register Webhook with Google Drive ---
        try {
            // 1. Fetch the global auth token for this organization
            const { data: authRecord } = await supabase
                .from('b_sheet_connections')
                .select('google_refresh_token')
                .eq('organization_id', organizationId)
                .eq('spreadsheet_id', 'GLOBAL_OAUTH')
                .single();

            if (authRecord && authRecord.google_refresh_token) {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );
                oauth2Client.setCredentials({ refresh_token: authRecord.google_refresh_token });
                
                const drive = google.drive({ version: 'v3', auth: oauth2Client });
                
                const channelId = `broadcastpilot_channel_${Date.now()}`;
                // The address must be your verified domain webhook endpoint
                const webhookUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3001'}/api/webhooks/google-drive`;
                
                const watchResponse = await drive.files.watch({
                    fileId: spreadsheetId,
                    requestBody: {
                        id: channelId,
                        type: 'web_hook',
                        address: webhookUrl
                    }
                });

                // Update the connection with the webhook IDs
                await supabase
                    .from('b_sheet_connections')
                    .update({
                        webhook_channel_id: channelId,
                        webhook_resource_id: watchResponse.data.resourceId
                    })
                    .eq('organization_id', organizationId)
                    .eq('spreadsheet_id', spreadsheetId);
                    
                console.log(`[Google Sheets] Successfully registered webhook for sheet ${spreadsheetId}`);
            } else {
                console.log(`[Google Sheets] No OAuth token found for org ${organizationId}. Skipping webhook registration.`);
            }
        } catch (webhookError) {
            console.error('[Google Sheets] Failed to register webhook:', webhookError.message);
            // We don't fail the ingestion if webhook fails, it will just fall back to polling
        }
        // -----------------------------------------------

        res.json({
            success: true,
            insertedCount: leadsToInsert.length,
            invalidCount: invalidRows.length,
            invalidRows
        });

    } catch (error) {
        console.error('Ingestion Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
