const supabase = require('../supabaseClient');
const {
    getEmailStatus,
    getSmsStatus,
    isActiveConnection,
} = require('./channelConnections');

async function fetchEmailCredentials(organizationId) {
    const { data, error } = await supabase
        .from('b_email_credentials')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
}

async function fetchSmsCredentials(organizationId) {
    const { data, error } = await supabase
        .from('b_sms_credentials')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
}

function buildPreflightError(channel, connection) {
    if (!connection) {
        return `${channel === 'email' ? 'Email' : 'SMS'} channel is not connected. Complete channel setup in Settings first.`;
    }

    if (!isActiveConnection(connection)) {
        return `${channel === 'email' ? 'Email' : 'SMS'} channel is ${String(connection.status || 'not active').replace(/_/g, ' ')}. Complete verification before sending broadcasts.`;
    }

    return null;
}

async function preflightEmailCampaign({ organizationId, targetStatus }) {
    const creds = await fetchEmailCredentials(organizationId);
    const connection = await getEmailStatus(organizationId, creds);
    const connectionError = buildPreflightError('email', connection);
    if (connectionError) return { ok: false, error: connectionError, connection, leads: [], creds };

    let query = supabase
        .from('b_leads')
        .select('*')
        .eq('organization_id', organizationId)
        .not('email', 'is', null)
        .is('email_unsubscribed_at', null);

    if (targetStatus && targetStatus !== 'ALL') {
        query = query.eq('status', targetStatus);
    }

    query = query.or('email_opt_in.is.null,email_opt_in.eq.true');

    const { data: leads, error } = await query;
    if (error) throw error;

    if (!leads?.length) {
        return {
            ok: false,
            error: `No opted-in leads with emails found for status: ${targetStatus}`,
            connection,
            leads: [],
            creds,
        };
    }

    return { ok: true, connection, leads, creds };
}

async function preflightSmsCampaign({ organizationId, leadStatusFilter }) {
    const creds = await fetchSmsCredentials(organizationId);
    const connection = await getSmsStatus(organizationId, creds);
    const connectionError = buildPreflightError('sms', connection);
    if (connectionError) return { ok: false, error: connectionError, connection, leads: [], creds };

    let query = supabase
        .from('b_leads')
        .select('id, name, phone')
        .eq('organization_id', organizationId)
        .not('phone', 'is', null)
        .is('sms_opt_out_at', null);

    if (leadStatusFilter && leadStatusFilter !== 'ALL') {
        query = query.eq('status', leadStatusFilter);
    }

    query = query.or('sms_opt_in.is.null,sms_opt_in.eq.true');

    const { data: leads, error } = await query;
    if (error) throw error;

    if (!leads?.length) {
        return {
            ok: false,
            error: 'No opted-in leads with phone numbers found for the given filter',
            connection,
            leads: [],
            creds,
        };
    }

    return { ok: true, connection, leads, creds };
}

module.exports = {
    preflightEmailCampaign,
    preflightSmsCampaign,
};
