const supabase = require('./src/supabaseClient');

async function check() {
    const { data, error } = await supabase.from('b_meta_connections').select('*');
    if (error) {
        console.error('Error fetching:', error);
    } else {
        console.log('Total connections in DB:', data.length);
        console.log('Data:', JSON.stringify(data, null, 2));
    }
}
check();
