/**
 * DOING-KOSHA Smart Safety System - 100% Master Data Sync (Clean Version)
 */

const currentState = {
    currentStep: 0,
    selectedWorker: null,
    selectedDept: null,
    selectedTask: null,
    selectedStep: null,
    availableSteps: [],
    currentStepIndex: 0,
    checkedItems: new Set(),
    checkedMeasures: new Set(),
    improvedMeasures: new Set(),
    riskMatrixData: {},
    manualNotes: {},
    photoBase64: null,
    signatureBase64: null,
    incidents: {}, // Initialize to prevent TypeError
    risks: []      // Initialize to prevent TypeError
};

const GAS_URL = "https://script.google.com/macros/s/AKfycbzmS6hN33FeJ9yZwpyTjJDjW4ogmsWv8Wu8JZZyqvHGcAdjudlPoud4wSdxlnONnu5w6w/exec/exec";

// 1. ?°ì´??ë³´ì•ˆ ?°íšŒ(CORS) ë°??•ì œ ? í‹¸ë¦¬í‹°
function cleanValue(val) {
    if (typeof val !== 'string') return val;
    // [cite: 41] ê°™ì? ?¸ìš©êµ??œê±° ë°?ê³µë°± ?•ë¦¬
    return val.replace(/\[cite: \d+\]/g, '').trim(); 
}

function smartSplit(text) {
    if (!text || typeof text !== 'string') return [text];
    // ë²ˆí˜¸ ?¨í„´ ?•ê·œ?? 1., (1), ?? -, * ?±ì„ ê°ì??˜ì—¬ ë¶„ë¦¬
    const items = text.split(/(?=[0-9]+\.|[0-9]+\)|[????|\([0-9]+\)|(?:\n|^)[-*?¢â€?)/)
        .map(item => item.replace(/^[0-9]+\.|^[0-9]+\)|^[????|^\([0-9]+\)|^-|^\*|^\??^\??, '').trim())
        .filter(item => item.length > 0);
    return items.length > 0 ? items : [text.trim()];
}

function fetchJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        
        window[callbackName] = (data) => {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP fetch failed'));
        };

        const separator = url.indexOf('?') >= 0 ? '&' : '?';
        script.src = `${url}${separator}callback=${callbackName}`;
        document.body.appendChild(script);
    });
}
let signaturePad;

document.addEventListener('DOMContentLoaded', () => {
    initLucide();
    initEventListeners();
    fetchInitialData();
    updateDate();
    setInterval(updateDate, 60000);

    // ì´ˆê¸° ?ˆìŠ¤? ë¦¬ ?íƒœ ?¤ì • (ë©”ì¸ ?”ë©´)
    if (!history.state) {
        history.replaceState({ phase: 'dashboard' }, "", "");
    }

    // ë¸Œë¼?°ì?/ë¬¼ë¦¬ ?¤ë¡œê°€ê¸?ê°ì?
    window.onpopstate = (event) => {
        if (event.state && event.state.phase) {
            switchPhase(event.state.phase, true);
        } else {
            goHome(true);
        }
    };

    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
    }
});

function initLucide() { if (window.lucide) window.lucide.createIcons(); }

function switchPhase(targetId, skipHistory = false) {
    console.log(`?”„ Switching Phase to: ${targetId}`);
    const targetPhase = document.getElementById(targetId);
    if (!targetPhase) {
        console.error(`??Target phase not found: ${targetId}`);
        return;
    }

    // ?ˆìŠ¤? ë¦¬ ê¸°ë¡ (?¤ë¡œê°€ê¸°ìš©)
    if (!skipHistory) {
        history.pushState({ phase: targetId }, "", targetId === 'dashboard' ? " " : "#" + targetId);
    }

    // Stepper & Step State
    const stepper = document.getElementById('stepper');
    if (targetId === 'dashboard' || targetId === 'step-history') {
        if (stepper) stepper.style.display = 'none';
        currentState.currentStep = 0;
    } else if (targetId.startsWith('step-')) {
        if (stepper) stepper.style.display = 'block';
        const stepNum = parseInt(targetId.replace('step-', ''));
        if (!isNaN(stepNum)) {
            currentState.currentStep = stepNum;
            updateStepperUI(stepNum);
        } else if (targetId === 'step-improvement') {
            updateStepperUI(3);
        }
    }

    // ?”ë©´ ?˜ì´ì¦?ê´€ë¦? ???˜ë‚˜??activeë§?ì¡´ì¬?˜ë„ë¡?ê°•ì œ
    document.querySelectorAll('.phase').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none'; // ëª…ì‹œ?ìœ¼ë¡??¨ê?
        p.style.opacity = '0';
    });

    targetPhase.style.display = 'block'; // ë¨¼ì? ë³´ì´ê²??¤ì •
    targetPhase.classList.add('active');
    
    // ë¸Œë¼?°ì? ë¦¬í”Œë¡œìš° ê°•ì œ ? ë„ ??? ë‹ˆë©”ì´???¤í–‰
    void targetPhase.offsetWidth; 
    
    setTimeout(() => {
        targetPhase.style.opacity = '1';
        targetPhase.style.transform = 'translateY(0)';
    }, 20);
    
    if (targetId !== 'dashboard') {
        initLucide();
    }
    window.scrollTo({top: 0, behavior: 'smooth'}); 
}

function updateStepperUI(activeStep) {
    const nodes = document.querySelectorAll('.step-node');
    const fill = document.getElementById('progress-fill');
    
    nodes.forEach(node => {
        const step = parseInt(node.dataset.step);
        node.classList.remove('active', 'completed');
        if (step === activeStep) node.classList.add('active');
        if (step < activeStep) node.classList.add('completed');
    });

    const percent = ((activeStep - 1) / (nodes.length - 1)) * 100;
    fill.style.width = `${percent}%`;
}

function goHome() { 
    // ë¸Œë¼?°ì? ìºì‹œ ë¬´ì‹œ?˜ê³  ë£¨íŠ¸ ê²½ë¡œë¡?ê°•ì œ ë¦¬ë¡œ??    window.location.assign(window.location.origin + window.location.pathname);
    setTimeout(() => { window.location.reload(); }, 50);
}

function startAssessment() {
    currentState.selectedDept = null;
    currentState.selectedTask = null;
    currentState.checkedItems.clear();
    currentState.checkedMeasures.clear();
    currentState.improvedMeasures.clear();
    currentState.manualNotes = {};
    currentState.riskMatrixData = {};
    currentState.photoBase64 = null;
    
    // UI ì´ˆê¸°??    const container = document.getElementById('selection-container');
    const header = document.getElementById('step1-header');
    const confirmArea = document.getElementById('final-confirm-area');
    const homeBtn = document.getElementById('step1-home-btn');
    
    if (container) {
        container.style.display = 'flex';
        container.classList.add('selection-banner-list');
    }
    if (header) {
        header.querySelector('h2').innerText = "ë¶€??? íƒ";
        header.querySelector('p').innerText = "?„ì¬ ?Œì†??ë¶€?œë? ? íƒ?˜ì„¸??";
    }
    if (confirmArea) confirmArea.style.display = 'none';
    if (homeBtn) homeBtn.style.display = 'flex';

    switchPhase('step-1');
    renderDeptBanners();
}

