const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMembers() {
    const { data, error } = await supabase.from('b_organization_members').select('*');
    console.log('Members:', JSON.stringify(data, null, 2));
}

checkMembers();