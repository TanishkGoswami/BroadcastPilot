const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
const googleSheetsRoutes = require('./routes/googleSheets');
const leadsRoutes = require('./routes/leads');
const campaignsRoutes = require('./routes/campaigns');
const chatRoutes = require('./routes/chat');
const emailCampaignsRoutes = require('./routes/emailCampaigns');
const smsCampaignsRoutes = require('./routes/smsCampaigns');
const settingsRoutes = require('./routes/settings');
const webhooksRoutes = require('./routes/webhooks');
const authRoutes = require('./routes/auth');
const metaAuthRoutes = require('./routes/metaAuth');
const webhooksMetaRoutes = require('./routes/webhooksMeta');
const teamRoutes = require('./routes/team');
const authMiddleware = require('./middleware/authMiddleware');
const { startCron } = require('./workers/sheetSyncCron');
require('./workers/emailWorker');
require('./workers/smsWorker');
require('./workers/sheetWorker');
require('./workers/metaWorker');

app.use('/api/sheets', authMiddleware, googleSheetsRoutes);
app.use('/api/leads', authMiddleware, leadsRoutes);
app.use('/api/campaigns', authMiddleware, campaignsRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/email-campaigns', authMiddleware, emailCampaignsRoutes);
app.use('/api/sms-campaigns', authMiddleware, smsCampaignsRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/team', authMiddleware, teamRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/meta', metaAuthRoutes);
app.use('/api/webhooks/meta', webhooksMetaRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'BroadcastPilot Backend' });
});

// Start Background Workers
startCron();

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`BroadcastPilot Backend running on port ${PORT}`);
});
