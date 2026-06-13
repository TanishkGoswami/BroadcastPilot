const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');

// Meta OAuth Configuration
const META_CLIENT_ID = process.env.META_CLIENT_ID;
const META_CLIENT_SECRET = process.env.META_CLIENT_SECRET;
const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || META_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET || META_CLIENT_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
const META_REDIRECT_URI = `${PUBLIC_BASE_URL}/api/auth/meta/callback`;

// 1. Redirect to Meta Login
router.get('/', (req, res) => {
    const organizationId = req.query.organizationId || 'test-org-123';
    
    // We pass organizationId in the state parameter so we know who logged in during the callback
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
    
    // Scopes needed for Lead Ads: 
    // pages_show_list (to see their pages), 
    // pages_manage_metadata (to register webhooks), 
    // leads_retrieval (to get lead data)
    // business_management (required if the pages are owned by a Business Manager)
    const scopes = 'pages_show_list,pages_manage_metadata,leads_retrieval,business_management,pages_messaging';
    
    // auth_type=rerequest forces Facebook to ask for the permissions again if the user previously declined or skipped the page selection
    const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_CLIENT_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&state=${state}&scope=${scopes}&response_type=code&auth_type=rerequest`;
    
    res.redirect(metaAuthUrl);
});

// 2. Handle Meta Callback
router.get('/callback', async (req, res) => {
    const code = req.query.code;
    const stateRaw = req.query.state;
    
    if (!code) {
        return res.status(400).send('Missing authorization code');
    }

    try {
        const stateStr = Buffer.from(stateRaw, 'base64').toString('utf-8');
        const { organizationId } = JSON.parse(stateStr);

        // Exchange code for Short-Lived Access Token
        const tokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_CLIENT_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&client_secret=${META_CLIENT_SECRET}&code=${code}`);
        const tokenData = tokenResponse.data;

        if (tokenData.error) {
            console.error('Meta Token Error:', tokenData.error);
            return res.status(400).send(`Authentication failed: ${tokenData.error.message}`);
        }

        const shortLivedToken = tokenData.access_token;

        // Exchange Short-Lived Token for Long-Lived Token
        const longTokenResponse = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_CLIENT_ID}&client_secret=${META_CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`);
        const longTokenData = longTokenResponse.data;
        
        const longLivedToken = longTokenData.access_token || shortLivedToken;

        // Fetch User's Pages using the Long-Lived Token
        const pagesResponse = await axios.get(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${longLivedToken}`);
        const pagesData = pagesResponse.data;

        if (pagesData.error) {
            console.error('Meta Pages Error:', pagesData.error);
            return res.status(400).send('Failed to retrieve Facebook Pages');
        }

        const pages = pagesData.data;
        if (!pages || pages.length === 0) {
            console.error('Meta returned empty pages data:', JSON.stringify(pagesData));
            return res.status(400).send(`
                <h3>No Facebook Pages found for this account.</h3>
                <p>Meta returned the following data:</p>
                <pre>${JSON.stringify(pagesData, null, 2)}</pre>
                <p>If you see an empty data array, it means Meta API believes this specific Facebook profile is not an Admin or Editor of any Pages.</p>
            `);
        }

        // For simplicity, we will automatically save the first page found. 
        // In a production UI, you would let them select the page.
        const selectedPage = pages[0];
        const pageId = selectedPage.id;
        const pageName = selectedPage.name;
        // The page access token is required to read leads for that specific page
        const pageAccessToken = selectedPage.access_token;
        const instagramId = selectedPage.instagram_business_account?.id || null;

        // Save to Database
        const { error } = await supabase
            .from('b_meta_connections')
            .upsert({
                organization_id: organizationId,
                page_id: pageId,
                page_name: pageName,
                page_access_token: pageAccessToken,
                instagram_id: instagramId
            }, { onConflict: 'organization_id,page_id' });

        if (error) {
            console.error('Supabase save error:', error);
            return res.status(500).send('Failed to save connection to database');
        }

        // Subscribe the Page to our App's Webhooks automatically for leads and messages
        await axios.post(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=leadgen,messages,messaging_postbacks&access_token=${pageAccessToken}`);

        // Redirect back to the React app dashboard (the Contacts page is on the root path /)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/`);

    } catch (error) {
        console.error('Meta Auth Error:', error.response?.data || error.message);
        res.status(500).send(`
            <h3>Authentication Error</h3>
            <p>${error.response?.data?.error?.message || error.message}</p>
        `);
    }
});

