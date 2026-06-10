const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const nodemailer = require('nodemailer');
const supabase = require('../supabaseClient');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null
});

const emailQueue = new Queue('emailBroadcasts', { connection });

// Get dynamic transporter if settings provided, else global
function getTransporter(smtpSettings) {
    // smtpSettings.host is being used as a hack for brandingEnabled in settings.js
    // Only use dynamic transporter if it's a real host (not 'true' or 'false')
    if (smtpSettings && smtpSettings.host && smtpSettings.host !== 'true' && smtpSettings.host !== 'false') {
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
        
        const globalFromAddress = process.env.SMTP_FROM || 'noreply@broadcastpilot.com';
        
        // If they provided a real custom SMTP host, use their fromEmail. 
        // Otherwise, use the platform's verified globalFromAddress.
        const isCustomSmtp = smtpSettings && smtpSettings.host && smtpSettings.host !== 'true' && smtpSettings.host !== 'false';
        
        const physicalSender = (isCustomSmtp && smtpSettings.fromEmail) 
            ? smtpSettings.fromEmail.trim() 
            : globalFromAddress.trim();
            
        const senderString = contactInfo.senderName ? `"${contactInfo.senderName}" <${physicalSender}>` : physicalSender;
        
        // Set reply-to so responses go directly to the client's email address (if they entered a valid email)
        const replyToAddress = (contactInfo.contactAddress && contactInfo.contactAddress.includes('@')) 
            ? contactInfo.contactAddress.trim() 
            : null;

        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
        const unsubscribeLink = `${baseUrl}/api/emailCampaigns/unsubscribe/${leadId}`;

        // Inject Contact Address, Unsubscribe Link, and Branding
        let finalHtmlBody = htmlBody;
        finalHtmlBody += `
            <br><br><hr style="border:0; border-top: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 11px; color: #888; margin-top: 10px; white-space: pre-wrap;">${contactInfo.contactAddress}</p>
            <p style="font-size: 11px; margin-top: 5px;">
                <a href="${unsubscribeLink}" style="color: #888; text-decoration: underline;">Unsubscribe</a> from these emails.
            </p>
        `;
        
        if (contactInfo.brandingEnabled) {
            finalHtmlBody += `
                <p style="font-size: 11px; color: #aaa; margin-top: 5px;">
                    Powered by <a href="https://broadcastpilot.com" style="color: #0070d1; text-decoration: none;">BroadcastPilot</a>
                </p>
            `;
        }

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
            status: 'DELIVERED'
        });
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        
        // Log failure
        await supabase.from('b_delivery_logs').insert({
            campaign_id: campaignId,
            lead_id: leadId,
            channel: 'email',
            contact: email,
            status: 'FAILED',
            error: error.message
        });

        throw error;
    }
}, { 
    connection,
    concurrency: 5 // Send 5 emails concurrently
});

// Update campaign statuses when queue drains
worker.on('drained', async () => {
    console.log('Queue drained. Updating PROCESSING campaigns to COMPLETED...');
    try {
        await supabase
            .from('b_campaigns')
            .update({ status: 'COMPLETED' })
            .eq('status', 'PROCESSING');
    } catch (error) {
        console.error('Error updating campaign statuses on drain:', error);
    }
});

worker.on('completed', job => {
    console.log(`Email job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`Email job ${job.id} failed with error ${err.message}`);
});

module.exports = { emailQueue };
