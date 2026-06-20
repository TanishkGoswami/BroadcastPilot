const supabase = require('../supabaseClient');

async function updateCampaignStatusFromLogs(campaignId) {
    if (!campaignId) return null;

    const { data: campaign, error: campaignError } = await supabase
        .from('b_campaigns')
        .select('id, total_targets, status')
        .eq('id', campaignId)
        .maybeSingle();

    if (campaignError || !campaign) return null;

    const { data: logs, error: logsError } = await supabase
        .from('b_delivery_logs')
        .select('status')
        .eq('campaign_id', campaignId);

    if (logsError || !Array.isArray(logs)) return campaign;

    const totalTargets = Number(campaign.total_targets || 0);
    if (totalTargets <= 0 || logs.length < totalTargets) return campaign;

    const failedCount = logs.filter(log => String(log.status || '').toLowerCase() === 'failed').length;
    const nextStatus = failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

    const { data: updated } = await supabase
        .from('b_campaigns')
        .update({ status: nextStatus })
        .eq('id', campaignId)
        .select()
        .maybeSingle();

    return updated || campaign;
}

module.exports = {
    updateCampaignStatusFromLogs,
};
