const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { metaSyncQueue } = require('../workers/metaWorker');

const META_APP_SECRET = process.env.META_CLIENT_SECRET;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'broadcastpilot_meta_secret_token';

// 1. Webhook Verification Challenge (GET)
// Meta will send a GET request here when you first configure the webhook URL in the App Dashboard
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Meta Webhook] Successfully verified webhook challenge');
        res.status(200).send(challenge);
    } else {
        console.error('[Meta Webhook] Verification failed. Tokens do not match.');
        res.sendStatus(403);
    }
});

// 2. Receive Push Notifications (POST)
router.post('/', async (req, res) => {
    // Optional: Verify X-Hub-Signature to ensure request is actually from Meta
    // const signature = req.headers['x-hub-signature-256'];
    // const payload = JSON.stringify(req.body);
    // const expectedSignature = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(payload).digest('hex');
    // if (signature !== expectedSignature) return res.sendStatus(401);

    try {
        const body = req.body;

        if (body.object === 'page' || body.object === 'instagram') {
            const channel = body.object === 'instagram' ? 'instagram' : 'messenger';
            
            body.entry.forEach(entry => {
                const accountId = entry.id;
                
                if (entry.changes) {
                    entry.changes.forEach(async change => {
                        if (change.field === 'leadgen') {
                            const leadgenId = change.value.leadgen_id;
                            const formId = change.value.form_id;
                            
                            console.log(`[Meta Webhook] Received new lead! Leadgen ID: ${leadgenId}, Page/Account: ${accountId}`);

                            // Push the Leadgen ID to BullMQ so the worker can fetch the actual PII data
                            await metaSyncQueue.add('syncMetaLead', {
                                leadgenId: leadgenId,
                                pageId: accountId,
                                formId: formId
                            });
                        }
                        
                        if (change.field === 'messages') {
                            const event = change.value;
                            
                            if (event.message && !event.message.is_echo) {
                                console.log(`[Meta Webhook] Received standalone IG message for account: ${accountId}`);
                                await metaSyncQueue.add('syncMetaMessage', {
                                    accountId: accountId,
                                    event: event,
                                    channel: 'instagram'
                                });
                            }
                        }
                    });
                }

                if (entry.messaging) {
                    entry.messaging.forEach(async event => {
                        
                        if (event.message && !event.message.is_echo) {
                            let actualChannel = channel;
                            let targetAccountId = accountId;

                            // If it came via the Page webhook, check if the recipient is the Instagram ID instead of the Page ID
                            if (body.object === 'page' && event.recipient && event.recipient.id && event.recipient.id !== accountId) {
                                actualChannel = 'instagram';
                                targetAccountId = event.recipient.id;
                            }

                            console.log(`[Meta Webhook] Received message for account: ${targetAccountId} on channel: ${actualChannel}`);
                            await metaSyncQueue.add('syncMetaMessage', {
                                accountId: targetAccountId,
                                event: event,
                                channel: actualChannel
                            });
                        }
                    });
                }
            });

            // Return a 200 OK to tell Meta we received it successfully
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('[Meta Webhook] Error processing notification:', error);
        res.sendStatus(500);
    }
});

module.exports = router;
