const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUser() {
    const orgId = '847e859b-9bd7-4407-93c7-84e6b7a499f2';
    // This is the brand new user ID that appeared in the logs
    const userId = 'a92f3b2f-0aea-4117-b12b-d9fb516af4ab'; 
    
    console.log('Fixing Organization:', orgId);
    
    // Ensure the new user is an Owner of the organization
    const { data: memberData, error: memberError } = await supabase
        .from('b_organization_members')
        .upsert({ organization_id: orgId, user_id: userId, role: 'owner' }, { onConflict: 'organization_id,user_id' });
    console.log('Member Upsert Error:', memberError);
    
    console.log('Done!');
}

fixUser();
