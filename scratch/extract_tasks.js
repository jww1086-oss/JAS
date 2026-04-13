const fs = require('fs');
const content = fs.readFileSync('master_data_utf8.js', 'utf8');
// remove 'const MASTER_DATA = ' and ';'
const jsonStr = content.replace('const MASTER_DATA = ', '').trim().replace(/;$/, '');
try {
    const data = JSON.parse(jsonStr);
    const tasksByDept = {};
    const taskCountSet = new Set();
    
    data.forEach(item => {
        if (!tasksByDept[item.부서명]) tasksByDept[item.부서명] = new Set();
        tasksByDept[item.부서명].add(item.작업명);
        taskCountSet.add(`${item.부서명}|${item.작업명}`);
    });
    
    const result = {
        totalTasks: taskCountSet.size,
        depts: Object.keys(tasksByDept).map(dept => ({
            name: dept,
            tasks: Array.from(tasksByDept[dept])
        }))
    };
    
    console.log(JSON.stringify(result, null, 2));
} catch (e) {
    console.error("JSON Parse Error:", e);
}
