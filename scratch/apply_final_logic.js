
const fs = require('fs');
const path = require('path');

const filePath = 'app.js';
let content = fs.readFileSync(filePath, 'utf8');

/** 1. Re-apply extra functions and state updates **/
const helperFunctions = `
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

function updateMeasureText(key, type, index, val) {
    if (!currentState.notes) currentState.notes = {};
    if (!currentState.notes[key]) currentState.notes[key] = { currentEdit: [], improveEdit: [] };
    
    if (type === 'current') {
        currentState.notes[key].currentEdit[index] = val;
    } else {
        currentState.notes[key].improveEdit[index] = val;
    }
    saveDraft();
}
`;
content += helperFunctions;

/** 2. Update selectAssessmentTask **/
content = content.replace(
    /function selectAssessmentTask\(task\) \{([\s\S]+?)\}/,
    `function selectAssessmentTask(task) {
    currentState.selectedTask = (task || "").trim();
    console.log("Selected Task: " + currentState.selectedTask);
    
    currentState.selectedExtra = (window.MASTER_DATA && window.MASTER_DATA.extraInfo) ? 
        window.MASTER_DATA.extraInfo.find(ex => 
            (ex.부서명||"").trim() === (currentState.selectedDept||"").trim() && 
            (ex.작업명||"").trim() === (task||"").trim()
        ) : null;
        
    renderExtraInfoInWorkerStep();
    hydrateStateFromLogs(task);
    
    const container = document.getElementById('selection-container');
    const workerCard = document.getElementById('worker-input-card-wrap');
    if (container) container.style.display = 'none';
    if (workerCard) workerCard.style.display = 'block';

    const header = document.getElementById('step1-header');
    if (header) {
        header.querySelector('h2').innerText = "평가자 성명 입력";
        header.querySelector('p').innerText = "평가자 성명을 추가 또는 선택하세요.";
    }

    const homeBtn = document.getElementById('step1-home-btn');
    if (homeBtn) {
        homeBtn.style.display = 'grid';
        homeBtn.style.gridTemplateColumns = '1fr 2fr';
        homeBtn.style.gap = '12px';
        homeBtn.innerHTML = \`
            <button class="btn btn-secondary" onclick="handleStep1Back()">이전단계</button>
            <button class="btn btn-primary" onclick="nextStep(2)">다음단계</button>
        \`;
        if (window.lucide) window.lucide.createIcons();
    }
}`
);

/** 3. Update switchPhase and handleStep2Back **/
content = content.replace(
    /if \(targetId === 'step-1'\) \{[\s\S]+?contextBanner\.style\.display = 'none';/,
    `if (targetId === 'step-1') {
                    contextBanner.style.display = 'none';
                    if (currentState.selectedTask) renderExtraInfoInWorkerStep();`
);

content = content.replace(
    /function handleStep2Back\(\) \{[\s\S]+?switchPhase\('step-1'\);[\s\S]+?\}/,
    `function handleStep2Back() {
    switchPhase('step-1');
    renderExtraInfoInWorkerStep();
}`
);

/** 4. Integration of Auto-fill Hazards **/
content = content.replace(
    /currentState\.currentStepIndex = 0;[\s\S]+?currentState\.selectedStep = currentState\.availableSteps\[0\];/,
    `currentState.currentStepIndex = 0;
        currentState.selectedStep = currentState.availableSteps[0];
        
        const taskRisks = currentState.risks.filter(r => 
            (r.부서명||"").trim() === (currentState.selectedDept||"").trim() &&
            (r.작업명||"").trim() === (currentState.selectedTask||"").trim()
        );
        taskRisks.forEach(r => {
            const hazardHash = getHash(r.위험요인);
            const taskHash = getHash(currentState.selectedTask || "");
            const stepHash = getHash((r.작업단계||"").trim());
            const key = \`\${taskHash}-\${stepHash}-\${hazardHash}\`;
            currentState.checkedItems.add(key);
        });`
);

/** 5. renderRiskChecklist Improvements **/
content = content.replace(
    /header\.innerHTML = \`([\s\S]+?)\`;/,
    (match) => match + `\n\n    // [v34.5.1] Removed Extra Info display from here and moved to worker step.`
);

// Template replacement for cards (Static Title, Editable Measures)
content = content.replace(
    /return \`([\s\S]+?)<\/div>\s+\`;/g, 
    (match) => {
        if (match.includes('check-indicator')) {
            return match.replace(/<span style="flex: 1; font-weight: 800; color: #1e293b;">\$\{r\.위험요인\}<\/span>/, 
                `<span style="flex: 1; font-weight: 900; color: #1e293b; font-size: 1.1rem; padding: 4px; letter-spacing: -0.3px;">\${r.위험요인}</span>`)
                .replace(/<span style="flex: 1; font-size: 0\.95rem;">\$\{m\}<\/span>/g, 
                `<input type="text" value="\${(currentState.notes?.[key]?.currentEdit?.[mi]) || m}" 
                             onclick="event.stopPropagation()"
                             onchange="updateMeasureText('\${key}', 'current', \${mi}, this.value)"
                             style="flex: 1; font-size: 0.95rem; border: none; background: transparent; padding: 2px; border-bottom: 1px dashed transparent;"
                             onfocus="this.style.borderBottomColor='#e2e8f0'"
                             onblur="this.style.borderBottomColor='transparent'">`)
                .replace(/<span style="flex: 1; font-size: 0\.95rem;">\$\{im\}<\/span>/g, 
                `<input type="text" value="\${(currentState.notes?.[key]?.improveEdit?.[imi]) || im}" 
                             onclick="event.stopPropagation()"
                             onchange="updateMeasureText('\${key}', 'improve', \${imi}, this.value)"
                             style="flex: 1; font-size: 0.95rem; border: none; background: transparent; padding: 2px; border-bottom: 1px dashed transparent;"
                             onfocus="this.style.borderBottomColor='#e2e8f0'"
                             onblur="this.style.borderBottomColor='transparent'">`);
        }
        return match;
    }
);

/** 6. preparePreviewData fixes **/
content = content.replace(
    /if \(currentState\.checkedMeasures\.has\(\`\$\{key\}-m-\$\{idx\}\`\)\) currentMeasures\.push\(m\.trim\(\)\);/,
    `if (currentState.checkedMeasures.has(\`\${key}-m-\${idx}\`)) {
                    const editedText = currentState.notes?.[key]?.currentEdit?.[idx] || m;
                    currentMeasures.push(editedText.trim());
                }`
);
content = content.replace(
    /if \(text && !improveMeasures\.includes\(text\)\) improveMeasures\.push\(text\);/,
    `const editedText = currentState.notes?.[key]?.improveEdit?.[idx] || text;
                        if (editedText && !improveMeasures.includes(editedText)) improveMeasures.push(editedText.trim());`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("✅ app.js fully upgraded to v34.5.1 Final.");
