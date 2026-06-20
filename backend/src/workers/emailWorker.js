const { Worker, Queue } = require('bullmq');
const nodemailer = require('nodemailer');
const supabase = require('../supabaseClient');
const { createRedisConnection } = require('../utils/redisConnection');
const { updateCampaignStatusFromLogs } = require('../services/campaignStatus');

const connection = createRedisConnection();

const emailQueue = new Queue('emailBroadcasts', { connection });

function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getDomain(email) {
    return String(email || '').split('@')[1]?.toLowerCase() || '';
}

function getTransporter(smtpSettings) {
    if (smtpSettings?.host) {
        return nodemailer.createTransport({
            host: smtpSettings.host,
            port: smtpSettings.port || 587,
            auth: {
                user: smtpSettings.user,
                pass: smtpSettings.pass
            }
        });
    }
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: process.env.SMTP_PORT || 587,
        auth: {
            user: process.env.SMTP_USER || 'test_user',
            pass: process.env.SMTP_PASS || 'test_pass'
        }
    });
}

const worker = new Worker('emailBroadcasts', async job => {
    const { leadId, email, subject, htmlBody, campaignId, contactInfo, smtpSettings } = job.data;
    const transporter = getTransporter(smtpSettings);
    
    try {
        console.log(`Sending email to ${email}...`);
        
        const globalFromAddress = (process.env.SMTP_FROM || 'noreply@broadcastpilot.com').trim();
        
        const isCustomSmtp = Boolean(smtpSettings?.host);
        
        const requestedSenderEmail = isValidEmail(contactInfo.senderEmail)
            ? contactInfo.senderEmail.trim().toLowerCase()
            : null;
        const canUseRequestedSender =
            requestedSenderEmail &&
            (isCustomSmtp || getDomain(requestedSenderEmail) === getDomain(globalFromAddress));

        const physicalSender = canUseRequestedSender ? requestedSenderEmail : globalFromAddress;
            
        const senderString = contactInfo.senderName ? `"${contactInfo.senderName}" <${physicalSender}>` : physicalSender;
        const replyToAddress = requestedSenderEmail && requestedSenderEmail !== physicalSender
            ? requestedSenderEmail
            : null;

        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
        const unsubscribeLink = `${baseUrl}/api/emailCampaigns/unsubscribe/${leadId}`;

        let finalHtmlBody = htmlBody;
        finalHtmlBody += `
            <br><br><hr style="border:0; border-top: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 11px; margin-top: 5px;">
                <a href="${unsubscribeLink}" style="color: #888; text-decoration: underline;">Unsubscribe</a> from these emails.
            </p>
        `;

        const mailOptions = {
            from: senderString,
            to: email,
            subject: subject,
            html: finalHtmlBody,
        };

        if (replyToAddress) {
            mailOptions.replyTo = replyToAddress;
        }

        const info = await transporter.sendMail(mailOptions);

        console.log('Message sent: %s', info.messageId);

        // Log success
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaignId,
            lead_id: leadId,
            channel: 'email',
            contact: email,
            message_id: info.messageId,
            status: 'sent'
        });
        await updateCampaignStatusFromLogs(campaignId);
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        
        // Log failure
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaignId,
            lead_id: leadId,
            channel: 'email',
            contact: email,
            status: 'failed',
            error: error.message
        });
        await updateCampaignStatusFromLogs(campaignId);

        throw error;
    }
}, { 
    connection,
    concurrency: 5 // Send 5 emails concurrently
});

worker.on('drained', async () => {
    console.log('Email queue drained.');
});

worker.on('completed', job => {
    console.log(`Email job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Email job ${job.id} failed with error ${err.message}`);
});

module.exports = { emailQueue };
