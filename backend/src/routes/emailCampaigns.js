const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { emailQueue } = require('../workers/emailWorker');
const { personalizeMessage } = require('../utils/personalizeMessage');
const { preflightEmailCampaign } = require('../services/campaignPreflight');

function normalizeEmailSettings(creds) {
    return {
        smtpSettings: {
            host: creds.smtp_host || null,
            port: creds.smtp_port || null,
            user: creds.smtp_user || null,
            pass: creds.smtp_pass || null,
            fromEmail: creds.from_email || null
        },
        contactInfo: {
            senderName: creds.smtp_user,
            senderEmail: creds.from_email
        }
    };
}

// Trigger an email broadcast campaign
router.post('/broadcast', async (req, res) => {
    try {
        const { organization_id: organizationId, role } = req.user;
        const { targetStatus, subject, htmlBody, campaignName } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only workspace owners can send broadcasts' });
        }

        if (!organizationId || !targetStatus || !subject || !htmlBody) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const preflight = await preflightEmailCampaign({ organizationId, targetStatus });
        if (!preflight.ok) {
            return res.status(400).json({ error: preflight.error, connection: preflight.connection });
        }

        const { creds, leads, connection } = preflight;

        // 3. Create Campaign Record
        const { data: campaign, error: campError } = await supabase
            .from('b_campaigns')
            .insert({
                organization_id: organizationId,
                name: campaignName || `Email Broadcast - ${new Date().toISOString()}`,
                template_name: 'email_custom', // Mock template name for emails
                template_language: 'en_US',
                status: 'PROCESSING',
                total_targets: leads.length
            })
            .select()
            .single();

        if (campError) throw campError;

        // 4. Enqueue Jobs to the Email Worker
        const emailSettings = normalizeEmailSettings(creds);

        const jobs = leads.map(lead => ({
            name: 'sendEmail',
            data: { 
                leadId: lead.id, 
                email: lead.email,
                subject: subject,
                htmlBody: personalizeMessage(htmlBody, lead),
                campaignId: campaign.id,
                ...emailSettings
            },
            opts: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                }
            }
        }));

        await emailQueue.addBulk(jobs);

        res.json({
            success: true,
            campaign,
            enqueuedCount: jobs.length,
            connection: {
                status: connection.status,
                verificationStatus: connection.verification_status,
            },
        });

    } catch (error) {
        console.error('Email Broadcast Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unsubscribe Endpoint
router.get('/unsubscribe/:leadId', async (req, res) => {
    try {
        const { leadId } = req.params;
        
        const { error } = await supabase
            .from('b_leads')
            .update({
                status: 'UNSUBSCRIBED',
                email_opt_in: false,
                email_unsubscribed_at: new Date().toISOString()
            })
            .eq('id', leadId);

        if (error) throw error;

        // Optionally, redirect to a nicely formatted frontend success page.
        // For now, returning simple HTML.
        res.send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h2>Unsubscribed Successfully</h2>
                <p>You will no longer receive broadcast emails from us.</p>
            </div>
        `);
    } catch (error) {
        console.error('Unsubscribe Error:', error);
        res.status(500).send('Error processing unsubscribe request.');
    }
});

module.exports = router;
