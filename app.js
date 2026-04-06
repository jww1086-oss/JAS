function updateDate(){const n=new Date();const d=n.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"});const t=n.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});const e=document.getElementById("current-date");if(e)e.innerText=`${d} ${t}`}
console.log("%c🚀 KOMIPO Smart Safety System v33.4-ULTRA Loaded", "color: #3b82f6; font-weight: bold; font-size: 1.2rem;");
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

const GAS_URL = "https://script.google.com/macros/s/AKfycbyvavs2Dk-OKQpIsxNcs5LwXNHjibiUcHvTTEfngo4YMBBe94Vt5VTmrOWZo2otLuaieg/exec";
const MASTER_SHEET = "위험성평가자료";// [NEW] 실시간 네트워크 상태 업데이트 함수 (v25.1)
function updateNetworkStatus(isOnline, message = "") {
    const indicator = document.getElementById('network-status');
    if (!indicator) return;

    if (isOnline) {
        indicator.className = 'status-indicator online';
        indicator.querySelector('.status-text').textContent = message || '실시간 ON';
    } else {
        indicator.className = 'status-indicator offline';
        indicator.querySelector('.status-text').textContent = message || '접속 중...';
    }
}

// 1. 데이터 보안 우회(CORS) 및 정제 유틸리티
function cleanValue(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/\[cite: \d+\]/g, '').trim(); 
}

function smartSplit(text) {
    if (!text || typeof text !== 'string') return [text];
    const items = text.split(/(?=[0-9]+\.|[0-9]+\)|[①-⑳]|\([0-9]+\)|(?:\n|^)[-*••])/)
        .map(item => item.replace(/^[0-9]+\.|^[0-9]+\)|^[①-⑳]|^\([0-9]+\)|^-|^\*|^\•|^\•/, '').trim())
        .filter(item => item.length > 0);
    return items.length > 0 ? items : [text.trim()];
}

// --- [NEW] 임시 저장 및 복원 시스템 (v25.2) ---
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
                    부서명: data.selectedDept,
                    작업명: data.selectedTask,
                    일시: data.lastUpdated,
                    점검자: (Array.isArray(data.selectedWorkers) ? data.selectedWorkers.join(', ') : data.selectedWorker) || '작성 중'
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
        // 상태 복원
        Object.assign(currentState, data);
        currentState.checkedItems = new Set(data.checkedItems);
        currentState.checkedMeasures = new Set(data.checkedMeasures);
        currentState.improvedMeasures = new Set(data.improvedMeasures);
        currentState.expandedHazardKeys = new Set(data.expandedHazardKeys);
        
        showToast("🔄 임시 저장된 데이터를 불러왔습니다.");
        
        // 현재 단계에 맞춰 이동
        if (currentState.currentStep > 0) {
            switchPhase(`step-${currentState.currentStep}`);
        } else {
            switchPhase('step-1');
        }
    } catch (e) {
        console.error("Resume error:", e);
        showToast("❌ 데이터를 불러오지 못했습니다.");
    }
}

// --- [NEW] 임시 저장 및 복원 시스템 (v25.2) ---
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
                    부서명: data.selectedDept,
                    작업명: data.selectedTask,
                    일시: data.lastUpdated,
                    점검자: data.selectedWorkers.join(', ') || '작성 중'
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
        // 상태 복원
        Object.assign(currentState, data);
        currentState.checkedItems = new Set(data.checkedItems);
        currentState.checkedMeasures = new Set(data.checkedMeasures);
        currentState.improvedMeasures = new Set(data.improvedMeasures);
        currentState.expandedHazardKeys = new Set(data.expandedHazardKeys);
        
        showToast("🔄 임시 저장된 데이터를 불러왔습니다.");
        
        // 현재 단계에 맞춰 이동
        if (currentState.currentStep > 0) {
            switchPhase(`step-${currentState.currentStep}`);
        } else {
            switchPhase('step-1');
        }
    } catch (e) {
        console.error("Resume error:", e);
        showToast("❌ 데이터를 불러오지 못했습니다.");
    }
}

function getHash(str) {
    if (typeof str !== "string") return "0";
    const normalized = str.replace(/[^ㄱ-ㅎ|가-힣|a-z|A-Z|0-9]/g, ""); 
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

const SPREADSHEET_ID = "1_qLqeCtpr8D66oj7TjNwqvvUNa4xU7m_QVpdyzKryeE";

// [v33.5] 초고속 데이터 통신 엔진 (Fetch API + Google Visualization API)
async function fetchData(url) {
    try {
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok) throw new Error('네트워크 응답 오류');
        return await response.json();
    } catch (e) {
        console.error("Fetch Data Error:", e);
        throw e;
    }
}

