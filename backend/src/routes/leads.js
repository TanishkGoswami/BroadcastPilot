const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { google } = require('googleapis');

// Get all leads for an organization
router.get('/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;
        const { data, error } = await supabase
            .from('b_leads')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a single manual lead
router.post('/', async (req, res) => {
    try {
        const { organizationId, name, phone, email } = req.body;
        
        if (!organizationId || !phone) {
            return res.status(400).json({ error: 'Organization ID and Phone are required.' });
        }

        const { data, error } = await supabase
            .from('b_leads')
            .insert([{
                organization_id: organizationId,
                name: name || 'Unknown',
                phone: phone,
                email: email || null,
                status: 'PENDING',
                spreadsheet_id: 'MANUAL',
                sheet_name: 'Manual Entry',
                sheet_row_id: 0
            }])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, lead: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update lead status and sync to Google Sheets
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, apiKey } = req.body; // apiKey passed for Google Sheets sync demo

        // 1. Update in DB
        const { data: lead, error } = await supabase
            .from('b_leads')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 2. Sync back to Google Sheets
        if (apiKey && lead && lead.spreadsheet_id && lead.sheet_row_id) {
            try {
                const sheets = google.sheets({ version: 'v4', auth: apiKey });
                const range = `${lead.sheet_name}!C${lead.sheet_row_id}`; // Assuming Column C is Status

                await sheets.spreadsheets.values.update({
                    spreadsheetId: lead.spreadsheet_id,
                    range: range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[status]]
                    }
                });
            } catch (sheetError) {
                console.error("Failed to sync to Google Sheets:", sheetError.message);
                // We still return success for the DB update, but might log the sheet failure
            }
        }

        res.json({ success: true, lead });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
