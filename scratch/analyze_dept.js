const fs = require('fs');
const content = fs.readFileSync('master_data_utf8.js', 'utf8');
try {
    const match = content.match(/const MASTER_DATA = (\[[\s\S]*\]);/);
    if (match) {
        const data = eval(match[1]);
        // 부서명을 기준으로 그룹화
        const deptGroup = {};
        data.forEach(item => {
            const dept = item.부서명 || item["부서"];
            if (!deptGroup[dept]) deptGroup[dept] = new Set();
            deptGroup[dept].add(item.작업명 || item["작업"]);
        });
        
        console.log("Departments found:", Object.keys(deptGroup));
        for (const dept in deptGroup) {
            console.log(`Dept: ${dept}, Unique Tasks: ${deptGroup[dept].size}`);
        }
    }
} catch (e) {
    console.error(e);
}
