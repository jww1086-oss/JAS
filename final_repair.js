const fs = require('fs');

const targetFile = 'app.js';
let content = fs.readFileSync(targetFile, 'utf8');

// 1. GAS_URL은 이미 master_restore.js가 수정했으므로 유지

// 2. 인코딩 깨짐 (Double Encoding: UTF-8 -> EUC-KR -> UTF-8) 복구
const mapping = [
    { from: /?시?/g, to: "실시간" },
    { from: /?속 ?/g, to: "접속 중" },
    { from: /?이/g, to: "데이터" },
    { from: /?속/g, to: "소속" },
    { from: /?/g, to: "점검자" },
    { from: /?업?/g, to: "작업명" },
    { from: /부?명/g, to: "부서명" },
    { from: /?시/g, to: "일시" },
    { from: /?업?계/g, to: "작업단계" },
    { from: /?험?인/g, to: "위험요인" },
    { from: /?재?전조치/g, to: "현재안전조치" },
    { from: /개선??/g, to: "개선대책" },
    { from: /?재_?험??/g, to: "현재_위험도" },
    { from: /?류_?험??/g, to: "잔류_위험도" },
    { from: /?름/g, to: "이름" },
    { from: /?태/g, to: "상태" },
    { from: /?면/g, to: "화면" },
    { from: /?인/g, to: "확인" },
    { from: /?택/g, to: "선택" },
    { from: /?행/g, to: "실행" },
    { from: /?보/g, to: "정보" },
    { from: /?정/g, to: "설정" },
    { from: /?동/g, to: "자동" },
    { from: /?료/g, to: "완료" },
    { from: /?공/g, to: "성공" },
    { from: /?패/g, to: "실패" },
    { from: /?력/g, to: "입력" },
    { from: /?명/g, to: "명단" },
    { from: /?롭?운/g, to: "드롭다운" },
    { from: /?환/g, to: "전환" },
    { from: /?동/g, to: "이동" }
];

// 정규식 매칭이 어려울 수 있으므로 split/join 사용
const rawMapping = {
    "?시?": "실시간",
    "?속 ?": "접속 중",
    "?이": "데이터",
    "부?명": "부서명",
    "?업?": "작업명",
    "?시": "일시",
    "?": "점검자",
    "?업?계": "작업단계",
    "?험?인": "위험요인",
    "?재?전조치": "현재안전조치",
    "개선??": "개선대책",
    "?재_?험??": "현재_위험도",
    "?류_?험??": "잔류_위험도",
    "?름": "이름",
    "?속": "소속",
    "?태": "상태",
    "?면": "화면"
};

for (const [broken, fixed] of Object.entries(rawMapping)) {
    content = content.split(broken).join(fixed);
}

// 3. 정규식 복구
const regex1_old = '(?=[0-9]+\\.|[0-9]+\\)|[????|\\([0-9]+\\)|(?:\\n|^)[-*??';
const regex1_new = '(?=[0-9]+\\.|[0-9]+\\)|[Ⅰ-Ⅳ]|\\([0-9]+\\)|(?:\\n|^)[-*●])';
content = content.split(regex1_old).join(regex1_new);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Final Deep Repair Complete.');