// --- NEW INSTAGRAM LOGIN FOR BUSINESS ROUTES ---
const IG_REDIRECT_URI = `${PUBLIC_BASE_URL}/api/auth/meta/instagram/callback`;

router.get('/instagram', (req, res) => {
    const organizationId = req.query.organizationId || 'test-org-123';
    const state = Buffer.from(JSON.stringify({ organizationId })).toString('base64');
    
    const scopes = 'instagram_business_basic,instagram_business_manage_messages';
    const igAuthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(IG_REDIRECT_URI)}&state=${state}&response_type=code&scope=${scopes}`;
    
    res.redirect(igAuthUrl);
});

router.get('/instagram/callback', async (req, res) => {
    const code = req.query.code;
    const stateRaw = req.query.state;
    
    if (!code) return res.status(400).send('Missing authorization code');

    try {
        const stateStr = Buffer.from(stateRaw, 'base64').toString('utf-8');
        const { organizationId } = JSON.parse(stateStr);

        // Exchange code for short-lived token
        const tokenForm = new URLSearchParams({
            client_id: INSTAGRAM_CLIENT_ID,
            client_secret: INSTAGRAM_CLIENT_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: IG_REDIRECT_URI,
            code: code
        });
        
        const shortTokenRes = await axios.post('https://api.instagram.com/oauth/access_token', tokenForm.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const shortAccessToken = shortTokenRes.data.access_token;

        // Exchange for long-lived token
        const longTokenRes = await axios.get(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_CLIENT_SECRET}&access_token=${shortAccessToken}`);
        const longAccessToken = longTokenRes.data.access_token;

        // Fetch User Info
        const userRes = await axios.get(`https://graph.instagram.com/v21.0/me?fields=user_id,username,name&access_token=${longAccessToken}`);
        const userInfo = userRes.data;
        console.log('Instagram User Info:', userInfo);

        const upsertPayload = {
            organization_id: organizationId,
            instagram_id: userInfo.user_id || userInfo.id, // Fallback to id just in case
            instagram_access_token: longAccessToken,
            instagram_username: userInfo.username,
            instagram_name: userInfo.name
        };
        console.log('Upsert Payload:', upsertPayload);

        // Upsert Database
        const { data: upsertData, error } = await supabase
            .from('b_meta_connections')
            .upsert(upsertPayload, { onConflict: 'organization_id,instagram_id' })
            .select();

        console.log('Supabase Upsert Result Data:', upsertData);

        if (error) {
            console.error('Supabase save error:', error);
            return res.status(500).send('Failed to save Instagram connection to database');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/`);

    } catch (error) {
        console.error('Instagram Auth Error:', error.response?.data || error.message);
        res.status(500).send(`
            <h3>Instagram Authentication Error</h3>
            <p>${error.response?.data?.error_message || error.message}</p>
        `);
    }
});
// -----------------------------------------------

// 3. Get connection status
router.get('/status', authMiddleware, async (req, res) => {
    console.log('--- GET /auth/meta/status ---');
    console.log('User ID:', req.user?.id);
    console.log('User Org ID:', req.user?.organization_id);

    try {
        if (!req.user || !req.user.organization_id) {
            console.log('Failed: User has no organization_id');
            return res.status(400).json({ success: false, error: 'User does not belong to an organization' });
        }

        const { data, error } = await supabase
            .from('b_meta_connections')
            .select('*')
            .eq('organization_id', req.user.organization_id);
            
        console.log('Supabase fetch error:', error);
        console.log('Supabase fetch data length:', data ? data.length : 0);
        console.log('Connections data:', data);

        if (error) throw error;
        res.json({ success: true, connections: data });
    } catch (err) {
        console.error('Status fetch error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
