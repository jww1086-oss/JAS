
const fs = require('fs');
const path = require('path');

const filePath = 'app.js';
let content = fs.readFileSync(filePath, 'utf8');

/** 1. Remove Toast Messages **/
// Toast 1: 초고속 모드
content = content.replace(/if\s*\(typeof\s+showToast\s*===\s*'function'\)\s*\{\s*showToast\("⚡\s*초고속\s*모드:.*"\);\s*\}/g, '// Toast removed');
// Re-checking the exact string from previous view_file (line 295)
content = content.replace(/showToast\("⚡\s*초고속\s*모드:.*"\);/g, '// Toast removed');

// Toast 2: 최신 데이터와 동기화
content = content.replace(/showToast\("🎴\s*최신\s*데이터와\s*동기화되었습니다."\);/g, '// Toast removed');
// Also handle cases with garbled characters if any
content = content.replace(/showToast\(".*최신.*데이터와.*동기화.*"\);/g, '// Toast removed');

/** 2. Fix Extra Info Matching (Trim added) **/
content = content.replace(
    /ex\.부서명\s*===\s*currentState\.selectedDept\s*&&\s*ex\.작업명\s*===\s*task/g,
    '(ex.부서명||"").trim() === (currentState.selectedDept||"").trim() && (ex.작업명||"").trim() === (task||"").trim()'
);

/** 3. Revert Hazard Title to non-editable span **/
const hazardInputPattern = /<input\s+type="text"\s+class="risk-edit-input"\s+value="\$\{r\.위험요인\}"\s+onclick="event\.stopPropagation\(\)"\s+onchange="updateHazardTitle\('\$\{key\}',\s+this\.value\)"\s+style="[^"]*"\s+onfocus="[^"]*"\s+onblur="[^"]*">/g;
const hazardSpanReplacement = `<span style="flex: 1; font-weight: 900; color: #1e293b; font-size: 1.1rem; padding: 4px; letter-spacing: -0.3px;">\${r.위험요인}</span>`;

content = content.replace(hazardInputPattern, hazardSpanReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log("✅ app.js Final Polish: Toasts removed, Extra Info matching improved, Hazard Title reverted.");
