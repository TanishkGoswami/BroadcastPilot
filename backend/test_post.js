const express = require('express');
const router = require('./src/routes/campaigns');
const app = express();
app.use(express.json());
app.use('/api/campaigns', router);

const server = app.listen(0, async () => {
    const port = server.address().port;
    try {
        const fetch = require('node-fetch'); // or axios
    } catch(e) {}
    const axios = require('axios');
    try {
        const res = await axios.post(`http://127.0.0.1:${port}/api/campaigns/broadcast`, {
            organizationId: '847e859b-9bd7-4407-93c7-84e6b7a499f2',
            targetStatus: 'INTERESTED',
            templateName: 'hello_world',
            templateLanguage: 'en_US',
            campaignName: 'Test'
        });
        console.log("Status:", res.status);
        console.log("Body:", res.data);
    } catch(err) {
        console.log("Status:", err.response?.status);
        console.log("Body:", err.response?.data);
        console.log("Error:", err.message);
    }
    server.close();
});
