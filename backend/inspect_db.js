const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    // We can just select 1 row from each to see their structure
    const tables = ['w_wa_accounts', 'w_conversations', 'w_messages'];
    for (const t of tables) {
        console.log(`\n--- ${t} ---`);
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) console.error(error);
        else console.log(JSON.stringify(data[0] || 'No rows', null, 2));
    }
}

inspect();
