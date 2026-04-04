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
    const type = e.parameter.type || "master"; 
    let sheetName = "위험성_마스터";
    if (type === "users") {
      sheetName = "평가자명단";
    } else if (type === "logs") {
      sheetName = "실시로그";
    }
    
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
    let logSheet = ss.getSheetByName("실시로그");
    if (!logSheet) {
      logSheet = ss.insertSheet("실시로그");
    }
    
    // 헤더가 없는 경우 자동 생성 (첫 번째 행이 비어있으면)
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow([
        "일시", "부서명", "작업명", "점검자", "작업단계", "위험요인", 
        "현재안전조치", "개선대책", "현재_빈도", "현재_강도", "현재_위험도", 
        "잔류_빈도", "잔류_강도", "잔류_위험도", "종합개선의견"
      ]);
      logSheet.getRange(1, 1, 1, 15).setBackground("#f8fafc").setFontWeight("bold");
    }
    
    data.logs.forEach(log => {
      logSheet.appendRow([
        new Date(),              // A: 일시
        data.department,         // B: 부서명
        data.task,               // C: 작업명
        data.worker,             // D: 점검자
        log.step_name,           // E: 작업단계
        log.hazard,              // F: 위험요인
        log.current_measures,    // G: 현재안전조치
        log.improvements_checked,// H: 개선대책
        log.current_frequency,   // I: 현재_빈도
        log.current_severity,    // J: 현재_강도
        log.current_score,       // K: 현재_위험도
        log.residual_frequency,  // L: 잔류_빈도
        log.residual_severity,   // M: 잔류_강도
        log.residual_score,      // N: 잔류_위험도
        data.overall_improvement // O: 종합개선의견
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
