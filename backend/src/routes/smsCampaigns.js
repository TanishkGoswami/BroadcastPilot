const express = require('express');
const router = express.Router();
const { Queue } = require('bullmq');
const supabase = require('../supabaseClient');
const { createRedisConnection } = require('../utils/redisConnection');

const connection = createRedisConnection();
const smsQueue = new Queue('smsQueue', { connection });

// Trigger an SMS Campaign
router.post('/send', async (req, res) => {
    try {
        const { organization_id: organizationId, role } = req.user;
        const { campaignName, messageContent, leadStatusFilter } = req.body;

        if (role !== 'owner') {
            return res.status(403).json({ error: 'Only workspace owners can send broadcasts' });
        }

        if (!organizationId || !campaignName || !messageContent) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Verify SMS Credentials exist for this org
        const { data: creds, error: credsError } = await supabase
            .from('b_sms_credentials')
            .select('id')
            .eq('organization_id', organizationId)
            .single();

        if (credsError || !creds) {
            return res.status(400).json({ error: 'No SMS credentials found. Please connect Twilio in Settings first.' });
        }

        // 2. Fetch target leads
        let leadQuery = supabase
            .from('b_leads')
            .select('id, name, phone')
            .eq('organization_id', organizationId)
            .not('phone', 'is', null);

        if (leadStatusFilter && leadStatusFilter !== 'ALL') {
            leadQuery = leadQuery.eq('status', leadStatusFilter);
        }

        const { data: leads, error: leadError } = await leadQuery;

        if (leadError) throw leadError;
        if (!leads || leads.length === 0) {
            return res.status(400).json({ error: 'No leads found with a phone number for the given filter' });
        }

        // 3. Create Campaign Record
        const { data: campaign, error: campError } = await supabase
            .from('b_campaigns')
            .insert({
                organization_id: organizationId,
                name: campaignName,
                template_name: 'Custom SMS',
                template_language: 'en',
                status: 'PROCESSING',
                total_targets: leads.length
            })
            .select()
            .single();

        if (campError) throw campError;

        // 4. Enqueue SMS Jobs to BullMQ
        const jobs = leads.map(lead => {
            // Personalize message (replace {{Name}} or {{name}})
            let personalizedMessage = messageContent;
            if (lead.name) {
                personalizedMessage = personalizedMessage.replace(/{{[Nn]ame}}/g, lead.name);
            }

            return {
                name: `sms-send-${lead.id}`,
                data: {
                    leadId: lead.id,
                    organizationId: organizationId,
                    campaignId: campaign.id,
                    toPhone: lead.phone,
                    messageContent: personalizedMessage
                },
                opts: {
                    removeOnComplete: true,
                    removeOnFail: false
                }
            };
        });

        await smsQueue.addBulk(jobs);

        res.json({
            success: true,
            campaignId: campaign.id,
            message: `Campaign started. Queued ${jobs.length} SMS messages.`
        });

    } catch (error) {
        console.error('SMS Campaign Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
