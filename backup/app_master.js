/**
 * DOING-KOSHA Smart Safety System - 100% Master Data Sync (Clean Version)
 */

const currentState = {
    currentStep: 0,
    selectedWorkers: [], 
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
    incidents: {}, 
    risks: [],      
    expandedHazardKeys: new Set(),
    manualHazards: [], 
    manualHazardItems: {}, 
    improvementResults: {}, 
    allLogs: [] 
};

const GAS_URL = "https://script.google.com/macros/s/AKfycbzmS6hN33FeJ9yZwpyTjJDjW4ogmsWv8Wu8JZZyqvHGcAdjudlPoud4wSdxlnONnu5w6w/exec/exec";
// [NEW] ?¤ì‹œê°??¤íŠ¸?Œí¬ ?íƒœ ?…ë°?´íŠ¸ ?¨ìˆ˜ (v25.1)
function updateNetworkStatus(isOnline, message = "") {
    const indicator = document.getElementById('network-status');
    if (!indicator) return;

    if (isOnline) {
        indicator.className = 'status-indicator online';
        indicator.querySelector('.status-text').textContent = message || '?¤ì‹œê°?ON';
    } else {
        indicator.className = 'status-indicator offline';
        indicator.querySelector('.status-text').textContent = message || '?‘ì† ì¤?..';
    }
}

// 1. ?°ì´??ë³´ì•ˆ ?°íšŒ(CORS) ë°??•ì œ ? í‹¸ë¦¬í‹°
function cleanValue(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/\[cite: \d+\]/g, '').trim(); 
}

function smartSplit(text) {
    if (!text || typeof text !== 'string') return [text];
    const items = text.split(/(?=[0-9]+\.|[0-9]+\)|[????|\([0-9]+\)|(?:\n|^)[-*?¢â€?)/)
        .map(item => item.replace(/^[0-9]+\.|^[0-9]+\)|^[????|^\([0-9]+\)|^-|^\*|^\??^\??, '').trim())
        .filter(item => item.length > 0);
    return items.length > 0 ? items : [text.trim()];
}

// --- [NEW] ?„ì‹œ ?€??ë°?ë³µì› ?œìŠ¤??(v25.2) ---
function saveDraft() {
    if (!currentState.selectedDept || !currentState.selectedTask) return;
    const key = `KOMIPO_DRAFT_${currentState.selectedDept}_${currentState.selectedTask}`;
    const draftData = {
        ...currentState,
        checkedItems: Array.from(currentState.checkedItems),
        checkedMeasures: Array.from(currentState.checkedMeasures),
        improvedMeasures: Array.from(currentState.improvedMeasures),
        expandedHazardKeys: Array.from(currentState.expandedHazardKeys),
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(draftData));
}

function loadDrafts() {
    const drafts = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('KOMIPO_DRAFT_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                drafts.push({
                    isDraft: true,
                    draftKey: key,
                    ë¶€?œëª…: data.selectedDept,
                    ?‘ì—…ëª? data.selectedTask,
                    ?¼ì‹œ: data.lastUpdated,
                    ?ê??? (Array.isArray(data.selectedWorkers) ? data.selectedWorkers.join(', ') : data.selectedWorker) || '?‘ì„± ì¤?
                });
            } catch (e) { console.error("Draft parse error:", e); }
        }
    }
    return drafts;
}

function resumeDraft(key) {
    const rawData = localStorage.getItem(key);
    if (!rawData) return;
    try {
        const data = JSON.parse(rawData);
        // ?íƒœ ë³µì›
        Object.assign(currentState, data);
        currentState.checkedItems = new Set(data.checkedItems);
        currentState.checkedMeasures = new Set(data.checkedMeasures);
        currentState.improvedMeasures = new Set(data.improvedMeasures);
        currentState.expandedHazardKeys = new Set(data.expandedHazardKeys);
        
        showToast("?”„ ?„ì‹œ ?€?¥ëœ ?°ì´?°ë? ë¶ˆëŸ¬?”ìŠµ?ˆë‹¤.");
        
        // ?„ì¬ ?¨ê³„??ë§ì¶° ?´ë™
        if (currentState.currentStep > 0) {
            switchPhase(`step-${currentState.currentStep}`);
        } else {
            switchPhase('step-1');
        }
    } catch (e) {
        console.error("Resume error:", e);
        showToast("???°ì´?°ë? ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??");
    }
}

// --- [NEW] ?„ì‹œ ?€??ë°?ë³µì› ?œìŠ¤??(v25.2) ---
function saveDraft() {
    if (!currentState.selectedDept || !currentState.selectedTask) return;
    const key = `KOMIPO_DRAFT_${currentState.selectedDept}_${currentState.selectedTask}`;
    const draftData = {
        ...currentState,
        checkedItems: Array.from(currentState.checkedItems),
        checkedMeasures: Array.from(currentState.checkedMeasures),
        improvedMeasures: Array.from(currentState.improvedMeasures),
        expandedHazardKeys: Array.from(currentState.expandedHazardKeys),
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(draftData));
}

function loadDrafts() {
    const drafts = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('KOMIPO_DRAFT_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                drafts.push({
                    isDraft: true,
                    draftKey: key,
                    ë¶€?œëª…: data.selectedDept,
                    ?‘ì—…ëª? data.selectedTask,
                    ?¼ì‹œ: data.lastUpdated,
                    ?ê??? data.selectedWorkers.join(', ') || '?‘ì„± ì¤?
                });
            } catch (e) { console.error("Draft parse error:", e); }
        }
    }
    return drafts;
}

function resumeDraft(key) {
    const rawData = localStorage.getItem(key);
    if (!rawData) return;
    try {
        const data = JSON.parse(rawData);
        // ?íƒœ ë³µì›
        Object.assign(currentState, data);
        currentState.checkedItems = new Set(data.checkedItems);
        currentState.checkedMeasures = new Set(data.checkedMeasures);
        currentState.improvedMeasures = new Set(data.improvedMeasures);
        currentState.expandedHazardKeys = new Set(data.expandedHazardKeys);
        
        showToast("?”„ ?„ì‹œ ?€?¥ëœ ?°ì´?°ë? ë¶ˆëŸ¬?”ìŠµ?ˆë‹¤.");
        
        // ?„ì¬ ?¨ê³„??ë§ì¶° ?´ë™
        if (currentState.currentStep > 0) {
            switchPhase(`step-${currentState.currentStep}`);
        } else {
            switchPhase('step-1');
        }
    } catch (e) {
        console.error("Resume error:", e);
        showToast("???°ì´?°ë? ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??");
    }
}

function getHash(str) {
    if (typeof str !== "string") return "0";
    const normalized = str.replace(/[^????ê°€-??a-z|A-Z|0-9]/g, ""); 
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

function fetchJSONP(url) {
    updateNetworkStatus(false, '?µì‹  ì¤?..');
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        
        const timeout = setTimeout(() => {
            delete window[callbackName];
            document.body.removeChild(script);
            updateNetworkStatus(false, '?°ê²° ì§€??);
            reject(new Error('?¤íŠ¸?Œí¬ ?‘ë‹µ ?œê°„ ì´ˆê³¼'));
        }, 12000); 

        window[callbackName] = (data) => {
            clearTimeout(timeout);
            delete window[callbackName];
            document.body.removeChild(script);
            updateNetworkStatus(true, '?¤ì‹œê°?ON'); 
            resolve(data);
        };

        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            document.body.removeChild(script);
            updateNetworkStatus(false, '?°ê²° ?¤ë¥˜');
            reject(new Error('JSONP fetch failed'));
        };

        const separator = url.indexOf('?') >= 0 ? '&' : '?';
        const timestamp = new Date().getTime();
        script.src = `${url}${separator}callback=${callbackName}&_t=${timestamp}`;
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

    // [NEW] ?¤ì‹œê°??¨ë¼??ê°ì‹œ ?œìŠ¤??ê°€??    window.addEventListener('online', () => updateNetworkStatus(true, '?¤ì‹œê°?ON'));
    window.addEventListener('offline', () => updateNetworkStatus(false, 'OFFLINE'));

    if (!history.state) {
        history.replaceState({ phase: 'dashboard' }, "", "");
    }
    
    // [NEW] ???œì‘ ??ì´ˆê¸° ?”ë©´(?€?œë³´???¼ë¡œ ê°•ì œ ?„í™˜?˜ì—¬ ?ˆì´?„ì›ƒ ?•ë¦¬
    switchPhase('dashboard', true);

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
    if (targetId === 'dashboard' || targetId === 'step-history' || targetId === 'step-choice' || targetId === 'step-results') {
        if (stepper) stepper.style.display = 'none';
        currentState.currentStep = 0;
    } else {
        if (stepper) stepper.style.display = 'block';
        saveDraft(); // ?¨ê³„ ?„í™˜ ???ë™ ?€???œì„±??        const stepNum = parseInt(targetId.replace('step-', ''));
        if (!isNaN(stepNum)) {
            currentState.currentStep = stepNum;
            updateStepperUI(stepNum);
        } else if (targetId === 'step-improvement') {
            updateStepperUI(3);
            renderImprovementPhase(); // [NEW] ê°œì„  ?¨ê³„ ì§„ì… ???™ì  ?Œë”ë§??¸ì¶œ
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
    
    if (targetId === 'step-4') {
        const previewData = preparePreviewData();
        renderDetailedCardReport(previewData, 'preview-results-area', true);
    }
    
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
        header.querySelector('h2').innerText = "?‰ê????•ë³´ ë°?ë¶€??? íƒ";
        header.querySelector('p').innerText = "?±ëª…??? íƒ?˜ê³  ?Œì† ë¶€?œë? ?´ë¦­?˜ì„¸??";
    }
    if (confirmArea) confirmArea.style.display = 'none';
    if (homeBtn) homeBtn.style.display = 'flex';

    renderWorkers(); // [NEW] ?ê???ëª…ë‹¨ ?Œë”ë§??¸ì¶œ

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
    // [UNIFIED] ?µí•© ?Œë”ë§??”ì§„???¬ìš©?˜ë„ë¡?ë³€ê²?    setTimeout(() => {
        const logs = (data.logs || []).map(l => ({
            ë¶€?œëª…: data.department,
            ?‘ì—…ëª? data.task,
            ?ê??? data.worker,
            ?¼ì‹œ: data.timestamp,
            ?‘ì—…?¨ê³„: l.step || "?ê?",
            ?„í—˜?”ì¸: l.hazard,
            ?„ì¬?ˆì „ì¡°ì¹˜: l.current_checked,
            ê°œì„ ?€ì±? l.improvements_checked,
            ?„ì¬_?„í—˜?? l.current_score,
            ?”ë¥˜_?„í—˜?? l.residual_score,
            ì¢…í•©ê°œì„ ?˜ê²¬: data.overall_improvement
        }));
        renderDetailedCardReport(logs, 'report-view-content', false);
    }, 10);
    return `<div id="report-view-content" style="min-height:300px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">ë³´ê³ ?œë? êµ¬ì„± ì¤‘ì…?ˆë‹¤...</div>`;
}

