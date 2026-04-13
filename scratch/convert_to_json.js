const fs = require('fs');
const path = require('path');

// 부모 디렉토리의 파일을 찾도록 경로 수정
const inputPath = path.join(__dirname, '..', 'master_data_utf8.js');
const outputPath = path.join(__dirname, '..', 'master_data.json');

try {
    let content = fs.readFileSync(inputPath, 'utf8');
    
    const startIdx = content.indexOf('[');
    const endIdx = content.lastIndexOf(']');
    
    if (startIdx !== -1 && endIdx !== -1) {
        const jsonContent = content.substring(startIdx, endIdx + 1);
        // 검증
        const data = JSON.parse(jsonContent); 
        fs.writeFileSync(outputPath, jsonContent, 'utf8');
        console.log(`✅ [SUCCESS] master_data.json 생성 완료! (건수: ${data.length}건)`);
    } else {
        console.error("❌ [ERROR] 배열 구조를 찾을 수 없습니다.");
    }
} catch (err) {
    console.error("❌ [ERROR] 변환 중 오류 발생:", err);
}
