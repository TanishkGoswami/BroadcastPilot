-- Run this in your Supabase SQL Editor

-- 1. Create b_organizations table
CREATE TABLE public.b_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create b_organization_members table
CREATE TABLE public.b_organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.b_organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'agent')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 3. Update b_leads table to add agent_id and make organization_id a UUID
-- Wait, if organization_id is currently TEXT (like 'test-org-123'), we may need to migrate it.
-- Assuming we're starting fresh since the user said "Data Migration: Since we are moving away from the hardcoded test-org-123 ID, your previous test leads will disappear".
-- If b_leads already exists, we alter it:

ALTER TABLE public.b_leads
ADD COLUMN agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- If organization_id is currently text, and we want to link it to the new UUID table:
-- (WARNING: This drops the existing organization_id column and recreates it. ALL existing leads will be orphaned/deleted if you drop the column. Only run if okay with wiping old leads)
/*
ALTER TABLE public.b_leads DROP COLUMN organization_id;
ALTER TABLE public.b_leads ADD COLUMN organization_id UUID REFERENCES public.b_organizations(id) ON DELETE CASCADE;
*/

-- 4. Enable Row Level Security (RLS) - Optional but recommended
-- ALTER TABLE public.b_organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.b_organization_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.b_leads ENABLE ROW LEVEL SECURITY;