// [NEW] ?„ì¬ ?ê? ì¤‘ì¸ ?°ì´?°ë? ë³´ê³ ???•ì‹?¼ë¡œ ë³€?˜í•˜???¨ìˆ˜ (v25.0)
function preparePreviewData() {
    const logs = [];
    const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker || "ë¯¸ì???;
    
    // 1. ?œì? ?„í—˜?”ì¸ ì²˜ë¦¬
    currentState.risks.forEach(risk => {
        const hash = getHash(risk.?„í—˜?”ì¸);
        const stepName = risk.?‘ì—…?¨ê³„;
        const key = `${stepName}-${hash}`;
        
        if (currentState.checkedItems.has(key) || currentState.riskMatrixData[key]) {
            const riskData = currentState.riskMatrixData[key] || { current: { score: 1 }, residual: { score: 1 } };
            
            const currentMeasures = [];
            (risk.ê°œì„ ?€ì±?|| []).forEach((m, idx) => {
                if (currentState.checkedMeasures.has(`${key}-m-${idx}`)) {
                    currentMeasures.push(`[?´í–‰] ${m}`);
                }
            });
            const manualCurrent = (currentState.manualHazardItems[key]?.current || []).filter((_, idx) => currentState.checkedMeasures.has(`${key}-mc-${idx}`));
            currentMeasures.push(...manualCurrent);
            if (currentState.manualNotes[key]?.current) currentMeasures.push(`(ì¶”ê??˜ê²¬) ${currentState.manualNotes[key].current}`);

            const improveMeasures = [];
            (risk.ê°œì„ ?€ì±?|| []).forEach((m, idx) => {
                if (currentState.improvedMeasures.has(`${key}-mi-${idx}`)) {
                    improveMeasures.push(`[ê°œì„ ] ${m}`);
                }
            });
            const manualImprove = (currentState.manualHazardItems[key]?.improve || []).filter((_, idx) => currentState.improvedMeasures.has(`${key}-mi-${idx}`));
            improveMeasures.push(...manualImprove);
            if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`(ì¶”ê??˜ê²¬) ${currentState.manualNotes[key].improvement}`);

            logs.push({
                ë¶€?œëª…: currentState.selectedDept,
                ?‘ì—…ëª? currentState.selectedTask,
                ?ê??? workerName,
                ?‘ì—…?¨ê³„: stepName,
                ?„í—˜?”ì¸: risk.?„í—˜?”ì¸,
                ?„ì¬?ˆì „ì¡°ì¹˜: currentMeasures.join('\n') || "?´ìƒ ?†ìŒ (?‘í˜¸)",
                ê°œì„ ?€ì±? improveMeasures.join('\n') || "ì¶”ê? ê°œì„ ?¬í•­ ?†ìŒ",
                ?„ì¬_?„í—˜?? riskData.current.score,
                ?”ë¥˜_?„í—˜?? riskData.residual.score,
                ì¢…í•©ê°œì„ ?˜ê²¬: document.getElementById('overall-improvement')?.value || ""
            });
        }
    });

    // 2. ?˜ë™ ì¶”ê? ?„í—˜?”ì¸ ì²˜ë¦¬
    currentState.manualHazards.forEach(hazard => {
        const key = hazard.id;
        const stepName = hazard.stepName;
        const riskData = currentState.riskMatrixData[key] || { current: { score: 1 }, residual: { score: 1 } };
        
        const currentMeasures = (currentState.manualHazardItems[key]?.current || []).filter((_, idx) => currentState.checkedMeasures.has(`${key}-mc-${idx}`));
        if (currentState.manualNotes[key]?.current) currentMeasures.push(`(ì¶”ê??˜ê²¬) ${currentState.manualNotes[key].current}`);
        
        const improveMeasures = (currentState.manualHazardItems[key]?.improve || []).filter((_, idx) => currentState.improvedMeasures.has(`${key}-mi-${idx}`));
        if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`(ì¶”ê??˜ê²¬) ${currentState.manualNotes[key].improvement}`);

        logs.push({
            ë¶€?œëª…: currentState.selectedDept,
            ?‘ì—…ëª? currentState.selectedTask,
            ?ê??? workerName,
            ?‘ì—…?¨ê³„: stepName,
            ?„í—˜?”ì¸: hazard.hazardName,
            ?„ì¬?ˆì „ì¡°ì¹˜: currentMeasures.join('\n') || "?´ìƒ ?†ìŒ (?‘í˜¸)",
            ê°œì„ ?€ì±? improveMeasures.join('\n') || "ì¶”ê? ê°œì„ ?¬í•­ ?†ìŒ",
            ?„ì¬_?„í—˜?? riskData.current.score,
            ?”ë¥˜_?„í—˜?? riskData.residual.score,
            ì¢…í•©ê°œì„ ?˜ê²¬: document.getElementById('overall-improvement')?.value || ""
        });
    });

    return logs;
}

function nextStep(step) {
    if (step === 2) {
        // ?´ë‹¹ ë¶€?œì? ?‘ì—…??ë§ëŠ” ëª¨ë“  ?ê? ?¨ê³„ ì¶”ì¶œ (ê³µë°± ?œê±°?˜ì—¬ ?•í™•???’ì„)
        currentState.availableSteps = [...new Set(currentState.risks
            .filter(r => (r.ë¶€?œëª…||'').trim() === (currentState.selectedDept||'').trim() && 
                         (r.?‘ì—…ëª?|'').trim() === (currentState.selectedTask||'').trim())
            .map(r => (r.?‘ì—…?¨ê³„||'').trim()))].filter(Boolean);
        
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
        // [ì¶”ê?] ?ê????±ëª… ? íš¨??ê²€??(Step 2?ì„œ 3?¼ë¡œ ê°€ê¸????„ìˆ˜ ì²´í¬)
        const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker;
        if (!workerName || workerName.trim() === "") {
            showToast("? ï¸ ?ê????±ëª…??ë¨¼ì? ?…ë ¥??ì£¼ì„¸?? (?”ë©´ ìµœìƒ??");
            const input = document.getElementById('worker-input');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.style.boxShadow = "0 0 0 4px rgba(244, 63, 94, 0.2)"; // ?¼ì‹œ??ê°•ì¡°
                setTimeout(() => input.style.boxShadow = "", 2000);
            }
            return;
        }

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
            
            // Phase 2???´ë¹„ê²Œì´??ë²„íŠ¼??ë¹„ì? (ì¤‘ë³µ ë°©ì?)
            const nextContainer = document.getElementById('next-action-container');
            if (nextContainer) nextContainer.innerHTML = '';
        }
        return;
    }

    switchPhase(`step-${step}`);
}

