const supabase = require('../supabaseClient');

/**
 * Gets the next agent ID for a round-robin assignment based on the most recently assigned lead.
 * @param {string} orgId 
 * @returns {Promise<string|null>} user_id of the next agent, or null if no agents available
 */
async function getNextAgentId(orgId) {
    try {
        // 1. Get all agents for the organization, sorted deterministically by created_at
        const { data: agents, error: agentsError } = await supabase
            .from('b_organization_members')
            .select('user_id')
            .eq('organization_id', orgId)
            .eq('role', 'agent')
            .order('created_at', { ascending: true });

        if (agentsError) throw agentsError;
        
        // If no agents are in the team, we cannot assign to an agent
        if (!agents || agents.length === 0) {
            return null;
        }

        // 2. Fetch the most recent lead for the org to see who it was assigned to
        const { data: recentLeads, error: leadsError } = await supabase
            .from('b_leads')
            .select('agent_id')
            .eq('organization_id', orgId)
            .not('agent_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (leadsError) throw leadsError;

        // If no recent leads exist or it wasn't assigned, default to the first agent
        if (!recentLeads || recentLeads.length === 0) {
            return agents[0].user_id;
        }

        const lastAgentId = recentLeads[0].agent_id;

        // 3. Find the index of the last agent in our agents array
        const lastIndex = agents.findIndex(a => a.user_id === lastAgentId);

        // 4. Calculate the next index (Round Robin modulo math)
        // If the agent was deleted or not found, lastIndex is -1, so next index becomes 0.
        const nextIndex = (lastIndex + 1) % agents.length;

        return agents[nextIndex].user_id;
    } catch (error) {
        console.error('Error calculating next agent:', error);
        return null;
    }
}

/**
 * Gets the list of agents for an organization to support in-memory round robin.
 */
async function getAgentsList(orgId) {
    try {
        const { data: agents } = await supabase
            .from('b_organization_members')
            .select('user_id')
            .eq('organization_id', orgId)
            .eq('role', 'agent')
            .order('created_at', { ascending: true });
        return agents || [];
    } catch (error) {
        return [];
    }
}

module.exports = {
    getNextAgentId,
    getAgentsList
};
