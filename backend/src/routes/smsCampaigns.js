const express = require('express');
const router = express.Router();
const { Queue } = require('bullmq');
const supabase = require('../supabaseClient');
const { createRedisConnection } = require('../utils/redisConnection');
const { personalizeMessage } = require('../utils/personalizeMessage');
const { preflightSmsCampaign } = require('../services/campaignPreflight');

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

        const preflight = await preflightSmsCampaign({ organizationId, leadStatusFilter });
        if (!preflight.ok) {
            return res.status(400).json({ error: preflight.error, connection: preflight.connection });
        }

        const { leads, connection } = preflight;

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
            const personalizedMessage = personalizeMessage(messageContent, lead);

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
            message: `Campaign started. Queued ${jobs.length} SMS messages.`,
            connection: {
                status: connection.status,
                verificationStatus: connection.verification_status,
            },
        });

    } catch (error) {
        console.error('SMS Campaign Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
