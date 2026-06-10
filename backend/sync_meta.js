require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncMetaCreds() {
  const token = "EAAUvmUZCQNQcBRacD8wgdAcgNZB51CPHZB3M05222nZA4cLSwOcdzzvZB80VCFKDgk1t6ToXy2AYI03ZCqGWgZAa7YZCKV0oeUXDiqZAH5GcstkjlW4TiaP7mXmgTz1Hbfp4G8Y6ZAODwOKGXIr2w4hzoEddaUNsO4sG3TljXASWMZC1EN5beG27g4dYJnyBytJ3Nyoz3ZAGIeZA1kU5ZCiG3vZCADeHZAdXPzmotDMbY55yQe9gVnxm6ueUg545yq1WALP11z9kZAgJAOrFZBKyfgYfBQOdgE";
  const phone_id = "975350342321465";
  const org_id = "847e859b-9bd7-4407-93c7-84e6b7a499f2";

  console.log("Fetching WABA ID for phone:", phone_id);
  let waba_id = "132717019927694"; // Typically what it might be, but let's try to query GAP DB.
  
  // Actually, I can just query the Meta API to find the templates if I just try to use the WABA ID from the API or try to get it.
  try {
      // Get Phone number details (usually contains WABA ID)
      // Actually, WABA ID can be obtained from the Phone Number endpoint.
      // But wait, the Meta API for templates actually accepts WABA ID.
      // Let's just find the w_whatsapp_accounts in GAP database if they exist.
      const { data: gapAccounts } = await supabase.from('w_whatsapp_accounts').select('*').limit(1);
      if (gapAccounts && gapAccounts.length > 0) {
          waba_id = gapAccounts[0].waba_id || gapAccounts[0].whatsapp_business_account_id;
          console.log("Found in GAP accounts:", gapAccounts[0]);
      } else {
        const { data: gapSys } = await supabase.from('w_system_settings').select('*');
        console.log("System settings:", gapSys);
      }
      
      console.log("If we don't have waba_id, we will attempt to find it.");
  } catch(e) {
      console.error(e.message);
  }
}
syncMetaCreds();
