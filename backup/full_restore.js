const fs = require('fs');

const targetFile = 'app.js';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. GAS_URL 수정
content = content.replace(/\/exec\/exec/g, "/exec");

// 2. 한글 깨짐 패턴 매핑 (v34.3 기반 복구)
const mapping = [
    { from: /부[\s\S]?명/g, to: "부서명" }, // 부?명, 부명 등
    { from: /[\s\S]?업[\s\S]?/g, to: "작업명" }, // ?업?, ?업 등
    { from: /[\s\S]?시/g, to: "일시" },
    { from: /[\s\S]{2,4}/g, to: "점검자" }, // ???? 등
    { from: /[\s\S]?업[\s\S]?계/g, to: "작업단계" },
    { from: /[\s\S]?험[\s\S]?인/g, to: "위험요인" },
    { from: /[\s\S]?재[\s\S]?전조치/g, to: "현재안전조치" },
    { from: /개선[\s\S]?/g, to: "개선대책" },
    { from: /[\s\S]?재_[\s\S]?험[\s\S]{2}/g, to: "현재_위험도" },
    { from: /[\s\S]?류_[\s\S]?험[\s\S]{2}/g, to: "잔류_위험도" }
];

// 위와 같이 정규식으로 하면 위험하므로, 아주 구체적인 문자열 매칭으로 전환합니다.
// view_file에서 확인한 실제 깨진 형태들:
const fixedStrings = {
    "부?명": "부서명",
    "?업?": "작업명",
    "????": "점검자",
    "?시": "일시",
    "?업?계": "작업단계",
    "?험?인": "위험요인",
    "?재?전조치": "현재안전조치",
    "개선??": "개선대책",
    "?재_?험??": "현재_위험도",
    "?류_?험??": "잔류_위험도",
    "?시?ON": "실시간 ON",
    "?속 ?..": "접속 중..",
    "?? ?데이터 ?시??기???도 ?..": "최근 데이터 실시간 동기화 시도 중..",
    "?️ ?당 ?업???의???계가 ?습?다.": "⚠️ 해당 작업에 정의된 단계가 없습니다.",
    "?️ ?????명??먼? ?력??주세??": "⚠️ 점검자 이름을 먼저 입력해 주세요.",
    "부?명 매칭 ?패": "부서명 매칭 실패",
    "? 로컬 캐시 ?이??로드 ?료": "✅ 로컬 캐시 데이터 로드 완료",
    "? 구? ?트? ?시??결?었?니??": "✅ 구글 시트와 실시간 연결되었습니다."
};

for (const [broken, fixed] of Object.entries(fixedStrings)) {
    content = content.split(broken).join(fixed);
}

// 3. 정규식 깨짐 복구 (Line 52, 53)
const regex1_old = '(?=[0-9]+\\.|[0-9]+\\)|[????|\\([0-9]+\\)|(?:\\n|^)[-*??)';
const regex1_new = '(?=[0-9]+\\.|[0-9]+\\)|[Ⅰ-Ⅳ]|\\([0-9]+\\)|(?:\\n|^)[-*●])';
content = content.split(regex1_old).join(regex1_new);

const regex2_old = '^[0-9]+\\.|^[0-9]+\\)|^[????|^\\([0-9]+\\)|^-|^\\*|^\\??^\\??';
const regex2_new = '^[0-9]+\\.|^[0-9]+\\)|^[Ⅰ-Ⅳ]|^\\([0-9]+\\)|^-|^\\*|^●|^ㆍ';
content = content.split(regex2_old).join(regex2_new);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Final Restoration Complete.');
