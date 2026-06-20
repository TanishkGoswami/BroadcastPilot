function getLeadNameParts(lead) {
    const fullName = String(lead?.name || '').trim();
    const firstName = fullName.split(/\s+/)[0] || '';

    return {
        name: fullName,
        firstName,
    };
}

function personalizeMessage(template, lead) {
    if (typeof template !== 'string') {
        return template;
    }

    const { name, firstName } = getLeadNameParts(lead);
    const safeName = name || 'there';
    const safeFirstName = firstName || safeName;

    return template
        .replace(/\{\{\s*name\s*\}\}/gi, safeName)
        .replace(/\{\{\s*first_name\s*\}\}/gi, safeFirstName)
        .replace(/\{\{\s*firstName\s*\}\}/gi, safeFirstName);
}

module.exports = {
    personalizeMessage,
};
