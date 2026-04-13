
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix broken Korean characters in selectAssessmentTask
content = content.replace(/遺€\?쒕챸/g, '부서명');
content = content.replace(/\?묒뾽紐\?/g, '작업명');
content = content.replace(/\?됯\?\?\?\?\?깅챸 ?낅젰/g, '평가자 성명 입력');
content = content.replace(/\?댁쟾\?④퀎/g, '이전단계');
content = content.replace(/\?ㅼ쓬\?④퀎/g, '다음단계');

// Remove the toast in finalizeSync
const toastSnippet = /setTimeout\(\(\) => \{[\s\S]*?showToast\("📱 최신 데이터와 동기화되었습니다\."\);[\s\S]*?\}, 3000\);/;
content = content.replace(toastSnippet, '// Toast removed by user request');

// Extra check for version name or other broken Korean if any
content = content.replace(/\?됯\?\?\?\?\?깅챸\?\? 異붽\? \?먮뒗 \?좏깮\?섏꽭\?\?/g, '평가자 성명을 추가 또는 선택하세요.');

fs.writeFileSync(filePath, content, 'utf8');
console.log('app.js polished successfully.');
