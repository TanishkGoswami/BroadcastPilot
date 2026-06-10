/**
 * src/utils/broadcastUtils.js
 * Utility functions for WhatsApp broadcast campaigns.
 */

function normalizeTemplateHeaderMedia(mapping, fallbackType) {
    const source = mapping && typeof mapping === 'object' ? mapping : {};
    const type = String(
        source._header_media_type ||
        source.header_media_type ||
        fallbackType ||
        ''
    ).toLowerCase();
    const url = String(
        source._header_media_url ||
        source.header_media_url ||
        source.headerImageUrl ||
        source.header_image_url ||
        source.headerUrl ||
        ''
    ).trim();

    return { type, url };
}

function normalizeDynamicUrlButtonValue(templateUrl, value) {
    let cleanValue = String(value || '').trim();
    const cleanTemplateUrl = String(templateUrl || '');
    const placeholderIndex = cleanTemplateUrl.indexOf('{{');
    const staticPrefix = placeholderIndex >= 0 ? cleanTemplateUrl.slice(0, placeholderIndex) : '';

    if (staticPrefix && cleanValue.startsWith(staticPrefix)) {
        cleanValue = cleanValue.slice(staticPrefix.length);
    }

    if (staticPrefix.endsWith('/') && cleanValue.startsWith('/')) {
        cleanValue = cleanValue.slice(1);
    }

    return cleanValue;
}

function validateDynamicUrlButtonValue(templateUrl, value) {
    const rawValue = String(value || '').trim();
    const cleanTemplateUrl = String(templateUrl || '');
    const placeholderIndex = cleanTemplateUrl.indexOf('{{');
    const staticPrefix = placeholderIndex >= 0 ? cleanTemplateUrl.slice(0, placeholderIndex) : '';
    const normalizedValue = normalizeDynamicUrlButtonValue(templateUrl, rawValue);
    const isAbsoluteUrl = /^https?:\/\//i.test(rawValue);

    if (staticPrefix && isAbsoluteUrl && !rawValue.startsWith(staticPrefix)) {
        return {
            ok: false,
            value: normalizedValue,
            error: `URL button is approved for ${staticPrefix}... Enter only the placeholder part for that approved URL, or create a new Meta template for this different domain.`
        };
    }

    if (staticPrefix && /^https?:\/\//i.test(normalizedValue)) {
        return {
            ok: false,
            value: normalizedValue,
            error: 'URL button needs only the placeholder value, not a full URL.'
        };
    }

    return {
        ok: !!normalizedValue,
        value: normalizedValue,
        error: 'URL button placeholder value is required.'
    };
}

function resolveTemplateButtonUrl(templateUrl, value) {
    const cleanTemplateUrl = String(templateUrl || '').trim();
    if (!cleanTemplateUrl) return '';

    const cleanValue = normalizeDynamicUrlButtonValue(cleanTemplateUrl, value);
    if (!cleanTemplateUrl.includes('{{')) return cleanTemplateUrl;

    return cleanTemplateUrl.replace(/\{\{\s*\d+\s*\}\}/g, cleanValue);
}

function getMetaSendErrorMessage(error) {
    const code = error?.code;
    const details = error?.error_data?.details || error?.message || '';
    if (code === 131009) return 'Parameter format does not match template expected format';
    if (code === 131000) return 'Message failed to send because more than 24 hours have passed since the customer last replied to this number.';
    if (code === 131026) return 'Message undeliverable. The number might be invalid or not on WhatsApp.';
    if (code === 132000) return 'Number of parameters does not match the expected number of parameters';
    if (code === 132001) return 'Template does not exist in the specified language';
    if (code === 132015) return 'Template has been paused or disabled by Meta';
    if (code === 133010) return 'Phone number is not formatted properly. Include the country code without plus or symbols.';
    if (code === 131047) return 'More than 24 hours have passed since the customer last replied. (Re-engagement restriction)';
    return details || 'Meta API Error';
}

module.exports = {
    normalizeTemplateHeaderMedia,
    normalizeDynamicUrlButtonValue,
    validateDynamicUrlButtonValue,
    resolveTemplateButtonUrl,
    getMetaSendErrorMessage
};