function prevStep() {
    if (currentState.currentStepIndex > 0) {
        currentState.currentStepIndex--;
        currentState.selectedStep = currentState.availableSteps[currentState.currentStepIndex];
        renderRiskChecklist(currentState.selectedStep);
        window.scrollTo({top: 0, behavior: 'smooth'});
    } else {
        // ì²?ë²ˆì§¸ ?¨ê³„?ì„œ ?´ì „ ê¸°ëŠ¥?€ ì²˜ìŒ?¼ë¡œ(?€?œë³´?? ?´ë™
        location.reload();
    }
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
            
            // [?¤í”„?¼ì¸ ì§€?? ë¡œì»¬ ?¤í† ë¦¬ì???ë°±ì—… ?€??            localStorage.setItem('kosha_cached_risks', JSON.stringify(allRisks));
            
            // ?„ì¬ ?”ë©´??Step 1(ë¶€??? íƒ)??ê²½ìš° UI ?…ë°?´íŠ¸
            const container = document.getElementById('selection-container');
            if (container && container.offsetParent !== null) {
                renderDeptBanners();
            }
            
            console.log("???¤ì‹œê°??„í—˜??ë§ˆìŠ¤??ë¡œë“œ ë°??ë™ ë¶„í•  ?„ë£Œ:", currentState.risks.length, "ê±?);
        }
    } catch (error) {
        console.warn("? ï¸ ?„í—˜???°ì´??ë¡œë“œ ?¤íŒ¨, ìºì‹œ???°ì´?°ë? ?•ì¸?©ë‹ˆ??", error);
        const cached = localStorage.getItem('kosha_cached_risks');
        if (cached) {
            currentState.risks = JSON.parse(cached);
            console.log("?“‚ ë¡œì»¬ ìºì‹œ ?°ì´??ë¡œë“œ ?„ë£Œ:", currentState.risks.length, "ê±?);
            renderDeptBanners();
            showToast("?“¡ ?¤í”„?¼ì¸ ëª¨ë“œ: ê¸°ì¡´ ?ê? ?°ì´?°ë? ?¬ìš©?©ë‹ˆ??");
        } else if (currentState.risks.length === 0) {
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
            localStorage.setItem('kosha_cached_users', JSON.stringify(currentState.users));
            renderWorkers();
            console.log("???¤ì‹œê°?ê·¼ë¡œ??ëª…ë‹¨ ë¡œë“œ ?±ê³µ:", currentState.users.length, "ê±?);
        }
    } catch (error) {
        const cachedUsers = localStorage.getItem('kosha_cached_users');
        if (cachedUsers) {
            currentState.users = JSON.parse(cachedUsers);
            renderWorkers();
        }
        console.warn("? ï¸ ê·¼ë¡œ??ëª…ë‹¨ ë¡œë“œ ?¤íŒ¨ (ìºì‹œ ?¬ìš© ?œë„)");
    }
    
    if (currentState.risks.length > 0 && navigator.onLine) {
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
    const input = document.getElementById('worker-input');
    const addBtn = document.getElementById('add-worker-btn');

    // [ì¶”ê?] '+ ì¶”ê?' ë²„íŠ¼ ?´ë¦­ ë°??”í„° ???´ë²¤??ë°”ì¸??    if (addBtn && input) {
        addBtn.onclick = () => {
            const val = input.value.trim();
            if (val) {
                addSelectedWorker(val);
                input.value = '';
                const dropdown = document.getElementById('worker-dropdown');
                if (dropdown) dropdown.classList.remove('active');
            }
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addBtn.click();
            }
        };
    }

    setupCustomDropdown(
        'worker-input', 
        'worker-dropdown', 
        () => currentState.users.map(u => ({ 
            value: u.?´ë¦„, 
            sub: `${u.?Œì†} | ${u.ì§ì±…}` 
        })),
        (val) => { 
            addSelectedWorker(val); 
            if (input) input.value = ''; // ? íƒ ??ì´ˆê¸°??        }
    );

    updateSelectedWorkersUI(); // ê¸°ì¡´ ? íƒ ?´ì—­ ë³µì›
}

// [NEW] ?‰ê???ì¶”ê? ë¡œì§
function addSelectedWorker(name) {
    if (!name || currentState.selectedWorkers.includes(name)) return;
    currentState.selectedWorkers.push(name);
    updateSelectedWorkersUI();
}

// [NEW] ?‰ê????? œ ë¡œì§
function removeSelectedWorker(name) {
    currentState.selectedWorkers = currentState.selectedWorkers.filter(n => n !== name);
    updateSelectedWorkersUI();
}

// [NEW] ? íƒ???‰ê???ì¹?Chip) UI ?Œë”ë§?function updateSelectedWorkersUI() {
    const container = document.getElementById('selected-workers-chips');
    if (!container) return;

    if (currentState.selectedWorkers.length === 0) {
        container.innerHTML = `<span style="font-size:0.8rem; color:#94a3b8; font-style:italic;">? íƒ???‰ê??ê? ?†ìŠµ?ˆë‹¤.</span>`;
        return;
    }

    container.innerHTML = currentState.selectedWorkers.map(name => `
        <div class="assessor-chip" style="background:#f1f5f9; border:1px solid #e2e8f0; padding:6px 12px; border-radius:100px; display:flex; align-items:center; gap:6px; animation: fadeIn 0.3s ease;">
            <span style="font-size:0.85rem; font-weight:700; color:#1e293b;">${name}</span>
            <button onclick="removeSelectedWorker('${name}')" style="background:none; border:none; color:#94a3b8; cursor:pointer; display:flex; align-items:center; padding:2px;">
                <i data-lucide="x-circle" style="width:14px; height:14px;"></i>
            </button>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
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
    if (!stepName) stepName = currentState.selectedStep;
    else currentState.selectedStep = stepName; // ?„ì¬ ?Œë”ë§?ì¤‘ì¸ ?¨ê³„ë¥??„ì—­ ?íƒœë¡??•ì •

    const container = document.getElementById('risk-checklist');
    if (!container) return;

    // ?¨ê³„ ì§„í–‰ ?íƒœ ?œì‹œ ë°?    const progressTotal = currentState.availableSteps.length || 1;
    const progressCurrent = (currentState.currentStepIndex || 0) + 1;
    const progressPercent = (progressCurrent / progressTotal) * 100;
    
    let checklistHTML = `
        <div class="step-progress-wrapper premium-glass" style="margin-bottom:2.5rem; background:rgba(255, 255, 255, 0.9); padding:1.5rem; border-radius:24px; box-shadow:var(--shadow-md); border:1px solid rgba(255, 255, 255, 0.5); backdrop-filter: blur(10px);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.75rem; color:var(--doing-blue); font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Phase ${progressCurrent}</span>
                    <span style="font-weight:900; color:#1e293b; font-size:1.25rem; letter-spacing:-0.5px;">${stepName}</span>
                </div>
                <div style="text-align:right;">
                    <span style="display:block; font-size:1.1rem; font-weight:900; color:var(--doing-blue);">${Math.round(progressPercent)}%</span>
                    <span style="font-size:0.75rem; color:#64748b; font-weight:700;">${progressCurrent} / ${progressTotal} Sections</span>
                </div>
            </div>
            <div class="step-progress-bar-bg" style="height:8px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                <div class="step-progress-bar-fill" style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, #4f46e5, #3b82f6); box-shadow: 0 0 10px rgba(79, 70, 229, 0.3); transition:width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
            </div>
        </div>
        <div class="checklist-global-v6.3 checklist-items-area" style="display:flex !important; flex-direction:column !important; align-items:stretch !important; width:100% !important; padding:0 !important; margin-top: 1rem !important;">
    `;
    
    // ?„í„°ë§???ë¶€?œëª… + ?‘ì—…ëª?+ ?¨ê³„ëª?ì¡°ê±´??ëª¨ë‘ ?•ì¸?˜ì—¬ ?•í™•???°ì´??ë¡œë“œ
    let taskRisks = currentState.risks.filter(r => 
        (r.ë¶€?œëª…||"").trim() === (currentState.selectedDept||"").trim() &&
        (r.?‘ì—…ëª?|"").trim() === (currentState.selectedTask||"").trim() && 
        (r.?‘ì—…?¨ê³„||"").trim() === (stepName||"").trim()
    );

    // [ê°œì„ ] ì¤‘ë³µ ?„í—˜?”ì¸ ?œê±° (?°ì´??ì¤‘ë³µ ë°©ì?)
    const seenHazards = new Set();
    taskRisks = taskRisks.filter(r => {
        if (seenHazards.has(r.?„í—˜?”ì¸)) return false;
        seenHazards.add(r.?„í—˜?”ì¸);
        return true;
    });

    console.log(`?” Rendering risks for [${currentState.selectedTask}] - [${stepName}]. Unique items: ${taskRisks.length}`);
    
    if (taskRisks.length === 0) {
        checklistHTML += `
            <div style="text-align:center; padding:3rem; background:#f8fafc; border-radius:20px; border:1px dashed #cbd5e1; color:#94a3b8;">
                <p>?´ë‹¹ ?¨ê³„???•ì˜???„í—˜ ?”ì¸???†ìŠµ?ˆë‹¤.</p>
                <p style="font-size:0.75rem; margin-top:8px;">?°ì´??ë§ˆìŠ¤???œíŠ¸?€ ë¶€???‘ì—…ëª…ì´ ?¼ì¹˜?˜ëŠ”ì§€ ?•ì¸?˜ì‹­?œì˜¤.</p>
            </div>
        `;
    }

    checklistHTML += taskRisks.map((r, i) => {
        const hazardHash = getHash(r.?„í—˜?”ì¸);
        const taskHash = getHash(currentState.selectedTask || "");
        const stepHash = getHash(stepName || currentState.selectedStep || "");
        const key = `${taskHash}-${stepHash}-${hazardHash}`;
        
        const isChecked = currentState.checkedItems.has(key);
        const notes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        const riskData = currentState.riskMatrixData[key] || { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const measures = Array.isArray(r.ê°œì„ ?€ì±? ? r.ê°œì„ ?€ì±?: [r.ê°œì„ ?€ì±?;
        const isExpanded = currentState.expandedHazardKeys.has(key);
        
        return `
            <div class="check-item ${isChecked ? 'checked' : ''} ${isExpanded ? 'expanded' : ''}" id="risk-card-${i}" 
                 style="width: 100% !important; min-width: 100% !important; padding: 1.1rem !important;">
                
                <div class="check-item-header" onclick="toggleAccordion(${i}, '${key}')" style="cursor: pointer;">
                    <div class="check-indicator" onclick="event.stopPropagation(); toggleRiskByHash('${key}', '${stepName}')">
                        <i data-lucide="check"></i>
                    </div>
                    <span class="risk" style="flex: 1; font-weight: 900; color: #1e293b;">${r.?„í—˜?”ì¸}</span>
                    <i data-lucide="chevron-down" class="expand-icon" style="transition: 0.3s; ${isExpanded ? 'transform: rotate(180deg);' : ''}"></i>
                </div>

                <div class="measure-container" id="measure-panel-${i}" style="margin-top: 0; display: ${isExpanded ? 'block' : 'none'};">
                    <!-- Section 1: ?„ì¬?ˆì „ì¡°ì¹˜ -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:800; color:var(--doing-blue); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="shield-check" style="width:14px;"></i> [?„ì¬?ˆì „ì¡°ì¹˜]
                        </p>
                        <ul class="measure-list" style="margin-bottom: 1rem;">
                            ${measures.map((m, mi) => {
                                const mKey = `${key}-m-${mi}`;
                                const isMChecked = currentState.checkedMeasures.has(mKey);
                                return `
                                    <li class="measure-item ${isMChecked ? 'checked' : ''}" 
                                        onclick="toggleMeasureByHash('${mKey}', 'current', '${stepName}', event)">
                                        <div class="m-checkbox ${isMChecked ? 'active' : ''}">
                                            <i data-lucide="check"></i>
                                        </div>
                                        <span style="flex: 1; font-size: 0.95rem;">${m}</span>
                                    </li>
                                `;
                            }).join('')}
                        </ul>

                        <div class="manual-input-area" style="margin-bottom: 1rem;">
                            <label style="display: block; font-size: 0.8rem; font-weight: 800; color: #64748b; margin-bottom: 8px;">
                                <i data-lucide="edit-3" style="width:14px;"></i> ?„ì¬ ì¶”ê? ?ˆì „ì¡°ì¹˜ (?˜ê¸° ?…ë ¥)
                            </label>
                            <textarea class="manual-textarea" placeholder="ê¸°ì¡´ ?€ì±???ì¶”ê????„ì¥ ì¡°ì¹˜ ?´ìš©???…ë ¥?˜ì„¸??.." 
                                style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; width: 100%; min-height: 80px; font-family: inherit;"
                                oninput="updateManualNote('${key}', 'current', this.value)">${notes.current || ""}</textarea>
                        </div>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(248, 250, 252, 0.8); padding: 0.85rem 1rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                                  <span style="font-weight: 800; color: #334155; font-size: 0.85rem; font-family: 'Outfit', sans-serif;">?„ì¬ ?„í—˜???˜ì?</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'severity', this.value)" 
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8; font-size: 0.8rem;">Ã—</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'frequency', this.value)"
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8; font-size: 0.8rem;">=</span>
                                <span class="row-score ${getScoreClass(riskData.current.score)}" 
                                      style="min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: 900; font-size: 1rem; box-shadow: var(--shadow-sm);">
                                    ${riskData.current.score}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: ê°œì„ ?€ì±?ë°??”ë¥˜ ?„í—˜??-->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
                            <i data-lucide="wrench" style="width:16px;"></i> [ê°œì„ ?€ì±?
                        </p>
                    
                        <ul class="measure-list improvement" style="margin-bottom: 1rem;">
                            ${measures.map((m, mi) => {
                                const mKey = `${key}-m-${mi}`;
                                const isMChecked = currentState.checkedMeasures.has(mKey);
                                const isMImproved = currentState.improvedMeasures.has(mKey);
                                
                                // [ê°œì„ ] ?„ì¬ ?¤ì²œ ì¤?Checked)????ª©?€ ê°œì„ ?€ì±?ëª©ë¡?ì„œ ?œì™¸
                                if (isMChecked) return '';
                                
                                return `
                                    <li class="measure-item ${isMImproved ? 'improved' : ''}" 
                                        onclick="toggleMeasureByHash('${mKey}', 'improve', '${stepName}', event)"
                                        style="transition: all 0.3s ease; cursor: pointer; border-radius: 12px; margin-bottom: 6px;">
                                        <div class="m-checkbox ${isMImproved ? 'active-improve' : ''}">
                                            <i data-lucide="check"></i>
                                        </div>
                                        <span style="flex: 1; font-size: 0.95rem; font-weight: 500; color: #334155;">${m}</span>
                                    </li>
                                `;
                            }).join('')}
                            ${measures.every((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`)) ? 
                                `<li style="text-align:center; padding:15px; color:#94a3b8; font-size:0.85rem; background:#f8fafc; border-radius:12px; border:1px dashed #e2e8f0;">??ëª¨ë“  ?œì? ?ˆì „ì¡°ì¹˜ê°€ ?¤ì²œ ì¤‘ì…?ˆë‹¤.</li>` : ''}
                        </ul>

                        <div class="manual-input-area" style="margin-bottom: 1rem;">
                            <label style="display: block; font-size: 0.8rem; font-weight: 900; color: var(--doing-accent); margin-bottom: 10px; font-family: 'Outfit', sans-serif;">
                                <i data-lucide="wrench" style="width:16px;"></i> ì¶”ê? ê°œì„ ?€ì±??…ë ¥ (?˜ê¸°)
                            </label>
                            <textarea class="manual-textarea" placeholder="?„í—˜??ì¤„ì´ê¸??„í•œ ì¶”ê? ê°œì„  ?˜ê²¬???…ë ¥?˜ì„¸??.." 
                                style="background: rgba(254, 242, 242, 0.5); border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 90px; font-family: inherit; font-size: 0.95rem;"
                                oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement || ""}</textarea>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(254, 242, 242, 0.5); padding: 0.85rem 1rem; border-radius: 16px; border: 1.5px solid rgba(244, 63, 94, 0.1);">
                            <span style="font-weight: 800; color: var(--doing-accent); font-size: 0.85rem; font-family: 'Outfit', sans-serif;">ê°œì„  ???”ë¥˜?„í—˜</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'severity', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4); font-size: 0.8rem;">Ã—</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'frequency', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4); font-size: 0.8rem;">=</span>
                                <span class="row-score ${getScoreClass(riskData.residual.score)}" 
                                      style="min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: 900; font-size: 1rem; box-shadow: var(--shadow-sm);">
                                    ${riskData.residual.score}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // --- [NEW] ?˜ë™ ì¶”ê????„í—˜?”ì¸ ?Œë”ë§?---
    const manualRisks = (currentState.manualHazards || []).filter(mr => mr.stepName === stepName);
    const manualHTML = manualRisks.map((mr, mi) => {
        const key = mr.id; // ?´ë? ê³ ìœ ??ID(hash)ë¥?ê°€ì§€ê³??ˆìŒ
        const isChecked = currentState.checkedItems.has(key);
        const isExpanded = currentState.expandedHazardKeys.has(key);
        const riskData = currentState.riskMatrixData[key] || {
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        const notes = currentState.manualNotes[key] || { current: mr.currentMeasures || "", improvement: "" };

        return `
            <div class="check-item manual ${isChecked ? 'checked' : ''} ${isExpanded ? 'expanded' : ''}" id="risk-card-m-${mi}" 
                 style="width: 100% !important; min-width: 100% !important; padding: 1.1rem !important; border-left: 5px solid var(--doing-gold) !important;">
                
                <div class="check-item-header" onclick="toggleAccordion('m-${mi}', '${key}')" style="cursor: pointer;">
                    <div class="check-indicator" onclick="event.stopPropagation(); toggleRiskByHash('${key}', '${stepName}')">
                        <i data-lucide="check"></i>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                            <span style="font-size: 0.7rem; color: var(--doing-gold); font-weight: 800; text-transform: uppercase;">Manual Entry</span>
                            <button onclick="event.stopPropagation(); deleteManualHazard('${key}', '${stepName}')" 
                                    style="background: none; border: none; color: #ef4444; padding: 0 4px; cursor: pointer; opacity: 0.6; height: 20px;">
                                <i data-lucide="trash-2" style="width: 14px;"></i>
                            </button>
                        </div>
                        <span class="risk" style="font-weight: 950; color: #1e293b; font-size: 1.1rem;">${mr.hazardName}</span>
                    </div>
                    <i data-lucide="chevron-down" class="expand-icon" style="transition: 0.3s; ${isExpanded ? 'transform: rotate(180deg);' : ''}"></i>
                </div>

                <div class="measure-container" id="measure-panel-m-${mi}" style="margin-top: 0; display: ${isExpanded ? 'block' : 'none'};">
                    <!-- Section 1: ?„ì¬?ˆì „ì¡°ì¹˜ -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-indigo); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif;">
                            <i data-lucide="shield-check" style="width:16px;"></i> [?„ì¬?ˆì „ì¡°ì¹˜]
                        </p>
                        
                        <!-- [NEW] ?˜ë™ ì¡°ì¹˜ ë¦¬ìŠ¤??-->
                        <ul class="measure-list" style="margin-bottom: 1rem;">
                            ${(currentState.manualHazardItems[key]?.current || []).map((m, mIdx) => {
                                const mKey = `${key}-mc-${mIdx}`;
                                const isMChecked = currentState.checkedMeasures.has(mKey);
                                return `
                                    <li class="measure-item ${isMChecked ? 'checked' : ''}" 
                                        onclick="toggleMeasureByHash('${mKey}', 'current', '${stepName}', event)">
                                        <div class="m-checkbox ${isMChecked ? 'active' : ''}">
                                            <i data-lucide="check"></i>
                                        </div>
                                        <span style="flex: 1; font-size: 0.95rem;">${m}</span>
                                        <button onclick="event.stopPropagation(); removeManualMeasure('${key}', 'current', ${mIdx}, '${stepName}')" 
                                                style="background:none; border:none; color:#cbd5e1; cursor:pointer; padding:5px;">
                                            <i data-lucide="x-circle" style="width:14px;"></i>
                                        </button>
                                    </li>
                                `;
                            }).join('')}
                        </ul>

                        <!-- [NEW] ì¡°ì¹˜ ì¶”ê? ?…ë ¥ì°?-->
                        <div style="display:flex; gap:8px; margin-bottom:1rem;">
                            <input type="text" id="manual-input-${key}-current" placeholder="?„ì¬ ?œí–‰ ì¤‘ì¸ ì¡°ì¹˜ ì¶”ê?..." 
                                   style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:0.9rem;"
                                   onkeypress="if(event.key==='Enter') addManualMeasure('${key}', 'current', '${stepName}')">
                            <button onclick="addManualMeasure('${key}', 'current', '${stepName}')" 
                                    style="background:var(--doing-indigo); color:white; border:none; border-radius:10px; width:40px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>

                        <textarea class="manual-textarea" placeholder="ì¶”ê??ì¸ ?„ì¬ ?ˆì „ì¡°ì¹˜ ?•ì¸ ?´ìš©???…ë ¥?˜ì„¸??.." 
                                  style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 80px; font-family: inherit;"
                                  oninput="updateManualNote('${key}', 'current', this.value)">${notes.current}</textarea>
                        
                        <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; background: rgba(248, 250, 252, 0.8); padding: 1rem; border-radius: 18px; border: 1px solid #e2e8f0;">
                            <span style="font-weight: 800; color: #334155; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">?„ì¬ ?„í—˜???˜ì?</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'severity', this.value)" 
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8;">Ã—</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'frequency', this.value)"
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8;">=</span>
                                <span class="row-score ${getScoreClass(riskData.current.score)}" 
                                      style="min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: 900;">
                                    ${riskData.current.score}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: ê°œì„ ?€ì±?-->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif;">
                            <i data-lucide="wrench" style="width:16px;"></i> [ê°œì„ ?€ì±?
                        </p>

                        <!-- [NEW] ?˜ë™ ê°œì„ ?€ì±?ë¦¬ìŠ¤??(?„ì¬ ì¡°ì¹˜ ì²´í¬?˜ì? ?Šì? ??ª©ë§??œì‹œ) -->
                        <ul class="measure-list improvement" style="margin-bottom: 1rem;">
                            ${(currentState.manualHazardItems[key]?.improve || []).map((m, mIdx) => {
                                const mcKey = `${key}-mc-${mIdx}`; // ?„ì¬ì¡°ì¹˜?€ ?™ì¼ ?¸ë±???¬ìš©
                                const miKey = `${key}-mi-${mIdx}`;
                                const isMChecked = currentState.checkedMeasures.has(mcKey);
                                const isMImproved = currentState.improvedMeasures.has(miKey);
                                
                                if (isMChecked) return '';

                                return `
                                    <li class="measure-item ${isMImproved ? 'improved' : ''}" 
                                        onclick="toggleMeasureByHash('${miKey}', 'improve', '${stepName}', event)">
                                        <div class="m-checkbox ${isMImproved ? 'active-improve' : ''}">
                                            <i data-lucide="check"></i>
                                        </div>
                                        <span style="flex: 1; font-size: 0.95rem;">${m}</span>
                                        <button onclick="event.stopPropagation(); removeManualMeasure('${key}', 'improve', ${mIdx}, '${stepName}')" 
                                                style="background:none; border:none; color:#cbd5e1; cursor:pointer; padding:5px;">
                                            <i data-lucide="x-circle" style="width:14px;"></i>
                                        </button>
                                    </li>
                                `;
                            }).join('')}
                        </ul>

                        <!-- [NEW] ê°œì„ ?€ì±?ì¶”ê? ?…ë ¥ì°?-->
                        <div style="display:flex; gap:8px; margin-bottom:1rem;">
                            <input type="text" id="manual-input-${key}-improve" placeholder="?„ìš”??ê°œì„  ?€ì±?ì¶”ê?..." 
                                   style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:0.9rem;"
                                   onkeypress="if(event.key==='Enter') { event.preventDefault(); addManualMeasure('${key}', 'improve', '${stepName.replace(/'/g, "\\'")}'); }">
                            <button onclick="addManualMeasure('${key}', 'improve', '${stepName.replace(/'/g, "\\'")}')" 
                                    style="background:var(--doing-accent); color:white; border:none; border-radius:10px; width:40px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>

                        <textarea class="manual-textarea" placeholder="ì¶”ê? ê°œì„ ?˜ê²¬ ?ëŠ” ?•ì¸ ?¬í•­???…ë ¥?˜ì„¸??.." 
                                  style="background: rgba(254, 242, 242, 0.5); border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 80px; font-family: inherit;"
                                  oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement}</textarea>

                        <div style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: space-between; background: rgba(254, 242, 242, 0.5); padding: 1.25rem; border-radius: 20px; border: 1.5px solid rgba(244, 63, 94, 0.1);">
                            <span style="font-weight: 800; color: var(--doing-accent); font-size: 0.9rem; font-family: 'Outfit', sans-serif;">ê°œì„  ???”ë¥˜?„í—˜</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'severity', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4);">Ã—</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'frequency', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4);">=</span>
                                <span class="row-score ${getScoreClass(riskData.residual.score)}" 
                                      style="min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-weight: 900;">
                                    ${riskData.residual.score}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    checklistHTML += manualHTML;

    // --- [NEW] ?„í—˜?”ì¸ ì¶”ê? ë²„íŠ¼ ?¹ì…˜ ---
    checklistHTML += `
        <div style="margin-top: 2rem; display: flex; justify-content: center; padding-bottom: 2rem; position: relative; z-index: 10;">
            <button onclick="requestAddManualHazard('${stepName.replace(/'/g, "\\'")}')" 
                    style="background: white; color: var(--doing-gold); border: 2px dashed var(--doing-gold); padding: 1.25rem 2rem; border-radius: 20px; font-weight: 900; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; transition: 0.3s; cursor: pointer !important; box-shadow: var(--shadow-sm); pointer-events: auto !important;">
                <i data-lucide="plus-circle"></i>
                ?ˆë¡œ???„í—˜?”ì¸ ë°œê²¬ ë°?ì¶”ê??˜ê¸°
            </button>
        </div>
    `;

    checklistHTML += `</div>`; // .checklist-items-area ?«ê¸°

    container.innerHTML = checklistHTML;
    initLucide();
    updateNextButton(taskRisks.length);
    checkIncidents(taskRisks);
}

