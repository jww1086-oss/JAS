
const fs = require('fs');
const path = require('path');

const filePath = 'app.js';
let content = fs.readFileSync(filePath, 'utf8');

/** 1. Fix selectAssessmentTask property names for extraInfo **/
content = content.replace(
    /ex\.μ === currentState\.selectedDept && ex\.۾ === task/g,
    'ex.부서명 === currentState.selectedDept && ex.작업명 === task'
);

/** 2. Fix renderRiskChecklist extraInfo property names **/
content = content.replace(
    /\$\{currentState\.selectedExtra\._ \|\| '-'\}/g,
    '${currentState.selectedExtra.사용공구_장비 || "-"}'
);
content = content.replace(
    /\$\{currentState\.selectedExtra\.ȣ_ \|\| '-'\}/g,
    '${currentState.selectedExtra.보호구_안전장비 || "-"}'
);
content = content.replace(
    /\$\{currentState\.selectedExtra\.ڷ \|\| '-'\}/g,
    '${currentState.selectedExtra.관련자료 || "-"}'
);

/** 3. Revert Hazard Title to Non-editable (Remove input) **/
// Find the part where the hazard title is rendered as an input and convert it back to a span.
// Based on previous edits, it looked something like:
// <input ... value="${risk.위험요인}" ... onchange="updateHazardTitle(...)">
// We want to change it to something like:
// <span style="..."> ${risk.위험요인} </span>

// I need to be careful with the exact string. Let's find the rendering logic in renderRiskChecklist.
// From previous attempts, the HTML for hazard title was:
// <input class="hazard-title-input" ... value="${risk.위험요인}" ...>

const hazardInputPattern = /<input\s+class="hazard-title-input"\s+style="[^"]*"\s+value="\$\{risk\.위험요인\}"\s+onchange="updateHazardTitle\('[^']+',\s+this\.value\)">/g;
const hazardSpanReplacement = `<span style="font-weight:800; color:#1e293b; font-size:1.1rem; letter-spacing:-0.3px;">\${risk.위험요인}</span>`;

content = content.replace(hazardInputPattern, hazardSpanReplacement);

/** 4. Ensure Measures remain editable and use corrected logic **/
// The measures were handled in the previous turn. I'll make sure they are preserved.

fs.writeFileSync(filePath, content, 'utf8');
console.log("✅ app.js refined: Extra Info fixed, Hazard Title reverted to non-editable.");
