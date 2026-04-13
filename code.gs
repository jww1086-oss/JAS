/**
 * KOMIPO 스마트 안전 시스템 - Google Apps Script (v32.0-ULTIMATE)
 * 1. 시트 이름 완벽 동기화 (위험성평가실시, TBM실시, 개선대책실행계획서)
 * 2. 사진 및 서명 이미지 자동 삽입 (Base64 to Blob)
 * 3. 행 높이 및 컬럼 너비 자동 최적화
 * 4. [v32.1] 작업단계(step_name) 폴백 강화
 */

const SPREADSHEET_ID = "1_qLqeCtpr8D66oj7TjNwqvvUNa4xU7m_QVpdyzKryeE";

// [중요] 시트 이름 설정 (사용자 시트 탭 이름과 정확히 일치해야 함)
const SHEET_NAMES = {
  MASTER: "위험성평가자료",
  USERS: "평가자명단",
  LOGS: "위험성평가실시",
  TBM_LOGS: "TBM실시",
  IMPROVE_PLAN: "개선대책실행계획서"
};

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const type = e.parameter.type || "master";
    const callback = e.parameter.callback;
    
    let sheetName = SHEET_NAMES.MASTER;
    if (type === "users") sheetName = SHEET_NAMES.USERS;
    else if (type === "logs") sheetName = SHEET_NAMES.LOGS;
    
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return returnJSONP([], callback);
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return returnJSONP([], callback);

    const headers = data[0];
    const rows = data.slice(1);
    const result = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        if (header) obj[header.toString().trim()] = row[i];
      });
      return obj;
    });
    return returnJSONP(result, callback);
  } catch (err) {
    return returnJSONP({ status: "error", message: err.message }, e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const params = JSON.parse(e.postData.contents);
    const now = new Date();
    const worker = params.worker || "미정";
    const dept = params.department || "미지정";
    const task = params.task || "내용없음";

    // 1. TBM 제출 처리 (TBM실시 시트)
    if (params.type === "TBM_SUBMISSION") {
      let tbmSheet = ss.getSheetByName(SHEET_NAMES.TBM_LOGS);
      if (!tbmSheet) {
        tbmSheet = ss.insertSheet(SHEET_NAMES.TBM_LOGS);
        tbmSheet.appendRow(["일시", "부서명", "작업명", "점검자", "체크항목수", "서명", "상태"]);
        tbmSheet.getRange(1, 1, 1, 7).setBackground("#eff6ff").setFontWeight("bold");
      }
      const lastRow = tbmSheet.getLastRow() + 1;
      tbmSheet.appendRow([now, dept, task, worker, params.checkedCount || 0, "", "완료"]);
      if (params.signature) insertImageSafe(tbmSheet, params.signature, lastRow, 6);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. 위험성평가 로그 처리 (위험성평가실시 시트)
    let logSheet = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_NAMES.LOGS);
      logSheet.appendRow([
        "일시", "부서명", "작업명", "점검자", "작업단계", "위험요인", 
        "현재안전조치", "개선대책", "현재_빈도", "현재_강도", "현재_위험도", 
        "잔류_빈도", "잔류_강도", "잔류_위험도", "현장사진", "최종서명"
      ]);
      logSheet.getRange(1, 1, 1, 16).setBackground("#f8fafc").setFontWeight("bold");
    }

    if (params.logs && Array.isArray(params.logs)) {
      params.logs.forEach(log => {
        const lastRow = logSheet.getLastRow() + 1;
        // [v35.8.8 호환 고도화] step_name 뿐만 아니라 다양한 키 지원
        const stepValue = (log.step_name || log.step || log.작업단계 || "").toString().trim() || "작업진행";
        
        logSheet.appendRow([
          now, dept, task, worker, stepValue, log.hazard || "", 
          log.current_measures || "", log.improvements_checked || "",
          log.current_frequency || 1, log.current_severity || 1, log.current_score || 1,
          log.residual_frequency || 1, log.residual_severity || 1, log.residual_score || 1,
          "", ""
        ]);
        if (params.photo) insertImageSafe(logSheet, params.photo, lastRow, 15);
        if (params.signature) insertImageSafe(logSheet, params.signature, lastRow, 16);
      });
    }

    // 3. 개선대책 실행계획서 자동 기입 (개선대책실행계획서 시트)
    if (params.improvement_plan && params.improvement_plan.length > 0) {
      let improveSheet = ss.getSheetByName(SHEET_NAMES.IMPROVE_PLAN);
      if (!improveSheet) {
        improveSheet = ss.insertSheet(SHEET_NAMES.IMPROVE_PLAN);
        improveSheet.appendRow(["기록일시", "부서명", "작업명", "위험요인", "개선대책내용", "담당자", "상태", "현장사진"]);
        improveSheet.getRange(1, 1, 1, 8).setBackground("#fff7ed").setFontWeight("bold");
      }
      params.improvement_plan.forEach(plan => {
        const lastRow = improveSheet.getLastRow() + 1;
        improveSheet.appendRow([now, dept, task, plan.hazard, plan.improvement_measure, worker, "진행중", ""]);
        if (params.photo) insertImageSafe(improveSheet, params.photo, lastRow, 8);
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** [Helper] 이미지를 시트에 실제 그림으로 삽입 (셀 맞춤) */
function insertImageSafe(sheet, base64Str, row, col) {
  try {
    if (!base64Str || !base64Str.includes(",")) return;
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Str.split(",")[1]), "image/png", "img_" + row + "_" + col + ".png");
    sheet.setRowHeight(row, 80); // 행 높이 최적화
    sheet.setColumnWidth(col, 120); // 컬럼 너비 최적화
    sheet.insertImage(blob, col, row, 5, 5).setHeight(70).setWidth(110);
  } catch (e) {
    sheet.getRange(row, col).setValue("이미지 삽입 실패");
  }
}

function returnJSONP(data, callback) {
  const jsonString = JSON.stringify(data);
  return callback 
    ? ContentService.createTextOutput(callback + "(" + jsonString + ")").setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
}
