CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. BroadcastPilot Workspace Tables
-- These tables isolate BroadcastPilot tenants from the main hub data.
CREATE TABLE IF NOT EXISTS public.b_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.b_organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.b_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_b_organization_members_user_id
ON public.b_organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_b_organization_members_organization_id
ON public.b_organization_members(organization_id);

CREATE TABLE IF NOT EXISTS public.b_agent_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.b_organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b_agent_invites_token_hash
ON public.b_agent_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_b_agent_invites_org_email
ON public.b_agent_invites(organization_id, email);

-- 1. WhatsApp Credentials Table
CREATE TABLE IF NOT EXISTS public.b_whatsapp_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    waba_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- 2. Leads Table
CREATE TABLE IF NOT EXISTS public.b_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    status TEXT DEFAULT 'PENDING',
    email_opt_in BOOLEAN DEFAULT TRUE,
    email_unsubscribed_at TIMESTAMPTZ,
    sms_opt_in BOOLEAN DEFAULT TRUE,
    sms_opt_out_at TIMESTAMPTZ,
    consent_source TEXT,
    spreadsheet_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    sheet_row_id INTEGER NOT NULL,
    ingestion_batch_id TEXT,
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, phone)
);

-- 3. Campaigns Table
CREATE TABLE IF NOT EXISTS public.b_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    template_name TEXT NOT NULL,
    template_language TEXT NOT NULL,
    status TEXT DEFAULT 'PROCESSING',
    total_targets INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Delivery Logs Table
CREATE TABLE IF NOT EXISTS public.b_delivery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.b_campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.b_leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    contact TEXT NOT NULL,
    message_id TEXT,
    status TEXT NOT NULL,
    error TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Email Credentials Table
CREATE TABLE IF NOT EXISTS public.b_email_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_user TEXT NOT NULL,
    smtp_pass TEXT NOT NULL,
    from_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- 6. Contacts Table
CREATE TABLE IF NOT EXISTS public.b_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    name TEXT,
    custom_name TEXT,
    phone TEXT,
    wa_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Conversations Table
CREATE TABLE IF NOT EXISTS public.b_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    contact_id UUID NOT NULL REFERENCES public.b_contacts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    unread_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Messages Table
CREATE TABLE IF NOT EXISTS public.b_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.b_conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    direction TEXT NOT NULL, -- 'inbound' or 'outbound'
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Sheet Connections Table
CREATE TABLE IF NOT EXISTS public.b_sheet_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    spreadsheet_id TEXT NOT NULL,
    mapping JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, spreadsheet_id)
);

-- 10. SMS Credentials Table
CREATE TABLE IF NOT EXISTS public.b_sms_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    provider TEXT DEFAULT 'twilio',
    account_sid TEXT NOT NULL,
    auth_token TEXT NOT NULL,
    from_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id)
);

-- 11. Channel Connections Table
CREATE TABLE IF NOT EXISTS public.b_channel_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'instagram', 'facebook')),
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'setup_required' CHECK (status IN ('not_connected', 'setup_required', 'pending_verification', 'active', 'paused', 'failed')),
    display_name TEXT,
    sender_identity TEXT,
    provider_resource_id TEXT,
    verification_status TEXT NOT NULL DEFAULT 'not_started',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, channel, provider)
);

CREATE INDEX IF NOT EXISTS idx_b_channel_connections_org_channel
ON public.b_channel_connections(organization_id, channel);

-- 12. SMS Number Requests / Compliance Intake
CREATE TABLE IF NOT EXISTS public.b_sms_number_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_compliance' CHECK (status IN ('draft', 'pending_compliance', 'submitted', 'approved', 'rejected', 'active')),
    business_name TEXT,
    website TEXT,
    business_address TEXT,
    use_case TEXT,
    sample_message TEXT,
    opt_in_description TEXT,
    assigned_number TEXT,
    provider TEXT NOT NULL DEFAULT 'twilio',
    provider_resource_id TEXT,
    rejection_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b_sms_number_requests_org_status
ON public.b_sms_number_requests(organization_id, status);

-- 13. Meta Connections Table
CREATE TABLE IF NOT EXISTS public.b_meta_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id TEXT NOT NULL,
    page_id TEXT, -- Nullable for standalone Instagram
    page_name TEXT,
    page_access_token TEXT,
    instagram_id TEXT,
    instagram_access_token TEXT,
    instagram_username TEXT,
    instagram_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (organization_id, page_id),
    UNIQUE NULLS NOT DISTINCT (organization_id, instagram_id)
);
