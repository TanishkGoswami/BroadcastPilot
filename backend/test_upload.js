const fs = require('fs');
const xlsx = require('xlsx');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// 1. Read the sample file into a buffer to simulate multer
const fileBuffer = fs.readFileSync('../sample_leads.csv');

// 2. Parse Excel/CSV from buffer (matching our backend logic)
const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0]; // Take first sheet
const worksheet = workbook.Sheets[sheetName];

// 3. Convert to array of arrays (header=1)
const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Raw Rows Parsed:");
console.table(rows);

const leadsToInsert = [];
const invalidRows = [];

// 4. Process rows
for (let i = 1; i < rows.length; i++) {
    const name = rows[i][0];
    const phoneRaw = rows[i][1];
    
    if (!phoneRaw) continue;

    const phoneNumber = parsePhoneNumberFromString(String(phoneRaw), 'IN');
    
    if (phoneNumber && phoneNumber.isValid()) {
        leadsToInsert.push({
            name: name ? String(name) : 'Unknown',
            phone: phoneNumber.format('E.164'), // Meta strictly requires E.164 format
            status: 'PENDING',
        });
    } else {
        invalidRows.push({ row: i + 1, raw_input: phoneRaw });
    }
}

console.log("\n✅ Valid Leads to Insert (Formatted to E.164):");
console.table(leadsToInsert);

console.log("\n❌ Invalid Rows (Will be ignored):");
console.table(invalidRows);
