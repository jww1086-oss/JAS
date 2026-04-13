const fs = require('fs');

const csvPath = 'master_risks.csv';
const jsonPath = 'master_data.json';

try {
    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // 부서명 -> 작업부서 변환
    const headerMapping = {
        '부서명': '작업부서',
        '작업명': '작업명',
        '작업단계': '작업단계',
        '위험요인': '위험요인',
        '현재안전조치_이행내역': '현재안전조치',
        '개선대책_이행내역': '개선대책',
        '현재_위험성': '위험도'
    };

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // 쉼표로 분리 (따옴표 내 쉼표 무시하는 간단한 로직)
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        let obj = {};
        
        headers.forEach((h, index) => {
            const cleanHeader = headerMapping[h] || h;
            let val = row[index] ? row[index].replace(/^"|"$/g, '').trim() : "";
            obj[cleanHeader] = val;
        });
        
        if (obj['작업부서'] && obj['작업명']) {
            results.push(obj);
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`✅ Success: ${results.length} rows converted to ${jsonPath}`);
} catch (err) {
    console.error('❌ Error:', err.message);
}
