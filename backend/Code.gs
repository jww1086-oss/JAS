/**
 * Anti-Gravity App Backend (Google Apps Script)
 * 
 * 구글 시트 설정 단계:
 * 1. 구글 시트 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 모두 삭제하고 이 내용을 붙여넣기
 * 3. [배포] > [새 배포] > [웹 앱] 선택
 * 4. 액세스 권한: [모든 사용자(Anyone)]로 설정 후 배포
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SHEET_NAMES = {
  RISK_MASTER: "위험성_마스터",
  LOGS: "실시_로그",
  USERS: "사용자_명단"
};

/**
 * [최초 1회 실행] 데이터베이스 구조 및 샘플 데이터 자동 생성
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 위험성_마스터 생성 (현재안전조치 컬럼 추가)
  if (!ss.getSheetByName(SHEET_NAMES.RISK_MASTER)) {
    const sheet = ss.insertSheet(SHEET_NAMES.RISK_MASTER);
    sheet.appendRow(["ID", "작업단계", "위험요인", "현재안전조치", "개선대책", "위험도"]);
    sheet.getRange("A1:F1").setBackground("#38bdf8").setFontColor("white").setFontWeight("bold");
    sheet.appendRow(["1", "수소 Bottle 상하역", "용기 전도", "고정 벨트 사용 중", "결박 상태 확인 및 서행", "12"]);
    sheet.appendRow(["2", "고소 작업", "추락", "안전모 착용", "안전벨트 체결 및 고리 걸기", "15"]);
  }
  
  // 2. 실시_로그 생성
  if (!ss.getSheetByName(SHEET_NAMES.LOGS)) {
    const sheet = ss.insertSheet(SHEET_NAMES.LOGS);
    sheet.appendRow(["날짜", "근로자명", "작업단계", "확인리스트", "사진URL", "서명URL", "위험도점수"]);
    sheet.getRange("A1:G1").setBackground("#818cf8").setFontColor("white").setFontWeight("bold");
  }
  
  // 3. 사용자_명단 생성
  if (!ss.getSheetByName(SHEET_NAMES.USERS)) {
    const sheet = ss.insertSheet(SHEET_NAMES.USERS);
    sheet.appendRow(["이름", "이메일", "소속", "직책", "경력"]);
    sheet.getRange("A1:E1").setBackground("#10b981").setFontColor("white").setFontWeight("bold");
    sheet.appendRow(["홍길동", "hong@example.com", "안전팀", "과장", "10년"]);
    sheet.appendRow(["김철수", "kim@example.com", "공무팀", "대리", "5년"]);
  }
  
  const defaultSheet = ss.getSheetByName("시트1");
  if (defaultSheet) ss.deleteSheet(defaultSheet);
  
  Logger.log("✅ 데이터베이스 구조 생성이 완료되었습니다!");
}

/**
 * GET 요청 처리: 초기 데이터 로드
 */
function doGet(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const riskSheet = ss.getSheetByName(SHEET_NAMES.RISK_MASTER);
  
  if (!userSheet || !riskSheet) {
    return ContentService.createTextOutput(JSON.stringify({
      error: "데이터베이스가 설정되지 않았습니다. setupDatabase를 실행하세요."
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    users: getSheetData(userSheet),
    risks: getSheetData(riskSheet)
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST 요청 처리: 데이터 저장
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    
    const photoUrl = saveImageToDrive(data.photo, "photo_" + data.workerName);
    const signUrl = saveImageToDrive(data.signature, "sign_" + data.workerName);
    
    const newRow = [
      new Date(), 
      data.workerName, 
      data.taskStep, 
      JSON.stringify(data.checks), 
      photoUrl, 
      signUrl, 
      data.riskScore || 0
    ];
    logSheet.appendRow(newRow);
    
    if (data.riskScore >= 15) sendHighRiskAlert(data.workerName, data.taskStep, data.riskScore);
    generatePDF(newRow);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "데이터가 정상적으로 저장되었습니다.",
      photoUrl: photoUrl 
    })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function saveImageToDrive(base64Data, filename) {
  if (!base64Data) return "";
  const decodedData = Utilities.base64Decode(base64Data.split(",")[1]);
  const blob = Utilities.newBlob(decodedData, "image/png", filename + "_" + Date.now() + ".png");
  let folder;
  const folders = DriveApp.getFoldersByName("AntiGravity_Uploads");
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("AntiGravity_Uploads");
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function sendHighRiskAlert(worker, task, score) {
  MailApp.sendEmail({
    to: "admin@example.com", // 필요시 수정
    subject: "⚠️ 고위험 작업 알림",
    body: `근로자: ${worker}\n작업: ${task}\n점수: ${score}`
  });
}

function generatePDF(rowData) {
  const doc = DocumentApp.create("보고서_" + rowData[1] + "_" + Date.now());
  doc.getBody().appendParagraph("안전 점검 보고서").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  doc.getBody().appendParagraph("점검자: " + rowData[1]);
  doc.getBody().appendParagraph("일시: " + rowData[0]);
  doc.saveAndClose();
}
