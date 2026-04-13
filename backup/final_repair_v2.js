const fs = require('fs');

const targetFile = 'app.js';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. 단순 문자열 치환 매핑 (정규식 지양)
const stringMapping = {
    "?시?": "실시간",
    "?속 ?": "접속 중",
    "부?명": "부서명",
    "?업?": "작업명",
    "?": "점검자",
    "?시": "일시",
    "?업?계": "작업단계",
    "?험?인": "위험요인",
    "?재?전조치": "현재안전조치",
    "개선??": "개선대책",
    "?재_?험??": "현재_위험도",
    "?류_?험??": "잔류_위험도",
    "?름": "이름",
    "?속": "소속",
    "?태": "상태",
    "?면": "화면",
    "?인": "확인",
    "?택": "선택",
    "?행": "실행",
    "?보": "정보",
    "?정": "설정",
    "?동": "자동",
    "?료": "완료",
    "?공": "성공",
    "?패": "실패",
    "?력": "입력",
    "?명": "명단",
    "?롭?운": "드롭다운",
    "?환": "전환",
    "?동": "이동",
    "?이": "데이터",
    "?시": "표시",
    "?리": "처리",
    "?성": "생성",
    "?비": "준비",
    "?작": "시작",
    "?정": "지정",
    "?용": "적용",
    "?서": "문서",
    "?항": "항목",
    "?견": "의견",
    "?출": "출력",
    "?성": "작성"
};

for (const [broken, fixed] of Object.entries(stringMapping)) {
    content = content.split(broken).join(fixed);
}

// 2. 정규식 깨짐 복구 (Line 52, 53)
const regex1_old = '(?=[0-9]+\\.|[0-9]+\\)|[????|\\([0-9]+\\)|(?:\\n|^)[-*??';
const regex1_new = '(?=[0-9]+\\.|[0-9]+\\)|[Ⅰ-Ⅳ]|\\([0-9]+\\)|(?:\\n|^)[-*●])';
content = content.split(regex1_old).join(regex1_new);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Final Repair v2 Complete.');