// [v33.5-HYPER] 구글 시트 고속 읽기 전용 엔진 (GViz + JSONP) - CORS 보안 우회 및 최단 시간 로드
function fetchGViz(sheetName) {
    return new Promise((resolve, reject) => {
        const callbackName = 'gviz_cb_' + Math.round(100000 * Math.random());
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}`;
        
        window[callbackName] = (data) => {
            delete window[callbackName];
            const script = document.getElementById(callbackName);
            if (script) script.remove();

            if (data.status === 'error') {
                reject(new Error(data.errors[0].detailed_message));
                return;
            }

            const cols = data.table.cols.map(c => (c.label || "").trim());
            const rows = data.table.rows.map(row => {
                let obj = {};
                row.c.forEach((cell, i) => {
                    if (cols[i]) obj[cols[i]] = cell ? (cell.v !== null ? cell.v : "") : "";
                });
                return obj;
            });
            resolve(rows);
        };

        const script = document.createElement('script');
        script.id = callbackName;
        script.src = url;
        script.onerror = () => {
            delete window[callbackName];
            script.remove();
            reject(new Error('GViz 로딩 실패'));
        };
        document.body.appendChild(script);
    });
}

let signaturePad;

document.addEventListener('DOMContentLoaded', async () => {
    // [v33.4] 초고속 초기 로딩 시스템: 캐시된 마스터 데이터 즉시 복원
    try {
        const cachedRisks = localStorage.getItem('kosha_cached_risks');
        const cachedUsers = localStorage.getItem('kosha_cached_users');
        if (cachedRisks) {
            currentState.risks = JSON.parse(cachedRisks);
            console.log("⚡ 캐시된 위험성 데이터 즉시 로드 완료");
            setTimeout(() => {
                if (typeof showToast === 'function') {
                    showToast("⚡ 초고속 모드: 데이터를 즉시 로드했습니다.");
                }
            }, 500); 
        }
        if (cachedUsers) {
            currentState.users = JSON.parse(cachedUsers);
            console.log("⚡ 캐시된 근로자 명단 즉시 로드 완료");
        }
    } catch (e) { console.error("Cache load error:", e); }

    initLucide();
    initEventListeners();
    
    // [v33.5] 최단 시간 연동: 병렬 고속 동기화 시작
    fetchInitialData(); 
    updateDate();
    setInterval(updateDate, 60000);

    // [NEW] 실시간 온라인 감시 시스템 가동
    window.addEventListener('online', () => updateNetworkStatus(true, '실시간 ON'));
    window.addEventListener('offline', () => updateNetworkStatus(false, 'OFFLINE'));

    if (!history.state) {
        history.replaceState({ phase: 'dashboard' }, "", "");
    }
    
    // [NEW] 앱 시작 시 초기 화면(대시보드)으로 강제 전환하여 레이아웃 정리
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
            backgroundColor: 'rgba(255, 255, 255, 0)',
            penColor: 'rgb(0, 0, 0)',
            onBegin: () => {
                const placeholder = document.getElementById('sig-placeholder');
                if (placeholder) placeholder.style.display = 'none';
            }
        });
    }

    document.getElementById('clear-signature')?.addEventListener('click', () => {
        if (signaturePad) {
            signaturePad.clear();
            const placeholder = document.getElementById('sig-placeholder');
            if (placeholder) placeholder.style.display = 'block';
        }
    });
});


function initLucide() { if (window.lucide) window.lucide.createIcons(); }

function switchPhase(targetId, skipHistory = false) {
    console.log(`🔄 Switching Phase to: ${targetId}`);
    const targetPhase = document.getElementById(targetId);
    if (!targetPhase) {
        console.error(`❌ Target phase not found: ${targetId}`);
        return;
    }

    // 히스토리 기록 (뒤로가기용)
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
        saveDraft(); // 단계 전환 시 자동 저장 활성화
        const stepNum = parseInt(targetId.replace('step-', ''));
        if (!isNaN(stepNum)) {
            currentState.currentStep = stepNum;
            updateStepperUI(stepNum);
        } else if (targetId === 'step-improvement') {
            updateStepperUI(3);
            renderImprovementPhase(); // [NEW] 개선 단계 진입 시 동적 렌더링 호출
        }
    }

    // 화면 페이즈 관리: 단 하나의 active만 존재하도록 강제
    document.querySelectorAll('.phase').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none'; // 명시적으로 숨김
        p.style.opacity = '0';
    });

    targetPhase.style.display = 'block'; // 먼저 보이게 설정
    targetPhase.classList.add('active');
    
    // 브라우저 리플로우 강제 유도 후 애니메이션 실행
    void targetPhase.offsetWidth; 
    
    setTimeout(() => {
        targetPhase.style.opacity = '1';
        targetPhase.style.transform = 'translateY(0)';
    }, 20);
    
    if (targetId === 'step-4') {
        const previewData = preparePreviewData();
        renderDetailedCardReport(previewData, 'preview-results-area', true);

        // [v33.0] 메인 서명 패드 고해상도 대응 (펜 위치 어긋남 방지)
        setTimeout(() => {
            const canvas = document.getElementById('signature-pad');
            if (canvas && typeof SignaturePad !== 'undefined') {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext("2d").scale(ratio, ratio);
                
                // 기존 패드가 있다면 지우고 새로 초기화하여 좌표 동기화
                signaturePad = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    penColor: 'rgb(0, 0, 0)'
                });
            }
        }, 100);
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
    // 브라우저 캐시 무시하고 루트 경로로 강제 리로드
    window.location.assign(window.location.origin + window.location.pathname);
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
    
    // UI 초기화
    const container = document.getElementById('selection-container');
    const header = document.getElementById('step1-header');
    const confirmArea = document.getElementById('final-confirm-area');
    const homeBtn = document.getElementById('step1-home-btn');
    
    if (container) {
        container.style.display = 'flex';
        container.classList.add('selection-banner-list');
    }
    if (header) {
        header.querySelector('h2').innerText = "평가자 정보 및 부서 선택";
        header.querySelector('p').innerText = "성명을 선택하고 소속 부서를 클릭하세요.";
    }
    if (confirmArea) confirmArea.style.display = 'none';
    if (homeBtn) homeBtn.style.display = 'flex';

    renderWorkers(); // [NEW] 점검자 명단 렌더링 호출

    switchPhase('step-1');
    renderDeptBanners();
}

function renderDeptBanners() {
    const container = document.getElementById('selection-container');
    if (!container) return;
    
    // 데이터 로딩 중인 경우 처리
    if (!currentState.risks || currentState.risks.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 1rem; text-align: center; color: #64748b; background: white; border-radius: 20px; border: 1px dashed #e2e8f0;">
                <div class="loader-spinner" style="margin-bottom: 12px; font-size: 1.5rem; animation: spin 2s linear infinite;">🔄</div>
                <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">데이터를 동기화하고 있습니다...</div>
                <div style="font-size: 0.8rem; margin-top: 6px; opacity: 0.7;">3~5초 정도 소요될 수 있습니다.</div>
            </div>
        `;
        return;
    }
    
    // 부서 목록 추출 (가나다 순 정렬)
    const depts = [...new Set(currentState.risks.map(r => (r.부서명||'').trim()))]
                    .filter(Boolean)
                    .sort();
    
    container.innerHTML = depts.map(dept => `
        <div class="dept-banner-card" onclick="selectAssessmentDept('${dept}')">
            <div class="dbc-icon"><i data-lucide="building-2"></i></div>
            <div class="dbc-text">
                <div class="title">${dept}</div>
                <div class="desc">평가 대상 부서</div>
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
        header.querySelector('h2').innerText = "작업명 선택";
        header.querySelector('p').innerText = "수행 중인 작업을 선택하세요.";
    }
    renderTaskBanners(dept);
}

function renderTaskBanners(dept) {
    const container = document.getElementById('selection-container');
    if (!container) return;
    
    const tasks = [...new Set(currentState.risks.filter(r => r.부서명 === dept).map(r => r.작업명))];
    
    // 최고의 퀄리티를 위한 지능형 아이콘 매핑 함수
    const getTaskIcon = (task) => {
        if (task.includes('전기') || task.includes('전력') || task.includes('계전기') || task.includes('VCB')) return 'zap';
        if (task.includes('점검') || task.includes('시험') || task.includes('측정')) return 'activity';
        if (task.includes('작업') || task.includes('보수') || task.includes('정비')) return 'hammer';
        if (task.includes('해체') || task.includes('철거')) return 'trash-2';
        if (task.includes('설치') || task.includes('조립')) return 'package-plus';
        if (task.includes('화재') || task.includes('소방')) return 'flame';
        return 'clipboard-list';
    };

    container.innerHTML = tasks.map(task => `
        <div class="task-banner-card" onclick="selectAssessmentTask('${task}')">
            <div class="tbc-icon"><i data-lucide="${getTaskIcon(task)}"></i></div>
            <div class="tbc-text">
                <div class="title">${task}</div>
                <div class="desc-tag">현재 작업 프로세스</div>
            </div>
            <i data-lucide="chevron-right" class="tbc-arrow"></i>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

function selectAssessmentTask(task) {
    currentState.selectedTask = task;
    console.log(`Selected Task: ${task}`);
    
    // 중간 확인 단계 없이 즉시 점검표로 이동 (초간편 워크플로우)
    // 렌더링 지연 방지를 위해 즉시 화면 전환 시도
    setTimeout(() => {
        nextStep(2);
    }, 10);
}

// [NEW] 1단계(부서/작업 선택) 이전단계 스마트 핸들러
function handleStep1Back() {
    const header = document.getElementById('step1-header');
    
    if (currentState.selectedDept) {
        // 부서가 선택된 상태(즉, 작업명 선택 화면)라면 부서 선택 화면으로 되돌아감
        currentState.selectedDept = null;
        currentState.selectedTask = null;
        if (header) {
            header.querySelector('h2').innerText = "평가자 정보 및 부서 선택";
            header.querySelector('p').innerText = "성명을 선택하고 소속 부서를 클릭하세요.";
        }
        renderDeptBanners();
    } else {
        // 부서 선택 화면이라면 이전 페이즈(업무 선택)로 이동
        switchPhase('step-choice');
    }
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
        // 최근 20건만 유지
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
        // 테스트를 위한 샘플 데이터 주입 (사용자 확인용)
        const sampleData = [
            { id: 101, department: "계전기술부", task: "변압기 점검", worker: "점검자A", timestamp: "2024-04-03 10:00:00", logs: [] },
            { id: 102, department: "발전기술부", task: "펌프 점검", worker: "점검자B", timestamp: "2024-04-03 14:30:00", logs: [] },
            { id: 103, department: "정비기획부", task: "밸브 측정", worker: "점검자C", timestamp: "2024-04-02 09:15:00", logs: [] }
        ];
        localStorage.setItem('kosha_history', JSON.stringify(sampleData));
        location.reload(); // 데이터 반영을 위해 리로드
        return;
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
    title.innerText = "부서별 위험성평가 조회";
    subtitle.innerText = "조회할 부서를 선택하세요.";
    
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
    subtitle.innerText = "조회할 작업명을 선택하세요.";
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
                            <div style="font-size:0.75rem; color:#64748b;">최근 평가 이력 보기</div>
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
    // [UNIFIED] 통합 렌더링 엔진을 사용하도록 변경
    setTimeout(() => {
        const logs = (data.logs || []).map(l => ({
            부서명: data.department,
            작업명: data.task,
            점검자: data.worker,
            일시: data.timestamp,
            작업단계: l.step || "점검",
            위험요인: l.hazard,
            현재안전조치: l.current_checked,
            개선대책: l.improvements_checked,
            현재_위험도: l.current_score,
            잔류_위험도: l.residual_score,
            종합개선의견: data.overall_improvement
        }));
        renderDetailedCardReport(logs, 'report-view-content', false);
    }, 10);
    return `<div id="report-view-content" style="min-height:300px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">보고서를 구성 중입니다...</div>`;
}

// [NEW] 현재 점검 중인 데이터를 보고서 형식으로 변환하는 함수 (v25.0)
function preparePreviewData() {
    const logs = [];
    const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker || "미지정";
    
    // 1. 표준 위험요인 처리
    const taskHash = getHash(currentState.selectedTask || "");
    
    currentState.risks.forEach(risk => {
        const hazardHash = getHash(risk.위험요인);
        const stepName = risk.작업단계;
        const stepHash = getHash(stepName);
        const key = `${taskHash}-${stepHash}-${hazardHash}`;
        
        if (currentState.checkedItems.has(key) || currentState.riskMatrixData[key]) {
            const riskData = currentState.riskMatrixData[key] || { current: { score: 1 }, residual: { score: 1 } };
            
            // 점검표 렌더링 로직과 동일하게 줄바꿈 분리
            const standardMeasures = Array.isArray(risk.개선대책) ? risk.개선대책 : (risk.개선대책 ? risk.개선대책.split('\n') : []);
            
            const currentMeasures = [];
            standardMeasures.forEach((m, idx) => {
                if (currentState.checkedMeasures.has(`${key}-m-${idx}`)) {
                    currentMeasures.push(`[이행] ${m.trim()}`);
                }
            });
            
            if (currentState.manualNotes[key]?.current) currentMeasures.push(`(추가의견) ${currentState.manualNotes[key].current}`);

            const improveMeasures = [];
            standardMeasures.forEach((m, idx) => {
                if (currentState.improvedMeasures.has(`${key}-m-${idx}`)) {
                    improveMeasures.push(`[개선] ${m.trim()}`);
                }
            });
            
            if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`(추가의견) ${currentState.manualNotes[key].improvement}`);

            logs.push({
                부서명: currentState.selectedDept,
                작업명: currentState.selectedTask,
                점검자: workerName,
                작업단계: stepName,
                위험요인: risk.위험요인,
                현재안전조치: currentMeasures.length > 0 ? currentMeasures.join('\n') : "없음",
                개선대책: improveMeasures.length > 0 ? improveMeasures.join('\n') : "없음",
                현재_빈도: riskData.current.frequency,
                현재_강도: riskData.current.severity,
                현재_위험도: riskData.current.score,
                잔류_빈도: riskData.residual.frequency,
                잔류_강도: riskData.residual.severity,
                잔류_위험도: riskData.residual.score
            });
        }
    });

    // 2. 수동 추가 위험요인 처리
    currentState.manualHazards.forEach(hazard => {
        const key = hazard.id;
        const stepName = hazard.stepName;
        const riskData = currentState.riskMatrixData[key] || { current: { score: 1 }, residual: { score: 1 } };
        
        const currentMeasures = (currentState.manualHazardItems[key]?.current || []).filter((_, idx) => currentState.checkedMeasures.has(`${key}-mc-${idx}`));
        if (currentState.manualNotes[key]?.current) currentMeasures.push(`(추가의견) ${currentState.manualNotes[key].current}`);
        
        const improveMeasures = (currentState.manualHazardItems[key]?.improve || []).filter((_, idx) => currentState.improvedMeasures.has(`${key}-mi-${idx}`));
        if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`(추가의견) ${currentState.manualNotes[key].improvement}`);

        logs.push({
            부서명: currentState.selectedDept,
            작업명: currentState.selectedTask,
            점검자: workerName,
            작업단계: stepName,
            위험요인: hazard.hazardName,
            현재안전조치: currentMeasures.join('\n') || "이상 없음 (양호)",
            개선대책: improveMeasures.join('\n') || "추가 개선사항 없음",
            현재_위험도: riskData.current.score,
            잔류_위험도: riskData.residual.score,
            종합개선의견: document.getElementById('overall-improvement')?.value || ""
        });
    });

    return logs;
}

