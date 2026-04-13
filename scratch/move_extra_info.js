
const fs = require('fs');
const path = require('path');

const filePath = 'app.js';
let content = fs.readFileSync(filePath, 'utf8');

/** 1. Add renderExtraInfoInWorkerStep function **/
const renderExtraInfoFunction = `
function renderExtraInfoInWorkerStep() {
    const container = document.getElementById('extra-info-container');
    if (!container) return;
    
    if (!currentState.selectedExtra) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = \`
        <div class="extra-info-card premium-glass" style="padding:1.25rem; border-radius:20px; border:1px solid #e0f2fe; background:#f0f9ff; animation: fadeIn 0.5s ease-out; margin-bottom: 1.5rem;">
            <h4 style="font-size:0.85rem; color:#0369a1; font-weight:900; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <i data-lucide="info" style="width:16px;"></i> 작업 사전 정보
            </h4>
            <div style="display:grid; grid-template-columns:1fr; gap:10px;">
                <div style="font-size:0.85rem; color:#1e293b;"><strong style="color:#64748b;">🛠 사용공구/장비:</strong> \${currentState.selectedExtra.사용공구_장비 || '-'}</div>
                <div style="font-size:0.85rem; color:#1e293b;"><strong style="color:#64748b;">🦺 보호구/안전장비:</strong> \${currentState.selectedExtra.보호구_안전장비 || '-'}</div>
                <div style="font-size:0.85rem; color:#1e293b;"><strong style="color:#64748b;">📄 관련자료:</strong> \${currentState.selectedExtra.관련자료 || '-'}</div>
            </div>
        </div>
    \`;
    if (window.lucide) window.lucide.createIcons();
}
`;

content += renderExtraInfoFunction;

/** 2. Update selectAssessmentTask to call it **/
// Existing selectAssessmentTask might have been modified. Let's use a simpler match.
content = content.replace(
    /currentState\.selectedExtra = (window\.)?MASTER_DATA\.extraInfo\.find\(ex =>[^;]+;\s+}/,
    `currentState.selectedExtra = (window.MASTER_DATA.extraInfo || []).find(ex => 
            (ex.부서명||"").trim() === (currentState.selectedDept||"").trim() && 
            (ex.작업명||"").trim() === (task||"").trim()
        );
        renderExtraInfoInWorkerStep();
    }`
);

/** 3. Remove Extra Info from Step 2 (renderRiskChecklist) **/
const extraInfoBlockPattern = /\/\/ \[v34\.5\.1\] 사전 점검 정보 카드 추가 \(공구, 보호구 등\)\s+if \(currentState\.selectedExtra\) \{[\s\S]+?\}\s+/;
content = content.replace(extraInfoBlockPattern, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log("✅ app.js updated: Extra Info moved to Worker Selection Step.");
