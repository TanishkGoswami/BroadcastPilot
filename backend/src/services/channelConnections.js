const supabase = require('../supabaseClient');

const CHANNEL_STATUS = {
    NOT_CONNECTED: 'not_connected',
    SETUP_REQUIRED: 'setup_required',
    PENDING_VERIFICATION: 'pending_verification',
    ACTIVE: 'active',
    PAUSED: 'paused',
    FAILED: 'failed',
};

function getDomain(email) {
    return String(email || '').split('@')[1]?.toLowerCase() || '';
}

function getPlatformEmailDomain() {
    return getDomain(process.env.SMTP_FROM || 'noreply@broadcastpilot.com');
}

function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeChannelConnection(row) {
    return row || null;
}

async function getChannelConnection(organizationId, channel, provider) {
    let query = supabase
        .from('b_channel_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('channel', channel);

    if (provider) query = query.eq('provider', provider);

    const { data, error } = await query
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (error.code === '42P01') return null;
        throw error;
    }

    return normalizeChannelConnection(data);
}

async function upsertChannelConnection({
    organizationId,
    channel,
    provider,
    status,
    displayName,
    senderIdentity,
    providerResourceId,
    verificationStatus,
    metadata = {},
    lastError = null,
    verifiedAt = null,
}) {
    const payload = {
        organization_id: organizationId,
        channel,
        provider,
        status,
        display_name: displayName || null,
        sender_identity: senderIdentity || null,
        provider_resource_id: providerResourceId || null,
        verification_status: verificationStatus || 'not_started',
        metadata,
        last_error: lastError,
        verified_at: verifiedAt,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('b_channel_connections')
        .upsert(payload, { onConflict: 'organization_id,channel,provider' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

function deriveEmailVerification(senderEmail) {
    const senderDomain = getDomain(senderEmail);
    const platformDomain = getPlatformEmailDomain();
    const sameDomainAsPlatform = Boolean(senderDomain && platformDomain && senderDomain === platformDomain);

    return {
        status: CHANNEL_STATUS.ACTIVE,
        verificationStatus: sameDomainAsPlatform ? 'domain_verified' : 'reply_to_only',
        metadata: {
            mode: sameDomainAsPlatform ? 'verified_from' : 'platform_sender_reply_to',
            platform_from_domain: platformDomain,
            sender_domain: senderDomain,
            note: sameDomainAsPlatform
                ? 'Sender domain matches the platform sender domain.'
                : 'Email will send from the verified platform address and use this sender as Reply-To until domain authentication is added.',
        },
        verifiedAt: sameDomainAsPlatform ? new Date().toISOString() : null,
    };
}

async function upsertEmailConnection(organizationId, { senderName, senderEmail }) {
    if (!senderName || !senderEmail) throw new Error('Sender name and sender email are required');
    if (!isValidEmail(senderEmail)) throw new Error('Enter a valid sender email address');

    const normalizedEmail = senderEmail.trim().toLowerCase();
    const verification = deriveEmailVerification(normalizedEmail);

    return upsertChannelConnection({
        organizationId,
        channel: 'email',
        provider: process.env.EMAIL_PROVIDER || 'platform_smtp',
        status: verification.status,
        displayName: senderName.trim(),
        senderIdentity: normalizedEmail,
        verificationStatus: verification.verificationStatus,
        metadata: verification.metadata,
        verifiedAt: verification.verifiedAt,
    });
}

async function upsertSmsConnection(organizationId, {
    fromNumber,
    businessName,
    website,
    useCase,
    sampleMessage,
    optInDescription,
    requestedBy,
}) {
    const assignedNumber = fromNumber || process.env.TWILIO_PHONE_NUMBER || '';
    const hasComplianceIntake = Boolean(businessName && website && useCase && sampleMessage && optInDescription);
    const status = hasComplianceIntake ? CHANNEL_STATUS.ACTIVE : CHANNEL_STATUS.PENDING_VERIFICATION;

    let request = null;
    try {
        const { data, error } = await supabase
            .from('b_sms_number_requests')
            .insert({
                organization_id: organizationId,
                requested_by: requestedBy || null,
                status: status === CHANNEL_STATUS.ACTIVE ? 'active' : 'pending_compliance',
                business_name: businessName || null,
                website: website || null,
                use_case: useCase || null,
                sample_message: sampleMessage || null,
                opt_in_description: optInDescription || null,
                assigned_number: assignedNumber || null,
                metadata: {
                    managed_by: 'broadcastpilot',
                    note: hasComplianceIntake
                        ? 'Compliance intake captured. Marked active for platform-managed sending.'
                        : 'Compliance intake is incomplete. Keep SMS paused for broadcasts.',
                },
            })
            .select()
            .single();
        if (error && error.code !== '42P01') throw error;
        request = data || null;
    } catch (error) {
        if (error.code !== '42P01') throw error;
    }

    return upsertChannelConnection({
        organizationId,
        channel: 'sms',
        provider: 'twilio',
        status,
        displayName: assignedNumber ? `SMS ${assignedNumber}` : 'SMS Number Pending',
        senderIdentity: assignedNumber || null,
        providerResourceId: request?.id || null,
        verificationStatus: hasComplianceIntake ? 'platform_managed_active' : 'pending_compliance',
        metadata: {
            request_id: request?.id || null,
            business_name: businessName || null,
            website: website || null,
            use_case: useCase || null,
            compliance_required: true,
        },
        verifiedAt: hasComplianceIntake ? new Date().toISOString() : null,
    });
}

async function getEmailStatus(organizationId, fallbackCreds) {
    const connection = await getChannelConnection(organizationId, 'email');
    if (connection) return connection;
    if (!fallbackCreds?.from_email) return null;

    const verification = deriveEmailVerification(fallbackCreds.from_email);
    return {
        channel: 'email',
        provider: 'legacy',
        status: verification.status,
        display_name: fallbackCreds.smtp_user,
        sender_identity: fallbackCreds.from_email,
        verification_status: verification.verificationStatus,
        metadata: verification.metadata,
    };
}

async function getSmsStatus(organizationId, fallbackCreds) {
    const connection = await getChannelConnection(organizationId, 'sms');
    if (connection) return connection;
    if (!fallbackCreds?.from_number) return null;

    return {
        channel: 'sms',
        provider: 'legacy',
        status: CHANNEL_STATUS.ACTIVE,
        display_name: `SMS ${fallbackCreds.from_number}`,
        sender_identity: fallbackCreds.from_number,
        verification_status: 'legacy_active',
        metadata: { mode: 'legacy_platform_number' },
    };
}

function isActiveConnection(connection) {
    return connection?.status === CHANNEL_STATUS.ACTIVE;
}

module.exports = {
    CHANNEL_STATUS,
    getChannelConnection,
    getEmailStatus,
    getSmsStatus,
    isActiveConnection,
    upsertChannelConnection,
    upsertEmailConnection,
    upsertSmsConnection,
};