function nextStep(step) {
    if (step === 2) {
        // 해당 부서와 작업에 맞는 모든 점검 단계 추출 (공백 제거하여 정확도 높임)
        currentState.availableSteps = [...new Set(currentState.risks
            .filter(r => (r.부서명||'').trim() === (currentState.selectedDept||'').trim() && 
                         (r.작업명||'').trim() === (currentState.selectedTask||'').trim())
            .map(r => (r.작업단계||'').trim()))].filter(Boolean);
        
        if (currentState.availableSteps.length === 0) {
            // 백업: 부서명 매칭 실패 시 작업명만으로 검색 시도
            currentState.availableSteps = [...new Set(currentState.risks
                .filter(r => (r.작업명||'').trim() === (currentState.selectedTask||'').trim())
                .map(r => r.작업단계))].filter(Boolean);
        }

        if (currentState.availableSteps.length === 0) {
            showToast("⚠️ 해당 작업에 정의된 단계가 없습니다.");
            return;
        }
        
        currentState.currentStepIndex = 0;
        currentState.selectedStep = currentState.availableSteps[0];
        
        // 1. 화면 전환을 먼저 수행하여 즉각 정지 현상 해결
        switchPhase('step-2');
        
        // 2. 그 다음 데이터 렌더링 (약간의 지연을 주어 UI 프리징 방지)
        setTimeout(() => {
            renderRiskChecklist(currentState.selectedStep);
            
            // 3. 점검자 성명 드롭다운 설정
            const input = document.getElementById('worker-input');
            const dropdown = document.getElementById('worker-dropdown');
            if (input && dropdown) {
                setupCustomDropdown(input, dropdown, 
                    () => currentState.users.map(u => ({ value: u.이름, sub: `${u.소속} ${u.직책}` })), 
                    (val) => { currentState.selectedWorker = val; }
                );
            }
        }, 50);
        
        return;
    }
    
    if (step === 3) {
        // [추가] 점검자 성명 유효성 검사 (Step 2에서 3으로 가기 전 필수 체크)
        const workerName = document.getElementById('worker-input')?.value || currentState.selectedWorker;
        if (!workerName || workerName.trim() === "") {
            showToast("⚠️ 점검자 성명을 먼저 입력해 주세요. (화면 최상단)");
            const input = document.getElementById('worker-input');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.style.boxShadow = "0 0 0 4px rgba(244, 63, 94, 0.2)"; // 일시적 강조
                setTimeout(() => input.style.boxShadow = "", 2000);
            }
            return;
        }

        // 다음 단계가 더 있는지 확인
        if (currentState.currentStepIndex < currentState.availableSteps.length - 1) {
            currentState.currentStepIndex++;
            currentState.selectedStep = currentState.availableSteps[currentState.currentStepIndex];
            renderRiskChecklist(currentState.selectedStep);
            window.scrollTo({top: 0, behavior: 'smooth'});
        } else {
            // 모든 단계 종료 -> 개선 단계로 자동 전환
            switchPhase('step-improvement');
            if (window.lucide) window.lucide.createIcons();
            
            // Phase 2의 내비게이션 버튼들 비움 (중복 방지)
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
        // 첫 번째 단계에서 이전 기능은 처음으로(대시보드) 이동
        location.reload();
    }
}

function prevStep(step) {
    if (step === 0) {
        goHome();
    } else {
        history.back(); // 히스토리 뒤로가기 실행 (popstate에서 화면 전환 처리됨)
    }
}

function loadMockData() {
    // [v26.1] 데이터 로딩 실패 시 이전 정보 유출 방지를 위해 초기화된 상태로 표시
    currentState.users = [
        { 이름: "데이터 로딩 대기 중", 소속: "-", 직책: "-", 경력: "-" }
    ];
    
    currentState.risks = [
        { 
            부서명: "연결 대기", 
            작업명: "구글 시트 동기화 시도 중...", 
            작업단계: "-", 
            위험요인: "네트워크 및 권한을 확인해주세요.", 
            개선대책: ["데이터가 보이지 않으면 새로고침(Ctrl+F5) 하세요."] 
        }
    ];
    currentState.incidents = {};
}

async function fetchInitialData() {
    console.log("🚀 [v33.6-HYBRID] 하이브리드 동기화 시스템 가동...");
    updateNetworkStatus(false, '동기화 중');

    try {
        // [v33.6] 1단계: 초고속 GViz 엔진(JSONP) 선제 시도
        try {
            console.log("⚡ [Fast-Path] GViz 엔진 시도 중...");
            const [riskData, userData] = await Promise.all([
                fetchGViz(MASTER_SHEET),
                fetchGViz("평가자명단")
            ]);
            
            processRiskData(riskData);
            processUserData(userData);
            finalizeSync("✅ [Hyper] 구글 엔진 직통 동기화 완료");
            return; // 성공 시 종료

        } catch (gvizError) {
            console.warn("🛡️ [Fallback] 권한 제약으로 일반 통로(GAS)로 전환합니다:", gvizError.message);
            
            // [v33.6] 2단계: 보안 GAS 엔진(Legacy Path) 자동 전환
            // fetchJSONP 대신 최신 fetch API를 비동기 호출
            const params = new URLSearchParams({ type: 'master' });
            const riskResponse = await fetch(`${GAS_URL}?${params.toString()}`, { redirect: 'follow' });
            const riskData = await riskResponse.json();
            
            const userParams = new URLSearchParams({ type: 'users' });
            const userResponse = await fetch(`${GAS_URL}?${userParams.toString()}`, { redirect: 'follow' });
            const userData = await userResponse.json();

            processRiskData(riskData);
            processUserData(userData);
            finalizeSync("✅ [Standard] 보안 앱스 서버를 통한 동기화 완료");
        }

    } catch (error) {
        console.warn("⚠️ 최종 동기화 지연 (캐시 모드 유지):", error);
        if (currentState.risks.length === 0) {
            loadMockData();
            renderDeptBanners();
        }
    }
}