// [NEW] ê°œì„  ?¨ê³„(Phase 3)???™ì  ë¦¬ìŠ¤???Œë”ë§??¨ìˆ˜
function renderImprovementPhase() {
    const container = document.querySelector('#step-improvement .improvement-content-area');
    if (!container) return;

    // 0. ?€ê²??ì—­ ì´ˆê¸°??ë°??ë‹¨ ?´ë¹„ê²Œì´??ë¹„ì? (ì¤‘ë³µ ë°©ì?)
    const nextContainerFocus = document.getElementById('next-action-container');
    if (nextContainerFocus) nextContainerFocus.innerHTML = '';
    const improvedKeys = Array.from(currentState.improvedMeasures);
    
    if (improvedKeys.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 1.5rem; text-align: center; color: #64748b; background: white; border-radius: 24px; border: 1px dashed #e2e8f0;">
                <i data-lucide="info" style="width:48px; height:48px; margin-bottom:1rem; opacity:0.3;"></i>
                <div style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">? íƒ??ê°œì„  ì¡°ì¹˜ê°€ ?†ìŠµ?ˆë‹¤.</div>
                <div style="font-size: 0.9rem; margin-top: 8px;">ëª¨ë“  ì¡°ì¹˜ê°€ ?´í–‰ ì¤‘ì´ê±°ë‚˜ ?‘í˜¸?©ë‹ˆ?? ë°”ë¡œ ?œëª… ?¨ê³„ë¡??´ë™?˜ì„¸??</div>
                <button class="btn btn-primary" onclick="nextStep(4)" style="margin-top:2rem; width:100%;">?œëª… ë°??œì¶œ ?¨ê³„ë¡??´ë™ <i data-lucide="chevron-right"></i></button>
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; justify-content: center;">
                <button class="btn" onclick="switchPhase('step-2', true)" 
                        style="background: #f1f5f9; color: #475569; width: 100%; height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i data-lucide="arrow-left"></i> ?´ì „ ?¨ê³„ë¡?(?ê? ?¤ì‹œ?˜ê¸°)
                </button>
            </div>
        `;
        initLucide();
        return;
    }

    let itemsHTML = improvedKeys.map((mKey, idx) => {
        let hazardName = "ë¯¸ì •???„í—˜?”ì¸";
        let measureName = "ë¯¸ì •???€ì±?;

        // ??ë¶„ì„ ë°??•ë³´ ì¶”ì¶œ
        if (mKey.includes('-mi-')) { // ?˜ë™ ??ª©
            const parts = mKey.split('-mi-');
            const hId = parts[0];
            const mIdx = parseInt(parts[1]);
            const hazard = (currentState.manualHazards || []).find(h => h.id === hId);
            if (hazard) {
                hazardName = hazard.hazardName;
                measureName = (currentState.manualHazardItems[hId]?.improve || [])[mIdx] || "?˜ë™ ê°œì„ ??ª©";
            }
        } else { // ?œì? ??ª©
            const parts = mKey.split('-m-');
            if (parts.length >= 2) {
                const hazardHash = parts[0];
                const mIdx = parseInt(parts[1]);
                const risk = currentState.risks.find(r => getHash(r.?„í—˜?”ì¸) === hazardHash.split('-').pop());
                if (risk) {
                    hazardName = risk.?„í—˜?”ì¸;
                    measureName = (Array.isArray(risk.ê°œì„ ?€ì±? ? risk.ê°œì„ ?€ì±?mIdx] : risk.ê°œì„ ?€ì±? || "?œì? ê°œì„ ?€ì±?;
                }
            }
        }

        const result = currentState.improvementResults[mKey] || { photo: null, note: "" };

        return `
            <div class="improvement-card" style="background: white; border-radius: 18px; padding: 1.15rem; border: 1px solid #f1f5f9; border-top: 5px solid var(--doing-accent); margin-bottom: 0.85rem; box-shadow: var(--shadow-sm);">
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.5rem;">
                    <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">IMPROVEMENT ITEM #${idx + 1}</span>
                    <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">[?¬ê³ ? í˜•] ${hazardName}</span>
                    <span style="font-size: 1.1rem; color: #1e293b; font-weight: 900; line-height: 1.4;">${measureName}</span>
                </div>

                <div class="media-card" style="margin-bottom: 1rem; border: none; padding: 0;">
                    <div class="photo-upload-box" onclick="document.getElementById('photo-input-${mKey}').click()" 
                         id="preview-box-${mKey}" 
                         style="background: #fffcfc; border: 2px dashed rgba(244, 63, 94, 0.2); height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 16px; cursor: pointer; transition: 0.3s; overflow: hidden;">
                        ${result.photo 
                            ? `<img src="${result.photo}" style="width: 100%; height: 100%; object-fit: cover;">` 
                            : `<i data-lucide="camera" style="width:32px; height:32px; margin-bottom:8px; color:var(--doing-accent); opacity:0.4;"></i>
                               <span style="font-size: 0.9rem; font-weight: 800; color: var(--doing-accent); opacity: 0.6;">ê°œì„  ?????¬ì§„ ì´¬ì˜</span>`
                        }
                    </div>
                    <input type="file" id="photo-input-${mKey}" accept="image/*" capture="environment" style="display:none;" 
                           onchange="handleImprovementPhoto('${mKey}', this)">
                </div>

                <div class="manual-input-area" style="padding: 0; border: none;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 900; color: #475569; margin-bottom: 8px;">
                        <i data-lucide="edit-3" style="width:14px;"></i> ì¡°ì¹˜ ê²°ê³¼ ?…ë ¥
                    </label>
                    <textarea class="manual-textarea" placeholder="ì¡°ì¹˜ ?´ìš© ?ëŠ” ?•ì¸ ?¬í•­???…ë ¥?˜ì„¸??.." 
                              style="background: #fffcfc; border: 1.5px solid rgba(244, 63, 94, 0.1); border-radius: 12px; padding: 1rem; width: 100%; min-height: 80px; font-size:0.9rem;"
                              oninput="updateImprovementNote('${mKey}', this.value)">${result.note}</textarea>
                </div>
            </div>
        `;
    }).join('');

    // ?˜ë‹¨ ê³µí†µ ?…ë ¥ì°?ë°??´ë¹„ê²Œì´??    itemsHTML += `
        <div class="manual-input-area" style="background:white; border-radius:20px; padding:1.25rem; border:1px solid #f1f5f9; margin-bottom: 1.5rem;">
            <label class="ui-label" style="display:flex; align-items:center; gap:6px; font-weight: 900; font-size: 0.9rem;">
                <i data-lucide="message-square" style="width:16px;"></i> ì¢…í•© ê°œì„  ì¡°ì¹˜ ?˜ê²¬
            </label>
            <textarea id="overall-improvement" class="manual-textarea" style="min-height:100px; margin-top:10px; font-size: 0.9rem;" 
                      placeholder="?„ì¥ ?„ì²´???€??ì¢…í•©?ì¸ ê°œì„  ?˜ê²¬???…ë ¥?˜ì„¸??.." 
                      oninput="currentState.overallImprovement = this.value">${currentState.overallImprovement || ""}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 2rem;">
            <button class="btn" onclick="switchPhase('step-2', true)" 
                    style="background: #f1f5f9; color: #475569; height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <i data-lucide="arrow-left"></i> ?´ì „?¼ë¡œ
            </button>
            <button class="btn btn-primary" onclick="nextStep(4)" 
                    style="background: var(--doing-accent); height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                ?¤ìŒ (?œëª…) <i data-lucide="chevron-right"></i>
            </button>
        </div>
    `;

    container.innerHTML = itemsHTML;
    initLucide();
}

function handleImprovementPhoto(mKey, input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // ?´ë?ì§€ ë¦¬ì‚¬?´ì§• (?±ëŠ¥ ë°??©ëŸ‰ ìµœì ??
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max = 1200;
            
            if (width > height) {
                if (width > max) { height *= max / width; width = max; }
            } else {
                if (height > max) { width *= max / height; height = max; }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            
            if (!currentState.improvementResults[mKey]) {
                currentState.improvementResults[mKey] = { photo: null, note: "" };
            }
            currentState.improvementResults[mKey].photo = optimizedBase64;
            
            // ë¯¸ë¦¬ë³´ê¸° ?…ë°?´íŠ¸
            const previewBox = document.getElementById(`preview-box-${mKey}`);
            if (previewBox) {
                previewBox.innerHTML = `<img src="${optimizedBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            showToast("?“· ?¬ì§„??ì²¨ë??˜ì—ˆ?µë‹ˆ??");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateImprovementNote(mKey, val) {
    if (!currentState.improvementResults[mKey]) {
        currentState.improvementResults[mKey] = { photo: null, note: "" };
    }
    currentState.improvementResults[mKey].note = val;
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

function requestAddManualHazard(stepName) {
    const hazardName = prompt("ë°œê²¬???ˆë¡œ???„í—˜?”ì¸ëª…ì„ ?…ë ¥?˜ì„¸??");
    if (!hazardName || hazardName.trim() === "") return;

    const id = `manual-${getHash(currentState.selectedTask)}-${getHash(stepName)}-${Date.now()}`;
    const newHazard = {
        id: id,
        stepName: stepName,
        hazardName: hazardName.trim(),
        currentMeasures: ""
    };

    if (!currentState.manualHazards) currentState.manualHazards = [];
    currentState.manualHazards.push(newHazard);
    
    // ì¡°ì¹˜ ??ª© ?€?¥ì†Œ ì´ˆê¸°??    currentState.manualHazardItems[id] = { current: [], improve: [] };
    
    // ì¦‰ì‹œ ?¼ì³ì§??íƒœë¡??œì‹œ
    currentState.expandedHazardKeys.add(id);
    currentState.checkedItems.add(id); // ?˜ë™ ì¶”ê???ê¸°ë³¸?ìœ¼ë¡?ì²´í¬??ê²ƒìœ¼ë¡?ê°„ì£¼

    renderRiskChecklist(stepName);
    showToast("???ˆë¡œ???„í—˜?”ì¸??ëª©ë¡ ?˜ë‹¨??ì¶”ê??˜ì—ˆ?µë‹ˆ??");
}

function deleteManualHazard(hazardId, stepName) {
    if (confirm("???„í—˜?”ì¸???µì§¸ë¡??? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?")) {
        currentState.manualHazards = currentState.manualHazards.filter(h => h.id !== hazardId);
        currentState.checkedItems.delete(hazardId);
        currentState.expandedHazardKeys.delete(hazardId);
        delete currentState.manualHazardItems[hazardId];
        delete currentState.manualNotes[hazardId];
        delete currentState.riskMatrixData[hazardId];
        
        renderRiskChecklist(stepName);
        showToast("?—‘ï¸??„í—˜?”ì¸???? œ?˜ì—ˆ?µë‹ˆ??");
    }
}

function addManualMeasure(hazardId, type, stepName) {
    const input = document.getElementById(`manual-input-${hazardId}-${type}`);
    const val = input ? input.value.trim() : "";
    
    if (!val) {
        showToast("? ï¸ ì¶”ê????´ìš©???…ë ¥?˜ì„¸??");
        return;
    }

    if (!currentState.manualHazardItems[hazardId]) {
        currentState.manualHazardItems[hazardId] = { current: [], improve: [] };
    }

    currentState.manualHazardItems[hazardId][type].push(val);
    input.value = ""; // ?…ë ¥ì°?ì´ˆê¸°??    
    renderRiskChecklist(stepName);
    showToast("??ì¡°ì¹˜ ??ª©??ì¶”ê??˜ì—ˆ?µë‹ˆ??");
}

function removeManualMeasure(hazardId, type, mIndex, stepName) {
    if (confirm("????ª©???? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?")) {
        currentState.manualHazardItems[hazardId][type].splice(mIndex, 1);
        renderRiskChecklist(stepName);
    }
}

function toggleRiskByHash(key, stepName) {
    if (currentState.checkedItems.has(key)) {
        currentState.checkedItems.delete(key);
    } else {
        currentState.checkedItems.add(key);
    }
    renderRiskChecklist(stepName);
}

function toggleAccordion(index, key) {
    const targetCard = document.getElementById(`risk-card-${index}`);
    const measurePanel = document.getElementById(`measure-panel-${index}`);
    
    if (targetCard && measurePanel) {
        const isCurrentlyExpanded = currentState.expandedHazardKeys.has(key);
        
        if (isCurrentlyExpanded) {
            currentState.expandedHazardKeys.delete(key);
            targetCard.classList.remove('expanded');
            measurePanel.style.display = 'none';
        } else {
            currentState.expandedHazardKeys.add(key);
            targetCard.classList.add('expanded');
            measurePanel.style.display = 'block';
            
            // Lucide ?„ì´ì½??¬ìƒ??ë°?ë¶€?œëŸ¬???¤í¬ë¡?            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    } else {
        // [?ˆì™¸ì²˜ë¦¬] DOM???†ëŠ” ê²½ìš° ê°•ì œ ë¦¬ë Œ?”ë§
        if (currentState.expandedHazardKeys.has(key)) {
            currentState.expandedHazardKeys.delete(key);
        } else {
            currentState.expandedHazardKeys.add(key);
        }
        renderRiskChecklist(currentState.selectedStep);
    }
}

function toggleMeasureByHash(mKey, type, stepName, event) {
    event.stopPropagation();
    
    if (type === 'current') {
        if (currentState.checkedMeasures.has(mKey)) {
            currentState.checkedMeasures.delete(mKey);
        } else {
            currentState.checkedMeasures.add(mKey);
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
    const parts = mKey.split('-m-');
    const hazardKey = parts[0];
    if (!currentState.checkedItems.has(hazardKey)) {
        currentState.checkedItems.add(hazardKey);
    }

    renderRiskChecklist(stepName);
}

function updateRiskScoreByHash(key, stepName, matrixType, field, value) {
    if (!currentState.riskMatrixData[key]) {
        currentState.riskMatrixData[key] = { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
    }
    
    // ?°ì´???…ë°?´íŠ¸
    const val = parseInt(value);
    currentState.riskMatrixData[key][matrixType][field] = val;
    
    // [?µì‹¬ ê°œì„ ] ?„ì¬?„í—˜(current) ?˜ì • ???”ë¥˜?„í—˜(residual) ê°•ì œ ?™ê¸°??    if (matrixType === 'current') {
        currentState.riskMatrixData[key].residual[field] = val;
    }

    // ê°ê°??ìµœì¢… ?ìˆ˜ ?¬ê³„??(current & residual ?????•ì‹¤???™ê¸°??
    const current = currentState.riskMatrixData[key].current;
    const residual = currentState.riskMatrixData[key].residual;
    
    current.score = (current.severity || 1) * (current.frequency || 1);
    residual.score = (residual.severity || 1) * (residual.frequency || 1);
    
    // ë¶€ëª??„í—˜?”ì¸ ?ë™ ì²´í¬ ì²˜ë¦¬
    if (!currentState.checkedItems.has(key)) {
        currentState.checkedItems.add(key);
    }

    // ë¦¬ë Œ?”ë§ (?¸ìê°€ ?†ìœ¼ë©??„ì—­ ?íƒœ ?¬ìš©)
    const targetStep = stepName || currentState.selectedStep;
    renderRiskChecklist(targetStep);
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

    const currentCheckedCount = Array.from(currentState.checkedItems).filter(key => 
        key.startsWith(`${getHash(currentState.selectedTask || "")}-${getHash(currentState.selectedStep || "")}`)
    ).length;
    
    const isFirstStep = currentState.currentStepIndex === 0;
    const isLastStep = currentState.currentStepIndex === currentState.availableSteps.length - 1;
    
    const nextBtnText = isLastStep ? "?‰ê? ?„ë£Œ <i data-lucide='check-check'></i>" : "?¤ìŒ?¨ê³„ <i data-lucide='arrow-right'></i>";
    const prevBtnText = "<i data-lucide='arrow-left'></i> ?´ì „?¨ê³„";
    const totalSteps = currentState.availableSteps.length;
    const currentStepNum = currentState.currentStepIndex + 1;
    const nextStepDisplay = isLastStep ? currentStepNum : currentStepNum + 1;
    const progressText = `(${nextStepDisplay} / ${totalSteps} ?¨ê³„)`;

    container.innerHTML = `
        <div class="next-action-area active" style="margin-top:2rem; display: flex; flex-direction: column; gap: 12px; animation: fadeInUp 0.5s ease-out;">
            <div style="display: grid; grid-template-columns: ${isFirstStep ? '1fr' : '1fr 1fr'}; gap: 10px;">
                ${!isFirstStep ? `
                    <button class="btn btn-secondary" 
                            style="width:100%; border-radius:20px; padding:1.2rem; display:flex; align-items:center; justify-content:center; background:#f1f5f9; border:1.5px solid #e2e8f0; color:#475569; font-weight:800; font-family:'Outfit', sans-serif;" 
                            onclick="prevStep()">
                        ${prevBtnText}
                    </button>
                ` : ''}
                <button class="btn btn-primary" 
                        style="width:100%; border-radius:20px; padding:1.2rem; display:flex; align-items:center; justify-content:center; gap:10px; background: var(--doing-indigo); box-shadow: var(--shadow-md);" 
                        onclick="nextStep(3)">
                    <span>${nextBtnText}</span>
                    <span style="font-size:0.8rem; opacity:0.8;">${progressText}</span>
                </button>
            </div>

            <button class="btn btn-secondary-outline" 
                    style="width:100%; border-radius:20px; padding:1.2rem; display:flex; align-items:center; justify-content:center; background:#ffffff; border:1px solid #e2e8f0; color:#1e293b; font-weight:800; font-family:'Outfit', sans-serif;" 
                    onclick="location.reload()">
                ì²˜ìŒ?¼ë¡œ
            </button>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

function initEventListeners() {
    document.getElementById('task-select')?.addEventListener('change', (e) => {
        currentState.selectedDept = e.target.value;
        if (e.target.value) populateTasks(e.target.value);
    });

    document.getElementById('step1-task-select')?.addEventListener('change', (e) => {
        currentState.selectedTask = e.target.value;
    });

    document.getElementById('worker-input')?.addEventListener('input', (e) => {
        currentState.selectedWorker = e.target.value;
    });

}

async function submitLog() {
    const today = new Date().toLocaleDateString('ko-KR');
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay ? overlay.querySelector('p') : null;
    
    if (loadingText) loadingText.innerText = "?°ì´?°ë? ì²˜ë¦¬ ì¤‘ì…?ˆë‹¤...";
    if (overlay) overlay.classList.add('active');

    const logs = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        if (parts.length < 3) return null;
        
        const r = currentState.risks.find(risk => 
            getHash(risk.?‘ì—…ëª?|| "") === parts[0] &&
            getHash(risk.?‘ì—…?¨ê³„ || "") === parts[1] &&
            getHash(risk.?„í—˜?”ì¸ || "") === parts[2]
        );
        
        if (!r) return null;
        
        const riskData = currentState.riskMatrixData[key] || {
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        const currentMeasuresMaster = Array.isArray(r.?„ì¬?ˆì „ì¡°ì¹˜) ? r.?„ì¬?ˆì „ì¡°ì¹˜ : (r.?„ì¬?ˆì „ì¡°ì¹˜ ? [r.?„ì¬?ˆì „ì¡°ì¹˜] : []);
        const improvementMeasuresMaster = Array.isArray(r.ê°œì„ ?€ì±? ? r.ê°œì„ ?€ì±?: (r.ê°œì„ ?€ì±?? [r.ê°œì„ ?€ì±? : []);
        
        const currentChecked = [...currentMeasuresMaster.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`)), mNotes.current]
            .filter(v => v && v.trim()).join('\n');
            
        const improvedList = [...improvementMeasuresMaster.filter((_, mi) => currentState.improvedMeasures.has(`${key}-m-${mi}`)), mNotes.improvement]
            .filter(v => v && v.trim()).join('\n');
            
        return {
            department: currentState.selectedDept,
            task_name: currentState.selectedTask,
            step_name: r.?‘ì—…?¨ê³„ || currentState.selectedStep,
            hazard: r.?„í—˜?”ì¸,
            current_measures: currentChecked || currentMeasuresMaster.filter(v => v).join('\n'),
            improvements_checked: improvedList || "",
            current_frequency: riskData.current.frequency,
            current_severity: riskData.current.severity,
            current_score: riskData.current.score,
            residual_frequency: riskData.residual.frequency,
            residual_severity: riskData.residual.severity,
            residual_score: riskData.residual.score
        };
    }).filter(Boolean);

    const workerNames = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : currentState.selectedWorker || '';

    const payload = {
        worker: workerNames,
        department: currentState.selectedDept,
        task: currentState.selectedTask,
        step: currentState.selectedStep,
        logs: logs,
        improvement_plan: [], 
        overall_improvement: document.getElementById('overall-improvement')?.value || "",
        photo: currentState.photoBase64 || "",
        signature: typeof signaturePad !== 'undefined' && !signaturePad.isEmpty() ? signaturePad.toDataURL() : ""
    };

    try {
        if (loadingText) loadingText.innerText = "?°ì´?°ë? ?„ì†¡ ì¤‘ì…?ˆë‹¤...";
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }
        });

        showToast("???„ì†¡ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??");
        // ?œì¶œ ?±ê³µ ???´ë‹¹ ?„ì‹œ ?€???°ì´???? œ
        const draftKey = `KOMIPO_DRAFT_${currentState.selectedDept}_${currentState.selectedTask}`;
        localStorage.removeItem(draftKey);

        setTimeout(() => {
            overlay.classList.remove('active');
            location.reload();
        }, 2000);

    } catch (error) {
        console.warn("? ï¸ ?„ì†¡ ?¤íŒ¨:", error);
        queueSubmission(payload);
        overlay.classList.remove('active');
        showToast("?“‚ ?¤í”„?¼ì¸ ?íƒœ?´ê±°???¤ë¥˜ê°€ ë°œìƒ?˜ì—¬ ?´ìš©??ë¡œì»¬???€ê¸°ì—´???€?¥í–ˆ?µë‹ˆ??");
        setTimeout(() => location.reload(), 2500);
    }
}

