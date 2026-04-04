/**
 * KOSHA Smart Safety System - Google Apps Script (Multi-Sheet Version)
 * 
 * 기능:
 * 1. GET: 시트 데이터(위험성_마스터, 사용자명단)를 JSON으로 반환
 * 2. POST: 점검 완료 시 '실시로그'와 '개선대책_실행계획서' 시트에 각각 데이터 저장
 */

const SPREADSHEET_ID = "1_qLqeCtpr8D66oj7TjNwqvvUNa4xU7m_QVpdyzKryeE"; 

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const type = e.parameter.type || "master"; // 요청 타입 (master 또는 users)
    let sheetName = (type === "users") ? "평가자명단" : "위험성_마스터";
    
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("'" + sheetName + "' 시트를 찾을 수 없습니다.");
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        if (header) obj[header.toString().trim()] = row[i];
      });
      return obj;
    });
    
    const jsonString = JSON.stringify(result);
    const callback = e.parameter.callback;
    
    // JSONP 지원 (callback 파라미터가 있으면 함수로 감싸서 반환)
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonString + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const data = JSON.parse(e.postData.contents);
    
    // 1. '실시로그' 저장
    const logSheet = ss.getSheetByName("실시로그");
    if (!logSheet) throw new Error("'실시로그' 시트가 없습니다.");
    
    data.logs.forEach(log => {
      logSheet.appendRow([
        new Date(),              // A: 일시
        data.department,         // B: 부서명
        data.task,               // C: 작업명
        data.worker,             // D: 점검자
        log.step_name,           // E: 작업단계 (개별 단계 기록으로 수정)
        log.hazard,              // F: 위험요인
        log.current_measures,    // G: 현재안전조치
        log.improvements_checked,// H: 개선대책
        log.current_score,       // I: 현재_위험도
        log.residual_score       // J: 잔류_위험도
      ]);
    });
    
    // 2. '개선대책_실행계획서' 저장 로직 (사용자 시트 순서에 맞춰 정렬 수정)
    if (data.improvement_plan && data.improvement_plan.length > 0) {
      let improveSheet = ss.getSheetByName("개선대책_실행계획서");
      
      // 시트가 없으면 생성 (제목 순서 지정)
      if (!improveSheet) {
        improveSheet = ss.insertSheet("개선대책_실행계획서");
        improveSheet.appendRow(["개선예정일", "담당부서", "작업명", "위험요인", "개선대책", "담당자", "상태"]);
        improveSheet.getRange(1, 1, 1, 7).setBackground("#f1f5f9").setFontWeight("bold");
      }
      
      // 데이터 입력 (시트 헤더와 순서 정확히 일치시킴)
      data.improvement_plan.forEach(plan => {
        improveSheet.appendRow([
          plan.improvement_date,   // A: 개선예정일
          plan.department,         // B: 담당부서
          plan.task_name,          // C: 작업명
          plan.hazard,             // D: 위험요인
          plan.improvement_measure,// E: 개선대책
          plan.manager,            // F: 담당자
          "진행중"                 // G: 상태 (기본값)
        ]);
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
