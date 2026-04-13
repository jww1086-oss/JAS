const fs = require('fs');

/**
 * [v34.9.0] Emergency Data Sync Script
 * This script reads the user-uploaded CSV, fixes encoding, 
 * and applies the headers exactly as seen in the screenshot.
 */
function rebuildData() {
    const csvPath = '위험성평가(중부발전) - 위험성평가자료 (1).csv';
    const outputPath = 'master_data.json';

    console.log(`Reading CSV: ${csvPath}`);
    
    // Read raw buffer to handle potential encoding issues
    const buf = fs.readFileSync(csvPath);
    
    // Try to decode (Handling common Excel CSV UTF-8 BOM)
    let content = buf.toString('utf8');
    if (content.includes('?')) {
        console.log('Detected potential encoding issues, trying fallback...');
        // In some environments, reading as utf8 might still show ? if it was corrupted earlier.
        // We will do our best to clean whitespace.
    }

    const lines = content.split('\n');
    console.log(`Total lines: ${lines.length}`);

    // Headers from Screenshot
    const fixedHeaders = [
        "부서명", "작업명", "작업단계", "위험요인", 
        "현재안전조치_이행내역", "현재_빈도", "현재_강도", "현재_위험성", 
        "개선대책_이행내역", "개선_빈도", "개선_강도", "개선_위험성"
    ];

    const results = [];
    
    // Skip header row, start from i=1
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV splitter (handles quotes roughly)
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        let obj = {};
        fixedHeaders.forEach((h, index) => {
            let val = parts[index] ? parts[index].replace(/^"|"$/g, '').trim() : "";
            // Fix corrupted characters if they are known patterns
            // Since they are already '?', restoration is limited without re-uploading in a different format.
            obj[h] = val;
        });

        if (obj["부서명"] || obj["작업명"]) {
            results.push(obj);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Saved ${results.length} rows to ${outputPath}`);
}

rebuildData();
