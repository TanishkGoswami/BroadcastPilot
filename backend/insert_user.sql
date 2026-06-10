-- Run this in your Supabase SQL Editor to insert the user "shwet chourey"

-- 1. Create a new organization for Shwet Chourey
-- We use a CTE or just insert and return the ID, but standard SQL can just use a random UUID or we can create it in a DO block.
-- The simplest way is to hardcode an organization ID or use a subquery.

DO $$
DECLARE
    new_org_id UUID;
    target_user_id UUID := '36881c2c-55e3-4707-921a-12838cfc8d32';
BEGIN
    -- 1. Insert the organization and capture its generated ID
    INSERT INTO public.b_organizations (name)
    VALUES ('Shwet Chourey Organization')
    RETURNING id INTO new_org_id;

    -- 2. Insert the user as the owner of this new organization
    INSERT INTO public.b_organization_members (organization_id, user_id, role)
    VALUES (new_org_id, target_user_id, 'owner');

    RAISE NOTICE 'Successfully created organization and assigned owner role to %', target_user_id;
END $$;
