-- Run this in your Supabase SQL Editor

-- 1. Create b_organizations table
CREATE TABLE IF NOT EXISTS public.b_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create b_organization_members table
CREATE TABLE IF NOT EXISTS public.b_organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.b_organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'agent')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_b_organization_members_user_id
ON public.b_organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_b_organization_members_organization_id
ON public.b_organization_members(organization_id);

-- 3. Create b_agent_invites table for direct BroadcastPilot agent onboarding
CREATE TABLE IF NOT EXISTS public.b_agent_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.b_organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b_agent_invites_token_hash
ON public.b_agent_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_b_agent_invites_org_email
ON public.b_agent_invites(organization_id, email);

-- 3. Update b_leads table to add agent assignment support.
-- BroadcastPilot writes workspace ids from b_organizations into existing b_* tables.

ALTER TABLE public.b_leads
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Keep existing organization_id TEXT columns in b_* data tables unless you run a planned migration.
-- The app stores UUID values as strings there, which avoids destructive migration of existing leads.

-- 4. Enable Row Level Security (RLS) - Optional but recommended
-- ALTER TABLE public.b_organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.b_organization_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.b_leads ENABLE ROW LEVEL SECURITY;
