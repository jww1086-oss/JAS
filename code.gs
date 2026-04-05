/**
 * KOMIPO 스마트 안전 시스템 - Google Apps Script (v25.4-premium)
 * 
 * [설정 방법]
 * 1. SPREADSHEET_ID를 실제 구글 시트 ID로 변경하세요.
 * 2. 수정한 후 '배포' -> '새 배포' -> '웹 앱' (액세스 권한: 모든 사용자)으로 배포합니다.
 */

const SPREADSHEET_ID = "1_qLqeCtpr8D66oj7TjNwqvvUNa4xU7m_QVpdyzKryeE"; 

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const type = e.parameter.type || "master";
    const callback = e.parameter.callback;
    
    let sheetName = "위험성_마스터";
    if (type === "users") sheetName = "평가자명단";
    else if (type === "logs") sheetName = "실시로그";
    
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("'" + sheetName + "' 시트를 찾을 수 없습니다.");
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return returnJSONP([], callback); // 데이터가 헤더뿐이면 빈 배열 반환

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

function returnJSONP(data, callback) {
  const jsonString = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + jsonString + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const params = JSON.parse(e.postData.contents);
    
    // 1. '실시로그' 시트 확보 및 헤더 자동 생성 (16컬럼 정밀 모드)
    let logSheet = ss.getSheetByName("실시로그");
    if (!logSheet) {
      logSheet = ss.insertSheet("실시로그");
      logSheet.appendRow([
        "일시", "부서명", "작업명", "점검자", "작업단계", "위험요인", 
        "현재안전조치", "개선대책", "현재_빈도", "현재_강도", "현재_위험도", 
        "잔류_빈도", "잔류_강도", "잔류_위험도", "사진URL", "서명URL"
      ]);
      logSheet.getRange(1, 1, 1, 16).setBackground("#f8fafc").setFontWeight("bold");
    }
    
    const now = new Date();
    const worker = params.worker || "미지정";
    const dept = params.department || "미지정";
    const task = params.task || "내용없음";
    
    // 2. 다중 로그(logs[]) 데이터 저장 (A-P열 매핑)
    if (params.logs && Array.isArray(params.logs)) {
      params.logs.forEach(log => {
        logSheet.appendRow([
          now,                            // A: 일시
          dept,                           // B: 부서명
          task,                           // C: 작업명
          worker,                         // D: 점검자
          log.step_name || "",            // E: 작업단계
          log.hazard || "",               // F: 위험요인
          log.current_measures || "",      // G: 현재안전조치
          log.improvements_checked || "", // H: 개선대책
          log.current_frequency || 1,     // I: 현재_빈도
          log.current_severity || 1,      // J: 현재_강도
          log.current_score || 1,         // K: 현재_위험도
          log.residual_frequency || 1,    // L: 잔류_빈도
          log.residual_severity || 1,     // M: 잔류_강도
          log.residual_score || 1,        // N: 잔류_위험도
          params.photo || "",             // O: 사진URL
          params.signature || ""          // P: 서명URL
        ]);
      });
    }

    // 3. '개선대책_실행계획서' 동기화 (있는 경우만)
    if (params.improvement_plan && params.improvement_plan.length > 0) {
      let improveSheet = ss.getSheetByName("개선대책_실행계획서");
      if (!improveSheet) {
        improveSheet = ss.insertSheet("개선대책_실행계획서");
        improveSheet.appendRow(["개선예정일", "담당부서", "작업명", "위험요인", "개선대책", "담당자", "상태"]);
        improveSheet.getRange(1, 1, 1, 7).setBackground("#f1f5f9").setFontWeight("bold");
      }
      
      params.improvement_plan.forEach(plan => {
        improveSheet.appendRow([
          plan.improvement_date, dept, task, plan.hazard, plan.improvement_measure, worker, "진행중"
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