function renderDeptBanners() {
    const container = document.getElementById('selection-container');
    if (!container) return;
    
    // ?°ì´??ë¡œë”© ì¤‘ì¸ ê²½ìš° ì²˜ë¦¬
    if (!currentState.risks || currentState.risks.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 1rem; text-align: center; color: #64748b; background: white; border-radius: 20px; border: 1px dashed #e2e8f0;">
                <div class="loader-spinner" style="margin-bottom: 12px; font-size: 1.5rem; animation: spin 2s linear infinite;">?”„</div>
                <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">?°ì´?°ë? ?™ê¸°?”í•˜ê³??ˆìŠµ?ˆë‹¤...</div>
                <div style="font-size: 0.8rem; margin-top: 6px; opacity: 0.7;">3~5ì´??•ë„ ?Œìš”?????ˆìŠµ?ˆë‹¤.</div>
            </div>
        `;
        return;
    }
    
    // ë¶€??ëª©ë¡ ì¶”ì¶œ (ê°€?˜ë‹¤ ???•ë ¬)
    const depts = [...new Set(currentState.risks.map(r => (r.ë¶€?œëª…||'').trim()))]
                    .filter(Boolean)
                    .sort();
    
    container.innerHTML = depts.map(dept => `
        <div class="dept-banner-card" onclick="selectAssessmentDept('${dept}')">
            <div class="dbc-icon"><i data-lucide="building-2"></i></div>
            <div class="dbc-text">
                <div class="title">${dept}</div>
                <div class="desc">?‰ê? ?€??ë¶€??/div>
            </div>
            <i data-lucide="chevron-right" class="dbc-arrow"></i>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

function selectAssessmentDept(dept) {
    currentState.selectedDept = dept;
    const header = document.getElementById('step1-header');
    if (header) {
        header.querySelector('h2').innerText = "?‘ì—…ëª?? íƒ";
        header.querySelector('p').innerText = "?˜í–‰ ì¤‘ì¸ ?‘ì—…??? íƒ?˜ì„¸??";
    }
    renderTaskBanners(dept);
}

function renderTaskBanners(dept) {
    const container = document.getElementById('selection-container');
    if (!container) return;
    
    // ?´ë‹¹ ë¶€?œì˜ ?‘ì—… ëª©ë¡ ì¶”ì¶œ
    const tasks = [...new Set(currentState.risks.filter(r => r.ë¶€?œëª… === dept).map(r => r.?‘ì—…ëª?)];
    
    container.innerHTML = tasks.map(task => `
        <div class="task-banner-card" onclick="selectAssessmentTask('${task}')">
            <div class="tbc-icon"><i data-lucide="activity"></i></div>
            <div class="tbc-text">
                <div class="title">${task}</div>
                <div class="desc">?„ì¬ ?‘ì—…ëª?/div>
            </div>
            <i data-lucide="chevron-right" class="tbc-arrow"></i>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

function selectAssessmentTask(task) {
    currentState.selectedTask = task;
    console.log(`Selected Task: ${task}`);
    
    // ì¤‘ê°„ ?•ì¸ ?¨ê³„ ?†ì´ ì¦‰ì‹œ ?ê??œë¡œ ?´ë™ (ì´ˆê°„???Œí¬?Œë¡œ??
    // ?Œë”ë§?ì§€??ë°©ì?ë¥??„í•´ ì¦‰ì‹œ ?”ë©´ ?„í™˜ ?œë„
    setTimeout(() => {
        nextStep(2);
    }, 10);
}

function renderWorkers() {
    const input = document.getElementById('worker-input');
    const dropdown = document.getElementById('worker-dropdown');
    if (!input || !dropdown) return;

    setupCustomDropdown(input, dropdown, currentState.users.map(u => ({ value: u.name, sub: u.dept })), (val) => {
        currentState.selectedWorker = val;
    });
}

// --- History System Functions ---

function saveToHistory(payload) {
    try {
        const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
        const newEntry = {
            ...payload,
            id: Date.now(),
            timestamp: new Date().toLocaleString('ko-KR')
        };
        // ìµœê·¼ 20ê±´ë§Œ ? ì?
        history.unshift(newEntry);
        if (history.length > 20) history.pop();
        localStorage.setItem('kosha_history', JSON.stringify(history));
    } catch (e) {
        console.error("History Save Error:", e);
    }
}

function viewHistory() {
    switchPhase('step-history');
    renderHistoryList();
}

const historyViewContext = {
    view: 'depts', // 'depts', 'tasks', 'logs'
    selectedDept: null,
    selectedTask: null
};

function renderHistoryList() {
    const listContainer = document.getElementById('history-list-container');
    const detailArea = document.getElementById('history-detail-container');
    const title = document.getElementById('history-title');
    const subtitle = document.getElementById('history-subtitle');
    const navPath = document.getElementById('history-nav-path');
    
    if (!listContainer || !detailArea) return;

    listContainer.style.display = 'block';
    detailArea.style.display = 'none';

    const historyData = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    
    if (historyData.length === 0) {
        // ?ŒìŠ¤?¸ë? ?„í•œ ?˜í”Œ ?°ì´??ì£¼ì… (?¬ìš©???•ì¸??
        const sampleData = [
            { id: 101, department: "ë°œì „?´ì˜??, task: "?˜ì†Œ ?¤ë¹„ ?ê?", worker: "?ê¸¸??, timestamp: "2024-04-03 10:00:00", logs: [] },
            { id: 102, department: "ì£¼ê°„?„ê¸°?€", task: "ë³€?•ê¸° ?ê?", worker: "ê¹€ì² ìˆ˜", timestamp: "2024-04-03 14:30:00", logs: [] },
            { id: 103, department: "ê¸°ê³„?•ë¹„?€", task: "?Œí”„ êµì²´ ?‘ì—…", worker: "?´ì˜??, timestamp: "2024-04-02 09:15:00", logs: [] }
        ];
        localStorage.setItem('kosha_history', JSON.stringify(sampleData));
        location.reload(); // ?°ì´??ë°˜ì˜???„í•´ ë¦¬ë¡œ??        return;
    }

    if (historyViewContext.view === 'depts') {
        renderHistoryDepts(listContainer, title, subtitle, historyData);
        navPath.style.display = 'none';
    } else if (historyViewContext.view === 'tasks') {
        renderHistoryTasks(listContainer, title, subtitle, historyData);
        navPath.style.display = 'flex';
    } else if (historyViewContext.view === 'logs') {
        renderHistoryLogs(listContainer, title, subtitle, historyData);
        navPath.style.display = 'flex';
    }
    
    initLucide();
}

function renderHistoryDepts(container, title, subtitle, history) {
    title.innerText = "ë¶€?œë³„ ?ê???ì¡°íšŒ";
    subtitle.innerText = "ì¡°íšŒ??ë¶€?œë? ? íƒ?˜ì„¸??";
    
    const depts = [...new Set(history.map(h => h.department))];
    container.innerHTML = `
        <div class="dept-grid">
            ${depts.map(dept => `
                <div class="dept-banner-card" onclick="selectHistoryDept('${dept}')">
                    <div class="dept-icon-circle"><i data-lucide="building-2"></i></div>
                    <span class="dept-name">${dept}</span>
                    <i data-lucide="chevron-right" style="color:#cbd5e1;"></i>
                </div>
            `).join('')}
        </div>
    `;
}

function selectHistoryDept(dept) {
    historyViewContext.selectedDept = dept;
    historyViewContext.view = 'tasks';
    renderHistoryList();
}

function renderHistoryTasks(container, title, subtitle, history) {
    const dept = historyViewContext.selectedDept;
    title.innerText = dept;
    subtitle.innerText = "ì¡°íšŒ???‘ì—…ëª…ì„ ? íƒ?˜ì„¸??";
    document.getElementById('nav-path-text').innerText = dept;

    const deptHistory = history.filter(h => h.department === dept);
    const tasks = [...new Set(deptHistory.map(h => h.task))];

    container.innerHTML = `
        <div class="history-task-list" style="display:grid; grid-template-columns:1fr; gap:12px;">
            ${tasks.map(task => `
                <div class="task-group-item banner-style" onclick="selectHistoryTask('${task}')" style="background:#fff; border-radius:20px; padding:1.5rem; display:flex; align-items:center; justify-content:space-between; border:1px solid #f1f5f9; box-shadow:var(--shadow-sm);">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:12px; background:#f0f9ff; color:#0369a1; display:flex; align-items:center; justify-content:center;">
                            <i data-lucide="file-text"></i>
                        </div>
                        <div>
                            <div style="font-weight:800; color:#1e293b; font-size:1rem;">${task}</div>
                            <div style="font-size:0.75rem; color:#64748b;">ìµœê·¼ ?‰ê? ?´ë ¥ ë³´ê¸°</div>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" style="color:#cbd5e1;"></i>
                </div>
            `).join('')}
        </div>
    `;
}

function selectHistoryTask(task) {
    historyViewContext.selectedTask = task;
    const dept = historyViewContext.selectedDept;
    const historyData = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    
    const latestLog = historyData.find(h => h.department === dept && h.task === task);
    if (latestLog) {
        showHistoryDetailByLog(latestLog.id);
    }
}

function showHistoryDetailByLog(id) {
    const historyData = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    const entry = historyData.find(h => h.id === id);
    if (!entry) return;

    const listArea = document.getElementById('history-list-container');
    const detailArea = document.getElementById('history-detail-container');
    const content = document.getElementById('report-view-content');

    listArea.style.display = 'none';
    detailArea.style.display = 'block';
    content.innerHTML = generateReportHTML(entry);
    initLucide();
}

function goBackInHistory() {
    if (historyViewContext.view === 'logs') {
        historyViewContext.view = 'tasks';
    } else if (historyViewContext.view === 'tasks') {
        historyViewContext.view = 'depts';
    }
    renderHistoryList();
}

function closeHistoryDetail() {
    const listArea = document.getElementById('history-list-container');
    const detailArea = document.getElementById('history-detail-container');
    listArea.style.display = 'block';
    detailArea.style.display = 'none';
}

function getScoreBadge(score) {
    let cls = 'badge-low';
    if (score >= 13) cls = 'badge-critical';
    else if (score >= 9) cls = 'badge-high';
    else if (score >= 4) cls = 'badge-med';
    return `<span class="report-badge ${cls}">${score}</span>`;
}

function generateReportHTML(data) {
    const logs = data.logs || [];
    return `
        <div class="report-view-container">
            <!-- ?”ì•½ ?•ë³´ ì¹´ë“œ -->
            <div class="report-summary-card">
                <div class="summary-title">?„í—˜?±í‰ê°€ ê²°ê³¼ ë³´ê³ ??/div>
                <div class="summary-info-grid">
                    <div class="summary-label">ë¶€?œëª…</div>
                    <div class="summary-value">${data.department}</div>
                    
                    <div class="summary-label">?‘ì—…?¼ì‹œ</div>
                    <div class="summary-value">${data.timestamp}</div>
                    
                    <div class="summary-label">?‘ì—…ëª?/div>
                    <div class="summary-value">${data.task}</div>
                    
                    <div class="summary-label">?ê???/div>
                    <div class="summary-value">${data.worker} ??/div>
                </div>
            </div>

            <!-- ?„í—˜?”ì¸ë³??ì„¸ ì¹´ë“œ ?¤íƒ -->
            ${logs.map((log, i) => `
                <div class="hazard-report-card">
                    <div class="hazard-card-header">
                        <h3><i data-lucide="alert-triangle" style="width:18px; color:#ff4757;"></i> ??ª© ${i + 1}. ${log.hazard}</h3>
                    </div>
                    <div class="hazard-card-body">
                        <!-- ?„ì¬ ?íƒœ ?¹ì…˜ -->
                        <div class="hazard-section">
                            <div class="section-label"><i data-lucide="shield-check" style="width:14px;"></i> ?„ì¬ ?ˆì „ì¡°ì¹˜ ?´í–‰?´ì—­</div>
                            <div class="section-content">${log.current_checked.replace(/\n/g, '<br>')}</div>
                            <div class="score-display-row">
                                <div class="score-item">
                                    <span class="score-label">?„ì¬ ?„í—˜??</span>
                                    ${getScoreBadge(log.current_score)}
                                    <span style="font-size:0.7rem; color:#94a3b8;">(ê°•ë„ ${log.current_severity} Ã— ë¹ˆë„ ${log.current_frequency})</span>
                                </div>
                            </div>
                        </div>

                        <div style="border-top:1px dashed #e2e8f0; margin:1rem 0;"></div>

                        <!-- ê°œì„  ?€ì±??¹ì…˜ -->
                        <div class="hazard-section">
                            <div class="section-label" style="color:#22c55e;"><i data-lucide="trending-up" style="width:14px;"></i> ê°œì„ ?€ì±?ë°??”ë¥˜ ?„í—˜??/div>
                            <div class="section-content" style="background:#f0fdf4; border-left:4px solid #22c55e;">
                                ${log.improvements_checked ? log.improvements_checked.replace(/\n/g, '<br>') : 'ì¶”ê? ê°œì„ ?¬í•­ ?†ìŒ (?„ì¬ ì¡°ì¹˜ ? ì?)'}
                            </div>
                            <div class="score-display-row">
                                <div class="score-item">
                                    <span class="score-label">?”ë¥˜ ?„í—˜??</span>
                                    ${getScoreBadge(log.residual_score)}
                                    <span style="font-size:0.7rem; color:#94a3b8;">(ê°•ë„ ${log.residual_severity} Ã— ë¹ˆë„ ${log.residual_frequency})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}

            <!-- ë¯¸ë””??ì¹´ë“œ ?¹ì…˜ -->
            <div class="report-media-section">
                <div class="media-card">
                    <h4><i data-lucide="camera" style="width:16px; vertical-align:middle; margin-right:4px;"></i> ?„ì¥ ?ê? ?¬ì§„</h4>
                    ${data.photo ? `<img src="${data.photo}" class="media-full-img">` : '<div class="section-content">?±ë¡???¬ì§„???†ìŠµ?ˆë‹¤.</div>'}
                </div>
                
                <div class="media-card">
                    <h4><i data-lucide="pen-tool" style="width:16px; vertical-align:middle; margin-right:4px;"></i> ?ê????œëª…</h4>
                    ${data.signature ? `<img src="${data.signature}" class="media-full-img" style="max-height:150px; background:#fff;">` : '<div class="section-content">?œëª…???±ë¡?˜ì? ?Šì•˜?µë‹ˆ??</div>'}
                </div>
            </div>
        </div>
    `;
}

function nextStep(step) {
    if (step === 2) {
        // ?´ë‹¹ ë¶€?œì? ?‘ì—…??ë§ëŠ” ëª¨ë“  ?ê? ?¨ê³„ ì¶”ì¶œ (ê³µë°± ?œê±°?˜ì—¬ ?•í™•???’ì„)
        currentState.availableSteps = [...new Set(currentState.risks
            .filter(r => (r.ë¶€?œëª…||'').trim() === (currentState.selectedDept||'').trim() && 
                         (r.?‘ì—…ëª?|'').trim() === (currentState.selectedTask||'').trim())
            .map(r => r.?‘ì—…?¨ê³„))].filter(Boolean);
        
        if (currentState.availableSteps.length === 0) {
            // ë°±ì—…: ë¶€?œëª… ë§¤ì¹­ ?¤íŒ¨ ???‘ì—…ëª…ë§Œ?¼ë¡œ ê²€???œë„
            currentState.availableSteps = [...new Set(currentState.risks
                .filter(r => (r.?‘ì—…ëª?|'').trim() === (currentState.selectedTask||'').trim())
                .map(r => r.?‘ì—…?¨ê³„))].filter(Boolean);
        }

        if (currentState.availableSteps.length === 0) {
            showToast("? ï¸ ?´ë‹¹ ?‘ì—…???•ì˜???¨ê³„ê°€ ?†ìŠµ?ˆë‹¤.");
            return;
        }
        
        currentState.currentStepIndex = 0;
        currentState.selectedStep = currentState.availableSteps[0];
        
        // 1. ?”ë©´ ?„í™˜??ë¨¼ì? ?˜í–‰?˜ì—¬ ì¦‰ê° ?•ì? ?„ìƒ ?´ê²°
        switchPhase('step-2');
        
        // 2. ê·??¤ìŒ ?°ì´???Œë”ë§?(?½ê°„??ì§€?°ì„ ì£¼ì–´ UI ?„ë¦¬ì§?ë°©ì?)
        setTimeout(() => {
            renderRiskChecklist(currentState.selectedStep);
            
            // 3. ?ê????±ëª… ?œë¡­?¤ìš´ ?¤ì •
            const input = document.getElementById('worker-input');
            const dropdown = document.getElementById('worker-dropdown');
            if (input && dropdown) {
                setupCustomDropdown(input, dropdown, 
                    () => currentState.users.map(u => ({ value: u.?´ë¦„, sub: `${u.?Œì†} ${u.ì§ì±…}` })), 
                    (val) => { currentState.selectedWorker = val; }
                );
            }
        }, 50);
        
        return;
    }
    
    if (step === 3) {
        // ?¤ìŒ ?¨ê³„ê°€ ???ˆëŠ”ì§€ ?•ì¸
        if (currentState.currentStepIndex < currentState.availableSteps.length - 1) {
            currentState.currentStepIndex++;
            currentState.selectedStep = currentState.availableSteps[currentState.currentStepIndex];
            renderRiskChecklist(currentState.selectedStep);
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else {
            // ëª¨ë“  ?¨ê³„ ì¢…ë£Œ -> ê°œì„  ?¨ê³„ë¡??ë™ ?„í™˜
            switchPhase('step-improvement');
            if (window.lucide) window.lucide.createIcons();
        }
        return;
    }

    if (step === 4) {
        // ?œëª… ë°??œì¶œ ?¨ê³„
        switchPhase('step-4');
        return;
    }

    switchPhase(`step-${step}`);
}

function prevStep(step) {
    if (step === 0) {
        goHome();
    } else {
        history.back(); // ?ˆìŠ¤? ë¦¬ ?¤ë¡œê°€ê¸??¤í–‰ (popstate?ì„œ ?”ë©´ ?„í™˜ ì²˜ë¦¬??
    }
}

function loadMockData() {
    // ?œíŠ¸ ë¡œë“œ ?¤íŒ¨(CORS ?? ?œì—??ê¸°ë³¸?ìœ¼ë¡?ë°œì „?´ì˜?¤ì´ ?˜í??˜ë„ë¡?ì¡°ì¹˜
    currentState.users = [
        { ?´ë¦„: "?ê¸¸??, ?Œì†: "ë°œì „?´ì˜??, ì§ì±…: "ê³¼ì¥", ê²½ë ¥: "10?? }
    ];
    
    currentState.risks = [
        { 
            ë¶€?œëª…: "ë°œì „?´ì˜??, 
            ?‘ì—…ëª? "?˜ì†Œ, ì§ˆì†Œ, ?„ì‚° ê°€?¤ì„¤ë¹??ê?", 
            ?‘ì—…?¨ê³„: "?‘ì—…ì¤€ë¹?, 
            ?„í—˜?”ì¸: "?°ì´??ë¡œë”© ?€ê¸?ì¤?..", 
            ê°œì„ ?€ì±? ["?¸í„°???°ê²° ë°?êµ¬ê? ?œíŠ¸ ê¶Œí•œ???•ì¸?˜ì„¸??"] 
        }
    ];
    currentState.incidents = {};
}

async function fetchInitialData() {
    console.log("??êµ¬ê? ?œíŠ¸ ?°ì´???¤ì‹œê°??™ê¸°???œë„ ì¤?..");
    
    // 1. ?„í—˜??ë§ˆìŠ¤???°ì´??ê°€?¸ì˜¤ê¸?(?…ë¦½??ì²˜ë¦¬)
    try {
        const riskData = await fetchJSONP(GAS_URL);
        if (Array.isArray(riskData) && riskData.length > 0) {
            const allRisks = [];
            riskData.forEach(item => {
                const cleanedHazard = cleanValue(item.?„í—˜?”ì¸ || "?´ìš© ?†ìŒ");
                const cleanedMeasures = cleanValue(item.?„ì¬?ˆì „ì¡°ì¹˜_?´í–‰?´ì—­ || item.?„ì¬?ˆì „ì¡°ì¹˜ || "");
                
                // ?„í—˜?”ì¸ê³?ê°œì„ ?€ì±…ì„ ê°ê° ë²ˆí˜¸?œìœ¼ë¡?ë¶„ë¦¬
                const hazards = smartSplit(cleanedHazard);
                const measures = smartSplit(cleanedMeasures);
                
                // ?„í—˜?”ì¸ë³„ë¡œ ê°œë³„ ?ê? ??ª© ?ì„±
                hazards.forEach(h => {
                    allRisks.push({
                        ë¶€?œëª…: cleanValue(item.ë¶€?œëª… || item.?Œì† || "ë¯¸ì???),
                        ?‘ì—…ëª? cleanValue(item.?‘ì—…ëª?|| "ë¯¸ì •???‘ì—…"),
                        ?‘ì—…?¨ê³„: cleanValue(item.?‘ì—…?¨ê³„ || "ë¯¸ì •???¨ê³„"),
                        ?„í—˜?”ì¸: h,
                        ê°œì„ ?€ì±? measures
                    });
                });
            });
            currentState.risks = allRisks;
            
            // ?„ì¬ ?”ë©´??Step 1(ë¶€??? íƒ)??ê²½ìš° UI ?…ë°?´íŠ¸
            const container = document.getElementById('selection-container');
            if (container && container.offsetParent !== null) {
                renderDeptBanners();
            }
            
            console.log("???¤ì‹œê°??„í—˜??ë§ˆìŠ¤??ë¡œë“œ ë°??ë™ ë¶„í•  ?„ë£Œ:", currentState.risks.length, "ê±?);
        }
    } catch (error) {
        console.warn("? ï¸ ?„í—˜???°ì´??ë¡œë“œ ?¤íŒ¨, ê¸°ë³¸ ?°ì´?°ë? ? ì??©ë‹ˆ??", error);
        if (currentState.risks.length === 0) {
            loadMockData();
            renderDeptBanners();
        }
    }

    // 2. ?¬ìš©?ëª…???°ì´??ê°€?¸ì˜¤ê¸?(?…ë¦½??ì²˜ë¦¬)
    try {
        const userData = await fetchJSONP(GAS_URL + "?type=users");
        if (Array.isArray(userData) && userData.length > 0) {
            currentState.users = userData.map(u => ({
                ?´ë¦„: cleanValue(u.?´ë¦„ || u.?±ëª… || ""),
                ?Œì†: cleanValue(u.?Œì† || u.ë¶€?œëª… || ""),
                ì§ì±…: cleanValue(u.ì§ì±… || ""),
                ê²½ë ¥: cleanValue(u.ê²½ë ¥ || "")
            }));
            renderWorkers();
            console.log("???¤ì‹œê°?ê·¼ë¡œ??ëª…ë‹¨ ë¡œë“œ ?±ê³µ:", currentState.users.length, "ê±?);
        }
    } catch (error) {
        console.warn("? ï¸ ê·¼ë¡œ??ëª…ë‹¨ ë¡œë“œ ?¤íŒ¨ (ë³´ì•ˆ ì°¨ë‹¨ ê°€?¥ì„±)");
    }
    
    if (currentState.risks.length > 0) {
        showToast("?“± êµ¬ê? ?œíŠ¸?€ ?¤ì‹œê°??°ê²°?˜ì—ˆ?µë‹ˆ??");
    }
}

function renderDepartmentList() {
    const departments = [...new Set(currentState.risks.map(r => r.ë¶€?œëª…))]
        .filter(d => d && d !== "undefined" && d !== "null");
    
    setupCustomDropdown(
        'task-select', 
        'dept-dropdown', 
        () => departments.map(d => ({ value: d })),
        (val) => {
            currentState.selectedDept = val;
            populateTasks(val);
        }
    );
}

function renderWorkers() {
    setupCustomDropdown(
        'worker-input', 
        'worker-dropdown', 
        () => currentState.users.map(u => ({ 
            value: u.?´ë¦„, 
            sub: `${u.?Œì†} | ${u.ì§ì±…}` 
        })),
        (val) => { currentState.selectedWorker = val; }
    );
}

function populateTasks(dept) {
    const taskArea = document.getElementById('step1-task-area'); // 1?¨ê³„???ˆë¡œ???‘ì—…?ì—­
    if (taskArea) taskArea.style.display = 'block';
    
    const deptTasks = [...new Set(currentState.risks.filter(r => r.ë¶€?œëª… === dept).map(r => r.?‘ì—…ëª?)];
    
    setupCustomDropdown(
        'step1-task-select', 
        'step1-task-dropdown', 
        () => deptTasks.map(t => ({ value: t })),
        (val) => {
            currentState.selectedTask = val;
            // populateWorkSteps(val); // 1?¨ê³„?ì„œ??? íƒë§???        }
    );
}

function populateWorkSteps(taskName) {
    const stepArea = document.getElementById('step-selection-area');
    if (stepArea) stepArea.style.display = 'block';

    const steps = [...new Set(currentState.risks
        .filter(r => r.?‘ì—…ëª?=== taskName && r.ë¶€?œëª… === currentState.selectedDept)
        .map(r => r.?‘ì—…?¨ê³„))];

    setupCustomDropdown(
        'step2-step-select', 
        'step2-step-dropdown', 
        () => steps.map(s => ({ value: s })),
        (val) => {
            currentState.selectedStep = val;
            renderRiskChecklist(val);
        }
    );
}

function setupCustomDropdown(inputId, dropdownId, getItemsFn, onSelectFn) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    const render = (filter = '') => {
        const items = getItemsFn();
        const filtered = items.filter(item => 
            String(item.value).toLowerCase().includes(filter.toLowerCase())
        );

        dropdown.innerHTML = filtered.length > 0 
            ? filtered.map(item => `
                <div class="dropdown-item" data-value="${item.value}">
                    <i data-lucide="check-circle-2" style="width:16px; color:#3b82f6;"></i>
                    <span>${item.value}</span>
                    ${item.sub ? `<span class="sub-info">${item.sub}</span>` : ''}
                </div>
            `).join('')
            : '<div class="dropdown-item" style="cursor:default; color:#94a3b8;">ê²€??ê²°ê³¼ê°€ ?†ìŠµ?ˆë‹¤.</div>';
        
        if (window.lucide) window.lucide.createIcons();
        
        dropdown.querySelectorAll('.dropdown-item[data-value]').forEach(el => {
            el.onclick = (e) => {
                const val = el.dataset.value;
                input.value = val;
                dropdown.classList.remove('active');
                if (onSelectFn) onSelectFn(val);
                e.stopPropagation();
            };
        });
    };

    input.onfocus = () => {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
        render(input.value);
        dropdown.classList.add('active');
    };

    input.oninput = () => {
        render(input.value);
        dropdown.classList.add('active');
    };
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-container')) {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active'));
    }
});


function updateManualNote(key, type, val) {
    if (!currentState.manualNotes[key]) {
        currentState.manualNotes[key] = { current: "", improvement: "" };
    }
    currentState.manualNotes[key][type] = val;
}

function renderRiskChecklist(stepName) {
    const container = document.getElementById('risk-checklist');
    if (!container) return;

    // ?¨ê³„ ì§„í–‰ ?íƒœ ?œì‹œ ë°?    const progressTotal = currentState.availableSteps.length || 1;
    const progressCurrent = (currentState.currentStepIndex || 0) + 1;
    const progressPercent = (progressCurrent / progressTotal) * 100;
    
    let checklistHTML = `
        <div class="step-progress-wrapper" style="margin-bottom:2.5rem; background:white; padding:1.5rem; border-radius:20px; box-shadow:var(--shadow-sm); border:1px solid var(--border-light);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-weight:900; color:#1e293b; font-size:1.15rem;">${progressCurrent}. ${stepName}</span>
                <span style="font-size:0.85rem; color:#64748b; font-weight:700; background:#f1f5f9; padding:4px 10px; border-radius:10px;">${progressCurrent}/${progressTotal} ?¨ê³„</span>
            </div>
            <div class="step-progress-bar-bg" style="height:10px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                <div class="step-progress-bar-fill" style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, #3b82f6, #2563eb); transition:width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
            </div>
        </div>
        <div class="checklist-global-v6.3 checklist-items-area" style="display:flex !important; flex-direction:column !important; align-items:stretch !important; width:100% !important; padding:0 !important; margin-top: 1rem !important;">
    `;
    
    // ?„í„°ë§???ë¶€?œëª… + ?‘ì—…ëª?+ ?¨ê³„ëª?ì¡°ê±´??ëª¨ë‘ ?•ì¸?˜ì—¬ ?•í™•???°ì´??ë¡œë“œ
    const taskRisks = currentState.risks.filter(r => 
        r.ë¶€?œëª… === currentState.selectedDept &&
        r.?‘ì—…ëª?=== currentState.selectedTask && 
        r.?‘ì—…?¨ê³„ === stepName
    );

    console.log(`?” Rendering risks for [${currentState.selectedTask}] - [${stepName}]. Total items: ${taskRisks.length}`);
    
    if (taskRisks.length === 0) {
        checklistHTML += `
            <div style="text-align:center; padding:3rem; background:#f8fafc; border-radius:20px; border:1px dashed #cbd5e1; color:#94a3b8;">
                <p>?´ë‹¹ ?¨ê³„???•ì˜???„í—˜ ?”ì¸???†ìŠµ?ˆë‹¤.</p>
                <p style="font-size:0.75rem; margin-top:8px;">?°ì´??ë§ˆìŠ¤???œíŠ¸?€ ë¶€???‘ì—…ëª…ì´ ?¼ì¹˜?˜ëŠ”ì§€ ?•ì¸?˜ì‹­?œì˜¤.</p>
            </div>
        `;
    }

    checklistHTML += taskRisks.map((r, i) => {
        const key = `${currentState.selectedTask}-${stepName}-${i}`;
        const isChecked = currentState.checkedItems.has(key);
        const notes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        // Initialize dual risk matrix data if not exist
        const riskData = currentState.riskMatrixData[key] || { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const measures = Array.isArray(r.ê°œì„ ?€ì±? ? r.ê°œì„ ?€ì±?: [r.ê°œì„ ?€ì±?;
        
        return `
            <div class="check-item ${isChecked ? 'checked' : ''} ${isChecked ? 'expanded' : ''}" id="risk-${i}" 
                 style="width: 100% !important; min-width: 100% !important; box-sizing: border-box !important;">
                <div class="check-item-header">
                    <div class="check-indicator" onclick="toggleRisk(${i}, '${stepName}')">
                        <i data-lucide="check"></i>
                    </div>
                    <span class="risk" onclick="toggleAccordion(${i})">${r.?„í—˜?”ì¸}</span>
                    <i data-lucide="chevron-down" class="expand-icon" onclick="toggleAccordion(${i})"></i>
                </div>

                <div class="measure-container">
                    <!-- Section 1: ?„ì¬?ˆì „ì¡°ì¹˜ -->
                    <p style="font-size:0.8rem; font-weight:800; color:var(--doing-blue); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <i data-lucide="shield-check" style="width:14px;"></i> [?„ì¬?ˆì „ì¡°ì¹˜]
                    </p>
                    <ul class="measure-list" style="width: 100% !important; padding: 0 !important;">
                        ${measures.map((m, mi) => {
                            const mKey = `${key}-m-${mi}`;
                            const isMChecked = currentState.checkedMeasures.has(mKey);
                            return `
                                <li class="measure-item ${isMChecked ? 'checked' : ''}" 
                                    style="width: 100% !important; display: flex !important; align-items: flex-start !important; padding: 0.5rem 0.25rem !important; margin-bottom: 4px !important; box-sizing: border-box !important;"
                                    onclick="toggleMeasure('${mKey}', 'current', event)">
                                    <div class="m-checkbox ${isMChecked ? 'active' : ''}" style="margin-right: 12px !important;">
                                        <i data-lucide="check"></i>
                                    </div>
                                    <span style="flex: 1 !important; text-align: left !important; font-size: 0.95rem !important; line-height: 1.5 !important;">${m}</span>
                                </li>
                            `;
                        }).join('')}
                    </ul>

                    <!-- Matrix 1: ?„ì¬ ?„í—˜???˜ì? ?‰ê? -->
                    <div class="risk-matrix-controls current-matrix" style="border: none !important; background: none !important; padding: 0 !important;">
                        <div class="manual-input-area" style="background: #f8fafc !important; border: 1px dashed #e2e8f0 !important; border-radius: 12px !important; padding: 12px !important;">
                            <label class="manual-label"><i data-lucide="edit-3" style="width:14px;"></i> ?„ì¬ ì¶”ê? ?ˆì „ì¡°ì¹˜ (?˜ê¸° ?…ë ¥)</label>
                            <textarea class="manual-textarea" placeholder="ê¸°ì¡´ ?€ì±???ì¶”ê????„ì¥ ì¡°ì¹˜ ?´ìš©???…ë ¥?˜ì„¸??.." 
                                oninput="updateManualNote('${key}', 'current', this.value)">${notes.current || ""}</textarea>
                        </div>
                        
                        <p class="matrix-title" style="margin-top:20px;">?„ì¬ ?„í—˜???˜ì? ?‰ê?</p>
                        <div class="matrix-row-unified">
                            <div class="row-item">
                                <span class="row-label">ê°•ë„</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'current', 'severity', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">Ã—</div>
                            <div class="row-item">
                                <span class="row-label">ë¹ˆë„</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'current', 'frequency', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">=</div>
                            <div class="row-result current">
                                <span class="row-label">?„í—˜??/span>
                                <span class="row-score ${getScoreClass(riskData.current.score)}">${riskData.current.score}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: ê°œì„ ?€ì±?ë°??”ë¥˜ ?„í—˜??-->
                    <div class="residual-cleanup-area" style="margin-top: 1.5rem !important; border-top: 1px solid #f1f5f9 !important; padding-top: 1.5rem !important;">
                        <p style="font-size:0.8rem; font-weight:800; color:var(--doing-accent); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="wrench" style="width:14px;"></i> [ê°œì„ ?€ì±?ë°??”ë¥˜ ?„í—˜???ê?]
                        </p>
                    
                    ${measures.some((_, mi) => !currentState.checkedMeasures.has(`${key}-m-${mi}`)) ? `
                        <ul class="measure-list improvement" style="width: 100% !important; padding: 0 !important;">
                            ${measures.map((m, mi) => {
                                const mKey = `${key}-m-${mi}`;
                                if (currentState.checkedMeasures.has(mKey)) return '';
                                const isMImproved = currentState.improvedMeasures.has(mKey);
                                return `
                                    <li class="measure-item ${isMImproved ? 'improved' : ''}" 
                                        style="width: 100% !important; display: flex !important; align-items: flex-start !important; padding: 0.5rem 0.25rem !important; margin-bottom: 4px !important; box-sizing: border-box !important;"
                                        onclick="toggleMeasure('${mKey}', 'improve', event)">
                                        <div class="m-checkbox ${isMImproved ? 'active-improve' : ''}" style="margin-right: 12px !important;">
                                            <i data-lucide="check"></i>
                                        </div>
                                        <span style="flex: 1 !important; text-align: left !important; font-size: 0.95rem !important; line-height: 1.5 !important;">${m}</span>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    ` : '<p style="font-size:0.75rem; color:#64748b; margin-bottom:12px; padding-left:4px;">?„ì¬ ì¡°ì¹˜ê°€ ëª¨ë‘ ?„ë£Œ?˜ì—ˆ?µë‹ˆ?? ìµœì¢… ?„í—˜?„ë? ?‰ê??˜ì„¸??</p>'}

                    <!-- Matrix 2: ê°œì„  ???„í—˜???˜ì? -->
                    <div class="risk-matrix-controls residual-matrix">
                        <div class="manual-input-area" style="border-color: #f87171; background: rgba(254, 242, 242, 0.5);">
                            <label class="manual-label" style="color: #ef4444;"><i data-lucide="wrench" style="width:14px;"></i> ì¶”ê? ê°œì„ ?€ì±??…ë ¥ (?˜ê¸°)</label>
                            <textarea class="manual-textarea" placeholder="?„í—˜??ì¤„ì´ê¸??„í•œ ì¶”ê? ê°œì„  ?˜ê²¬???ìœ ë¡?²Œ ?…ë ¥?˜ì„¸??.." 
                                oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement || ""}</textarea>
                        </div>

                        <p class="matrix-title improved" style="margin-top:20px;">ê°œì„  ???„í—˜???˜ì? ?‰ê?</p>
                        <div class="matrix-row-unified">
                            <div class="row-item">
                                <span class="row-label">ê°•ë„</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'residual', 'severity', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">Ã—</div>
                            <div class="row-item">
                                <span class="row-label">ë¹ˆë„</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'residual', 'frequency', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">=</div>
                            <div class="row-result residual">
                                <span class="row-label">?”ë¥˜?„í—˜</span>
                                <span class="row-score ${getScoreClass(riskData.residual.score)}">${riskData.residual.score}</span>
                            </div>
                        </div>
        `;
    }).join('');

    checklistHTML += `</div>`; // .checklist-items-area ?«ê¸°

    container.innerHTML = checklistHTML;
    initLucide();
    updateNextButton(taskRisks.length);
    checkIncidents(taskRisks);
}

function checkIncidents(taskRisks) {
    const incidentContainer = document.getElementById('incident-container');
    const incidentContent = document.getElementById('incident-content');
    
    // Find if any of the hazard has a matching incident
    const matchingIncidents = taskRisks
        .map(r => (currentState.incidents && r.?„í—˜?”ì¸) ? currentState.incidents[r.?„í—˜?”ì¸] : null)
        .filter(incident => incident);

    if (matchingIncidents.length > 0) {
        incidentContent.innerHTML = matchingIncidents.map(inc => `<p>${inc}</p>`).join('');
        incidentContainer.style.display = 'block';
    } else {
        incidentContainer.style.display = 'none';
    }
}

function toggleRisk(index, stepName) {
    const key = `${currentState.selectedTask}-${stepName}-${index}`;
    if (currentState.checkedItems.has(key)) {
        currentState.checkedItems.delete(key);
    } else {
        currentState.checkedItems.add(key);
    }
    renderRiskChecklist(stepName);
}

function toggleAccordion(index) {
    const item = document.getElementById(`risk-${index}`);
    if (item) item.classList.toggle('expanded');
}

function toggleMeasure(mKey, type, event) {
    event.stopPropagation();
    
    if (type === 'current') {
        if (currentState.checkedMeasures.has(mKey)) {
            currentState.checkedMeasures.delete(mKey);
        } else {
            currentState.checkedMeasures.add(mKey);
            // If checked in current, it shouldn't be in improved
            currentState.improvedMeasures.delete(mKey);
        }
    } else if (type === 'improve') {
        if (currentState.improvedMeasures.has(mKey)) {
            currentState.improvedMeasures.delete(mKey);
        } else {
            currentState.improvedMeasures.add(mKey);
        }
    }
    
    // Auto-check parent hazard
    const hazardKey = mKey.split('-m-')[0];
    if (!currentState.checkedItems.has(hazardKey)) {
        currentState.checkedItems.add(hazardKey);
    }

    renderRiskChecklist(currentState.selectedStep);
}

function updateRiskScore(index, stepName, matrixType, field, value) {
    const key = `${currentState.selectedTask}-${stepName}-${index}`;
    if (!currentState.riskMatrixData[key]) {
        currentState.riskMatrixData[key] = { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
    }
    
    currentState.riskMatrixData[key][matrixType][field] = parseInt(value);
    const mData = currentState.riskMatrixData[key][matrixType];
    mData.score = mData.severity * mData.frequency;
    
    // Auto-check hazard
    if (!currentState.checkedItems.has(key)) {
        currentState.checkedItems.add(key);
    }
    renderRiskChecklist(stepName);
}

function getScoreClass(score) {
    if (score >= 13) return 'critical';
    if (score >= 9) return 'high';
    if (score >= 4) return 'med';
    return 'low';
}

function updateNextButton(totalInStep) {
    const container = document.getElementById('next-action-container');
    if (!container) return;

    // ?„ì¬ ?¨ê³„?ì„œ ì²´í¬????ª© ??ê³„ì‚°
    const currentCheckedCount = Array.from(currentState.checkedItems).filter(key => 
        key.startsWith(`${currentState.selectedTask}-${currentState.selectedStep}`)
    ).length;
    
    // ëª¨ë“  ??ª©??ì²´í¬?˜ì—ˆê±°ë‚˜ ??ª©???†ëŠ” ê²½ìš° ë²„íŠ¼ ?¸ì¶œ
    if (currentCheckedCount >= totalInStep) {
        const isLastStep = currentState.currentStepIndex === currentState.availableSteps.length - 1;
        const btnText = isLastStep ? "?‰ê? ?„ë£Œ (ê°œì„  ?¨ê³„ë¡??´ë™) <i data-lucide='check-check'></i>" : "?¤ìŒ ?‘ì—…?¨ê³„ë¡??´ë™ <i data-lucide='arrow-right'></i>";
        
        container.innerHTML = `
            <div class="next-action-area active" style="margin-top:2rem; animation:fadeInUp 0.5s ease-out;">
                <button class="btn btn-primary" style="width:100%; border-radius:18px; padding:1.2rem;" onclick="nextStep(3)">
                    ${btnText}
                </button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    } else {
        container.innerHTML = '';
    }
}

function initEventListeners() {
    // 1?¨ê³„ ë¶€??? íƒ -> ?‘ì—… ëª©ë¡ ?ì—…
    document.getElementById('task-select')?.addEventListener('change', (e) => {
        currentState.selectedDept = e.target.value;
        if (e.target.value) populateTasks(e.target.value);
    });

    // 1?¨ê³„ ?‘ì—…ëª?? íƒ -> ì´ˆê¸°??    document.getElementById('step1-task-select')?.addEventListener('change', (e) => {
        currentState.selectedTask = e.target.value;
    });

    document.getElementById('worker-input')?.addEventListener('input', (e) => {
        currentState.selectedWorker = e.target.value;
    });

    document.getElementById('photo-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (f) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // ìµœë? ê°€ë¡??¬ê¸° 800pxë¡??œí•œ (?©ëŸ‰ ìµœì ??
                    const maxW = 800;
                    let w = img.width;
                    let h = img.height;
                    
                    if (w > maxW) {
                        h = h * (maxW / w);
                        w = maxW;
                    }
                    
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    // JPEG ?•ì‹?¼ë¡œ ?”ì§ˆ 0.5(50%) ?•ì¶• (ìµœì? ?©ëŸ‰ ì§€??
                    const optimizedData = canvas.toDataURL('image/jpeg', 0.5);
                    
                    currentState.photoBase64 = optimizedData;
                    const preview = document.getElementById('photo-preview');
                    preview.innerHTML = `<img src="${optimizedData}" style="width:100%; border-radius:20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">`;
                };
                img.src = f.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('clear-signature')?.addEventListener('click', () => signaturePad.clear());
}

async function submitLog() {
    const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker;
    if (!workerName || workerName.trim() === "") { 
        showToast("? ï¸ ?ê????±ëª…???ë‹¨???…ë ¥?˜ê±°??? íƒ??ì£¼ì„¸??"); 
        switchPhase('step-2');
        return; 
    }
    if (signaturePad.isEmpty()) { showToast("? ï¸ ë³¸ì¸ ?œëª…???„ìš”?©ë‹ˆ??"); return; }
    
    const today = new Date().toLocaleDateString('ko-KR');
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay.querySelector('p');
    if (loadingText) loadingText.innerText = "?°ì´?°ë? êµ¬ê? ?œíŠ¸ë¡??„ì†¡ ì¤‘ì…?ˆë‹¤...";
    overlay.classList.add('active');

    // 1. ?¤ì‹œë¡œê·¸???°ì´??    const logs = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        const index = parseInt(parts[parts.length - 1]);
        const step = parts.slice(1, parts.length - 1).join('-');
        const task = parts[0];
        const risksAtStep = currentState.risks.filter(r => r.?‘ì—…?¨ê³„ === step && r.?‘ì—…ëª?=== task);
        const r = risksAtStep[index];
        if (!r) return null;

        const riskData = currentState.riskMatrixData[key] || {
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        const measures = Array.isArray(r.ê°œì„ ?€ì±? ? r.ê°œì„ ?€ì±?: [r.ê°œì„ ?€ì±?;
        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        const currentChecked = [
            ...measures.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`)),
            mNotes.current
        ].filter(v => v && v.trim()).join('\n');
        
        const improvedList = [
            ...measures.filter((_, mi) => !currentState.checkedMeasures.has(`${key}-m-${mi}`)),
            mNotes.improvement
        ].filter(v => v && v.trim()).join('\n');

        return {
            hazard: r.?„í—˜?”ì¸,
            current_checked: currentChecked,
            current_frequency: riskData.current.frequency,
            current_severity: riskData.current.severity,
            current_score: riskData.current.score,
            improvements_checked: improvedList,
            residual_frequency: riskData.residual.frequency,
            residual_severity: riskData.residual.severity,
            residual_score: riskData.residual.score
        };
    }).filter(Boolean);

    // 2. ê°œì„ ?€ì±??¤í–‰ê³„íš?œìš© ?°ì´??    const improvementPlan = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        const index = parseInt(parts[parts.length - 1]);
        const step = parts.slice(1, parts.length - 1).join('-');
        const task = parts[0];
        const risksAtStep = currentState.risks.filter(r => r.?‘ì—…?¨ê³„ === step && r.?‘ì—…ëª?=== task);
        const r = risksAtStep[index];
        if (!r) return null;

        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        const riskData = currentState.riskMatrixData[key];
        const measures = Array.isArray(r.ê°œì„ ?€ì±? ? r.ê°œì„ ?€ì±?: [r.ê°œì„ ?€ì±?;
        const currentMeasuresChecked = measures.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`));
        
        const needsImprovement = mNotes.improvement.trim() !== "" || 
                               (riskData && riskData.current.score >= 9) || 
                               (currentMeasuresChecked.length < measures.length);

        if (!needsImprovement) return null;

        const improvements = [
            ...measures.filter((_, mi) => !currentState.checkedMeasures.has(`${key}-m-${mi}`)),
            mNotes.improvement
        ].filter(v => v && v.trim()).join('\n');

        return {
            department: currentState.selectedDept,
            task_name: currentState.selectedTask,
            hazard: r.?„í—˜?”ì¸,
            improvement_measure: improvements || "?„ì¬ ì¡°ì¹˜ ?„ë£Œ ë°?? ì?ê´€ë¦?,
            improvement_date: today,
            manager: workerName
        };
    }).filter(Boolean);

    const payload = {
        worker: workerName,
        department: currentState.selectedDept,
        task: currentState.selectedTask,
        step: currentState.selectedStep,
        logs: logs,
        improvement_plan: improvementPlan,
        overall_improvement: document.getElementById('overall-improvement')?.value || "",
        photo: currentState.photoBase64,
        signature: signaturePad.toDataURL()
    };

    try {
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }
        });

        // 3. ë¡œì»¬ ?´ì—­ ?€??ì¶”ê?
        saveToHistory(payload);

        // ?„ì†¡ ?„ë£Œ ?ˆë‚´ (no-cors ?¹ì„±???±ê³µ ê°€??
        setTimeout(() => {
            overlay.classList.remove('active');
            showToast("???ê? ê²°ê³¼ê°€ êµ¬ê? ?œíŠ¸ë¡??„ì†¡?˜ì—ˆ?µë‹ˆ??");
            setTimeout(() => location.reload(), 2000);
        }, 1500);

    } catch (error) {
        console.error("?„ì†¡ ?¤ë¥˜:", error);
        overlay.classList.remove('active');
        showToast("???„ì†¡ ?¤íŒ¨: ?¸í„°???°ê²° ?ëŠ” ?¤ì •???•ì¸?˜ì„¸??");
    }
}
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateDate() {
    const el = document.getElementById('current-date');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
}
