require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const organization_id = '847e859b-9bd7-4407-93c7-84e6b7a499f2';
  
  const { data: creds, error } = await supabase
      .from('b_whatsapp_credentials')
      .select('*')
      .eq('organization_id', organization_id)
      .single();
      
  if (error || !creds) {
      console.error('No credentials found for this ORG ID:', error);
      return;
  }
  
  const waba_id = creds.whatsapp_business_account_id;
  const token = creds.access_token;
  
  const axios = require('axios');
  try {
      const response = await axios.get(
          `https://graph.facebook.com/v19.0/${waba_id}/message_templates?limit=100`,
          {
              headers: { Authorization: `Bearer ${token}` }
          }
      );
      const templates = response.data.data;
      console.log('Total templates:', templates.length);
      console.log('Statuses:', templates.map(t => t.status));
  } catch (err) {
      console.error('Meta API Error:', err.response?.data || err.message);
  }
}

check();
