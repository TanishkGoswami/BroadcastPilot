require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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
  
  console.log('Credentials found:', creds);
  
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
      console.log('Templates from Meta API:', JSON.stringify(response.data.data, null, 2));
  } catch (err) {
      console.error('Meta API Error:', err.response?.data || err.message);
  }
}

check();
