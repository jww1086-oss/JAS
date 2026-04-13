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
// [NEW] ?�시�??�트?�크 ?�태 ?�데?�트 ?�수 (v25.1)
function updateNetworkStatus(isOnline, message = "") {
    const indicator = document.getElementById('network-status');
    if (!indicator) return;

    if (isOnline) {
        indicator.className = 'status-indicator online';
        indicator.querySelector('.status-text').textContent = message || '?�시�?ON';
    } else {
        indicator.className = 'status-indicator offline';
        indicator.querySelector('.status-text').textContent = message || '?�속 �?..';
    }
}

// 1. ?�이??보안 ?�회(CORS) �??�제 ?�틸리티
function cleanValue(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/\[cite: \d+\]/g, '').trim(); 
}

function smartSplit(text) {
    if (!text || typeof text !== 'string') return [text];
    const items = text.split(/(?=[0-9]+\.|[0-9]+\)|[????|\([0-9]+\)|(?:\n|^)[-*?��?)/)
        .map(item => item.replace(/^[0-9]+\.|^[0-9]+\)|^[????|^\([0-9]+\)|^-|^\*|^\??^\??, '').trim())
        .filter(item => item.length > 0);
    return items.length > 0 ? items : [text.trim()];
}

// --- [NEW] ?�시 ?�??�?복원 ?�스??(v25.2) ---
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
                    부?�명: data.selectedDept,
                    ?�업�? data.selectedTask,
                    ?�시: data.lastUpdated,
                    ?��??? (Array.isArray(data.selectedWorkers) ? data.selectedWorkers.join(', ') : data.selectedWorker) || '?�성 �?
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
        // ?�태 복원
        Object.assign(currentState, data);
        currentState.checkedItems = new Set(data.checkedItems);
        currentState.checkedMeasures = new Set(data.checkedMeasures);
        currentState.improvedMeasures = new Set(data.improvedMeasures);
        currentState.expandedHazardKeys = new Set(data.expandedHazardKeys);
        
        showToast("?�� ?�시 ?�?�된 ?�이?��? 불러?�습?�다.");
        
        // ?�재 ?�계??맞춰 ?�동
        if (currentState.currentStep > 0) {
            switchPhase(`step-${currentState.currentStep}`);
        } else {
            switchPhase('step-1');
        }
    } catch (e) {
        console.error("Resume error:", e);
        showToast("???�이?��? 불러?��? 못했?�니??");
    }
}

// --- [NEW] ?�시 ?�??�?복원 ?�스??(v25.2) ---
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
                    부?�명: data.selectedDept,
                    ?�업�? data.selectedTask,
                    ?�시: data.lastUpdated,
                    ?��??? data.selectedWorkers.join(', ') || '?�성 �?
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
        // ?�태 복원
        Object.assign(currentState, data);
        currentState.checkedItems = new Set(data.checkedItems);
        currentState.checkedMeasures = new Set(data.checkedMeasures);
        currentState.improvedMeasures = new Set(data.improvedMeasures);
        currentState.expandedHazardKeys = new Set(data.expandedHazardKeys);
        
        showToast("?�� ?�시 ?�?�된 ?�이?��? 불러?�습?�다.");
        
        // ?�재 ?�계??맞춰 ?�동
        if (currentState.currentStep > 0) {
            switchPhase(`step-${currentState.currentStep}`);
        } else {
            switchPhase('step-1');
        }
    } catch (e) {
        console.error("Resume error:", e);
        showToast("???�이?��? 불러?��? 못했?�니??");
    }
}

function getHash(str) {
    if (typeof str !== "string") return "0";
    const normalized = str.replace(/[^????가-??a-z|A-Z|0-9]/g, ""); 
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}


const MAX_CACHE_AGE_MS = 60 * 60 * 1000; // 1시간 캐시 (밀리초)
async function fetchJSONP(url) {
    // URL 기반으로 캐시키 생성 (로그와 데이터 구분)
    const isLogReq = url.includes('type=logs') || url.includes('type=users');
    const cacheKey = 'komipo_cache_' + url.split('?')[0] + (isLogReq ? '_logs' : '_risk');
    
    // 1. 캐시 확인
    try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
            const cached = JSON.parse(cachedStr);
            // 1시간 이내의 캐시인지 확인
            if (Date.now() - cached.timestamp < MAX_CACHE_AGE_MS) {
                console.log('⚡ 캐시된 데이터 로드 완료:', cacheKey);
                if(typeof updateNetworkStatus === 'function') updateNetworkStatus(true, '캐시 로드됨 (고속화)');
                return cached.data;
            } else {
                console.log('캐시 만료됨:', cacheKey);
            }
        }
    } catch(e) { console.error('Cache read error', e); }

    // 2. 캐시가 없거나 만료된 경우 원본 페치
    const data = await fetchJSONP_original(url);
    
    // 3. 새 데이터를 캐시에 저장
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch(e) { console.error('Cache write error', e); }
    
    return data;
}

function fetchJSONP_original(url) {
    updateNetworkStatus(false, '?�신 �?..');
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        
        const timeout = setTimeout(() => {
            delete window[callbackName];
            document.body.removeChild(script);
            updateNetworkStatus(false, '?�결 지??);
            reject(new Error('?�트?�크 ?�답 ?�간 초과'));
        }, 12000); 

        window[callbackName] = (data) => {
            clearTimeout(timeout);
            delete window[callbackName];
            document.body.removeChild(script);
            updateNetworkStatus(true, '?�시�?ON'); 
            resolve(data);
        };

        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            document.body.removeChild(script);
            updateNetworkStatus(false, '?�결 ?�류');
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

    // [NEW] ?�시�??�라??감시 ?�스??가??    window.addEventListener('online', () => updateNetworkStatus(true, '?�시�?ON'));
    window.addEventListener('offline', () => updateNetworkStatus(false, 'OFFLINE'));

    if (!history.state) {
        history.replaceState({ phase: 'dashboard' }, "", "");
    }
    
    // [NEW] ???�작 ??초기 ?�면(?�?�보???�로 강제 ?�환?�여 ?�이?�웃 ?�리
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
    console.log(`?�� Switching Phase to: ${targetId}`);
    const targetPhase = document.getElementById(targetId);
    if (!targetPhase) {
        console.error(`??Target phase not found: ${targetId}`);
        return;
    }

    // ?�스?�리 기록 (?�로가기용)
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
        saveDraft(); // ?�계 ?�환 ???�동 ?�???�성??        const stepNum = parseInt(targetId.replace('step-', ''));
        if (!isNaN(stepNum)) {
            currentState.currentStep = stepNum;
            updateStepperUI(stepNum);
        } else if (targetId === 'step-improvement') {
            updateStepperUI(3);
            renderImprovementPhase(); // [NEW] 개선 ?�계 진입 ???�적 ?�더�??�출
        }
    }

    // ?�면 ?�이�?관�? ???�나??active�?존재?�도�?강제
    document.querySelectorAll('.phase').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none'; // 명시?�으�??��?
        p.style.opacity = '0';
    });

    targetPhase.style.display = 'block'; // 먼�? 보이�??�정
    targetPhase.classList.add('active');
    
    // 브라?��? 리플로우 강제 ?�도 ???�니메이???�행
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
    // 브라?��? 캐시 무시?�고 루트 경로�?강제 리로??    window.location.assign(window.location.origin + window.location.pathname);
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
    
    // UI 초기??    const container = document.getElementById('selection-container');
    const header = document.getElementById('step1-header');
    const confirmArea = document.getElementById('final-confirm-area');
    const homeBtn = document.getElementById('step1-home-btn');
    
    if (container) {
        container.style.display = 'flex';
        container.classList.add('selection-banner-list');
    }
    if (header) {
        header.querySelector('h2').innerText = "?��????�보 �?부???�택";
        header.querySelector('p').innerText = "?�명???�택?�고 ?�속 부?��? ?�릭?�세??";
    }
    if (confirmArea) confirmArea.style.display = 'none';
    if (homeBtn) homeBtn.style.display = 'flex';

    renderWorkers(); // [NEW] ?��???명단 ?�더�??�출

    switchPhase('step-1');
    renderDeptBanners();
}

