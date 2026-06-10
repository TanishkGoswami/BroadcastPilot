const supabase = require('./src/supabaseClient');

async function test() {
    const { data, error } = await supabase.from('b_email_credentials').select('*');
    console.log("Credentials:", data);
    console.log("Error:", error);
}

test();
