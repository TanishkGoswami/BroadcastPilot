# Email and SMS Channel Changes

This note documents the Email/SMS changes added to make BroadcastPilot closer to an industry-style channel setup, and how to fall back if needed.

## What Changed

### Email

- Settings now treats Email as a sender identity setup.
- Users enter:
  - Sender name
  - Sender email
- Backend creates/reads a channel status through `b_channel_connections`.
- If the sender domain is not the verified platform SMTP domain, emails still send from the platform SMTP address and use the user's sender email as `Reply-To`.
- Email campaign sends now run a preflight check before queueing.
- Email recipients are filtered by:
  - `email_opt_in`
  - `email_unsubscribed_at`
- Unsubscribe now sets:
  - `status = 'UNSUBSCRIBED'`
  - `email_opt_in = false`
  - `email_unsubscribed_at = now()`

### SMS

- Settings now treats SMS as a platform-managed Twilio number setup.
- Users no longer enter Twilio SID/token in the UI.
- Users submit compliance intake fields:
  - Business name
  - Website
  - Use case
  - Sample message
  - Opt-in source
- Backend stores status through    `b_channel_connections`.
- Backend stores compliance intake in `b_sms_number_requests`.
- SMS campaign sends now run a preflight check before queueing.
- SMS recipients are filtered by:
  - `sms_opt_in`
  - `sms_opt_out_at`

## New Schema

Run `backend/supabase_schema.sql` to add:

- `b_channel_connections`
- `b_sms_number_requests`
- `b_leads.email_opt_in`
- `b_leads.email_unsubscribed_at`
- `b_leads.sms_opt_in`
- `b_leads.sms_opt_out_at`
- `b_leads.consent_source`

These changes are additive. Existing `b_email_credentials` and `b_sms_credentials` are not removed.

## Important Files Changed

- `backend/supabase_schema.sql`
- `backend/db_schema.sql`
- `backend/src/services/channelConnections.js`
- `backend/src/services/campaignPreflight.js`
- `backend/src/services/campaignStatus.js`
- `backend/src/routes/settings.js`
- `backend/src/routes/emailCampaigns.js`
- `backend/src/routes/smsCampaigns.js`
- `backend/src/workers/emailWorker.js`
- `backend/src/workers/smsWorker.js`
- `frontend/src/pages/Settings.jsx`
- `README.md`

## Fallback Plan

If the new Email/SMS flow causes issues, you can fall back without dropping data.

### Quick Fallback

1. Stop using the new Settings modal fields.
2. Set Email/SMS records manually in the old tables:
   - `b_email_credentials`
   - `b_sms_credentials`
3. Temporarily bypass the preflight checks in:
   - `backend/src/routes/emailCampaigns.js`
   - `backend/src/routes/smsCampaigns.js`

### Code Fallback

Revert these files to the previous implementation:

- `backend/src/routes/settings.js`
- `backend/src/routes/emailCampaigns.js`
- `backend/src/routes/smsCampaigns.js`
- `backend/src/workers/emailWorker.js`
- `backend/src/workers/smsWorker.js`
- `frontend/src/pages/Settings.jsx`

Then remove imports/usages of:

- `channelConnections.js`
- `campaignPreflight.js`
- `campaignStatus.js`

### Database Fallback

Do not immediately drop the new tables. They are additive and harmless if unused.

If you are sure you want to remove them later:

```sql
DROP TABLE IF EXISTS public.b_sms_number_requests;
DROP TABLE IF EXISTS public.b_channel_connections;

ALTER TABLE public.b_leads
DROP COLUMN IF EXISTS email_opt_in,
DROP COLUMN IF EXISTS email_unsubscribed_at,
DROP COLUMN IF EXISTS sms_opt_in,
DROP COLUMN IF EXISTS sms_opt_out_at,
DROP COLUMN IF EXISTS consent_source;
```

Only run the drop SQL after confirming no deployed code reads these fields.

## Current Limitation

This is a production-shaped foundation, not a full compliance automation suite yet.

Still recommended next:

- Provider delivery webhooks
- SMS STOP/HELP webhook handling
- Real A2P/10DLC approval tracking
- Email domain authentication records
- Bounce/complaint suppression