function renderDeptBanners() {
    const container = document.getElementById('selection-container');
    if (!container) return;
    
    // ?�이??로딩 중인 경우 처리
    if (!currentState.risks || currentState.risks.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 1rem; text-align: center; color: #64748b; background: white; border-radius: 20px; border: 1px dashed #e2e8f0;">
                <div class="loader-spinner" style="margin-bottom: 12px; font-size: 1.5rem; animation: spin 2s linear infinite;">?��</div>
                <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">?�이?��? ?�기?�하�??�습?�다...</div>
                <div style="font-size: 0.8rem; margin-top: 6px; opacity: 0.7;">3~5�??�도 ?�요?????�습?�다.</div>
            </div>
        `;
        return;
    }
    
    // 부??목록 추출 (가?�다 ???�렬)
    const depts = [...new Set(currentState.risks.map(r => (r.부?�명||'').trim()))]
                    .filter(Boolean)
                    .sort();
    
    container.innerHTML = depts.map(dept => `
        <div class="dept-banner-card" onclick="selectAssessmentDept('${dept}')">
            <div class="dbc-icon"><i data-lucide="building-2"></i></div>
            <div class="dbc-text">
                <div class="title">${dept}</div>
                <div class="desc">?��? ?�??부??/div>
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
        header.querySelector('h2').innerText = "?�업�??�택";
        header.querySelector('p').innerText = "?�행 중인 ?�업???�택?�세??";
    }
    renderTaskBanners(dept);
}

