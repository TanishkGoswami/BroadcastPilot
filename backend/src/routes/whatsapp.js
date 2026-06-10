const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const whatsappService = require('../services/whatsappService');
const supabase = require('../supabaseClient');

// 1. Get Status
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        
        // Check database
        const { data: accounts, error } = await supabase
            .from('w_wa_accounts')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('status', 'connected');
            
        if (error) throw error;
        
        if (accounts && accounts.length > 0) {
            // Check if service is actually connected in memory, if not, reconnect it
            const sessionId = `org_${organization_id}`;
            if (!whatsappService.isConnected(sessionId)) {
                // Background reconnect attempt
                whatsappService.initBaileysConnection(organization_id, sessionId).catch(console.error);
            }
            res.json({ connected: true, account: accounts[0] });
        } else {
            res.json({ connected: false });
        }
    } catch (err) {
        console.error("Status check error:", err);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// 2. Get QR Code
router.get('/qr', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        const sessionId = `org_${organization_id}`;
        
        // If not connected, initialize to generate QR
        if (!whatsappService.isConnected(sessionId)) {
            await whatsappService.initBaileysConnection(organization_id, sessionId);
        }
        
        // Give it a second to generate the QR code
        let retries = 0;
        let qr = whatsappService.getQrCode(sessionId);
        
        while (!qr && retries < 10) {
            await new Promise(r => setTimeout(r, 1000));
            qr = whatsappService.getQrCode(sessionId);
            retries++;
        }
        
        if (qr) {
            res.json({ qr });
        } else {
            res.status(408).json({ error: 'Timeout waiting for QR code. Wait a moment and try again.' });
        }
    } catch (err) {
        console.error("QR generation error:", err);
        res.status(500).json({ error: 'Failed to generate QR' });
    }
});

// 3. Get Templates
router.get('/templates', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        
        // Fetch WA Credentials (we need WABA ID and Token)
        const { data: creds, error } = await supabase
            .from('b_whatsapp_credentials')
            .select('*')
            .eq('organization_id', organization_id)
            .single();
            
        if (error || !creds || !creds.whatsapp_business_account_id) {
            console.log("No valid WA creds found, returning mock templates for testing.");
            return res.json({ success: true, templates: [
                { id: 'mock_1', name: 'hello_world', language: 'en_US', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hello {{1}}, welcome to BroadcastPilot!' }] },
                { id: 'mock_2', name: 'promotional_offer', language: 'en', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hi {{1}}, get 20% off using code {{2}}!' }] }
            ]});
        }

        const waba_id = creds.whatsapp_business_account_id;
        const token = creds.access_token;

        // Call Meta Graph API
        const axios = require('axios');
        const response = await axios.get(
            `https://graph.facebook.com/v19.0/${waba_id}/message_templates?limit=100`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        // Filter out non-approved templates if desired, or return all
        const templates = response.data.data;
        console.log("Meta API returned", templates?.length, "templates");
        if (templates?.length > 0) {
            console.log("First template:", templates[0].name, templates[0].status);
        }
        res.json({ success: true, templates });
    } catch (err) {
        console.error("Templates fetch error:", err.response?.data || err.message);
        // Fallback to mock on error so UI doesn't break
        return res.json({ success: true, templates: [
            { id: 'mock_1', name: 'hello_world', language: 'en_US', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hello {{1}}, welcome to BroadcastPilot!' }] }
        ]});
    }
});

// 4. Logout / Disconnect
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const organization_id = req.user.organization_id;
        const sessionId = `org_${organization_id}`;
        
        await whatsappService.logout(organization_id, sessionId);
        res.json({ success: true });
    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ error: 'Failed to logout' });
    }
});

module.exports = router;
