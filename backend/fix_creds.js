require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const token = "EAAUvmUZCQNQcBRacD8wgdAcgNZB51CPHZB3M05222nZA4cLSwOcdzzvZB80VCFKDgk1t6ToXy2AYI03ZCqGWgZAa7YZCKV0oeUXDiqZAH5GcstkjlW4TiaP7mXmgTz1Hbfp4G8Y6ZAODwOKGXIr2w4hzoEddaUNsO4sG3TljXASWMZC1EN5beG27g4dYJnyBytJ3Nyoz3ZAGIeZA1kU5ZCiG3vZCADeHZAdXPzmotDMbY55yQe9gVnxm6ueUg545yq1WALP11z9kZAgJAOrFZBKyfgYfBQOdgE";
  const phone_id = "975350342321465";
  const org_id = "847e859b-9bd7-4407-93c7-84e6b7a499f2";

  try {
      console.log("Fetching WABA ID from Meta...");
      const res = await axios.get(`https://graph.facebook.com/v19.0/${phone_id}?fields=whatsapp_business_account_id`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      const waba_id = res.data.whatsapp_business_account_id?.id || res.data.whatsapp_business_account_id;
      console.log("WABA ID found:", waba_id);

      if (waba_id) {
          console.log("Upserting into b_whatsapp_credentials...");
          const { data, error } = await supabase.from('b_whatsapp_credentials').upsert({
              organization_id: org_id,
              whatsapp_business_account_id: waba_id,
              access_token: token,
              phone_number_id: phone_id,
              status: 'active'
          }, { onConflict: 'organization_id' });
          
          if (error) console.error("Supabase Error:", error);
          else console.log("Credentials inserted successfully!");
      } else {
          console.error("Meta API response:", res.data);
      }
  } catch(e) {
      console.error("Error:", e.response?.data || e.message);
  }
}
fix();