// 데이터 처리 공통 함수
function processRiskData(riskData) {
    if (!riskData || riskData.length === 0) return;
    const allRisks = [];
    riskData.forEach(item => {
        const cleanedHazard = cleanValue(item.위험요인 || item.hazard || "");
        const cleanedMeasures = cleanValue(item.현재안전조치 || item.current_measures || "");
        const hazards = smartSplit(cleanedHazard);
        const measures = smartSplit(cleanedMeasures);
        
        hazards.forEach(h => {
            allRisks.push({
                부서명: cleanValue(item.부서명 || item.dept || "미지정"),
                작업명: cleanValue(item.작업명 || item.task || "미정의 작업"),
                작업단계: cleanValue(item.작업단계 || item.step || "미정의 단계"),
                위험요인: h,
                개선대책: measures,
                current_frequency: item.현재_빈도 || item.current_frequency || 1,
                current_severity: item.현재_강도 || item.current_severity || 1,
                current_score: item.현재_위험도 || item.current_score || 1
            });
        });
    });
    currentState.risks = allRisks;
    localStorage.setItem('kosha_cached_risks', JSON.stringify(allRisks));
    renderDeptBanners();
}

function processUserData(userData) {
    if (!userData || userData.length === 0) return;
    currentState.users = userData.map(u => ({
        이름: cleanValue(u.이름 || u.성명 || ""),
        소속: cleanValue(u.소속 || u.부서명 || ""),
        직책: cleanValue(u.직책 || ""),
        경력: cleanValue(u.경력 || "")
    }));
    localStorage.setItem('kosha_cached_users', JSON.stringify(currentState.users));
    renderWorkers();
}

function finalizeSync(msg) {
    console.log(msg);
    updateNetworkStatus(true, '실시간 ON');
    setTimeout(() => {
        showToast("📱 최신 데이터와 동기화되었습니다.");
    }, 3000); 
}

function renderDepartmentList() {
    const departments = [...new Set(currentState.risks.map(r => r.부서명))]
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

    // [추가] '+ 추가' 버튼 클릭 및 엔터 키 이벤트 바인딩
    if (addBtn && input) {
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
            value: u.이름, 
            sub: `${u.소속} | ${u.직책}` 
        })),
        (val) => { 
            addSelectedWorker(val); 
            if (input) input.value = ''; // 선택 후 초기화
        }
    );

    updateSelectedWorkersUI(); // 기존 선택 내역 복원
}

// [NEW] 평가자 추가 로직
function addSelectedWorker(name) {
    if (!name || currentState.selectedWorkers.includes(name)) return;
    currentState.selectedWorkers.push(name);
    updateSelectedWorkersUI();
}

// [NEW] 평가자 삭제 로직
function removeSelectedWorker(name) {
    currentState.selectedWorkers = currentState.selectedWorkers.filter(n => n !== name);
    updateSelectedWorkersUI();
}

