const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { loadBackendEnv } = require('./utils/loadBackendEnv');

loadBackendEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Ensure they are set in BroadcastPilot/backend/.env");
}

const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseKey || 'placeholder-key',
    {
        auth: {
            persistSession: false
        },
        realtime: {
            transport: ws
        }
    }
);

module.exports = supabase;
