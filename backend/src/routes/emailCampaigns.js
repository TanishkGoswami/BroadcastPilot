const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { emailQueue } = require('../workers/emailWorker');

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

        // 1. Fetch Client's SMTP Credentials
        const { data: creds, error: credError } = await supabase
            .from('b_email_credentials')
            .select('*')
            .eq('organization_id', organizationId)
            .single();

        if (credError || !creds) {
            return res.status(400).json({ error: 'Email Channel is not connected. Please go to Settings to configure your Contact Information.' });
        }

        // 2. Fetch Leads that have emails
        const { data: leads, error: leadError } = await supabase
            .from('b_leads')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('status', targetStatus)
            .not('email', 'is', null);

        if (leadError || !leads || leads.length === 0) {
            return res.status(400).json({ error: `No leads with emails found for status: ${targetStatus}` });
        }

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
        const jobs = leads.map(lead => ({
            name: 'sendEmail',
            data: { 
                leadId: lead.id, 
                email: lead.email,
                subject: subject,
                htmlBody: htmlBody,
                campaignId: campaign.id,
                smtpSettings: {
                    host: creds.smtp_host,
                    port: creds.smtp_port,
                    user: creds.smtp_user,
                    pass: creds.smtp_pass,
                    fromEmail: creds.from_email
                },
                contactInfo: {
                    senderName: creds.smtp_user, // Or any custom name
                    contactAddress: creds.from_email,
                    brandingEnabled: creds.smtp_host === 'true'
                }
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
            enqueuedCount: jobs.length
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
            .update({ status: 'UNSUBSCRIBED' })
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