// [NEW] 선택된 평가자 칩(Chip) UI 렌더링
function updateSelectedWorkersUI() {
    const container = document.getElementById('selected-workers-chips');
    if (!container) return;

    if (currentState.selectedWorkers.length === 0) {
        container.innerHTML = `<span style="font-size:0.8rem; color:#94a3b8; font-style:italic;">선택된 평가자가 없습니다.</span>`;
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
    const taskArea = document.getElementById('step1-task-area'); // 1단계의 새로운 작업영역
    if (taskArea) taskArea.style.display = 'block';
    
    const deptTasks = [...new Set(currentState.risks.filter(r => r.부서명 === dept).map(r => r.작업명))];
    
    setupCustomDropdown(
        'step1-task-select', 
        'step1-task-dropdown', 
        () => deptTasks.map(t => ({ value: t })),
        (val) => {
            currentState.selectedTask = val;
            // populateWorkSteps(val); // 1단계에서는 선택만 함
        }
    );
}

function populateWorkSteps(taskName) {
    const stepArea = document.getElementById('step-selection-area');
    if (stepArea) stepArea.style.display = 'block';

    const steps = [...new Set(currentState.risks
        .filter(r => r.작업명 === taskName && r.부서명 === currentState.selectedDept)
        .map(r => r.작업단계))];

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
                    <i data-lucide="user-check" style="width:18px; color:var(--doing-blue);"></i>
                    <span>${item.value}</span>
                    ${item.sub ? `<span class="sub-info">${item.sub}</span>` : ''}
                </div>
            `).join('')
            : '<div class="dropdown-item" style="cursor:default; color:#94a3b8;">검색 결과가 없습니다.</div>';
        
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
    else currentState.selectedStep = stepName; // 현재 렌더링 중인 단계를 전역 상태로 확정

    const container = document.getElementById('risk-checklist');
    if (!container) return;

    // 단계 진행 상태 표시 바
    const progressTotal = currentState.availableSteps.length || 1;
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
    
    // 필터링 시 부서명 + 작업명 + 단계명 조건을 모두 확인하여 정확한 데이터 로드
    let taskRisks = currentState.risks.filter(r => 
        (r.부서명||"").trim() === (currentState.selectedDept||"").trim() &&
        (r.작업명||"").trim() === (currentState.selectedTask||"").trim() && 
        (r.작업단계||"").trim() === (stepName||"").trim()
    );

    // [개선] 중복 위험요인 제거 (데이터 중복 방지)
    const seenHazards = new Set();
    taskRisks = taskRisks.filter(r => {
        if (seenHazards.has(r.위험요인)) return false;
        seenHazards.add(r.위험요인);
        return true;
    });

    console.log(`🔍 Rendering risks for [${currentState.selectedTask}] - [${stepName}]. Unique items: ${taskRisks.length}`);
    
    if (taskRisks.length === 0) {
        checklistHTML += `
            <div style="text-align:center; padding:3rem; background:#f8fafc; border-radius:20px; border:1px dashed #cbd5e1; color:#94a3b8;">
                <p>해당 단계에 정의된 위험 요인이 없습니다.</p>
                <p style="font-size:0.75rem; margin-top:8px;">데이터 마스터 시트와 부서/작업명이 일치하는지 확인하십시오.</p>
            </div>
        `;
    }

    checklistHTML += taskRisks.map((r, i) => {
        const hazardHash = getHash(r.위험요인);
        const taskHash = getHash(currentState.selectedTask || "");
        const stepHash = getHash(stepName || currentState.selectedStep || "");
        const key = `${taskHash}-${stepHash}-${hazardHash}`;
        
        const isChecked = currentState.checkedItems.has(key);
        const notes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        const riskData = currentState.riskMatrixData[key] || { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const measures = Array.isArray(r.개선대책) ? r.개선대책 : [r.개선대책];
        const isExpanded = currentState.expandedHazardKeys.has(key);
        
        return `
            <div class="check-item ${isChecked ? 'checked' : ''} ${isExpanded ? 'expanded' : ''}" id="risk-card-${i}" 
                 style="width: 100% !important; min-width: 100% !important; padding: 1.1rem !important;">
                
                <div class="check-item-header" onclick="toggleAccordion(${i}, '${key}')" style="cursor: pointer;">
                    <div class="check-indicator" onclick="event.stopPropagation(); toggleRiskByHash('${key}', '${stepName}')">
                        <i data-lucide="check"></i>
                    </div>
                    <span class="risk" style="flex: 1; font-weight: 900; color: #1e293b;">${r.위험요인}</span>
                    <i data-lucide="chevron-down" class="expand-icon" style="transition: 0.3s; ${isExpanded ? 'transform: rotate(180deg);' : ''}"></i>
                </div>

                <div class="measure-container" id="measure-panel-${i}" style="margin-top: 0; display: ${isExpanded ? 'block' : 'none'};">
                    <!-- Section 1: 현재안전조치 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:800; color:var(--doing-blue); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="shield-check" style="width:14px;"></i> [현재안전조치]
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
                                <i data-lucide="edit-3" style="width:14px;"></i> 현재 추가 안전조치 (수기 입력)
                            </label>
                            <textarea class="manual-textarea" placeholder="기존 대책 외 추가된 현장 조치 내용을 입력하세요..." 
                                style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; width: 100%; min-height: 80px; font-family: inherit;"
                                oninput="updateManualNote('${key}', 'current', this.value)">${notes.current || ""}</textarea>
                        </div>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(248, 250, 252, 0.8); padding: 0.85rem 1rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                                  <span style="font-weight: 800; color: #334155; font-size: 0.85rem; font-family: 'Outfit', sans-serif;">현재 위험성 수준</span>
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

                    <!-- Section 2: 개선대책 및 잔류 위험성 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
                            <i data-lucide="wrench" style="width:16px;"></i> [개선대책]
                        </p>
                    
                        <ul class="measure-list improvement" style="margin-bottom: 1rem;">
                            ${measures.map((m, mi) => {
                                const mKey = `${key}-m-${mi}`;
                                const isMChecked = currentState.checkedMeasures.has(mKey);
                                const isMImproved = currentState.improvedMeasures.has(mKey);
                                
                                // [개선] 현재 실천 중(Checked)인 항목은 개선대책 목록에서 제외
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
                                `<li style="text-align:center; padding:15px; color:#94a3b8; font-size:0.85rem; background:#f8fafc; border-radius:12px; border:1px dashed #e2e8f0;">✅ 모든 표준 안전조치가 실천 중입니다.</li>` : ''}
                        </ul>

                        <div class="manual-input-area" style="margin-bottom: 1rem;">
                            <label style="display: block; font-size: 0.8rem; font-weight: 900; color: var(--doing-accent); margin-bottom: 10px; font-family: 'Outfit', sans-serif;">
                                <i data-lucide="wrench" style="width:16px;"></i> 추가 개선대책 입력 (수기)
                            </label>
                            <textarea class="manual-textarea" placeholder="위험을 줄이기 위한 추가 개선 의견을 입력하세요..." 
                                style="background: rgba(254, 242, 242, 0.5); border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 90px; font-family: inherit; font-size: 0.95rem;"
                                oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement || ""}</textarea>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(254, 242, 242, 0.5); padding: 0.85rem 1rem; border-radius: 16px; border: 1.5px solid rgba(244, 63, 94, 0.1);">
                            <span style="font-weight: 800; color: var(--doing-accent); font-size: 0.85rem; font-family: 'Outfit', sans-serif;">개선 후 잔류위험</span>
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

    // --- [NEW] 수동 추가된 위험요인 렌더링 ---
    const manualRisks = (currentState.manualHazards || []).filter(mr => mr.stepName === stepName);
    const manualHTML = manualRisks.map((mr, mi) => {
        const key = mr.id; // 이미 고유한 ID(hash)를 가지고 있음
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
                    <!-- Section 1: 현재안전조치 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-indigo); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif;">
                            <i data-lucide="shield-check" style="width:16px;"></i> [현재안전조치]
                        </p>
                        
                        <!-- [NEW] 수동 조치 리스트 -->
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

                        <!-- [NEW] 조치 추가 입력창 -->
                        <div style="display:flex; gap:8px; margin-bottom:1rem;">
                            <input type="text" id="manual-input-${key}-current" placeholder="현재 시행 중인 조치 추가..." 
                                   style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:0.9rem;"
                                   onkeypress="if(event.key==='Enter') addManualMeasure('${key}', 'current', '${stepName}')">
                            <button onclick="addManualMeasure('${key}', 'current', '${stepName}')" 
                                    style="background:var(--doing-indigo); color:white; border:none; border-radius:10px; width:40px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>

                        <textarea class="manual-textarea" placeholder="추가적인 현재 안전조치 확인 내용을 입력하세요..." 
                                  style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 80px; font-family: inherit;"
                                  oninput="updateManualNote('${key}', 'current', this.value)">${notes.current}</textarea>
                        
                        <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; background: rgba(248, 250, 252, 0.8); padding: 1rem; border-radius: 18px; border: 1px solid #e2e8f0;">
                            <span style="font-weight: 800; color: #334155; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">현재 위험성 수준</span>
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

                    <!-- Section 2: 개선대책 -->
                    <div style="margin-top: 1rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <p style="font-size:0.85rem; font-weight:900; color:var(--doing-accent); margin-bottom:14px; display:flex; align-items:center; gap:8px; font-family: 'Outfit', sans-serif;">
                            <i data-lucide="wrench" style="width:16px;"></i> [개선대책]
                        </p>

                        <!-- [NEW] 수동 개선대책 리스트 (현재 조치 체크되지 않은 항목만 표시) -->
                        <ul class="measure-list improvement" style="margin-bottom: 1rem;">
                            ${(currentState.manualHazardItems[key]?.improve || []).map((m, mIdx) => {
                                const mcKey = `${key}-mc-${mIdx}`; // 현재조치와 동일 인덱스 사용
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

                        <!-- [NEW] 개선대책 추가 입력창 -->
                        <div style="display:flex; gap:8px; margin-bottom:1rem;">
                            <input type="text" id="manual-input-${key}-improve" placeholder="필요한 개선 대책 추가..." 
                                   style="flex:1; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:0.9rem;"
                                   onkeypress="if(event.key==='Enter') { event.preventDefault(); addManualMeasure('${key}', 'improve', '${stepName.replace(/'/g, "\\'")}'); }">
                            <button onclick="addManualMeasure('${key}', 'improve', '${stepName.replace(/'/g, "\\'")}')" 
                                    style="background:var(--doing-accent); color:white; border:none; border-radius:10px; width:40px; height:38px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                <i data-lucide="plus"></i>
                            </button>
                        </div>

                        <textarea class="manual-textarea" placeholder="추가 개선의견 또는 확인 사항을 입력하세요..." 
                                  style="background: rgba(254, 242, 242, 0.5); border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 16px; padding: 1.25rem; width: 100%; min-height: 80px; font-family: inherit;"
                                  oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement}</textarea>

                        <div style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: space-between; background: rgba(254, 242, 242, 0.5); padding: 1.25rem; border-radius: 20px; border: 1.5px solid rgba(244, 63, 94, 0.1);">
                            <span style="font-weight: 800; color: var(--doing-accent); font-size: 0.9rem; font-family: 'Outfit', sans-serif;">개선 후 잔류위험</span>
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

    // --- [NEW] 위험요인 추가 버튼 섹션 ---
    checklistHTML += `
        <div style="margin-top: 2rem; display: flex; justify-content: center; padding-bottom: 2rem; position: relative; z-index: 10;">
            <button onclick="requestAddManualHazard('${stepName.replace(/'/g, "\\'")}')" 
                    style="background: white; color: var(--doing-gold); border: 2px dashed var(--doing-gold); padding: 1.25rem 2rem; border-radius: 20px; font-weight: 900; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; transition: 0.3s; cursor: pointer !important; box-shadow: var(--shadow-sm); pointer-events: auto !important;">
                <i data-lucide="plus-circle"></i>
                새로운 위험요인 발견 및 추가하기
            </button>
        </div>
    `;

    checklistHTML += `</div>`; // .checklist-items-area 닫기

    container.innerHTML = checklistHTML;
    initLucide();
    updateNextButton(taskRisks.length);
    checkIncidents(taskRisks);
}

// [NEW] 개선 단계(Phase 3)의 동적 리스트 렌더링 함수
function renderImprovementPhase() {
    const container = document.querySelector('#step-improvement .improvement-content-area');
    if (!container) return;

    // 0. 타겟 영역 초기화 및 상단 내비게이션 비움 (중복 방지)
    const nextContainerFocus = document.getElementById('next-action-container');
    if (nextContainerFocus) nextContainerFocus.innerHTML = '';
    const improvedKeys = Array.from(currentState.improvedMeasures);
    
    if (improvedKeys.length === 0) {
        container.innerHTML = `
            <div style="padding: 3rem 1.5rem; text-align: center; color: #64748b; background: white; border-radius: 24px; border: 1px dashed #e2e8f0;">
                <i data-lucide="info" style="width:48px; height:48px; margin-bottom:1rem; opacity:0.3;"></i>
                <div style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">선택된 개선 조치가 없습니다.</div>
                <div style="font-size: 0.9rem; margin-top: 8px;">모든 조치가 이행 중이거나 양호합니다. 바로 서명 단계로 이동하세요.</div>
                <button class="btn btn-primary" onclick="nextStep(4)" style="margin-top:2rem; width:100%;">서명 및 제출 단계로 이동 <i data-lucide="chevron-right"></i></button>
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; justify-content: center;">
                <button class="btn" onclick="switchPhase('step-2', true)" 
                        style="background: #f1f5f9; color: #475569; width: 100%; height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <i data-lucide="arrow-left"></i> 이전 단계로 (점검 다시하기)
                </button>
            </div>
        `;
        initLucide();
        return;
    }

    let itemsHTML = improvedKeys.map((mKey, idx) => {
        let hazardName = "미정의 위험요인";
        let measureName = "미정의 대책";

        // 키 분석 및 정보 추출
        if (mKey.includes('-mi-')) { // 수동 항목
            const parts = mKey.split('-mi-');
            const hId = parts[0];
            const mIdx = parseInt(parts[1]);
            const hazard = (currentState.manualHazards || []).find(h => h.id === hId);
            if (hazard) {
                hazardName = hazard.hazardName;
                measureName = (currentState.manualHazardItems[hId]?.improve || [])[mIdx] || "수동 개선항목";
            }
        } else { // 표준 항목
            const parts = mKey.split('-m-');
            if (parts.length >= 2) {
                const hazardHash = parts[0];
                const mIdx = parseInt(parts[1]);
                const risk = currentState.risks.find(r => getHash(r.위험요인) === hazardHash.split('-').pop());
                if (risk) {
                    hazardName = risk.위험요인;
                    measureName = (Array.isArray(risk.개선대책) ? risk.개선대책[mIdx] : risk.개선대책) || "표준 개선대책";
                }
            }
        }

        const result = currentState.improvementResults[mKey] || { photo: null, note: "" };

        return `
            <div class="improvement-card" style="background: white; border-radius: 18px; padding: 1.15rem; border: 1px solid #f1f5f9; border-top: 5px solid var(--doing-accent); margin-bottom: 0.85rem; box-shadow: var(--shadow-sm);">
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 1.5rem;">
                    <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">IMPROVEMENT ITEM #${idx + 1}</span>
                    <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">[사고유형] ${hazardName}</span>
                    <span style="font-size: 1.1rem; color: #1e293b; font-weight: 900; line-height: 1.4;">${measureName}</span>
                </div>

                <div class="media-card" style="margin-bottom: 1rem; border: none; padding: 0;">
                    <div class="photo-upload-box" onclick="document.getElementById('photo-input-${mKey}').click()" 
                         id="preview-box-${mKey}" 
                         style="background: #fffcfc; border: 2px dashed rgba(244, 63, 94, 0.2); height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 16px; cursor: pointer; transition: 0.3s; overflow: hidden;">
                        ${result.photo 
                            ? `<img src="${result.photo}" style="width: 100%; height: 100%; object-fit: cover;">` 
                            : `<i data-lucide="camera" style="width:32px; height:32px; margin-bottom:8px; color:var(--doing-accent); opacity:0.4;"></i>
                               <span style="font-size: 0.9rem; font-weight: 800; color: var(--doing-accent); opacity: 0.6;">개선 전/후 사진 촬영</span>`
                        }
                    </div>
                    <input type="file" id="photo-input-${mKey}" accept="image/*" capture="environment" style="display:none;" 
                           onchange="handleImprovementPhoto('${mKey}', this)">
                </div>

                <div class="manual-input-area" style="padding: 0; border: none;">
                    <label style="display: block; font-size: 0.85rem; font-weight: 900; color: #475569; margin-bottom: 8px;">
                        <i data-lucide="edit-3" style="width:14px;"></i> 조치 결과 입력
                    </label>
                    <textarea class="manual-textarea" placeholder="조치 내용 또는 확인 사항을 입력하세요..." 
                              style="background: #fffcfc; border: 1.5px solid rgba(244, 63, 94, 0.1); border-radius: 12px; padding: 1rem; width: 100%; min-height: 80px; font-size:0.9rem;"
                              oninput="updateImprovementNote('${mKey}', this.value)">${result.note}</textarea>
                </div>
            </div>
        `;
    }).join('');

    // 하단 공통 입력창 및 내비게이션
    itemsHTML += `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 2rem;">
            <button class="btn" onclick="switchPhase('step-2', true)" 
                    style="background: #f1f5f9; color: #475569; height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <i data-lucide="arrow-left"></i> 이전으로
            </button>
            <button class="btn btn-primary" onclick="nextStep(4)" 
                    style="background: var(--doing-accent); height: 56px; border-radius: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                다음 (서명) <i data-lucide="chevron-right"></i>
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
            // 이미지 리사이징 (성능 및 용량 최적화)
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
            
            // 미리보기 업데이트
            const previewBox = document.getElementById(`preview-box-${mKey}`);
            if (previewBox) {
                previewBox.innerHTML = `<img src="${optimizedBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            showToast("📷 사진이 첨부되었습니다.");
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
        .map(r => (currentState.incidents && r.위험요인) ? currentState.incidents[r.위험요인] : null)
        .filter(incident => incident);

    if (matchingIncidents.length > 0) {
        incidentContent.innerHTML = matchingIncidents.map(inc => `<p>${inc}</p>`).join('');
        incidentContainer.style.display = 'block';
    } else {
        incidentContainer.style.display = 'none';
    }
}

function requestAddManualHazard(stepName) {
    const hazardName = prompt("발견된 새로운 위험요인명을 입력하세요:");
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
    
    // 조치 항목 저장소 초기화
    currentState.manualHazardItems[id] = { current: [], improve: [] };
    
    // 즉시 펼쳐진 상태로 표시
    currentState.expandedHazardKeys.add(id);
    currentState.checkedItems.add(id); // 수동 추가는 기본적으로 체크된 것으로 간주

    renderRiskChecklist(stepName);
    showToast("✅ 새로운 위험요인이 목록 하단에 추가되었습니다.");
}

function deleteManualHazard(hazardId, stepName) {
    if (confirm("이 위험요인을 통째로 삭제하시겠습니까?")) {
        currentState.manualHazards = currentState.manualHazards.filter(h => h.id !== hazardId);
        currentState.checkedItems.delete(hazardId);
        currentState.expandedHazardKeys.delete(hazardId);
        delete currentState.manualHazardItems[hazardId];
        delete currentState.manualNotes[hazardId];
        delete currentState.riskMatrixData[hazardId];
        
        renderRiskChecklist(stepName);
        showToast("🗑️ 위험요인이 삭제되었습니다.");
    }
}

function addManualMeasure(hazardId, type, stepName) {
    const input = document.getElementById(`manual-input-${hazardId}-${type}`);
    const val = input ? input.value.trim() : "";
    
    if (!val) {
        showToast("⚠️ 추가할 내용을 입력하세요.");
        return;
    }

    if (!currentState.manualHazardItems[hazardId]) {
        currentState.manualHazardItems[hazardId] = { current: [], improve: [] };
    }

    currentState.manualHazardItems[hazardId][type].push(val);
    input.value = ""; // 입력창 초기화
    
    renderRiskChecklist(stepName);
    showToast("✅ 조치 항목이 추가되었습니다.");
}

function removeManualMeasure(hazardId, type, mIndex, stepName) {
    if (confirm("이 항목을 삭제하시겠습니까?")) {
        currentState.manualHazardItems[hazardId][type].splice(mIndex, 1);
        renderRiskChecklist(stepName);
    }
}

function toggleRiskByHash(key, stepName) {
    const scrollY = window.scrollY; // 현재 스크롤 위치 저장
    if (currentState.checkedItems.has(key)) {
        currentState.checkedItems.delete(key);
    } else {
        currentState.checkedItems.add(key);
    }
    renderRiskChecklist(stepName);
    window.scrollTo(0, scrollY); // 스크롤 위치 복구
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
            
            // Lucide 아이콘 재생성 및 대상 카드 강조 스크롤 (화면 튕김 방지)
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 30);
        }
    } else {
        // [예외처리] DOM이 없는 경우 강제 리렌더링
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
    
    // 데이터 업데이트
    const val = parseInt(value);
    currentState.riskMatrixData[key][matrixType][field] = val;
    
    // [핵심 개선] 현재위험(current) 수정 시 잔류위험(residual) 강제 동기화
    if (matrixType === 'current') {
        currentState.riskMatrixData[key].residual[field] = val;
    }

    // 각각의 최종 점수 재계산 (current & residual 둘 다 확실히 동기화)
    const current = currentState.riskMatrixData[key].current;
    const residual = currentState.riskMatrixData[key].residual;
    
    current.score = (current.severity || 1) * (current.frequency || 1);
    residual.score = (residual.severity || 1) * (residual.frequency || 1);
    
    // 부모 위험요인 자동 체크 처리
    if (!currentState.checkedItems.has(key)) {
        currentState.checkedItems.add(key);
    }

    // 리렌더링 (인자가 없으면 전역 상태 사용)
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
    
    const nextBtnText = isLastStep ? "평가 완료 <i data-lucide='check-check'></i>" : "다음단계 <i data-lucide='arrow-right'></i>";
    const prevBtnText = "<i data-lucide='arrow-left'></i> 이전단계";
    const totalSteps = currentState.availableSteps.length;
    const currentStepNum = currentState.currentStepIndex + 1;
    const nextStepDisplay = isLastStep ? currentStepNum : currentStepNum + 1;
    const progressText = `(${nextStepDisplay} / ${totalSteps} 단계)`;

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
                처음으로
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

    // [v26.3] 평가자 추가 버튼 이벤트 바인딩
    document.getElementById('add-worker-btn')?.addEventListener('click', () => {
        const input = document.getElementById('worker-input');
        if (input && input.value.trim()) {
            addSelectedWorker(input.value.trim());
            input.value = ''; // 입력창 비우기
            document.getElementById('worker-dropdown')?.classList.remove('active');
        } else {
            showToast("평가자 성명을 입력하거나 선택해 주세요.");
        }
    });

}

