const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRoles() {
    try {
        console.log("Checking b_organization_members...");
        const { data: members, error } = await supabase
            .from('b_organization_members')
            .select('user_id, role');
            
        if (error) throw error;
        
        console.log(JSON.stringify(members, null, 2));

        console.log("\nChecking auth.users metadata...");
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        for (const user of users) {
            console.log(`${user.email} - Metadata:`, JSON.stringify(user.user_metadata));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkRoles();