function renderTaskBanners(dept) {
    const container = document.getElementById('selection-container');
    if (!container) return;
    
    // ?�당 부?�의 ?�업 목록 추출
    const tasks = [...new Set(currentState.risks.filter(r => r.부?�명 === dept).map(r => r.?�업�?)];
    
    container.innerHTML = tasks.map(task => `
        <div class="task-banner-card" onclick="selectAssessmentTask('${task}')">
            <div class="tbc-icon"><i data-lucide="activity"></i></div>
            <div class="tbc-text">
                <div class="title">${task}</div>
                <div class="desc">?�재 ?�업�?/div>
            </div>
            <i data-lucide="chevron-right" class="tbc-arrow"></i>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

function selectAssessmentTask(task) {
    currentState.selectedTask = task;
    console.log(`Selected Task: ${task}`);
    
    // 중간 ?�인 ?�계 ?�이 즉시 ?��??�로 ?�동 (초간???�크?�로??
    // ?�더�?지??방�?�??�해 즉시 ?�면 ?�환 ?�도
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
        // 최근 20건만 ?��?
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
        // ?�스?��? ?�한 ?�플 ?�이??주입 (?�용???�인??
        const sampleData = [
            { id: 101, department: "발전?�영??, task: "?�소 ?�비 ?��?", worker: "?�길??, timestamp: "2024-04-03 10:00:00", logs: [] },
            { id: 102, department: "주간?�기?�", task: "변?�기 ?��?", worker: "김철수", timestamp: "2024-04-03 14:30:00", logs: [] },
            { id: 103, department: "기계?�비?�", task: "?�프 교체 ?�업", worker: "?�영??, timestamp: "2024-04-02 09:15:00", logs: [] }
        ];
        localStorage.setItem('kosha_history', JSON.stringify(sampleData));
        location.reload(); // ?�이??반영???�해 리로??        return;
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
    title.innerText = "부?�별 ?��???조회";
    subtitle.innerText = "조회??부?��? ?�택?�세??";
    
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
    subtitle.innerText = "조회???�업명을 ?�택?�세??";
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
                            <div style="font-size:0.75rem; color:#64748b;">최근 ?��? ?�력 보기</div>
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
    // [UNIFIED] ?�합 ?�더�??�진???�용?�도�?변�?    setTimeout(() => {
        const logs = (data.logs || []).map(l => ({
            부?�명: data.department,
            ?�업�? data.task,
            ?��??? data.worker,
            ?�시: data.timestamp,
            ?�업?�계: l.step || "?��?",
            ?�험?�인: l.hazard,
            ?�재?�전조치: l.current_checked,
            개선?��? l.improvements_checked,
            ?�재_?�험?? l.current_score,
            ?�류_?�험?? l.residual_score,
            종합개선?�견: data.overall_improvement
        }));
        renderDetailedCardReport(logs, 'report-view-content', false);
    }, 10);
    return `<div id="report-view-content" style="min-height:300px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">보고?��? 구성 중입?�다...</div>`;
}

// [NEW] ?�재 ?��? 중인 ?�이?��? 보고???�식?�로 변?�하???�수 (v25.0)
function preparePreviewData() {
    const logs = [];
    const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker || "미�???;
    
    // 1. ?��? ?�험?�인 처리
    currentState.risks.forEach(risk => {
        const hash = getHash(risk.?�험?�인);
        const stepName = risk.?�업?�계;
        const key = `${stepName}-${hash}`;
        
        if (currentState.checkedItems.has(key) || currentState.riskMatrixData[key]) {
            const riskData = currentState.riskMatrixData[key] || { current: { score: 1 }, residual: { score: 1 } };
            
            const currentMeasures = [];
            (risk.개선?��?|| []).forEach((m, idx) => {
                if (currentState.checkedMeasures.has(`${key}-m-${idx}`)) {
                    currentMeasures.push(`[?�행] ${m}`);
                }
            });
            const manualCurrent = (currentState.manualHazardItems[key]?.current || []).filter((_, idx) => currentState.checkedMeasures.has(`${key}-mc-${idx}`));
            currentMeasures.push(...manualCurrent);
            if (currentState.manualNotes[key]?.current) currentMeasures.push(`(추�??�견) ${currentState.manualNotes[key].current}`);

            const improveMeasures = [];
            (risk.개선?��?|| []).forEach((m, idx) => {
                if (currentState.improvedMeasures.has(`${key}-mi-${idx}`)) {
                    improveMeasures.push(`[개선] ${m}`);
                }
            });
            const manualImprove = (currentState.manualHazardItems[key]?.improve || []).filter((_, idx) => currentState.improvedMeasures.has(`${key}-mi-${idx}`));
            improveMeasures.push(...manualImprove);
            if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`(추�??�견) ${currentState.manualNotes[key].improvement}`);

            logs.push({
                부?�명: currentState.selectedDept,
                ?�업�? currentState.selectedTask,
                ?��??? workerName,
                ?�업?�계: stepName,
                ?�험?�인: risk.?�험?�인,
                ?�재?�전조치: currentMeasures.join('\n') || "?�상 ?�음 (?�호)",
                개선?��? improveMeasures.join('\n') || "추�? 개선?�항 ?�음",
                ?�재_?�험?? riskData.current.score,
                ?�류_?�험?? riskData.residual.score,
                종합개선?�견: document.getElementById('overall-improvement')?.value || ""
            });
        }
    });

    // 2. ?�동 추�? ?�험?�인 처리
    currentState.manualHazards.forEach(hazard => {
        const key = hazard.id;
        const stepName = hazard.stepName;
        const riskData = currentState.riskMatrixData[key] || { current: { score: 1 }, residual: { score: 1 } };
        
        const currentMeasures = (currentState.manualHazardItems[key]?.current || []).filter((_, idx) => currentState.checkedMeasures.has(`${key}-mc-${idx}`));
        if (currentState.manualNotes[key]?.current) currentMeasures.push(`(추�??�견) ${currentState.manualNotes[key].current}`);
        
        const improveMeasures = (currentState.manualHazardItems[key]?.improve || []).filter((_, idx) => currentState.improvedMeasures.has(`${key}-mi-${idx}`));
        if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`(추�??�견) ${currentState.manualNotes[key].improvement}`);

        logs.push({
            부?�명: currentState.selectedDept,
            ?�업�? currentState.selectedTask,
            ?��??? workerName,
            ?�업?�계: stepName,
            ?�험?�인: hazard.hazardName,
            ?�재?�전조치: currentMeasures.join('\n') || "?�상 ?�음 (?�호)",
            개선?��? improveMeasures.join('\n') || "추�? 개선?�항 ?�음",
            ?�재_?�험?? riskData.current.score,
            ?�류_?�험?? riskData.residual.score,
            종합개선?�견: document.getElementById('overall-improvement')?.value || ""
        });
    });

    return logs;
}

function nextStep(step) {
    if (step === 2) {
        // ?�당 부?��? ?�업??맞는 모든 ?��? ?�계 추출 (공백 ?�거?�여 ?�확???�임)
        currentState.availableSteps = [...new Set(currentState.risks
            .filter(r => (r.부?�명||'').trim() === (currentState.selectedDept||'').trim() && 
                         (r.?�업�?|'').trim() === (currentState.selectedTask||'').trim())
            .map(r => (r.?�업?�계||'').trim()))].filter(Boolean);
        
        if (currentState.availableSteps.length === 0) {
            // 백업: 부?�명 매칭 ?�패 ???�업명만?�로 검???�도
            currentState.availableSteps = [...new Set(currentState.risks
                .filter(r => (r.?�업�?|'').trim() === (currentState.selectedTask||'').trim())
                .map(r => r.?�업?�계))].filter(Boolean);
        }

        if (currentState.availableSteps.length === 0) {
            showToast("?�️ ?�당 ?�업???�의???�계가 ?�습?�다.");
            return;
        }
        
        currentState.currentStepIndex = 0;
        currentState.selectedStep = currentState.availableSteps[0];
        
        // 1. ?�면 ?�환??먼�? ?�행?�여 즉각 ?��? ?�상 ?�결
        switchPhase('step-2');
        
        // 2. �??�음 ?�이???�더�?(?�간??지?�을 주어 UI ?�리�?방�?)
        setTimeout(() => {
            renderRiskChecklist(currentState.selectedStep);
            
            // 3. ?��????�명 ?�롭?�운 ?�정
            const input = document.getElementById('worker-input');
            const dropdown = document.getElementById('worker-dropdown');
            if (input && dropdown) {
                setupCustomDropdown(input, dropdown, 
                    () => currentState.users.map(u => ({ value: u.?�름, sub: `${u.?�속} ${u.직책}` })), 
                    (val) => { currentState.selectedWorker = val; }
                );
            }
        }, 50);
        
        return;
    }
    
    if (step === 3) {
        // [추�?] ?��????�명 ?�효??검??(Step 2?�서 3?�로 가�????�수 체크)
        const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker;
        if (!workerName || workerName.trim() === "") {
            showToast("?�️ ?��????�명??먼�? ?�력??주세?? (?�면 최상??");
            const input = document.getElementById('worker-input');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.style.boxShadow = "0 0 0 4px rgba(244, 63, 94, 0.2)"; // ?�시??강조
                setTimeout(() => input.style.boxShadow = "", 2000);
            }
            return;
        }

        // ?�음 ?�계가 ???�는지 ?�인
        if (currentState.currentStepIndex < currentState.availableSteps.length - 1) {
            currentState.currentStepIndex++;
            currentState.selectedStep = currentState.availableSteps[currentState.currentStepIndex];
            renderRiskChecklist(currentState.selectedStep);
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else {
            // 모든 ?�계 종료 -> 개선 ?�계�??�동 ?�환
            switchPhase('step-improvement');
            if (window.lucide) window.lucide.createIcons();
            
            // Phase 2???�비게이??버튼??비�? (중복 방�?)
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
        // �?번째 ?�계?�서 ?�전 기능?� 처음?�로(?�?�보?? ?�동
        location.reload();
    }
}

function prevStep(step) {
    if (step === 0) {
        goHome();
    } else {
        history.back(); // ?�스?�리 ?�로가�??�행 (popstate?�서 ?�면 ?�환 처리??
    }
}

function loadMockData() {
    // ?�트 로드 ?�패(CORS ?? ?�에??기본?�으�?발전?�영?�이 ?��??�도�?조치
    currentState.users = [
        { ?�름: "?�길??, ?�속: "발전?�영??, 직책: "과장", 경력: "10?? }
    ];
    
    currentState.risks = [
        { 
            부?�명: "발전?�영??, 
            ?�업�? "?�소, 질소, ?�산 가?�설�??��?", 
            ?�업?�계: "?�업준�?, 
            ?�험?�인: "?�이??로딩 ?��?�?..", 
            개선?��? ["?�터???�결 �?구�? ?�트 권한???�인?�세??"] 
        }
    ];
    currentState.incidents = {};
}

async function fetchInitialData() {
    console.log("??구�? ?�트 ?�이???�시�??�기???�도 �?..");
    
    // 1. ?�험??마스???�이??가?�오�?(?�립??처리)
    try {
        const riskData = await fetchJSONP(GAS_URL);
        if (Array.isArray(riskData) && riskData.length > 0) {
            const allRisks = [];
            riskData.forEach(item => {
                const cleanedHazard = cleanValue(item.?�험?�인 || "?�용 ?�음");
                const cleanedMeasures = cleanValue(item.?�재?�전조치_?�행?�역 || item.?�재?�전조치 || "");
                
                // ?�험?�인�?개선?�책을 각각 번호?�으�?분리
                const hazards = smartSplit(cleanedHazard);
                const measures = smartSplit(cleanedMeasures);
                
                // ?�험?�인별로 개별 ?��? ??�� ?�성
                hazards.forEach(h => {
                    allRisks.push({
                        부?�명: cleanValue(item.부?�명 || item.?�속 || "미�???),
                        ?�업�? cleanValue(item.?�업�?|| "미정???�업"),
                        ?�업?�계: cleanValue(item.?�업?�계 || "미정???�계"),
                        ?�험?�인: h,
                        개선?��? measures
                    });
                });
            });
            currentState.risks = allRisks;
            
            // [?�프?�인 지?? 로컬 ?�토리�???백업 ?�??            localStorage.setItem('kosha_cached_risks', JSON.stringify(allRisks));
            
            // ?�재 ?�면??Step 1(부???�택)??경우 UI ?�데?�트
            const container = document.getElementById('selection-container');
            if (container && container.offsetParent !== null) {
                renderDeptBanners();
            }
            
            console.log("???�시�??�험??마스??로드 �??�동 분할 ?�료:", currentState.risks.length, "�?);
        }
    } catch (error) {
        console.warn("?�️ ?�험???�이??로드 ?�패, 캐시???�이?��? ?�인?�니??", error);
        const cached = localStorage.getItem('kosha_cached_risks');
        if (cached) {
            currentState.risks = JSON.parse(cached);
            console.log("?�� 로컬 캐시 ?�이??로드 ?�료:", currentState.risks.length, "�?);
            renderDeptBanners();
            showToast("?�� ?�프?�인 모드: 기존 ?��? ?�이?��? ?�용?�니??");
        } else if (currentState.risks.length === 0) {
            loadMockData();
            renderDeptBanners();
        }
    }

    // 2. ?�용?�명???�이??가?�오�?(?�립??처리)
    try {
        const userData = await fetchJSONP(GAS_URL + "?type=users");
        if (Array.isArray(userData) && userData.length > 0) {
            currentState.users = userData.map(u => ({
                ?�름: cleanValue(u.?�름 || u.?�명 || ""),
                ?�속: cleanValue(u.?�속 || u.부?�명 || ""),
                직책: cleanValue(u.직책 || ""),
                경력: cleanValue(u.경력 || "")
            }));
            localStorage.setItem('kosha_cached_users', JSON.stringify(currentState.users));
            renderWorkers();
            console.log("???�시�?근로??명단 로드 ?�공:", currentState.users.length, "�?);
        }
    } catch (error) {
        const cachedUsers = localStorage.getItem('kosha_cached_users');
        if (cachedUsers) {
            currentState.users = JSON.parse(cachedUsers);
            renderWorkers();
        }
        console.warn("?�️ 근로??명단 로드 ?�패 (캐시 ?�용 ?�도)");
    }
    
    if (currentState.risks.length > 0 && navigator.onLine) {
        showToast("?�� 구�? ?�트?� ?�시�??�결?�었?�니??");
    }
}

function renderDepartmentList() {
    const departments = [...new Set(currentState.risks.map(r => r.부?�명))]
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

    // [추�?] '+ 추�?' 버튼 ?�릭 �??�터 ???�벤??바인??    if (addBtn && input) {
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
            value: u.?�름, 
            sub: `${u.?�속} | ${u.직책}` 
        })),
        (val) => { 
            addSelectedWorker(val); 
            if (input) input.value = ''; // ?�택 ??초기??        }
    );

    updateSelectedWorkersUI(); // 기존 ?�택 ?�역 복원
}

// [NEW] ?��???추�? 로직
function addSelectedWorker(name) {
    if (!name || currentState.selectedWorkers.includes(name)) return;
    currentState.selectedWorkers.push(name);
    updateSelectedWorkersUI();
}

// [NEW] ?��?????�� 로직
function removeSelectedWorker(name) {
    currentState.selectedWorkers = currentState.selectedWorkers.filter(n => n !== name);
    updateSelectedWorkersUI();
}

// [NEW] ?�택???��???�?Chip) UI ?�더�?function updateSelectedWorkersUI() {
    const container = document.getElementById('selected-workers-chips');
    if (!container) return;

    if (currentState.selectedWorkers.length === 0) {
        container.innerHTML = `<span style="font-size:0.8rem; color:#94a3b8; font-style:italic;">?�택???��??��? ?�습?�다.</span>`;
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
    const taskArea = document.getElementById('step1-task-area'); // 1?�계???�로???�업?�역
    if (taskArea) taskArea.style.display = 'block';
    
    const deptTasks = [...new Set(currentState.risks.filter(r => r.부?�명 === dept).map(r => r.?�업�?)];
    
    setupCustomDropdown(
        'step1-task-select', 
        'step1-task-dropdown', 
        () => deptTasks.map(t => ({ value: t })),
        (val) => {
            currentState.selectedTask = val;
            // populateWorkSteps(val); // 1?�계?�서???�택�???        }
    );
}

function populateWorkSteps(taskName) {
    const stepArea = document.getElementById('step-selection-area');
    if (stepArea) stepArea.style.display = 'block';

    const steps = [...new Set(currentState.risks
        .filter(r => r.?�업�?=== taskName && r.부?�명 === currentState.selectedDept)
        .map(r => r.?�업?�계))];

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
            : '<div class="dropdown-item" style="cursor:default; color:#94a3b8;">검??결과가 ?�습?�다.</div>';
        
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
    else currentState.selectedStep = stepName; // ?�재 ?�더�?중인 ?�계�??�역 ?�태�??�정

    const container = document.getElementById('risk-checklist');
    if (!container) return;

    // ?�계 진행 ?�태 ?�시 �?    const progressTotal = currentState.availableSteps.length || 1;
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
    
    // ?�터�???부?�명 + ?�업�?+ ?�계�?조건??모두 ?�인?�여 ?�확???�이??로드
    let taskRisks = currentState.risks.filter(r => 
        (r.부?�명||"").trim() === (currentState.selectedDept||"").trim() &&
        (r.?�업�?|"").trim() === (currentState.selectedTask||"").trim() && 
        (r.?�업?�계||"").trim() === (stepName||"").trim()
    );

    // [개선] 중복 ?�험?�인 ?�거 (?�이??중복 방�?)
    const seenHazards = new Set();
    taskRisks = taskRisks.filter(r => {
        if (seenHazards.has(r.?�험?�인)) return false;
        seenHazards.add(r.?�험?�인);
        return true;
    });

    console.log(`?�� Rendering risks for [${currentState.selectedTask}] - [${stepName}]. Unique items: ${taskRisks.length}`);
    
    if (taskRisks.length === 0) {
        checklistHTML += `
            <div style="text-align:center; padding:3rem; background:#f8fafc; border-radius:20px; border:1px dashed #cbd5e1; color:#94a3b8;">
                <p>?�당 ?�계???�의???�험 ?�인???�습?�다.</p>
                <p style="font-size:0.75rem; margin-top:8px;">?�이??마스???�트?� 부???�업명이 ?�치?�는지 ?�인?�십?�오.</p>
            </div>
        `;
    }

    checklistHTML += taskRisks.map((r, i) => {
        const hazardHash = getHash(r.?�험?�인);
        const taskHash = getHash(currentState.selectedTask || "");
        const stepHash = getHash(stepName || currentState.selectedStep || "");
        const key = `${taskHash}-${stepHash}-${hazardHash}`;
        
        const isChecked = currentState.checkedItems.has(key);
        const notes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        const riskData = currentState.riskMatrixData[key] || { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const measures = Array.isArray(r.개선?��? ? r.개선?��?: [r.개선?��?;
        const isExpanded = currentState.expandedHazardKeys.has(key);
        
        return `
            <div class="check-item ${isChecked ? 'checked' : ''} ${isExpanded ? 'expanded' : ''}" id="risk-card-${i}" 
                 style="width: 100% !important; min-width: 100% !important; padding: 1.1rem !important;">
                
                <div class="check-item-header" onclick="toggleAccordion(${i}, '${key}')" style="cursor: pointer;">
                    <div class="check-indicator" onclick="event.stopPropagation(); toggleRiskByHash('${key}', '${stepName}')">
                        <i data-lucide="check"></i>
                    </div>
                    <span class="risk" style="flex: 1; font-weight: 900; color: #1e293b;">${r.?�험?�인}</span>
                    <i data-lucide="chevron-down" class="expand-icon" style="transition: 0.3s; ${isExpanded ? 'transform: rotate(180deg);' : ''}"></i>
                </div>

                <div class="measure-container" id="measure-panel-${i}" style="margin-top: 0; display: ${isExpanded ? 'block' : 'none'};">
                    <!-- Section 1: ?�재?�전조치 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:800; color:var(--doing-blue); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="shield-check" style="width:14px;"></i> [?�재?�전조치]
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
                                <i data-lucide="edit-3" style="width:14px;"></i> ?�재 추�? ?�전조치 (?�기 ?�력)
                            </label>
                            <textarea class="manual-textarea" placeholder="기존 ?��???추�????�장 조치 ?�용???�력?�세??.." 
                                style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; width: 100%; min-height: 80px; font-family: inherit;"
                                oninput="updateManualNote('${key}', 'current', this.value)">${notes.current || ""}</textarea>
                        </div>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(248, 250, 252, 0.8); padding: 0.85rem 1rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                                  <span style="font-weight: 800; color: #334155; font-size: 0.85rem; font-family: 'Outfit', sans-serif;">?�재 ?�험???��?</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'severity', this.value)" 
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8; font-size: 0.8rem;">×</span>
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

                    <!-- Section 2: 개선?��?�??�류 ?�험??-->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
                            <i data-lucide="wrench" style="width:16px;"></i> [개선?��?
                        </p>
                    
                        <ul class="measure-list improvement" style="margin-bottom: 1rem;">
                            ${measures.map((m, mi) => {
                                const mKey = `${key}-m-${mi}`;
                                const isMChecked = currentState.checkedMeasures.has(mKey);
                                const isMImproved = currentState.improvedMeasures.has(mKey);
                                
                                // [개선] ?�재 ?�천 �?Checked)????��?� 개선?��?목록?�서 ?�외
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
                                `<li style="text-align:center; padding:15px; color:#94a3b8; font-size:0.85rem; background:#f8fafc; border-radius:12px; border:1px dashed #e2e8f0;">??모든 ?��? ?�전조치가 ?�천 중입?�다.</li>` : ''}
                        </ul>

                        <div class="manual-input-area" style="margin-bottom: 1rem;">
                            <label style="display: block; font-size: 0.8rem; font-weight: 900; color: var(--doing-accent); margin-bottom: 10px; font-family: 'Outfit', sans-serif;">
                                <i data-lucide="wrench" style="width:16px;"></i> 추�? 개선?��??�력 (?�기)
                            </label>
                            <textarea class="manual-textarea" placeholder="?�험??줄이�??�한 추�? 개선 ?�견???�력?�세??.." 
                                style="background: rgba(254, 242, 242, 0.5); border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 90px; font-family: inherit; font-size: 0.95rem;"
                                oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement || ""}</textarea>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(254, 242, 242, 0.5); padding: 0.85rem 1rem; border-radius: 16px; border: 1.5px solid rgba(244, 63, 94, 0.1);">
                            <span style="font-weight: 800; color: var(--doing-accent); font-size: 0.85rem; font-family: 'Outfit', sans-serif;">개선 ???�류?�험</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'severity', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4); font-size: 0.8rem;">×</span>
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

    // --- [NEW] ?�동 추�????�험?�인 ?�더�?---
    const manualRisks = (currentState.manualHazards || []).filter(mr => mr.stepName === stepName);
    const manualHTML = manualRisks.map((mr, mi) => {
        const key = mr.id; // ?��? 고유??ID(hash)�?가지�??�음
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
                    <!-- Section 1: ?�재?�전조치 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-indigo); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif;">
                            <i data-lucide="shield-check" style="width:16px;"></i> [?�재?�전조치]
                        </p>
                        
                        <!-- [NEW] ?�동 조치 리스??-->
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

                        <!-- [NEW] 조치 추�? ?�력�?-->
                        <div style="display:flex; gap:8px; margin-bottom:1rem;">
                            <input type="text" id="manual-input-${key}-current" placeholder="?�재 ?�행 중인 조치 추�?..." 
                                   style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:0.9rem;"
                                   onkeypress="if(event.key==='Enter') addManualMeasure('${key}', 'current', '${stepName}')">
                            <button onclick="addManualMeasure('${key}', 'current', '${stepName}')" 
                                    style="background:var(--doing-indigo); color:white; border:none; border-radius:10px; width:40px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>

                        <textarea class="manual-textarea" placeholder="추�??�인 ?�재 ?�전조치 ?�인 ?�용???�력?�세??.." 
                                  style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 80px; font-family: inherit;"
                                  oninput="updateManualNote('${key}', 'current', this.value)">${notes.current}</textarea>
                        
                        <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; background: rgba(248, 250, 252, 0.8); padding: 1rem; border-radius: 18px; border: 1px solid #e2e8f0;">
                            <span style="font-weight: 800; color: #334155; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">?�재 ?�험???��?</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'severity', this.value)" 
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8;">×</span>
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

                    <!-- Section 2: 개선?��?-->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif;">
                            <i data-lucide="wrench" style="width:16px;"></i> [개선?��?
                        </p>

                        <!-- [NEW] ?�동 개선?��?리스??(?�재 조치 체크?��? ?��? ??���??�시) -->
                        <ul class="measure-list improvement" style="margin-bottom: 1rem;">
                            ${(currentState.manualHazardItems[key]?.improve || []).map((m, mIdx) => {
                                const mcKey = `${key}-mc-${mIdx}`; // ?�재조치?� ?�일 ?�덱???�용
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

                        <!-- [NEW] 개선?��?추�? ?�력�?-->
                        <div style="display:flex; gap:8px; margin-bottom:1rem;">
                            <input type="text" id="manual-input-${key}-improve" placeholder="?�요??개선 ?��?추�?..." 
                                   style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:0.9rem;"
                                   onkeypress="if(event.key==='Enter') { event.preventDefault(); addManualMeasure('${key}', 'improve', '${stepName.replace(/'/g, "\\'")}'); }">
                            <button onclick="addManualMeasure('${key}', 'improve', '${stepName.replace(/'/g, "\\'")}')" 
                                    style="background:var(--doing-accent); color:white; border:none; border-radius:10px; width:40px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>

                        <textarea class="manual-textarea" placeholder="추�? 개선?�견 ?�는 ?�인 ?�항???�력?�세??.." 
                                  style="background: rgba(254, 242, 242, 0.5); border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 80px; font-family: inherit;"
                                  oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement}</textarea>

                        <div style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: space-between; background: rgba(254, 242, 242, 0.5); padding: 1.25rem; border-radius: 20px; border: 1.5px solid rgba(244, 63, 94, 0.1);">
                            <span style="font-weight: 800; color: var(--doing-accent); font-size: 0.9rem; font-family: 'Outfit', sans-serif;">개선 ???�류?�험</span>
                            <div class="matrix-row-unified" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'severity', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4);">×</span>
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

    // --- [NEW] ?�험?�인 추�? 버튼 ?�션 ---
    checklistHTML += `
        <div style="margin-top: 2rem; display: flex; justify-content: center; padding-bottom: 2rem; position: relative; z-index: 10;">
            <button onclick="requestAddManualHazard('${stepName.replace(/'/g, "\\'")}')" 
                    style="background: white; color: var(--doing-gold); border: 2px dashed var(--doing-gold); padding: 1.25rem 2rem; border-radius: 20px; font-weight: 900; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; transition: 0.3s; cursor: pointer !important; box-shadow: var(--shadow-sm); pointer-events: auto !important;">
                <i data-lucide="plus-circle"></i>
                ?�로???�험?�인 발견 �?추�??�기
            </button>
        </div>
    `;

    checklistHTML += `</div>`; // .checklist-items-area ?�기

    container.innerHTML = checklistHTML;
    initLucide();
    updateNextButton(taskRisks.length);
    checkIncidents(taskRisks);
}

// [NEW] 개선 ?�계(Phase 3)???�적 리스???�더�??�수
function renderImprovementPhase() {
    const container = document.querySelector('#step-improvement .improvement-content-area');
    if (!container) return;

    // 0. ?��??�역 초기??�??�단 ?�비게이??비�? (중복 방�?)
    const nextContainerFocus = document.getElementById('next-action-container');
    if (nextContainerFocus) nextContainerFocus.innerHTML = '';
    const improvedKeys = Array.from(currentState.improvedMeasures);
    
    if (improvedKeys.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 1.5rem; text-align: center; color: #64748b; background: white; border-radius: 24px; border: 1px dashed #e2e8f0;">
                <i data-lucide="info" style="width:48px; height:48px; margin-bottom:1rem; opacity:0.3;"></i>
                <div style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">?�택??개선 조치가 ?�습?�다.</div>
                <div style="font-size: 0.9rem; margin-top: 8px;">모든 조치가 ?�행 중이거나 ?�호?�니?? 바로 ?�명 ?�계�??�동?�세??</div>
                <button class="btn btn-primary" onclick="nextStep(4)" style="margin-top:2rem; width:100%;">?�명 �??�출 ?�계�??�동 <i data-lucide="chevron-right"></i></button>
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; justify-content: center;">
                <button class="btn" onclick="switchPhase('step-2', true)" 
                        style="background: #f1f5f9; color: #475569; width: 100%; height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i data-lucide="arrow-left"></i> ?�전 ?�계�?(?��? ?�시?�기)
                </button>
            </div>
        `;
        initLucide();
        return;
    }

    let itemsHTML = improvedKeys.map((mKey, idx) => {
        let hazardName = "미정???�험?�인";
        let measureName = "미정???��?;

        // ??분석 �??�보 추출
        if (mKey.includes('-mi-')) { // ?�동 ??��
            const parts = mKey.split('-mi-');
            const hId = parts[0];
            const mIdx = parseInt(parts[1]);
            const hazard = (currentState.manualHazards || []).find(h => h.id === hId);
            if (hazard) {
                hazardName = hazard.hazardName;
                measureName = (currentState.manualHazardItems[hId]?.improve || [])[mIdx] || "?�동 개선??��";
            }
        } else { // ?��? ??��
            const parts = mKey.split('-m-');
            if (parts.length >= 2) {
                const hazardHash = parts[0];
                const mIdx = parseInt(parts[1]);
                const risk = currentState.risks.find(r => getHash(r.?�험?�인) === hazardHash.split('-').pop());
                if (risk) {
                    hazardName = risk.?�험?�인;
                    measureName = (Array.isArray(risk.개선?��? ? risk.개선?��?mIdx] : risk.개선?��? || "?��? 개선?��?;
                }
            }
        }

        const result = currentState.improvementResults[mKey] || { photo: null, note: "" };

        return `
            <div class="improvement-card" style="background: white; border-radius: 18px; padding: 1.15rem; border: 1px solid #f1f5f9; border-top: 5px solid var(--doing-accent); margin-bottom: 0.85rem; box-shadow: var(--shadow-sm);">
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.5rem;">
                    <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">IMPROVEMENT ITEM #${idx + 1}</span>
                    <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">[?�고?�형] ${hazardName}</span>
                    <span style="font-size: 1.1rem; color: #1e293b; font-weight: 900; line-height: 1.4;">${measureName}</span>
                </div>

                <div class="media-card" style="margin-bottom: 1rem; border: none; padding: 0;">
                    <div class="photo-upload-box" onclick="document.getElementById('photo-input-${mKey}').click()" 
                         id="preview-box-${mKey}" 
                         style="background: #fffcfc; border: 2px dashed rgba(244, 63, 94, 0.2); height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 16px; cursor: pointer; transition: 0.3s; overflow: hidden;">
                        ${result.photo 
                            ? `<img src="${result.photo}" style="width: 100%; height: 100%; object-fit: cover;">` 
                            : `<i data-lucide="camera" style="width:32px; height:32px; margin-bottom:8px; color:var(--doing-accent); opacity:0.4;"></i>
                               <span style="font-size: 0.9rem; font-weight: 800; color: var(--doing-accent); opacity: 0.6;">개선 ?????�진 촬영</span>`
                        }
                    </div>
                    <input type="file" id="photo-input-${mKey}" accept="image/*" capture="environment" style="display:none;" 
                           onchange="handleImprovementPhoto('${mKey}', this)">
                </div>

                <div class="manual-input-area" style="padding: 0; border: none;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 900; color: #475569; margin-bottom: 8px;">
                        <i data-lucide="edit-3" style="width:14px;"></i> 조치 결과 ?�력
                    </label>
                    <textarea class="manual-textarea" placeholder="조치 ?�용 ?�는 ?�인 ?�항???�력?�세??.." 
                              style="background: #fffcfc; border: 1.5px solid rgba(244, 63, 94, 0.1); border-radius: 12px; padding: 1rem; width: 100%; min-height: 80px; font-size:0.9rem;"
                              oninput="updateImprovementNote('${mKey}', this.value)">${result.note}</textarea>
                </div>
            </div>
        `;
    }).join('');

    // ?�단 공통 ?�력�?�??�비게이??    itemsHTML += `
        <div class="manual-input-area" style="background:white; border-radius:20px; padding:1.25rem; border:1px solid #f1f5f9; margin-bottom: 1.5rem;">
            <label class="ui-label" style="display:flex; align-items:center; gap:6px; font-weight: 900; font-size: 0.9rem;">
                <i data-lucide="message-square" style="width:16px;"></i> 종합 개선 조치 ?�견
            </label>
            <textarea id="overall-improvement" class="manual-textarea" style="min-height:100px; margin-top:10px; font-size: 0.9rem;" 
                      placeholder="?�장 ?�체???�??종합?�인 개선 ?�견???�력?�세??.." 
                      oninput="currentState.overallImprovement = this.value">${currentState.overallImprovement || ""}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 2rem;">
            <button class="btn" onclick="switchPhase('step-2', true)" 
                    style="background: #f1f5f9; color: #475569; height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <i data-lucide="arrow-left"></i> ?�전?�로
            </button>
            <button class="btn btn-primary" onclick="nextStep(4)" 
                    style="background: var(--doing-accent); height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                ?�음 (?�명) <i data-lucide="chevron-right"></i>
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
            // ?��?지 리사?�징 (?�능 �??�량 최적??
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
            
            // 미리보기 ?�데?�트
            const previewBox = document.getElementById(`preview-box-${mKey}`);
            if (previewBox) {
                previewBox.innerHTML = `<img src="${optimizedBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            showToast("?�� ?�진??첨�??�었?�니??");
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
        .map(r => (currentState.incidents && r.?�험?�인) ? currentState.incidents[r.?�험?�인] : null)
        .filter(incident => incident);

    if (matchingIncidents.length > 0) {
        incidentContent.innerHTML = matchingIncidents.map(inc => `<p>${inc}</p>`).join('');
        incidentContainer.style.display = 'block';
    } else {
        incidentContainer.style.display = 'none';
    }
}

function requestAddManualHazard(stepName) {
    const hazardName = prompt("발견???�로???�험?�인명을 ?�력?�세??");
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
    
    // 조치 ??�� ?�?�소 초기??    currentState.manualHazardItems[id] = { current: [], improve: [] };
    
    // 즉시 ?�쳐�??�태�??�시
    currentState.expandedHazardKeys.add(id);
    currentState.checkedItems.add(id); // ?�동 추�???기본?�으�?체크??것으�?간주

    renderRiskChecklist(stepName);
    showToast("???�로???�험?�인??목록 ?�단??추�??�었?�니??");
}

function deleteManualHazard(hazardId, stepName) {
    if (confirm("???�험?�인???�째�???��?�시겠습?�까?")) {
        currentState.manualHazards = currentState.manualHazards.filter(h => h.id !== hazardId);
        currentState.checkedItems.delete(hazardId);
        currentState.expandedHazardKeys.delete(hazardId);
        delete currentState.manualHazardItems[hazardId];
        delete currentState.manualNotes[hazardId];
        delete currentState.riskMatrixData[hazardId];
        
        renderRiskChecklist(stepName);
        showToast("?���??�험?�인????��?�었?�니??");
    }
}

function addManualMeasure(hazardId, type, stepName) {
    const input = document.getElementById(`manual-input-${hazardId}-${type}`);
    const val = input ? input.value.trim() : "";
    
    if (!val) {
        showToast("?�️ 추�????�용???�력?�세??");
        return;
    }

    if (!currentState.manualHazardItems[hazardId]) {
        currentState.manualHazardItems[hazardId] = { current: [], improve: [] };
    }

    currentState.manualHazardItems[hazardId][type].push(val);
    input.value = ""; // ?�력�?초기??    
    renderRiskChecklist(stepName);
    showToast("??조치 ??��??추�??�었?�니??");
}

function removeManualMeasure(hazardId, type, mIndex, stepName) {
    if (confirm("????��????��?�시겠습?�까?")) {
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
            
            // Lucide ?�이�??�생??�?부?�러???�크�?            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    } else {
        // [?�외처리] DOM???�는 경우 강제 리렌?�링
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
    
    // ?�이???�데?�트
    const val = parseInt(value);
    currentState.riskMatrixData[key][matrixType][field] = val;
    
    // [?�심 개선] ?�재?�험(current) ?�정 ???�류?�험(residual) 강제 ?�기??    if (matrixType === 'current') {
        currentState.riskMatrixData[key].residual[field] = val;
    }

    // 각각??최종 ?�수 ?�계??(current & residual ?????�실???�기??
    const current = currentState.riskMatrixData[key].current;
    const residual = currentState.riskMatrixData[key].residual;
    
    current.score = (current.severity || 1) * (current.frequency || 1);
    residual.score = (residual.severity || 1) * (residual.frequency || 1);
    
    // 부�??�험?�인 ?�동 체크 처리
    if (!currentState.checkedItems.has(key)) {
        currentState.checkedItems.add(key);
    }

    // 리렌?�링 (?�자가 ?�으�??�역 ?�태 ?�용)
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
    
    const nextBtnText = isLastStep ? "?��? ?�료 <i data-lucide='check-check'></i>" : "?�음?�계 <i data-lucide='arrow-right'></i>";
    const prevBtnText = "<i data-lucide='arrow-left'></i> ?�전?�계";
    const totalSteps = currentState.availableSteps.length;
    const currentStepNum = currentState.currentStepIndex + 1;
    const nextStepDisplay = isLastStep ? currentStepNum : currentStepNum + 1;
    const progressText = `(${nextStepDisplay} / ${totalSteps} ?�계)`;

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
                처음?�로
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
    
    if (loadingText) loadingText.innerText = "?�이?��? 처리 중입?�다...";
    if (overlay) overlay.classList.add('active');

    const logs = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        if (parts.length < 3) return null;
        
        const r = currentState.risks.find(risk => 
            getHash(risk.?�업�?|| "") === parts[0] &&
            getHash(risk.?�업?�계 || "") === parts[1] &&
            getHash(risk.?�험?�인 || "") === parts[2]
        );
        
        if (!r) return null;
        
        const riskData = currentState.riskMatrixData[key] || {
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        const currentMeasuresMaster = Array.isArray(r.?�재?�전조치) ? r.?�재?�전조치 : (r.?�재?�전조치 ? [r.?�재?�전조치] : []);
        const improvementMeasuresMaster = Array.isArray(r.개선?��? ? r.개선?��?: (r.개선?��?? [r.개선?��? : []);
        
        const currentChecked = [...currentMeasuresMaster.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`)), mNotes.current]
            .filter(v => v && v.trim()).join('\n');
            
        const improvedList = [...improvementMeasuresMaster.filter((_, mi) => currentState.improvedMeasures.has(`${key}-m-${mi}`)), mNotes.improvement]
            .filter(v => v && v.trim()).join('\n');
            
        return {
            department: currentState.selectedDept,
            task_name: currentState.selectedTask,
            step_name: r.?�업?�계 || currentState.selectedStep,
            hazard: r.?�험?�인,
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
        if (loadingText) loadingText.innerText = "?�이?��? ?�송 중입?�다...";
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }
        });

        showToast("???�송 ?�료?�었?�니??");
        // ?�출 ?�공 ???�당 ?�시 ?�???�이????��
        const draftKey = `KOMIPO_DRAFT_${currentState.selectedDept}_${currentState.selectedTask}`;
        localStorage.removeItem(draftKey);

        setTimeout(() => {
            overlay.classList.remove('active');
            location.reload();
        }, 2000);

    } catch (error) {
        console.warn("?�️ ?�송 ?�패:", error);
        queueSubmission(payload);
        overlay.classList.remove('active');
        showToast("?�� ?�프?�인 ?�태?�거???�류가 발생?�여 ?�용??로컬???�기열???�?�했?�니??");
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

// --- 결과 조회 ?�스??(카드??UI ?�진) ---

async function openResultsView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        overlay.querySelector('p').innerText = "최신 기록??불러?�는 �?..";
        overlay.classList.add('active');
    }
    
    try {
        const response = await fetchJSONP(GAS_URL + "?type=logs");
        const drafts = loadDrafts(); // 로컬 ?�시?�???�이??로드
        
        let allLogs = [];
        if (Array.isArray(response)) allLogs = [...response];
        
        // ?�시?�???�이?��? ?�버 ?�이???�합
        currentState.allLogs = [...drafts, ...allLogs];
        
        const depts = [...new Set(currentState.allLogs.map(log => log.부?�명 || log.?�속 || "미�???))].filter(d => d).sort();
        const deptSelect = document.getElementById('result-dept-select');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">부?��? ?�택?�세??/option>' + 
                depts.map(d => `<option value="${d}">${d}</option>`).join('');
        }
        switchPhase('step-results');
        resetResultsView();
    } catch (error) {
        showToast("?�️ ?�이??로드 ?�패. ?�트?�크 ?�태�??�인?�세??");
    } finally {
        if(overlay) overlay.classList.remove('active');
    }
}

function resetResultsView() {
    document.getElementById('result-search-form').style.display = 'block';
    document.getElementById('result-detail-viewer').style.display = 'none';
    document.getElementById('results-empty-state').style.display = 'block';
    const taskSelect = document.getElementById('result-task-select');
    if (taskSelect) taskSelect.innerHTML = '<option value="">?�업???�택?�세??/option>';
    const deptSelect = document.getElementById('result-dept-select');
    if (deptSelect) deptSelect.value = "";
}

function updateResultTasks() {
    const selectedDept = document.getElementById('result-dept-select').value;
    const taskSelect = document.getElementById('result-task-select');
    if (!selectedDept || !taskSelect) return;
    
    const taskOptions = currentState.allLogs
        .filter(log => (log.부?�명 || log.?�속) === selectedDept)
        .map(log => ({
            name: log.?�업�?|| "?�목 ?�음",
            date: log.?�시 ? new Date(log.?�시).toLocaleDateString() : "?�짜미상",
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
    
    taskSelect.innerHTML = '<option value="">?�업???�택?�세??/option>' + 
        uniqueTasks.map(t => {
            const label = t.isDraft ? `[?�성 �? ${t.name} (${t.date})` : `${t.date} | ${t.name}`;
            const val = t.isDraft ? `DRAFT|${t.draftKey}` : t.name;
            return `<option value="${val}">${label}</option>`;
        }).join('');
}

function showResultDetail() {
    const dept = document.getElementById('result-dept-select').value;
    const selectedVal = document.getElementById('result-task-select').value;
    if (!dept || !selectedVal) {
        showToast("?�️ 부?��? ?�업???�택?�세??");
        return;
    }

    // ?�시 ?�????�� ?�택 ???�어가�??�행
    if (selectedVal.startsWith('DRAFT|')) {
        const draftKey = selectedVal.split('|')[1];
        resumeDraft(draftKey);
        return;
    }

    const task = selectedVal;

    const filteredLogs = currentState.allLogs.filter(log => (log.부?�명 || log.?�속) === dept && log.?�업�?=== task);
    if (filteredLogs.length === 0) {
        showToast("???�이?��? 찾을 ???�습?�다.");
        return;
    }

    document.getElementById('result-search-form').style.display = 'none';
    document.getElementById('result-detail-viewer').style.display = 'block';
    document.getElementById('results-empty-state').style.display = 'none';
    
    renderDetailedCardReport(filteredLogs, 'pdf-content-area', false);
}



// [CORE] ?�합 고도???�더�??�진 (v25.0)
function renderDetailedCardReport(logs, containerId, isPreview = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">?�이?��? ?�습?�다.</div>';
        return;
    }

    const first = logs[0];
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    // ?�계�?Step Name)�?로그 그룹??    const groupedLogs = logs.reduce((acc, log) => {
        const step = log.?�업?�계 || "?��? ?�계";
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
                ${isPreview ? "?�험?�평가 결과 미리보기" : "?�험?�평가 결과 조회 보고??}
            </h1>
            <div style="margin-top: 10px; font-size: 0.85rem; color: #64748b; font-weight: 500;">
                ${isPreview ? "?�출 ???�용??최종 ?�인??주세??" : "�?보고?�는 ?�스?�을 ?�해 ?�송???�시�??��? 기록?�니??"}
            </div>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 20px; border: 1.5px solid #e2e8f0; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">부?�명:</span> <span style="color: #1e293b; font-weight: 800;">${first.부?�명 || first.?�속 || "미�???}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">?�업�?</span> <span style="color: #1e293b; font-weight: 800;">${first.?�업�?|| "?�용 ?�음"}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">?��???</span> <span style="color: #1e293b; font-weight: 800;">${first.?��???|| first.?��???|| "미�???}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">${isPreview ? '?��??�자' : '조회?�시'}:</span> <span style="color: #1e293b; font-weight: 800;">${isPreview ? today : (first.?�시 ? new Date(first.?�시).toLocaleDateString() : today)}</span></div>
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
                            const curScore = parseInt(l.?�재_?�험??|| l.?�재?�험?? || 0;
                            const resScore = parseInt(l.?�류_?�험??|| l.?�류?�험?? || 0;

                            return `
                            <div style="background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
                                <div style="background: #f8fafc; padding: 12px 18px; border-bottom: 1.5px solid #f1f5f9; font-weight: 800; color: #475569; font-size: 0.9rem;">
                                    <span style="color: var(--doing-blue);">??�� ${lIdx + 1}.</span> ${l.?�험?�인 || "?�용 ?�음"}
                                </div>
                                
                                <div style="padding: 15px 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div style="border-right: 1px dashed #e2e8f0; padding-right: 15px;">
                                        <div style="font-weight: 800; color: #64748b; font-size: 0.75rem; margin-bottom: 6px;">?�재 ?�전조치</div>
                                        <div style="font-size: 0.85rem; color: #1e293b; line-height: 1.5; white-space: pre-line;">${l.?�재?�전조치 || "기본 조치 준??}</div>
                                        <div style="margin-top: 10px; text-align: right;">
                                            <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 700; margin-right: 4px;">?�험??</span>
                                            ${getReportScoreBadge(curScore)}
                                        </div>
                                    </div>

                                    <div>
                                        <div style="font-weight: 800; color: #059669; font-size: 0.75rem; margin-bottom: 6px;">추�? 개선?��?/div>
                                        <div style="font-size: 0.85rem; color: #166534; line-height: 1.5; white-space: pre-line; background: #f0fdf4; padding: 6px; border-radius: 6px;">${l.개선?��?|| "추�? 조치 불필??}</div>
                                        <div style="margin-top: 10px; text-align: right;">
                                            <span style="font-size: 0.7rem; color: #10b981; font-weight: 700; margin-right: 4px;">?�류 ?�험??</span>
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
                <i data-lucide="message-square" style="width:20px; color:var(--doing-blue);"></i> 종합 개선 조치 ?�견
            </h4>
            <div style="font-size: 0.95rem; color: #475569; line-height: 1.7; white-space: pre-line; background: white; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9;">
                ${first.종합개선?�견 || "?�이?�항 ?�음"}
            </div>
        </div>

        <div style="margin-top: 50px; text-align: center; border-top: 2px solid #f1f5f9; padding-top: 30px;">
            <div style="font-weight: 900; font-size: 1.5rem; color: #1e293b; letter-spacing: 5px; margin-bottom: 5px;">?�국중�?발전(�?</div>
            <p style="color: #94a3b8; font-size: 0.8rem; font-weight: 700;">KOMIPO SMART SAFETY SYSTEM</p>
        </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

function exportResultToPDF() {
    const element = document.getElementById('pdf-content-area');
    let taskName = "?�험?�평가_보고??;
    
    // ?�트 조회 ?�면??경우
    const selectTask = document.getElementById('result-task-select')?.value;
    if (selectTask) taskName = selectTask;
    // 미리보기 ?�는 로컬 ?�스?�리??경우
    else if (currentState.selectedTask) taskName = currentState.selectedTask;

    const opt = {
        margin: 10,
        filename: `${taskName.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    showToast("?�� PDF 보고?��? ?�성 중입?�다...");
    html2pdf().set(opt).from(element).save().then(() => {
        showToast("??PDF ?�운로드가 ?�료?�었?�니??");
    });
}





/**
 * [v34.3.2] 현재 실시한 위험성평가 데이터를 구글 시트 로그 포맷으로 조립
 * TBM 모듈에서 서버 데이터보다 우선적으로 활용하기 위함
 */
function assembleSubmissionLogs() {
    if (!currentState.selectedDept || !currentState.selectedTask) return [];
    
    const logs = [];
    const timestamp = new Date().toLocaleString('ko-KR');
    const worker = Array.isArray(currentState.selectedWorkers) ? currentState.selectedWorkers.join(', ') : (currentState.selectedWorker || '');

    // 체크된 항목들 순회
    currentState.checkedItems.forEach(key => {
        // [TaskHash]-[StepHash]-[HazardHash] 구조 분해
        const hazard = currentState.risks.find(r => getHash(r.위험요인) === key.split('-').pop());
        if (!hazard) return;

        const matrix = currentState.riskMatrixData[key] || { current: {}, residual: {} };
        const notes = currentState.manualNotes[key] || { current: '', improvement: '' };

        // 현재안전조치와 개선대책 조립
        const cm = Array.isArray(hazard.현재안전조치) ? hazard.현재안전조치.join('\n') : (hazard.현재안전조치 || '');
        const im = Array.isArray(hazard.개선대책) ? hazard.개선대책.join('\n') : (hazard.개선대책 || '');
        
        logs.push({
            일시: timestamp,
            부서명: currentState.selectedDept,
            작업명: currentState.selectedTask,
            점검자: worker,
            작업단계: hazard.작업단계 || currentState.selectedStep,
            위험요인: hazard.위험요인,
            현재안전조치: (cm + '\n' + notes.current).trim(),
            개선대책: (im + '\n' + notes.improvement).trim(),
            현재_빈도: matrix.current.frequency || 1,
            현재_강도: matrix.current.severity || 1,
            현재_위험도: matrix.current.score || 1,
            잔류_빈도: matrix.residual.frequency || 1,
            잔류_강도: matrix.residual.severity || 1,
            잔류_위험도: matrix.residual.score || 1
        });
    });

    return logs;
}