async function submitLog() {
    const today = new Date().toLocaleDateString('ko-KR');
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay ? overlay.querySelector('p') : null;
    
    // [v33.1] 로딩바를 건너뛰고 즉시 성공 애니메이션으로 (UX 개선)
    if (overlay) overlay.classList.remove('active');

    const logs = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        if (parts.length < 3) return null;
        
        const r = currentState.risks.find(risk => 
            getHash(risk.작업명 || "") === parts[0] &&
            getHash(risk.작업단계 || "") === parts[1] &&
            getHash(risk.위험요인 || "") === parts[2]
        );
        
        if (!r) return null;
        
        const riskData = currentState.riskMatrixData[key] || {
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        // 점검표 렌더링 로직과 동일하게 줄바꿈 분리
        const measures = Array.isArray(r.개선대책) ? r.개선대책 : (r.개선대책 ? r.개선대책.split('\n') : []);
        
        const currentChecked = [...measures.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`)), mNotes.current]
            .filter(v => v && v.trim()).map(v => v.includes('[이행]') ? v : `[이행] ${v}`).join('\n');
            
        const improvedList = [...measures.filter((_, mi) => currentState.improvedMeasures.has(`${key}-m-${mi}`)), mNotes.improvement]
            .filter(v => v && v.trim()).map(v => v.includes('[개선]') ? v : `[개선] ${v}`).join('\n');
            
        return {
            department: currentState.selectedDept,
            task_name: currentState.selectedTask,
            step_name: r.작업단계 || currentState.selectedStep,
            hazard: r.위험요인,
            current_measures: currentChecked || "없음",
            improvements_checked: improvedList || "없음",
            current_frequency: riskData.current.frequency,
            current_severity: riskData.current.severity,
            current_score: riskData.current.score,
            residual_frequency: riskData.residual.frequency,
            residual_severity: riskData.residual.severity,
            residual_score: riskData.residual.score
        };
    }).filter(Boolean);

    const workerNames = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : currentState.selectedWorker || '';

    // [v32.0] 개선대책 실행계획 데이터 추출
    const improvementPlan = Array.from(currentState.improvedMeasures).map(mKey => {
        const result = currentState.improvementResults[mKey] || { note: "" };
        let hazardName = "미정의 위험요인";
        
        // 키 분석하여 위험요인 명칭 추출
        if (mKey.includes('-mi-')) {
            const hId = mKey.split('-mi-')[0];
            const hazard = (currentState.manualHazards || []).find(h => h.id === hId);
            if (hazard) hazardName = hazard.hazardName;
        } else {
            const parts = mKey.split('-m-');
            if (parts.length >= 2) {
                const hazardHash = parts[0].split('-').pop();
                const risk = currentState.risks.find(r => getHash(r.위험요인) === hazardHash);
                if (risk) hazardName = risk.위험요인;
            }
        }

        return {
            hazard: hazardName,
            improvement_measure: result.note || "현장 즉시 개선 권고",
            improvement_date: new Date().toLocaleDateString('ko-KR')
        };
    });

    const payload = {
        worker: workerNames,
        department: currentState.selectedDept,
        task: currentState.selectedTask,
        step: currentState.selectedStep,
        logs: logs,
        improvement_plan: improvementPlan, 
        overall_improvement: document.getElementById('overall-improvement')?.value || "",
        photo: currentState.photoBase64 || "",
        signature: typeof signaturePad !== 'undefined' && !signaturePad.isEmpty() ? signaturePad.toDataURL() : ""
    };
    try {
        // [v30.1] 즉각적인 성공 화면 전환 (UX 개선)
        switchPhase('step-success');
        if (window.lucide) window.lucide.createIcons();

        // [배경 처리] 구글 시트로 데이터 전송
        fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }
        }).then(() => {
            console.log("✅ 데이터 전송 완료 (백그라운드)");
            const draftKey = `KOMIPO_DRAFT_${currentState.selectedDept}_${currentState.selectedTask}`;
            localStorage.removeItem(draftKey);
        }).catch(err => {
            console.warn("⚠️ 전송 실패, 대기열 저장:", err);
            queueSubmission(payload);
        });

    } catch (error) {
        console.error("❌ 제출 처리 중 오류:", error);
        if (typeof showToast === 'function') showToast("❌ 제출 중 오류가 발생했습니다.");
        if (overlay) overlay.classList.remove('active');
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

// --- 결과 조회 시스템 (카드형 UI 엔진) ---

// --- 결과 조회 시스템 (카드형 UI 엔진 v25.4) ---

async function openResultsView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        const p = overlay.querySelector('p');
        if (p) p.innerText = "최신 기록을 불러오는 중...";
        overlay.classList.add('active');
    }
    
    try {
        const response = await fetchGViz("위험성평가실시");
        const drafts = typeof loadDrafts === 'function' ? loadDrafts() : []; 
        
        let allLogs = [];
        if (Array.isArray(response)) allLogs = [...response];
        
        currentState.allLogs = [...drafts, ...allLogs];
        
        switchPhase('step-results');
        renderResultDeptCards();
    } catch (error) {
        console.error("Result Load Error:", error);
        showToast("⚠️ 데이터 로드 실패. 네트워크 상태를 확인하세요.");
    } finally {
        if(overlay) overlay.classList.remove('active');
    }
}

function renderResultDeptCards() {
    const container = document.getElementById('result-selection-container');
    const breadcrumb = document.getElementById('result-breadcrumb');
    const detailViewer = document.getElementById('result-detail-viewer');
    const emptyState = document.getElementById('results-empty-state');
    const statusText = document.getElementById('result-status-text');

    if (!container) return;

    // Reset View
    container.style.display = 'grid';
    if(breadcrumb) breadcrumb.style.display = 'none';
    if(detailViewer) detailViewer.style.display = 'none';
    if(emptyState) emptyState.style.display = 'none';
    if(statusText) statusText.innerText = "최근 점검 기록을 부서별로 조회합니다.";

    const depts = [...new Set(currentState.allLogs.map(log => log.부서명 || log.소속 || "미지정"))].filter(d => d).sort();

    if (depts.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center; color:#94a3b8;">조회 가능한 기록이 없습니다.</div>';
        return;
    }

    container.innerHTML = depts.map(dept => `
        <div class="dept-banner-card" onclick="selectResultDept('${dept}')">
            <div class="dbc-icon" style="background:#eff6ff; color:#3b82f6;"><i data-lucide="building-2"></i></div>
            <div class="dbc-text">
                <div class="title">${dept}</div>
                <div class="desc">점검 기록 존재</div>
            </div>
            <i data-lucide="chevron-right" class="dbc-arrow" style="color:#cbd5e1;"></i>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

function selectResultDept(dept) {
    currentState.currentResultDept = dept;
    const container = document.getElementById('result-selection-container');
    const breadcrumb = document.getElementById('result-breadcrumb');
    const bDept = document.getElementById('breadcrumb-dept');
    const statusText = document.getElementById('result-status-text');

    if(breadcrumb) breadcrumb.style.display = 'flex';
    if(bDept) {
        bDept.style.display = 'inline';
        bDept.innerText = ` > ${dept}`;
    }
    if(statusText) statusText.innerText = `[${dept}] 부서의 점검 리스트입니다.`;

    const filteredLogs = currentState.allLogs.filter(log => (log.부서명 || log.소속) === dept);
    
    // 이 부서의 작업들을 그룹화 (날짜 + 작업명 + 점검자 기준)
    const taskGroups = {};
    filteredLogs.forEach(log => {
        const date = log.일시 ? new Date(log.일시).toLocaleDateString() : "날짜미상";
        const worker = log.점검자 || log.평가자 || "미지정";
        const key = `${date}|${log.작업명 || "내용 없음"}|${worker}`;
        if (!taskGroups[key]) taskGroups[key] = [];
        taskGroups[key].push(log);
    });

    if (Object.keys(taskGroups).length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center; color:#94a3b8;">작업 기록이 없습니다.</div>';
        return;
    }

    container.innerHTML = Object.keys(taskGroups).map(key => {
        const [date, task, worker] = key.split('|');
        const logs = taskGroups[key];
        const isDraft = logs.some(l => l.isDraft);
        const safeKey = key.replace(/'/g, "\\'");
        
        return `
            <div class="history-item" onclick="showResultDetailByGroup('${safeKey}')">
                <div class="hi-header">
                    <div class="hi-badge" style="${isDraft ? 'background:#fff1f2; color:#e11d48;' : ''}">${isDraft ? "작성 중" : "제출 완료"}</div>
                    <div style="font-size:0.75rem; color:#94a3b8; font-weight:700;">${date}</div>
                </div>
                <div class="hi-title">${task}</div>
                <div class="hi-footer">
                    <i data-lucide="user" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i>
                    <span>점검자: ${worker}</span>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    window.scrollTo(0, 0);
}

function showResultDetailByGroup(groupKey) {
    const [date, task, worker] = groupKey.split('|');
    const filtered = currentState.allLogs.filter(log => {
        const logDate = log.일시 ? new Date(log.일시).toLocaleDateString() : "날짜미상";
        const logWorker = log.점검자 || log.평가자 || "미지정";
        return (log.부서명 || log.소속) === currentState.currentResultDept && 
               log.작업명 === task && 
               logWorker === worker &&
               logDate === date;
    });

    if (filtered.length === 0) {
        showToast("❌ 데이터를 찾을 수 없습니다.");
        return;
    }

    document.getElementById('result-selection-container').style.display = 'none';
    document.getElementById('result-detail-viewer').style.display = 'block';
    document.getElementById('result-status-text').innerText = "상세 점검 보고서";

    // "목록으로" 버튼 기능 연결
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            document.getElementById('result-selection-container').style.display = 'grid';
            document.getElementById('result-detail-viewer').style.display = 'none';
            document.getElementById('result-status-text').innerText = `[${currentState.currentResultDept}] 부서의 점검 리스트입니다.`;
        };
    }

    renderDetailedCardReport(filtered, 'pdf-content-area', false);
    window.scrollTo(0, 0);
}




// [CORE] 통합 고도화 렌더링 엔진 (v25.0)
function renderDetailedCardReport(logs, containerId, isPreview = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">데이터가 없습니다.</div>';
        return;
    }

    const first = logs[0];
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    // 단계별(Step Name)로 로그 그룹화
    const groupedLogs = logs.reduce((acc, log) => {
        const step = log.작업단계 || "점검 단계";
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
                ${isPreview ? "위험성평가 결과 미리보기" : "위험성평가 결과 보고서"}
            </h1>
            <div style="margin-top: 10px; font-size: 0.85rem; color: #64748b; font-weight: 500;">
                ${isPreview ? "제출 전 내용을 최종 확인해 주세요." : "본 보고서는 시스템을 통해 전송된 실시간 점검 기록입니다."}
            </div>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 20px; border: 1.5px solid #e2e8f0; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">부서명:</span> <span style="color: #1e293b; font-weight: 800;">${first.부서명 || first.소속 || "미지정"}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">작업명:</span> <span style="color: #1e293b; font-weight: 800;">${first.작업명 || "내용 없음"}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">점검자:</span> <span style="color: #1e293b; font-weight: 800;">${first.점검자 || first.평가자 || "미지정"}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">${isPreview ? '평가일자' : '조회일시'}:</span> <span style="color: #1e293b; font-weight: 800;">${isPreview ? today : (first.일시 ? new Date(first.일시).toLocaleDateString() : today)}</span></div>
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
                            const curScore = parseInt(l.현재_위험도 || l.현재위험도) || 0;
                            const resScore = parseInt(l.잔류_위험도 || l.잔류위험도) || 0;

                            return `
                            <div style="background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
                                <div style="background: #f8fafc; padding: 12px 18px; border-bottom: 1.5px solid #f1f5f9; font-weight: 800; color: #475569; font-size: 0.9rem;">
                                    <span style="color: var(--doing-blue);">항목 ${lIdx + 1}.</span> ${l.위험요인 || "내용 없음"}
                                </div>
                                
                                <div style="padding: 18px; display: flex; flex-direction: column; gap: 15px;">
                                    <!-- Section 1: 현재 안전조치 -->
                                    <div style="border-bottom: 1px dashed #f1f5f9; padding-bottom: 12px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div style="font-weight: 850; color: #64748b; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                                                <i data-lucide="shield-check" style="width:14px;"></i> 현재 안전조치
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size:0.6rem; padding:2px 6px; background:#f1f5f9; border-radius:6px; color:#475569; font-weight:800;">빈 ${l.현재_빈도 || 1}</span>
                                                <span style="font-size:0.6rem; padding:2px 6px; background:#f1f5f9; border-radius:6px; color:#475569; font-weight:800;">강 ${l.현재_강도 || 1}</span>
                                                ${getReportScoreBadge(curScore)}
                                            </div>
                                        </div>
                                        <div style="font-size: 0.92rem; color: #1e293b; line-height: 1.6; white-space: pre-line; font-weight: 600; padding-left: 2px;">${l.현재안전조치 || "없음"}</div>
                                    </div>

                                    <!-- Section 2: 개선대책 -->
                                    <div style="background: #f0fdf4; padding: 14px; border-radius: 16px; border: 1.5px solid #dcfce7;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div style="font-weight: 850; color: #059669; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                                                <i data-lucide="wrench" style="width:14px;"></i> 추가 개선대책
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size:0.6rem; padding:2px 6px; background:white; border-radius:6px; color:#059669; font-weight:800; border:1px solid #bbf7d0;">빈 ${l.잔류_빈도 || 1}</span>
                                                <span style="font-size:0.6rem; padding:2px 6px; background:white; border-radius:6px; color:#059669; font-weight:800; border:1px solid #bbf7d0;">강 ${l.잔류_강도 || 1}</span>
                                                ${getReportScoreBadge(resScore)}
                                            </div>
                                        </div>
                                        <div style="font-size: 0.92rem; color: #166534; line-height: 1.6; white-space: pre-line; font-weight: 700; padding-left: 2px;">${l.개선대책 || "없음"}</div>
                                    </div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        </div>


        <div style="margin-top: 50px; text-align: center; border-top: 2px solid #f1f5f9; padding-top: 30px;">
            <div style="font-weight: 900; font-size: 1.5rem; color: #1e293b; letter-spacing: 5px; margin-bottom: 5px;">한국중부발전(주)</div>
            <p style="color: #94a3b8; font-size: 0.8rem; font-weight: 700;">KOMIPO SMART SAFETY SYSTEM</p>
        </div>
    `;

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

function exportResultToPDF() {
    // 1. 현재 화면에서 실제 리포트 내용이 담긴 영역 지능형 감지
    let element = document.getElementById('pdf-content-area');
    if (!element || element.offsetHeight < 50 || document.getElementById('result-detail-viewer').style.display === 'none') {
        element = document.getElementById('preview-results-area');
    }
    
    if (!element || element.offsetHeight < 50) {
        showToast("⚠️ 출력할 데이터가 준비되지 않았습니다.");
        return;
    }

    // 2. 카카오톡 인앱 브라우저 여부 확인 (핵심 v26.8)
    const ua = navigator.userAgent.toUpperCase();
    const isKakao = ua.indexOf('KAKAOTALK') > -1;
    const isMobile = /IPHONE|IPAD|IPOD|ANDROID/i.test(ua);

    // 3. 파일명 생성 로직
    const dept = (currentState.selectedDept || currentState.currentResultDept || "DEP").trim();
    const task = (currentState.selectedTask || "TASK").trim();
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const safeName = `KOMIPO_${dateStr}_${dept}_${task}`.replace(/[<>:"/\\|?* \.()]/g, '_');
    const finalFileName = `${safeName}.pdf`;

    // [v26.9] 단순화된 통합 PDF 로직 (카톡 전용 로직 제거)
    let downloadSuccess = false;
    const triggerPrint = () => {
        if (!downloadSuccess) {
            showToast("🖨️ 인쇄 미리보기에서 [PDF로 저장]을 선택하실 수 있습니다.");
            setTimeout(() => window.print(), 500);
        }
    };

    const fallbackTimer = setTimeout(triggerPrint, 4500);

    const opt = {
        margin: 10,
        filename: finalFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 1.5, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    showToast("📄 PDF 보고서를 직접 생성 중입니다...");

    try {
        if (typeof html2pdf === 'undefined') {
            clearTimeout(fallbackTimer);
            triggerPrint();
            return;
        }

        html2pdf().set(opt).from(element).toPdf().get('pdf').output('blob').then((pdfBlob) => {
            downloadSuccess = true;
            clearTimeout(fallbackTimer);
            
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = finalFileName;
            document.body.appendChild(a);
            
            a.click();
            
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                if (document.body.contains(a)) document.body.removeChild(a);
                showToast("✅ PDF 다운로드가 시작되었습니다!");
            }, 1000);
        }).catch(err => {
            console.error("PDF Library Error:", err);
            clearTimeout(fallbackTimer);
            triggerPrint();
        });
    } catch (e) {
        console.error("PDF System Error:", e);
        clearTimeout(fallbackTimer);
        triggerPrint();
    }
}



