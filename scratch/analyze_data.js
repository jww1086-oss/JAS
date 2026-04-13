const fs = require('fs');
const content = fs.readFileSync('master_data_utf8.js', 'utf8');
// MASTER_DATA 변수에서 배열을 추출하여 길이를 확인합니다.
try {
    const match = content.match(/const MASTER_DATA = (\[[\s\S]*\]);/);
    if (match) {
        const data = eval(match[1]);
        console.log("Total Records in MASTER_DATA:", data.length);
        
        // 작업명의 고유 개수 확인
        const tasks = [...new Set(data.map(item => item.작업명))];
        console.log("Unique Tasks count:", tasks.length);
        
        // 상위 5개 데이터 미리보기
        console.log("First 5 records:", JSON.stringify(data.slice(0, 5), null, 2));
    } else {
        console.log("MASTER_DATA not found in file.");
    }
} catch (e) {
    console.error("Error parsing MASTER_DATA:", e);
}