function queueSubmission(payload) {
    const queue = JSON.parse(localStorage.getItem('kosha_sync_queue') || '[]');
    queue.push({
        id: Date.now(),
        payload: payload,
        retryCount: 0
    });
    localStorage.setItem('kosha_sync_queue', JSON.stringify(queue));
}

async function syncPendingSubmissions() {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem('kosha_sync_queue') || '[]');
    if (queue.length === 0) return;

    for (let i = 0; i < queue.length; i++) {
        try {
            await fetch(GAS_URL, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify(queue[i].payload),
                headers: { 'Content-Type': 'text/plain' }
            });
            queue.splice(i, 1);
            i--;
        } catch (e) {
            console.error("Sync failed for item", queue[i].id);
        }
    }
    localStorage.setItem('kosha_sync_queue', JSON.stringify(queue));
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- ê²°ê³¼ ì¡°íšŒ ?œìŠ¤??(ì¹´ë“œ??UI ?”ì§„) ---

async function openResultsView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        overlay.querySelector('p').innerText = "ìµœì‹  ê¸°ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?..";
        overlay.classList.add('active');
    }
    
    try {
        const response = await fetchJSONP(GAS_URL + "?type=logs");
        const drafts = loadDrafts(); // ë¡œì»¬ ?„ì‹œ?€???°ì´??ë¡œë“œ
        
        let allLogs = [];
        if (Array.isArray(response)) allLogs = [...response];
        
        // ?„ì‹œ?€???°ì´?°ì? ?œë²„ ?°ì´???µí•©
        currentState.allLogs = [...drafts, ...allLogs];
        
        const depts = [...new Set(currentState.allLogs.map(log => log.ë¶€?œëª… || log.?Œì† || "ë¯¸ì???))].filter(d => d).sort();
        const deptSelect = document.getElementById('result-dept-select');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">ë¶€?œë? ? íƒ?˜ì„¸??/option>' + 
                depts.map(d => `<option value="${d}">${d}</option>`).join('');
        }
        switchPhase('step-results');
        resetResultsView();
    } catch (error) {
        showToast("? ï¸ ?°ì´??ë¡œë“œ ?¤íŒ¨. ?¤íŠ¸?Œí¬ ?íƒœë¥??•ì¸?˜ì„¸??");
    } finally {
        if(overlay) overlay.classList.remove('active');
    }
}

function resetResultsView() {
    document.getElementById('result-search-form').style.display = 'block';
    document.getElementById('result-detail-viewer').style.display = 'none';
    document.getElementById('results-empty-state').style.display = 'block';
    const taskSelect = document.getElementById('result-task-select');
    if (taskSelect) taskSelect.innerHTML = '<option value="">?‘ì—…??? íƒ?˜ì„¸??/option>';
    const deptSelect = document.getElementById('result-dept-select');
    if (deptSelect) deptSelect.value = "";
}

function updateResultTasks() {
    const selectedDept = document.getElementById('result-dept-select').value;
    const taskSelect = document.getElementById('result-task-select');
    if (!selectedDept || !taskSelect) return;
    
    const taskOptions = currentState.allLogs
        .filter(log => (log.ë¶€?œëª… || log.?Œì†) === selectedDept)
        .map(log => ({
            name: log.?‘ì—…ëª?|| "?œëª© ?†ìŒ",
            date: log.?¼ì‹œ ? new Date(log.?¼ì‹œ).toLocaleDateString() : "? ì§œë¯¸ìƒ",
            isDraft: log.isDraft || false,
            draftKey: log.draftKey || ""
        }));

    const uniqueTasks = [];
    const seen = new Set();
    taskOptions.forEach(t => {
        const key = t.isDraft ? t.draftKey : `${t.name}-${t.date}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTasks.push(t);
        }
    });
    
    taskSelect.innerHTML = '<option value="">?‘ì—…??? íƒ?˜ì„¸??/option>' + 
        uniqueTasks.map(t => {
            const label = t.isDraft ? `[?‘ì„± ì¤? ${t.name} (${t.date})` : `${t.date} | ${t.name}`;
            const val = t.isDraft ? `DRAFT|${t.draftKey}` : t.name;
            return `<option value="${val}">${label}</option>`;
        }).join('');
}

function showResultDetail() {
    const dept = document.getElementById('result-dept-select').value;
    const selectedVal = document.getElementById('result-task-select').value;
    if (!dept || !selectedVal) {
        showToast("? ï¸ ë¶€?œì? ?‘ì—…??? íƒ?˜ì„¸??");
        return;
    }

    // ?„ì‹œ ?€????ª© ? íƒ ???´ì–´ê°€ê¸??¤í–‰
    if (selectedVal.startsWith('DRAFT|')) {
        const draftKey = selectedVal.split('|')[1];
        resumeDraft(draftKey);
        return;
    }

    const task = selectedVal;

    const filteredLogs = currentState.allLogs.filter(log => (log.ë¶€?œëª… || log.?Œì†) === dept && log.?‘ì—…ëª?=== task);
    if (filteredLogs.length === 0) {
        showToast("???°ì´?°ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.");
        return;
    }

    document.getElementById('result-search-form').style.display = 'none';
    document.getElementById('result-detail-viewer').style.display = 'block';
    document.getElementById('results-empty-state').style.display = 'none';
    
    renderDetailedCardReport(filteredLogs, 'pdf-content-area', false);
}



// [CORE] ?µí•© ê³ ë„???Œë”ë§??”ì§„ (v25.0)
function renderDetailedCardReport(logs, containerId, isPreview = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">?°ì´?°ê? ?†ìŠµ?ˆë‹¤.</div>';
        return;
    }

    const first = logs[0];
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    // ?¨ê³„ë³?Step Name)ë¡?ë¡œê·¸ ê·¸ë£¹??    const groupedLogs = logs.reduce((acc, log) => {
        const step = log.?‘ì—…?¨ê³„ || "?ê? ?¨ê³„";
        if (!acc[step]) acc[step] = [];
        acc[step].push(log);
        return acc;
    }, {});

    const getReportScoreBadge = (score) => {
        let color = '#059669', bg = '#ecfdf5', border = '#a7f3d0';
        if (score >= 13) { color = '#e11d48'; bg = '#fff1f2'; border = '#fda4af'; }
        else if (score >= 9) { color = '#ef4444'; bg = '#fef2f2'; border = '#fecaca'; }
        else if (score >= 4) { color = '#d97706'; bg = '#fffbeb'; border = '#fde68a'; }
        return `<span style="padding:4px 10px; border-radius:10px; font-weight:900; font-size:0.85rem; color:${color}; background:${bg}; border:1.5px solid ${border}; display:inline-block; min-width:30px; text-align:center;">${score}</span>`;
    };

    let html = `
        <div style="text-align: center; margin-bottom: 35px; padding-bottom: 25px; border-bottom: 3px double #e2e8f0; position: relative;">
            <div style="position: absolute; top: 0; right: 0; font-size: 0.6rem; color: #cbd5e1; font-weight: 700;">v25.0</div>
            <div style="font-size: 0.85rem; color: var(--doing-blue); font-weight: 800; margin-bottom: 10px; letter-spacing: 3px; text-transform: uppercase;">
                ${isPreview ? "PRE-SUBMISSION REVIEW" : "KOSHA SMART SAFETY RECORD"}
            </div>
            <h1 style="font-size: 1.8rem; color: #1e293b; margin: 0; font-weight: 900; letter-spacing: -1px;">
                ${isPreview ? "?„í—˜?±í‰ê°€ ê²°ê³¼ ë¯¸ë¦¬ë³´ê¸°" : "?„í—˜?±í‰ê°€ ê²°ê³¼ ì¡°íšŒ ë³´ê³ ??}
            </h1>
            <div style="margin-top: 10px; font-size: 0.85rem; color: #64748b; font-weight: 500;">
                ${isPreview ? "?œì¶œ ???´ìš©??ìµœì¢… ?•ì¸??ì£¼ì„¸??" : "ë³?ë³´ê³ ?œëŠ” ?œìŠ¤?œì„ ?µí•´ ?„ì†¡???¤ì‹œê°??ê? ê¸°ë¡?…ë‹ˆ??"}
            </div>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 20px; border: 1.5px solid #e2e8f0; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">ë¶€?œëª…:</span> <span style="color: #1e293b; font-weight: 800;">${first.ë¶€?œëª… || first.?Œì† || "ë¯¸ì???}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">?‘ì—…ëª?</span> <span style="color: #1e293b; font-weight: 800;">${first.?‘ì—…ëª?|| "?´ìš© ?†ìŒ"}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">?ê???</span> <span style="color: #1e293b; font-weight: 800;">${first.?ê???|| first.?‰ê???|| "ë¯¸ì???}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">${isPreview ? '?‰ê??¼ì' : 'ì¡°íšŒ?¼ì‹œ'}:</span> <span style="color: #1e293b; font-weight: 800;">${isPreview ? today : (first.?¼ì‹œ ? new Date(first.?¼ì‹œ).toLocaleDateString() : today)}</span></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 30px;">
            ${Object.keys(groupedLogs).map((stepName, stepIdx) => `
                <div class="step-group">
                    <div style="background: #1e293b; color: white; padding: 10px 20px; border-radius: 10px; font-weight: 800; font-size: 0.95rem; margin-bottom: 15px; display: inline-flex; align-items: center; gap: 8px;">
                        <span style="background: rgba(255,255,255,0.2); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.7rem;">${stepIdx + 1}</span>
                        ${stepName}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        ${groupedLogs[stepName].map((l, lIdx) => {
                            const curScore = parseInt(l.?„ì¬_?„í—˜??|| l.?„ì¬?„í—˜?? || 0;
                            const resScore = parseInt(l.?”ë¥˜_?„í—˜??|| l.?”ë¥˜?„í—˜?? || 0;

                            return `
                            <div style="background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
                                <div style="background: #f8fafc; padding: 12px 18px; border-bottom: 1.5px solid #f1f5f9; font-weight: 800; color: #475569; font-size: 0.9rem;">
                                    <span style="color: var(--doing-blue);">??ª© ${lIdx + 1}.</span> ${l.?„í—˜?”ì¸ || "?´ìš© ?†ìŒ"}
                                </div>
                                
                                <div style="padding: 15px 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div style="border-right: 1px dashed #e2e8f0; padding-right: 15px;">
                                        <div style="font-weight: 800; color: #64748b; font-size: 0.75rem; margin-bottom: 6px;">?„ì¬ ?ˆì „ì¡°ì¹˜</div>
                                        <div style="font-size: 0.85rem; color: #1e293b; line-height: 1.5; white-space: pre-line;">${l.?„ì¬?ˆì „ì¡°ì¹˜ || "ê¸°ë³¸ ì¡°ì¹˜ ì¤€??}</div>
                                        <div style="margin-top: 10px; text-align: right;">
                                            <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 700; margin-right: 4px;">?„í—˜??</span>
                                            ${getReportScoreBadge(curScore)}
                                        </div>
                                    </div>

                                    <div>
                                        <div style="font-weight: 800; color: #059669; font-size: 0.75rem; margin-bottom: 6px;">ì¶”ê? ê°œì„ ?€ì±?/div>
                                        <div style="font-size: 0.85rem; color: #166534; line-height: 1.5; white-space: pre-line; background: #f0fdf4; padding: 6px; border-radius: 6px;">${l.ê°œì„ ?€ì±?|| "ì¶”ê? ì¡°ì¹˜ ë¶ˆí•„??}</div>
                                        <div style="margin-top: 10px; text-align: right;">
                                            <span style="font-size: 0.7rem; color: #10b981; font-weight: 700; margin-right: 4px;">?”ë¥˜ ?„í—˜??</span>
                                            ${getReportScoreBadge(resScore)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 40px; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 25px; border-radius: 20px;">
            <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 1.1rem; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="message-square" style="width:20px; color:var(--doing-blue);"></i> ì¢…í•© ê°œì„  ì¡°ì¹˜ ?˜ê²¬
            </h4>
            <div style="font-size: 0.95rem; color: #475569; line-height: 1.7; white-space: pre-line; background: white; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9;">
                ${first.ì¢…í•©ê°œì„ ?˜ê²¬ || "?¹ì´?¬í•­ ?†ìŒ"}
            </div>
        </div>

        <div style="margin-top: 50px; text-align: center; border-top: 2px solid #f1f5f9; padding-top: 30px;">
            <div style="font-weight: 900; font-size: 1.5rem; color: #1e293b; letter-spacing: 5px; margin-bottom: 5px;">?œêµ­ì¤‘ë?ë°œì „(ì£?</div>
            <p style="color: #94a3b8; font-size: 0.8rem; font-weight: 700;">KOMIPO SMART SAFETY SYSTEM</p>
        </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

function exportResultToPDF() {
    const element = document.getElementById('pdf-content-area');
    let taskName = "?„í—˜?±í‰ê°€_ë³´ê³ ??;
    
    // ?œíŠ¸ ì¡°íšŒ ?”ë©´??ê²½ìš°
    const selectTask = document.getElementById('result-task-select')?.value;
    if (selectTask) taskName = selectTask;
    // ë¯¸ë¦¬ë³´ê¸° ?ëŠ” ë¡œì»¬ ?ˆìŠ¤? ë¦¬??ê²½ìš°
    else if (currentState.selectedTask) taskName = currentState.selectedTask;

    const opt = {
        margin: 10,
        filename: `${taskName.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    showToast("?“„ PDF ë³´ê³ ?œë? ?ì„± ì¤‘ì…?ˆë‹¤...");
    html2pdf().set(opt).from(element).save().then(() => {
        showToast("??PDF ?¤ìš´ë¡œë“œê°€ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??");
    });
}



