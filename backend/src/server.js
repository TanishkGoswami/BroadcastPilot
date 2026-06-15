const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked request from origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
}));

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
const whatsappRoutes = require('./routes/whatsapp');
const metaAuthRoutes = require('./routes/metaAuth');
const webhooksMetaRoutes = require('./routes/webhooksMeta');
const teamRoutes = require('./routes/team');
const authMiddleware = require('./middleware/authMiddleware');
const authUserMiddleware = require('./middleware/authUserMiddleware');
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
app.use('/api/team', authUserMiddleware, teamRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth/meta', metaAuthRoutes);
app.use('/api/webhooks/meta', webhooksMetaRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'BroadcastPilot Backend' });
});

const frontendDistPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath, {
        index: false,
        maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
    }));

    app.use((req, res, next) => {
        const acceptsHtml = req.accepts('html');
        const isApiRoute = req.path.startsWith('/api') || req.path === '/health';

        if (req.method === 'GET' && acceptsHtml && !isApiRoute) {
            res.sendFile(frontendIndexPath);
            return;
        }

        next();
    });
} else {
    console.warn(`Frontend build not found at ${frontendDistPath}. Run "npm run build" in frontend before production deploy.`);
}

// Start Background Workers
startCron();

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`BroadcastPilot Backend running on port ${PORT}`);
});
