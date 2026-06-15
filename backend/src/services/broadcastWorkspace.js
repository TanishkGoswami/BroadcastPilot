const supabase = require('../supabaseClient');

function getWorkspaceName(user) {
    const metadataName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.company_name ||
        user.user_metadata?.organization_name;

    if (metadataName && String(metadataName).trim()) {
        return String(metadataName).trim();
    }

    if (user.email) {
        const emailName = user.email.split('@')[0].replace(/[._-]+/g, ' ').trim();
        if (emailName) {
            return `${emailName}'s Broadcast Workspace`;
        }
    }

    return 'Broadcast Workspace';
}

async function findExistingMembership(userId) {
    const { data, error } = await supabase
        .from('b_organization_members')
        .select('organization_id, role, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(`Unable to read BroadcastPilot workspace membership: ${error.message}`);
    }

    return data;
}

async function getBroadcastWorkspace(user) {
    const membership = await findExistingMembership(user.id);

    if (!membership) {
        return null;
    }

    return {
        organization_id: membership.organization_id,
        role: membership.role,
    };
}

async function createOwnerWorkspace(user) {
    const { data: organization, error: orgError } = await supabase
        .from('b_organizations')
        .insert({ name: getWorkspaceName(user) })
        .select('id')
        .single();

    if (orgError) {
        throw new Error(`Unable to create BroadcastPilot workspace: ${orgError.message}`);
    }

    const { error: memberError } = await supabase
        .from('b_organization_members')
        .insert({
            organization_id: organization.id,
            user_id: user.id,
            role: 'owner',
        });

    if (memberError) {
        throw new Error(`Unable to create BroadcastPilot owner membership: ${memberError.message}`);
    }

    return {
        organization_id: organization.id,
        role: 'owner',
    };
}

async function getOrCreateBroadcastWorkspace(user) {
    const membership = await findExistingMembership(user.id);

    if (membership) {
        return {
            organization_id: membership.organization_id,
            role: membership.role,
        };
    }

    try {
        return await createOwnerWorkspace(user);
    } catch (error) {
        // Handles a rare double-click / multi-tab race where another request created membership first.
        const latestMembership = await findExistingMembership(user.id);
        if (latestMembership) {
            return {
                organization_id: latestMembership.organization_id,
                role: latestMembership.role,
            };
        }

        throw error;
    }
}

module.exports = {
    findExistingMembership,
    getBroadcastWorkspace,
    getOrCreateBroadcastWorkspace,
};
