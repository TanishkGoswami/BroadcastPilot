const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const supabase = require('../supabaseClient');

const authMiddleware = require('../middleware/authMiddleware');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.PUBLIC_BASE_URL || 'http://localhost:3001'}/api/auth/google/callback`
);

// 0. Get Current User Profile
router.get('/me', authMiddleware, (req, res) => {
    res.json({
        organization_id: req.user.organization_id,
        role: req.user.role
    });
});

// 1. Redirect to Google Consent Screen
router.get('/google', (req, res) => {
    const { organizationId } = req.query;
    
    if (!organizationId) {
        return res.status(400).send('Missing organizationId');
    }

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Required to get a refresh token
        prompt: 'consent', // Force consent screen to always get a refresh token
        scope: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly'
        ],
        state: organizationId // Pass org ID through the OAuth flow
    });

    res.redirect(url);
});

// 2. Handle Google Callback
router.get('/google/callback', async (req, res) => {
    const { code, state: organizationId } = req.query;

    if (!code || !organizationId) {
        return res.status(400).send('Missing code or state');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        if (tokens.refresh_token) {
            // Save the refresh token to the DB. 
            // We use a placeholder spreadsheet_id so it acts as the global auth for this org.
            const { error } = await supabase
                .from('b_sheet_connections')
                .upsert({
                    organization_id: organizationId,
                    spreadsheet_id: 'GLOBAL_OAUTH',
                    mapping: {},
                    google_refresh_token: tokens.refresh_token
                }, { onConflict: 'organization_id,spreadsheet_id' });

            if (error) {
                console.error('Error saving refresh token:', error);
                return res.status(500).send('Failed to save credentials.');
            }
        }

        // Ideally redirect to the frontend dashboard
        res.send('<html><body><h2>Successfully connected to Google!</h2><p>You can close this tab and return to the dashboard.</p><script>window.close()</script></body></html>');
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.status(500).send('Authentication failed');
    }
});

module.exports = router;
