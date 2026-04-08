function updateDate(){const n=new Date();const d=n.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"});const t=n.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});const e=document.getElementById("current-date");if(e)e.innerText=`${d} ${t}`}
console.log("%c🚀 KOMIPO Smart Safety System v34.0.4-LAYOUT_FIX Loaded", "color: #3b82f6; font-weight: bold; font-size: 1.2rem;");
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
    const indicator = document.getElementById('status-indicator'); // [v34.0.5] 올바른 ID 매핑
    if (!indicator) return;

    if (isOnline) {
        indicator.className = 'status-indicator online';
        indicator.querySelector('#status-text').textContent = message || '실시간 ON';
    } else {
        indicator.className = 'status-indicator offline';
        indicator.querySelector('#status-text').textContent = message || '오프라인';
    }
}

// [v34.0.5] 전송 대기 뱃지 업데이트 엔진 (사용 안함)
function updateSyncBadge() {
    // UI 뱃지는 표시하지 않고 조용히 백그라운드 처리만 수행합니다.
}

// 1. 데이터 보안 우회(CORS) 및 정제 유틸리티
function cleanValue(val) {
    if (typeof val !== 'string') return val;
    return val.replace(/\[cite: \d+\]/g, '').trim(); 
}

function smartSplit(text) {
    if (!text || typeof text !== 'string') return [text];
    // [v34.0.1] 지능형 분할: 문장 시작이나 공백 뒤에 오는 리스트 마커만 분할 (숫자 범위 보호)
    const items = text.split(/(?<=\s|^)(?=[0-9]+\.|[0-9]+\)|[①-⑳]|\([0-9]+\)|(?:\n|^)[-*••])/)
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

// --- [v34.0.30] 임시 저장 및 복원 시스템 (경량화 버전) ---
function saveDraft() {
    if (!currentState.selectedDept || !currentState.selectedTask) return;
    const key = `KOMIPO_DRAFT_${currentState.selectedDept}_${currentState.selectedTask}`;
    
    try {
        // [v34.0.30] 초경량화: currentState 전체가 아닌 실제 사용자 입력값만 선별하여 저장 (90% 이상 용량 절감)
        const draftData = {
            selectedDept: currentState.selectedDept,
            selectedTask: currentState.selectedTask,
            selectedWorkers: currentState.selectedWorkers,
            selectedStep: currentState.selectedStep,
            checkedItems: Array.from(currentState.checkedItems),
            checkedMeasures: Array.from(currentState.checkedMeasures),
            improvedMeasures: Array.from(currentState.improvedMeasures),
            manualNotes: currentState.manualNotes,
            riskMatrixData: currentState.riskMatrixData,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(draftData));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn("⚠️ LocalStorage 가득 참: 오래된 기록 자동 정리 모드 가동");
            // 오래된 드래프트 하나를 지우고 다시 시도 (안정성 확보)
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('KOMIPO_DRAFT_')) {
                    localStorage.removeItem(k);
                    break;
                }
            }
        } else {
            console.error("Draft save error:", e);
        }
    }
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
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
        
        window[callbackName] = (data) => {
            delete window[callbackName];
            const script = document.getElementById(callbackName);
            if (script) script.remove();

            if (data.status === 'error') {
                reject(new Error(data.errors[0].detailed_message));
                return;
            }

            const cols = data.table.cols.map((c, i) => (c.label || "").trim() || `col_${i}`);
            const rows = data.table.rows.map(row => {
                let obj = {};
                row.c.forEach((cell, i) => {
                    const key = cols[i];
                    if (key) {
                        const val = cell ? (cell.v !== null ? cell.v : "") : "";
                        obj[key] = val;
                        // [v34.0.23] 순서 기반 대체 키 제공 (A=0, B=1, ...)
                        obj[`idx_${i}`] = val;
                    }
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

// [v34.1.8] 서명판 스크롤 보호 해제 및 활성화 로직
function activateSignature(type) {
    const overlayId = type === 'final' ? 'signature-overlay-final' : 'signature-overlay-tbm';
    const overlay = document.getElementById(overlayId);
    if (!overlay) return;

    // 부드럽게 사라지는 효과
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        
        // 서명판이 가려져 있었다면 리사이징 강제 유도 (좌표 어긋남 방지)
        const canvasId = type === 'final' ? 'signature-pad' : 'tbm-signature-pad';
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
        }
        
        showToast("✍️ 서명 모드가 활성화되었습니다. (화면 고정)");
    }, 200);
}

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
    if (targetId === 'dashboard' || targetId === 'step-history' || targetId === 'step-choice' || targetId === 'step-results' || targetId === 'step-tbm' || targetId === 'step-success') {
        if (stepper) stepper.style.display = 'none';
        currentState.currentStep = 0;
    } else {
        if (stepper) {
            stepper.style.display = 'block';
            const contextBanner = document.getElementById('context-banner');
            if (contextBanner) {
                // targetId가 step-1이면 작업/부서를 고르는 곳이므로 배너를 감춥니다
                if (targetId === 'step-1') {
                    contextBanner.style.display = 'none';
                } else {
                    contextBanner.style.display = 'flex';
                    document.getElementById('context-dept').textContent = currentState.selectedDept || '알 수 없음';
                    document.getElementById('context-task').textContent = currentState.selectedTask || '작업 선택 안됨';
                }
            }
        }
        
        saveDraft(); // 단계 전환 시 자동 저장 활성화
        const stepNum = parseInt(targetId.replace('step-', ''));
        if (!isNaN(stepNum)) {
            currentState.currentStep = stepNum;
            updateStepperUI(stepNum);
            
            // [v34.1.2] 2단계(위험성 평가)로 복귀 시 목록 및 하단 버튼 자동 복구 렌더링
            if (targetId === 'step-2') {
                renderRiskChecklist(currentState.selectedStep);
            }
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
    const workerCard = document.getElementById('worker-input-card-wrap');
    
    if (container) {
        container.style.display = 'flex';
        container.classList.add('selection-banner-list');
    }
    if (workerCard) workerCard.style.display = 'none';

    if (header) {
        header.querySelector('h2').innerText = "부서 선택";
        header.querySelector('p').innerText = "소속 부서를 선택하세요.";
    }
    if (confirmArea) confirmArea.style.display = 'none';
    if (homeBtn) {
        homeBtn.innerHTML = '<button class="btn btn-secondary" onclick="handleStep1Back()">이전단계</button>';
        homeBtn.style.display = 'flex';
    }

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
                <link rel="stylesheet" href="style.css?v=33.8.0">
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
    
    const rawTasks = [...new Set(currentState.risks.filter(r => (r.부서명 || '').trim() === dept.trim()).map(r => r.작업명))];
    const tasks = rawTasks.filter(Boolean).sort(); // 가나다 순 정렬 확정
    
    // [v33.8.0-PRO] 1열 그리드로 변경하여 가독성 극대화 (카드형)
    container.innerHTML = `
        <div class="compact-task-grid">
            ${tasks.map(task => `
                <div class="compact-task-item" onclick="selectAssessmentTask('${task}')">
                    <div class="title">${task}</div>
                    <i data-lucide="chevron-right"></i>
                </div>
            `).join('')}
        </div>
    `;
    
    // 아이콘이 없으므로 lucide 호출은 생략 가능하나 안정성을 위해 유지
    if (window.lucide) window.lucide.createIcons();
}

function selectAssessmentTask(task) {
    currentState.selectedTask = (task || "").trim(); // [v34.0.18] 유령 문자 원천 차단
    console.log(`Selected Task: ${currentState.selectedTask}`);
    
    // [v34.0.5] 이전 상태 및 기존 평가자 자동 복원 (State Hydration)
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
        homeBtn.innerHTML = `
            <button class="btn btn-secondary" onclick="handleStep1Back()">이전단계</button>
            <button class="btn btn-primary" onclick="nextStep(2)">다음단계</button>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

// [v34.0.5] 기존 점검 기록 기반 상태 자동 복원 로직
function hydrateStateFromLogs(task) {
    // 1. 기존 선택 초기화 (안전장치)
    currentState.checkedItems.clear();
    currentState.checkedMeasures.clear();
    currentState.improvedMeasures.clear();
    currentState.riskMatrixData = {};
    currentState.manualNotes = {};
    currentState.selectedWorkers = [];

    const { selectedDept, allLogs } = currentState;
    if (!allLogs || allLogs.length === 0) return;

    // 현재 부서/작업에 해당하는 로그 필터 및 최신순 정렬
    const taskLogs = allLogs.filter(l => 
        (l.부서명 || l.소속) === selectedDept && 
        (l.작업명 || l.task_name || l.task) === task
    ).sort((a, b) => new Date(b.일시 || b.timestamp || 0) - new Date(a.일시 || a.timestamp || 0));

    if (taskLogs.length === 0) return; // 히스토리 없음

    // 가장 최신 세션(마지막으로 전송된 그룹)의 시간 추출 및 필터
    const latestTime = taskLogs[0].일시 || taskLogs[0].timestamp;
    const latestLogs = taskLogs.filter(l => (l.일시 || l.timestamp) === latestTime);

    // [평가자 복원]
    const workerStr = latestLogs[0].점검자 || latestLogs[0].worker || latestLogs[0].평가자 || "";
    if (workerStr && workerStr !== "미지정") {
        const workers = workerStr.split(',').map(s => s.trim()).filter(Boolean);
        workers.forEach(w => {
            if (!currentState.selectedWorkers.includes(w)) {
                currentState.selectedWorkers.push(w);
            }
        });
        updateSelectedWorkersUI();
    }

    // [위험성평가 상태 복원]
    latestLogs.forEach(log => {
        const hazardHash = getHash((log.위험요인 || log.hazard || "").trim());
        const stepName = (log.작업단계 || log.step_name || "").trim();
        const stepHash = getHash(stepName);
        const taskHash = getHash(task || "");
        const key = `${taskHash}-${stepHash}-${hazardHash}`;

        // 마스터 데이터(risks)에 해당하는 요인이 존재하는지 찾기
        const matchRisk = currentState.risks.find(r => 
            getHash((r.위험요인||"").trim()) === hazardHash && 
            getHash((r.작업단계||"").trim()) === stepHash && 
            getHash((r.작업명||"").trim()) === taskHash
        );

        if (matchRisk) {
            currentState.checkedItems.add(key);

            // 매트릭스 수치 복원
            currentState.riskMatrixData[key] = {
                current: {
                    severity: parseInt(log.현재_강도 || log.current_severity) || 1,
                    frequency: parseInt(log.현재_빈도 || log.current_frequency) || 1,
                    score: parseInt(log.현재_위험도 || log.current_score) || 1
                },
                residual: {
                    severity: parseInt(log.잔류_강도 || log.residual_severity) || 1,
                    frequency: parseInt(log.잔류_빈도 || log.residual_frequency) || 1,
                    score: parseInt(log.잔류_위험도 || log.residual_score) || 1
                }
            };

            // 조치 이력 추출
            const cmStr = log.현재안전조치 || log.current_measures || log.current_checked || "";
            const imStr = log.개선대책 || log.improvements_checked || log.improved_checked || "";

            const cmList = cmStr.split('\n').map(m => m.replace(/\[이행\]\s?/g, '').trim()).filter(Boolean);
            const imList = imStr.split('\n').map(m => m.replace(/\[개선\]\s?/g, '').trim()).filter(Boolean);

            const standardCurrent = Array.isArray(matchRisk.current_measures) ? matchRisk.current_measures : [];
            const standardImprove = Array.isArray(matchRisk.improvement_measures) ? matchRisk.improvement_measures : [];

            const cmManual = [];
            cmList.forEach(m => {
                const idx = standardCurrent.findIndex(sm => sm.trim() === m);
                if (idx !== -1) {
                    currentState.checkedMeasures.add(`${key}-m-${idx}`);
                } else if (m !== "이상 없음" && m !== "없음" && m !== "추가 개선사항 없음") {
                    cmManual.push(m);
                }
            });

            const imManual = [];
            imList.forEach(m => {
                const idx = standardImprove.findIndex(sm => sm.trim() === m);
                if (idx !== -1) {
                    currentState.improvedMeasures.add(`${key}-im-${idx}`);
                } else if (m !== "이상 없음" && m !== "없음" && m !== "추가 개선사항 없음") {
                    imManual.push(m);
                }
            });

            if (cmManual.length > 0 || imManual.length > 0) {
                currentState.manualNotes[key] = {
                    current: cmManual.join('\n'),
                    improvement: imManual.join('\n')
                };
            }
        }
    });

    console.log(`[Hydration] 상태 복원 완료. (점검자: ${currentState.selectedWorkers.length}명, 복원 항목: ${currentState.checkedItems.size}건)`);
}

// [NEW] 1단계(부서/작업 선택) 이전단계 스마트 핸들러
function handleStep1Back() {
    const workerCard = document.getElementById('worker-input-card-wrap');
    
    if (workerCard && workerCard.style.display === 'block') {
        currentState.selectedTask = null;
        workerCard.style.display = 'none';
        
        const container = document.getElementById('selection-container');
        if (container) container.style.display = 'block';
        
        const header = document.getElementById('step1-header');
        if (header) {
            header.querySelector('h2').innerText = "작업명 선택";
            header.querySelector('p').innerText = "수행 중인 작업을 선택하세요.";
        }
        
        const homeBtn = document.getElementById('step1-home-btn');
        if (homeBtn) {
            homeBtn.style.display = 'block';
            homeBtn.innerHTML = `<button class="btn btn-secondary" onclick="handleStep1Back()">이전단계</button>`;
        }
    } else if (currentState.selectedDept) {
        // 부서가 선택된 상태(즉, 작업명 선택 화면)라면 부서 선택 화면으로 되돌아감
        currentState.selectedDept = null;
        currentState.selectedTask = null;
        const header = document.getElementById('step1-header');
        if (header) {
            header.querySelector('h2').innerText = "부서 선택";
            header.querySelector('p').innerText = "소속 부서를 선택하세요.";
        }
        renderDeptBanners();
    } else {
        // 부서 선택 화면이라면 이전 페이즈(업무 선택)로 이동
        switchPhase('step-choice');
    }
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
        listContainer.innerHTML = `
            <div style="padding: 4rem 2rem; text-align: center; color: #94a3b8; background: white; border-radius: 30px; border: 2px dashed #f1f5f9;">
                <i data-lucide="database-zap" style="width: 60px; height: 60px; margin-bottom: 1.5rem; opacity: 0.3;"></i>
                <div style="font-weight: 900; font-size: 1.2rem; color: #1e293b; margin-bottom: 10px;">조회된 평가 기록이 없습니다</div>
                <p style="font-size: 0.9rem; line-height: 1.6; margin-bottom: 2rem;">최근에 수행된 위험성평가 내역이 구글 시트에 존재하지 않거나 현재 불러오는 중입니다.</p>
                <button class="btn btn-primary" onclick="fetchInitialData(true)" style="width: 100%; height: 56px; border-radius: 18px;">
                    <i data-lucide="refresh-cw"></i> 최신 정보로 시트 동기화
                </button>
            </div>
        `;
        initLucide();
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

// [NEW] 현재 점검 중인 데이터를 보고서 형식으로 변환하는 함수 (v34.0.1)
function preparePreviewData() {
    const logMap = new Map(); // [v34.2.0] Grouping by Hazard Name to prevent duplicates
    const workerNames = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : currentState.selectedWorker || "미지정";
    
    const taskHash = getHash(currentState.selectedTask || "");

    // 1. 표준 위험요인 처리
    currentState.risks.forEach(risk => {
        if ((risk.작업명||"").trim() !== (currentState.selectedTask||"").trim()) return;

        const hazardHash = getHash((risk.위험요인 || "").trim());
        const stepName = (risk.작업단계 || "").trim();
        const stepHash = getHash(stepName);
        const key = `${taskHash}-${stepHash}-${hazardHash}`;
        
        // [v34.1.7] riskMatrixData의 존재 여부와 상관없이 '체크박스'로 선택된 항목만 보고서에 포함
        if (currentState.checkedItems.has(key)) {
            // [v34.2.1-ULTRA] 수치 유실 원천 차단: 상태값에 없으면 마스터 데이터(한글 헤더)에서 직접 복구
            const riskData = currentState.riskMatrixData[key] || { 
                current: { 
                    severity: parseInt(r.현재_강도 || r.현재강도 || r.current_severity || 1), 
                    frequency: parseInt(r.현재_빈도 || r.현재빈도 || r.current_frequency || 1), 
                    score: (parseInt(r.현재_강도 || r.현재강도 || r.current_severity || 1)) * (parseInt(r.현재_빈도 || r.현재빈도 || r.current_frequency || 1))
                },
                residual: { 
                    severity: parseInt(r.잔류_강도 || r.잔류강도 || r.residual_severity || 1), 
                    frequency: parseInt(r.잔류_빈도 || r.잔류빈도 || r.residual_frequency || 1), 
                    score: (parseInt(r.잔류_강도 || r.잔류강도 || r.residual_severity || 1)) * (parseInt(r.잔류_빈도 || r.잔류빈도 || r.residual_frequency || 1))
                }
            };
            
            const standardCurrent = risk.current_measures || [];
            const standardImprove = risk.improvement_measures || [];
            
            // 현재 안전조치 추출
            const currentMeasures = [];
            standardCurrent.forEach((m, idx) => {
                if (currentState.checkedMeasures.has(`${key}-m-${idx}`)) currentMeasures.push(m.trim());
            });
            if (currentState.manualHazardItems[key]?.current) {
                currentState.manualHazardItems[key].current.forEach((m, idx) => {
                    if (currentState.checkedMeasures.has(`${key}-mc-${idx}`)) currentMeasures.push(m.trim());
                });
            }
            if (currentState.manualNotes[key]?.current) currentMeasures.push(`${currentState.manualNotes[key].current}`);

            // 개선대책 추출 (폴백 로직 포함)
            const improveMeasures = [];
            currentState.improvedMeasures.forEach(mKey => {
                if (mKey.startsWith(`${key}-im-`)) {
                    const idx = parseInt(mKey.split('-im-')[1]);
                    if (!isNaN(idx)) {
                        let text = (standardImprove[idx] && standardImprove[idx].trim() !== "" && standardImprove[idx] !== "추가 개선사항 없음") 
                                   ? standardImprove[idx].trim() 
                                   : (standardCurrent[idx] ? standardCurrent[idx].trim() : null);
                        if (text && !improveMeasures.includes(text)) improveMeasures.push(text);
                    }
                }
            });
            // 수동 개선대책
            if (currentState.manualHazardItems[key]?.improve) {
                currentState.manualHazardItems[key].improve.forEach((m, idx) => {
                    if (currentState.improvedMeasures.has(`${key}-mi-${idx}`)) improveMeasures.push(m.trim());
                });
            }
            if (currentState.manualNotes[key]?.improvement) improveMeasures.push(`${currentState.manualNotes[key].improvement}`);

            const hazardName = risk.위험요인;
            if (!logMap.has(hazardName)) {
                logMap.set(hazardName, {
                    부서명: currentState.selectedDept,
                    작업명: currentState.selectedTask,
                    점검자: workerNames,
                    작업단계: stepName,
                    위험요인: hazardName,
                    currentMeasuresSet: new Set(currentMeasures),
                    improveMeasuresSet: new Set(improveMeasures),
                    current_frequency: riskData.current.frequency,
                    current_severity: riskData.current.severity,
                    current_score: riskData.current.score,
                    residual_frequency: riskData.residual.frequency,
                    residual_severity: riskData.residual.severity,
                    residual_score: riskData.residual.score
                });
            } else {
                // 기존 데이터에 조치사항 병합
                const existing = logMap.get(hazardName);
                currentMeasures.forEach(m => existing.currentMeasuresSet.add(m));
                improveMeasures.forEach(m => existing.improveMeasuresSet.add(m));
                // 위험도는 가장 높은 값을 유지
                if (riskData.current.score > existing.current_score) {
                    existing.current_frequency = riskData.current.frequency;
                    existing.current_severity = riskData.current.severity;
                    existing.current_score = riskData.current.score;
                }
                if (riskData.residual.score > existing.residual_score) {
                    existing.residual_frequency = riskData.residual.frequency;
                    existing.residual_severity = riskData.residual.severity;
                    existing.residual_score = riskData.residual.score;
                }
                if (!existing.작업단계.includes(stepName)) existing.작업단계 += `, ${stepName}`;
            }
        }
    });

    // 2. 수동 추가 위험요인 처리
    if (currentState.manualHazards) {
        currentState.manualHazards.forEach(hazard => {
            const key = hazard.id;
            const riskData = currentState.riskMatrixData[key] || { 
                current: { frequency: 1, severity: 1, score: 1 }, 
                residual: { frequency: 1, severity: 1, score: 1 } 
            };
            
            const currentMeasures = (currentState.manualHazardItems[key]?.current || []).filter((_, idx) => currentState.checkedMeasures.has(`${key}-mc-${idx}`));
            const improveMeasures = (currentState.manualHazardItems[key]?.improve || []).filter((_, idx) => currentState.improvedMeasures.has(`${key}-mi-${idx}`));
            
            const hazardName = hazard.hazardName;
            if (!logMap.has(hazardName)) {
                logMap.set(hazardName, {
                    부서명: currentState.selectedDept,
                    작업명: currentState.selectedTask,
                    점검자: workerNames,
                    작업단계: hazard.stepName,
                    위험요인: hazardName,
                    currentMeasuresSet: new Set(currentMeasures),
                    improveMeasuresSet: new Set(improveMeasures),
                    current_frequency: riskData.current.frequency || 1,
                    current_severity: riskData.current.severity || 1,
                    current_score: riskData.current.score || 1,
                    residual_frequency: riskData.residual.frequency || 1,
                    residual_severity: riskData.residual.severity || 1,
                    residual_score: riskData.residual.score || 1
                });
            } else {
                const existing = logMap.get(hazardName);
                currentMeasures.forEach(m => existing.currentMeasuresSet.add(m));
                improveMeasures.forEach(m => existing.improveMeasuresSet.add(m));
            }
        });
    }

    // Map을 최종 로그 배열로 변환
    const logs = Array.from(logMap.values()).map(l => ({
        ...l,
        현재안전조치: l.currentMeasuresSet.size > 0 ? Array.from(l.currentMeasuresSet).join('\n') : "이상 없음",
        개선대책: l.improveMeasuresSet.size > 0 ? Array.from(l.improveMeasuresSet).join('\n') : 
                  (l.residual_score < l.current_score ? "작업 전 위험요인 공유 및 안전수칙 준수 여부 확인" : "추가 개선사항 없음")
    }));

    console.log(`✅ [v34.2.0-ULTRA] 데이터 집약 및 중복 제거 완료 (${logs.length}건)`);
    return logs;
}

function nextStep(step) {
    if (step === 2) {
        // [v34.2.5-ULTRA] 1단계 -> 2단계 이동 시 평가자 유효성 검사 보강
        const hasSelectedWorkers = currentState.selectedWorkers && currentState.selectedWorkers.length > 0;
        const currentInputValue = (document.getElementById('worker-input')?.value || "").trim();

        if (!hasSelectedWorkers && currentInputValue === "") {
            showToast("⚠️ 평가자 성명을 먼저 입력하거나 선택해 주세요.");
            const input = document.getElementById('worker-input');
            if (input) {
                input.focus();
                input.style.boxShadow = "0 0 0 4px rgba(244, 63, 94, 0.2)";
                setTimeout(() => input.style.boxShadow = "", 2000);
            }
            return;
        }

        // 입력창에만 이름이 있는 경우 자동 태그 추가
        if (currentInputValue !== "" && !currentState.selectedWorkers.includes(currentInputValue)) {
            currentState.selectedWorkers.push(currentInputValue);
        }

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
        // [v34.2.4-ULTRA] 점검자 성명 유효성 검사 (태그 리스트 포함)
        const hasSelectedWorkers = currentState.selectedWorkers && currentState.selectedWorkers.length > 0;
        const currentInputValue = (document.getElementById('worker-input')?.value || "").trim();
        
        if (!hasSelectedWorkers && currentInputValue === "") {
            showToast("⚠️ 점검자 성명을 먼저 입력해 주세요. (화면 최상단)");
            const input = document.getElementById('worker-input');
            if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.style.boxShadow = "0 0 0 4px rgba(244, 63, 94, 0.2)"; 
                setTimeout(() => input.style.boxShadow = "", 2000);
            }
            return;
        }

        // 입력창에만 이름이 있고 태그 추가를 안 한 경우, 자동으로 추가해주고 진행
        if (currentInputValue !== "" && !currentState.selectedWorkers.includes(currentInputValue)) {
            currentState.selectedWorkers.push(currentInputValue);
            if (typeof updateSelectedWorkersUI === 'function') updateSelectedWorkersUI();
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

function handleStep2Back() {
    switchPhase('step-1');
}

function prevStep() {
    if (currentState.currentStepIndex > 0) {
        currentState.currentStepIndex--;
        currentState.selectedStep = currentState.availableSteps[currentState.currentStepIndex];
        renderRiskChecklist(currentState.selectedStep);
        window.scrollTo({top: 0, behavior: 'smooth'});
    } else {
        // 첫 번째 단계에서 이전 기능은 처음으로(대시보드) 이동 대신 작업 선택으로 이동
        handleStep2Back();
    }
}

function prevStepFallback(step) {
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

// [v33.6.1] 구형 브라우저 및 GAS 보안 통로용 JSONP 엔진 (CORS 우회 필살기)
function fetchJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            delete window[callbackName];
            script.remove();
            reject(new Error('네트워크 응답 시간 초과'));
        }, 15000);

        window[callbackName] = (data) => {
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            resolve(data);
        };

        const separator = url.indexOf('?') >= 0 ? '&' : '?';
        script.src = `${url}${separator}callback=${callbackName}&_t=${Date.now()}`;
        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
            reject(new Error('통신 실패'));
        };
        document.body.appendChild(script);
    });
}

async function fetchInitialData() {
    console.log("🚀 [v34.0.4-LAYOUT_FIX] 하이브리드 동기화 가동...");
    updateNetworkStatus(false, '동기화 중');

    try {
        // [v33.6] 1단계: 초고속 GViz 엔진(JSONP) 선제 시도
        try {
            console.log("⚡ [Fast-Path] GViz 엔진 시도 중...");
            const [riskData, userData, logsData] = await Promise.all([
                fetchGViz(MASTER_SHEET),
                fetchGViz("평가자명단"),
                fetchGViz("위험성평가실시")
            ]);
            
            processRiskData(riskData);
            processUserData(userData);
            if (logsData && Array.isArray(logsData)) currentState.allLogs = logsData;
            
            finalizeSync("✅ [Hyper] 구글 엔진 직통 동기화 완료");
            return; 

        } catch (gvizError) {
            console.warn("🛡️ [Fallback] 보안 통로(GAS-JSONP)로 전환합니다:", gvizError.message);
            
            // [v33.6.1] 2단계: 보안 GAS 엔진(Legacy Path) 최적화 호출
            // fetch() 대신 CORS 이슈 없는 fetchJSONP 사용으로 100% 수신 보장
            const [riskData, userData, logsData] = await Promise.all([
                fetchJSONP(GAS_URL + "?type=master"),
                fetchJSONP(GAS_URL + "?type=users"),
                fetchJSONP(GAS_URL + "?type=logs")
            ]);

            processRiskData(riskData);
            processUserData(userData);
            if (logsData && Array.isArray(logsData)) currentState.allLogs = logsData;
            
            finalizeSync("✅ [Standard] 보안 앱스 서버 동기화 완료");
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
        // [v33.7.1-ULTIMATE] 지능형 헤더 탐색기 (Intelligence Header Mapping)
        const getV = (obj, keys) => {
            // 1. 직접 매칭 (가장 빠름)
            for(let k of keys) if(obj[k] !== undefined) return obj[k];
            
            // 2. 공격적인 정규식 매칭 (공백, 언더바, 특수문자 제거 후 부분 일치 포함)
            const norm = s => String(s).replace(/[\s\_\-\[\]\(\)]/g, '').toLowerCase();
            const normKeys = keys.map(norm);
            
            for(let key in obj) {
                const nKey = norm(key);
                for(let nk of normKeys) {
                    // 키값이 포함되어 있거나(startsWith/includes) 정규화된 값이 일치하면 인정
                    if(nKey.includes(nk) || nk.includes(nKey)) return obj[key];
                }
            }
            return "";
        };

        const cleanedHazard = cleanValue(getV(item, ["위험요인", "hazard"]) || "");
        const currentMeasuresStr = cleanValue(getV(item, ["현재안전조치", "현재안전조치_이행내역", "현재안전조치_내용", "current_measures", "현재_안전조치"]) || "");
        const improvementMeasuresStr = cleanValue(getV(item, ["개선대책", "개선대책_이행내역", "개선대책_내용", "improvement_measures", "개선_대책", "개선대책내용"]) || "");
        
        const hazards = smartSplit(cleanedHazard);
        const currentMeasures = smartSplit(currentMeasuresStr);
        const improvementMeasures = smartSplit(improvementMeasuresStr);
        
        hazards.forEach(h => {
            allRisks.push({
                부서명: cleanValue(getV(item, ["부서명", "dept"]) || "미지정"),
                작업명: cleanValue(getV(item, ["작업명", "task"]) || "미정의 작업"),
                작업단계: cleanValue(getV(item, ["작업단계", "step"]) || "미정의 단계"),
                위험요인: h,
                current_measures: currentMeasures,
                improvement_measures: improvementMeasures,
                current_frequency: getV(item, ["현재_빈도", "current_frequency"]) || 1,
                current_severity: getV(item, ["현재_강도", "current_severity"]) || 1,
                current_score: getV(item, ["현재_위험도", "current_score"]) || 1,
                residual_frequency: getV(item, ["개선후_빈도", "잔류_빈도", "residual_frequency"]) || 1,
                residual_severity: getV(item, ["개선후_강도", "잔류_강도", "residual_severity"]) || 1,
                residual_score: getV(item, ["개선후_위험도", "잔류_위험도", "residual_score"]) || 1
            });
        });
    });

    // [v33.9.1] 고유 위험요인 필터링 (중복 방지) - 초고속 유니크 엔진
    const uniqueRisks = [];
    const riskSeen = new Set();
    allRisks.forEach(r => {
        // [v34.0.0] 데이터 원본 중복 제거 시에도 공백 완전 제거 키 사용
        const k = `${(r.부서명||"").replace(/\s/g, '')}-${(r.작업명||"").replace(/\s/g, '')}-${(r.작업단계||"").replace(/\s/g, '')}-${(r.위험요인||"").replace(/\s/g, '')}`;
        if (!riskSeen.has(k)) {
            riskSeen.add(k);
            uniqueRisks.push(r);
        }
    });

    currentState.risks = uniqueRisks;
    localStorage.setItem('kosha_cached_risks', JSON.stringify(uniqueRisks));
    console.log(`✅ [v33.9.1] 고유 위험요인 ${uniqueRisks.length}건 동기화 완료 (중복 ${allRisks.length - uniqueRisks.length}건 제거)`);
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
    updateSyncBadge(); // [v34.0.5] 앱 진입/로딩 완료 시점 대기열 뱃지 UI 최신화
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
        
        // [v34.1.6] 화면에 렌더링되는 속성들을 즉시 상태(currentState)로 고정하여, 
        // 나중에 빈도만 바꿨을 때 강도가 1로 리셋되는 현상을 원천 차단
        if (!currentState.riskMatrixData[key]) {
            currentState.riskMatrixData[key] = { 
                current: { 
                    severity: parseInt(r.현재_강도 || r.현재강도 || r.current_severity || 1), 
                    frequency: parseInt(r.현재_빈도 || r.현재빈도 || r.current_frequency || 1), 
                    score: (parseInt(r.현재_강도 || r.현재강도 || r.current_severity || 1)) * (parseInt(r.현재_빈도 || r.현재빈도 || r.current_frequency || 1))
                },
                residual: { 
                    severity: parseInt(r.잔류_강도 || r.잔류강도 || r.residual_severity || 1), 
                    frequency: parseInt(r.잔류_빈도 || r.잔류빈도 || r.residual_frequency || 1), 
                    score: (parseInt(r.잔류_강도 || r.잔류강도 || r.residual_severity || 1)) * (parseInt(r.잔류_빈도 || r.잔류빈도 || r.residual_frequency || 1))
                }
            };
        }
        const riskData = currentState.riskMatrixData[key];
        
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
                            ${(r.current_measures || []).map((m, mi) => {
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
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'frequency', this.value)"
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: #94a3b8; font-size: 0.8rem;">×</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'current', 'severity', this.value)" 
                                        style="background: white; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
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
                            ${(() => {
                                const currentMeasures = r.current_measures || [];
                                const improvementMeasures = r.improvement_measures || [];
                                // 두 리스트 중 더 긴 것을 기준으로 순회 (보통 1:1 매칭)
                                const maxLen = Math.max(currentMeasures.length, improvementMeasures.length);
                                let hasVisibleImprovement = false;
                                
                                const listHTML = Array.from({length: maxLen}).map((_, mi) => {
                                    const cKey = `${key}-m-${mi}`;
                                    const mKey = `${key}-im-${mi}`;
                                    // [핵심] 현재안전조치가 체크되어 있다면 개선대책에서 숨김 (복구)
                                    if (currentState.checkedMeasures.has(cKey)) return '';
                                    
                                    // 개선대책 문구 결정: 지정된 대책이 없으면 현재 대책 문구를 폴백으로 사용
                                    const mText = (improvementMeasures[mi] && improvementMeasures[mi].trim() !== "") 
                                        ? improvementMeasures[mi] 
                                        : currentMeasures[mi];
                                        
                                    if (!mText || mText.trim() === "") return '';
                                    
                                    hasVisibleImprovement = true;
                                    const isMImproved = currentState.improvedMeasures.has(mKey);

                                    return `
                                        <li class="measure-item ${isMImproved ? 'improved' : ''}" 
                                            onclick="toggleMeasureByHash('${mKey}', 'improve', '${stepName.replace(/'/g, "\\'")}', event)"
                                            style="transition: all 0.3s ease; cursor: pointer; border-radius: 12px; margin-bottom: 8px; border: 1px solid #fecaca; background: #fff5f5; padding: 12px 14px; display: flex; align-items: center; gap: 10px;">
                                            <div class="m-checkbox ${isMImproved ? 'active-improve' : ''}">
                                                <i data-lucide="check"></i>
                                            </div>
                                            <span style="flex: 1; font-size: 1.05rem; font-weight: 800; color: #b91c1c;">${mText}</span>
                                        </li>
                                    `;
                                }).join('');

                                return hasVisibleImprovement ? listHTML : `<li style="text-align:center; padding:15px; color:#94a3b8; font-size:0.85rem; background:#f8fafc; border-radius:12px; border:1px dashed #e2e8f0;">✅ 모든 조치가 이행 중이거나 추가 대책이 필요 없습니다.</li>`;
                            })()}
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
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'frequency', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4); font-size: 0.8rem;">×</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName}', 'residual', 'severity', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
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
                                
                                // [복구] 수동 개선대책도 현재안전조치가 체크되면 숨김
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
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName.replace(/'/g, "\\'")}', 'residual', 'severity', this.value)"
                                        style="background: white; border: 1.5px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 4px 8px; font-weight: 700; cursor: pointer;">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                                <span style="font-weight: 900; color: rgba(244, 63, 94, 0.4);">×</span>
                                <select class="row-select" onchange="updateRiskScoreByHash('${key}', '${stepName.replace(/'/g, "\\'")}', 'residual', 'frequency', this.value)"
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
    
    // Auto-check parent hazard (정규식을 사용하여 모든 유형의 구분자 대응)
    const hazardKey = mKey.split(/-(?:m|im|mc|mi)-/)[0];
    if (!currentState.checkedItems.has(hazardKey)) {
        currentState.checkedItems.add(hazardKey);
    }

    renderRiskChecklist(stepName);
}

function updateRiskScoreByHash(key, stepName, matrixType, field, value) {
    if (!currentState.riskMatrixData[key]) {
        // [v34.2.2-ULTRA] 데이터 업데이트 시점에도 마스터 수치를 최우선 복구하여 '1'로 리셋되는 현상 방지
        const riskHash = key.split('-').pop();
        const r = currentState.risks.find(risk => getHash(risk.위험요인) === riskHash);

        if (r) {
            currentState.riskMatrixData[key] = { 
                current: { 
                    severity: parseInt(r.현재_강도 || r.현재강도 || r.current_severity || 1), 
                    frequency: parseInt(r.현재_빈도 || r.현재빈도 || r.current_frequency || 1), 
                    score: (parseInt(r.현재_강도 || r.현재강도 || r.current_severity || 1)) * (parseInt(r.현재_빈도 || r.현재빈도 || r.current_frequency || 1))
                },
                residual: { 
                    severity: parseInt(r.잔류_강도 || r.잔류강도 || r.residual_severity || 1), 
                    frequency: parseInt(r.잔류_빈도 || r.잔류빈도 || r.residual_frequency || 1), 
                    score: (parseInt(r.잔류_강도 || r.잔류강도 || r.residual_severity || 1)) * (parseInt(r.잔류_빈도 || r.잔류빈도 || r.residual_frequency || 1))
                }
            };
        } else {
            // 수동 추가 항목 등의 경우만 1로 시작
            currentState.riskMatrixData[key] = { 
                current: { severity: 1, frequency: 1, score: 1 },
                residual: { severity: 1, frequency: 1, score: 1 }
            };
        }
    }
    
    // 데이터 업데이트
    const val = parseInt(value);
    currentState.riskMatrixData[key][matrixType][field] = val;
    
    // [v34.1.5] 현재위험과 잔류위험의 자동 수치 동기화 로직 제거 (독립 입력 보장)
    
    // 각각의 최종 점수 재계산 (current & residual 둘 다 확실히 동기화)

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

    const isFirstStep = currentState.currentStepIndex === 0;
    const isLastStep = currentState.currentStepIndex === currentState.availableSteps.length - 1;
    
    const nextBtnText = isLastStep ? "평가 완료 <i data-lucide='check-check'></i>" : "다음단계 <i data-lucide='arrow-right'></i>";
    const totalSteps = currentState.availableSteps.length;
    const currentStepNum = currentState.currentStepIndex + 1;
    const nextStepDisplay = isLastStep ? currentStepNum : currentStepNum + 1;
    const progressText = `(${nextStepDisplay} / ${totalSteps} 단계)`;

    // [v34.1.1] 첫 단계여도 무조건 '이전단계'를 노출하여 선택 화면 복귀 보장
    const backAction = isFirstStep ? "handleStep2Back()" : "prevStep()";
    const backBtnText = "<i data-lucide='arrow-left'></i> 이전단계";

    container.innerHTML = `
        <div class="next-action-area active" style="margin-top:2rem; display: flex; flex-direction: column; gap: 12px; animation: fadeInUp 0.5s ease-out;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button class="btn" 
                        style="width:100%; border-radius:20px; padding:1.2rem; display:flex; align-items:center; justify-content:center; background:#f1f5f9; border:1.5px solid #e2e8f0; color:#475569; font-weight:800; font-family:'Outfit', sans-serif;" 
                        onclick="${backAction}">
                    ${backBtnText}
                </button>
                <button class="btn btn-primary" 
                        style="width:100%; border-radius:20px; padding:1.2rem; display:flex; align-items:center; justify-content:center; gap:10px; background: var(--doing-indigo); box-shadow: var(--shadow-md);" 
                        onclick="nextStep(3)">
                    <div style="display:flex; flex-direction:column; align-items:center; line-height:1.2;">
                        <span style="font-size:1rem;">${nextBtnText}</span>
                        <span style="font-size:0.7rem; opacity:0.8; font-weight:500;">${progressText}</span>
                    </div>
                </button>
            </div>
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
    const activeTask = (currentState.selectedTask || "").trim();
    const activeDept = (currentState.selectedDept || "").trim();
    const workerNames = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : currentState.selectedWorker || '';

    // [v34.0.20] 누락된 데이터 수집 명령 복구 (버튼 작동 불능 해결)
    const logs = preparePreviewData();

    // [v34.0.19] 데이터 불일치 원천 차단: 미리보기 logs가 작업명을 가지고 있으므로 이를 최우선으로 사용
    const taskNameFromLog = logs.length > 0 ? logs[0].작업명 : activeTask;

    if (!logs || logs.length === 0) {
        showToast("⚠️ 제출할 점검 항목이 없습니다.");
        if (overlay) overlay.classList.remove('active');
        return;
    }

    const formattedLogs = logs.map(l => {
        // [v34.2.3-ULTRA] 최종 전송 직전 보정 로직 (Double-Check)
        // 만약 값이 1이라면, 마스터 데이터에서 실제 값이 있는지 다시 한 번 뒤집니다.
        const riskHash = getHash(l.위험요인);
        const r = currentState.risks.find(risk => getHash(risk.위험요인) === riskHash);
        
        const f = parseInt(l.current_frequency || (r ? (r.현재_빈도 || r.현재강도 || r.current_frequency) : 1) || 1);
        const s = parseInt(l.current_severity || (r ? (r.현재_강도 || r.현재강도 || r.current_severity) : 1) || 1);
        const rf = parseInt(l.residual_frequency || (r ? (r.잔류_빈도 || r.잔류강도 || r.residual_frequency) : 1) || 1);
        const rs = parseInt(l.residual_severity || (r ? (r.잔류_강도 || r.잔류강도 || r.residual_severity) : 1) || 1);

        return {
            submission_id: Date.now(),
            부서명: activeDept,
            department: activeDept,
            작업명: l.작업명 || taskNameFromLog,
            step: l.작업단계 || l.step || "",
            hazard: l.위험요인 || l.hazard || "",
            current_measures: l.현재안전조치 || l.current_measures || "이상 없음",
            improvements_checked: l.개선대책 || l.improvements_checked || "추가 개선사항 없음",
            current_frequency: f,
            current_severity: s,
            current_score: f * s,
            residual_frequency: rf,
            residual_severity: rs,
            residual_score: rf * rs,
            timestamp: new Date().toLocaleString('ko-KR')
        };
    });

    console.log("🚀 [FINAL PAYLOAD CHECK]", formattedLogs);

    const improvementPlan = logs
        .filter(l => l.개선대책 && l.개선대책.trim() !== "" && l.개선대책 !== "추가 개선사항 없음")
        .map(l => ({
            submission_id: Date.now(),
            부서명: activeDept,
            department: activeDept,
            작업명: l.작업명 || taskNameFromLog,
            task: l.작업명 || taskNameFromLog,
            work_name: l.작업명 || taskNameFromLog,
            category: l.작업명 || taskNameFromLog,
            hazard: l.위험요인,
            improvement_measure: l.개선대책,
            improvement_date: new Date().toLocaleDateString('ko-KR'),
            timestamp: new Date().toLocaleString('ko-KR')
        }));

    const payload = {
        submission_id: Date.now(),
        // [v34.0.19] 최상단 레이어에서도 부서명-작업명 밀착 배치
        부서명: activeDept,
        department: activeDept,
        소속: activeDept,
        작업명: taskNameFromLog,
        "작업명 ": taskNameFromLog,
        task: taskNameFromLog,
        task_name: taskNameFromLog,
        work_name: taskNameFromLog,
        job_name: taskNameFromLog,
        category: taskNameFromLog,
        worker: workerNames,
        점검자: workerNames,
        timestamp: new Date().toLocaleString('ko-KR'),
        logs: formattedLogs,
        improvement_plan: improvementPlan,
        overall_improvement: document.getElementById('overall-improvement')?.value || "",
        photo: currentState.photoBase64 || "",
        signature: typeof signaturePad !== 'undefined' && !signaturePad.isEmpty() ? signaturePad.toDataURL() : ""
    };

    try {
        switchPhase('step-success');
        document.getElementById('success-task-name').textContent = `[위험성평가] ${taskNameFromLog}`;
        if (window.lucide) window.lucide.createIcons();

        const finalUrl = `${GAS_URL}?worker=${encodeURIComponent(workerNames)}&department=${encodeURIComponent(activeDept)}&work_name=${encodeURIComponent(taskNameFromLog)}&task=${encodeURIComponent(taskNameFromLog)}&작업명=${encodeURIComponent(taskNameFromLog)}&timestamp=${Date.now()}`;

        // [배경 처리] 구글 시트로 데이터 전송
        fetch(finalUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }
        }).then(response => {
            console.log("✅ 데이터 전송 성공 (v34.0.17)");
            showToast("✅ 구글 시트 전송이 완료되었습니다."); 
            
            // [v34.0.10] 제출 성공 시 임시저장 데이터 삭제
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
    updateSyncBadge();
    showToast(`⚠️ 오프라인 모드: 연결이 복구되면 자동으로 전송됩니다. (${queue.length}건 대기)`);
}

async function syncPendingSubmissions() {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem('kosha_sync_queue') || '[]');
    if (queue.length === 0) {
        updateSyncBadge();
        return;
    }

    let successCount = 0;
    for (let i = 0; i < queue.length; i++) {
        try {
            await fetch(GAS_URL, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify(queue[i].payload),
                headers: { 'Content-Type': 'text/plain' }
            });
            successCount++;
            queue.splice(i, 1);
            i--;
        } catch (e) {
            console.error("Sync failed for item", queue[i]?.id);
            queue[i].retryCount++;
        }
    }
    localStorage.setItem('kosha_sync_queue', JSON.stringify(queue));
    updateSyncBadge();
    
    if (successCount > 0) {
        showToast(`✅ 보류되었던 ${successCount}건의 데이터가 구글시트로 전송 완료되었습니다.`);
    }
}

// [v34.0.5] 글로벌 네트워크 리스너 및 백그라운드 싱크 활성화
window.addEventListener('online', () => {
    updateNetworkStatus(true, "실시간 ON");
    showToast("🌐 네트워크 연결됨: 연동 큐 처리 시작");
    syncPendingSubmissions();
});
window.addEventListener('offline', () => {
    showToast("📡 네트워크 끊김: 오프라인 모드로 안전 전환");
});
// [v34.0.15] 중복 전송 방지를 위해 30초 자동 동기화 기능을 제거합니다.
// setInterval(syncPendingSubmissions, 30000); 

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
        // [v34.0.26] 하이브리드 보안 동기화: 고속 엔진(GViz) 시도 후 실패 시 보안 엔진(GAS-JSONP)으로 자동 전환
        let response = null;
        try {
            console.log("⚡ [Fast-Path] 결과 데이터 고속 로드 시도...");
            response = await fetchGViz("위험성평가실시");
        } catch (gvizError) {
            console.warn("🛡️ [Fallback] 보안 통로(GAS-JSONP)로 결과를 불러옵니다.");
            // [v34.0.26] 시트 보안 설정으로 막혔을 때 앱스 서버 보안 우회로를 즉시 개설
            response = await fetchJSONP(GAS_URL + "?type=logs");
        }
        
        if (response && Array.isArray(response)) {
            // [v34.0.26] 최신본으로 갱신 (헤더 무시 매핑은 renderResultDeptCards에서 자동 처리)
            currentState.allLogs = response;
            console.log(`✅ [Sync] Result records loaded: ${response.length}`);
        } else {
            currentState.allLogs = [];
        }
        
        switchPhase('step-results');
        renderResultDeptCards();
    } catch (error) {
        console.error("Result Load Error:", error);
        showToast("⚠️ 데이터 로드에 문제가 발생했습니다.");
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
    if(statusText) statusText.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <h1 style="color: var(--doing-blue); font-size: 1.8rem; font-weight: 900; letter-spacing: -1px; margin:0;">RECORDS</h1>
            <button class="btn-refresh" onclick="openResultsView()" style="display:flex; align-items:center; gap:6px; padding:8px 16px; font-size:13px; background:#eff6ff; color:#3b82f6; border:1px solid #bfdbfe; border-radius:12px; cursor:pointer; font-weight:600; transition:all 0.2s;">
                <i data-lucide="refresh-cw" style="width:16px; height:16px;"></i> 최신 정보로 갱신
            </button>
        </div>
    `;

    // [v34.0.24] 이름표나 순서에 관계없이, 행 데이터 중 부서명처럼 생긴 것을 자동 필터링 (가장 간단하고 확실한 방식)
    const depts = [];
    currentState.allLogs.forEach(log => {
        // [v34.0.24] 어떤 칸(Key)이든 '제주_'로 시작하거나, 부서명 키가 있는 것을 수집
        const values = Object.values(log);
        const deptVal = log.부서명 || log.idx_0 || log.idx_1 || values.find(v => typeof v === 'string' && v.includes('제주_'));
        if (deptVal && !depts.includes(deptVal)) depts.push(deptVal);
    });

    if (depts.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; padding:60px 20px; text-align:center;">
                <div style="font-size:48px; margin-bottom:20px;">🔍</div>
                <h3 style="color:#1e293b; margin-bottom:12px; font-weight:700;">조회 가능한 기록이 없습니다.</h3>
                <div style="font-size:14px; color:#64748b; line-height:1.6; max-width:280px; margin:0 auto;">
                    구글 시트에 데이터가 있는데 안 보인다면,<br>시트의 **'부서명'이 '제주_'로 시작**하는지 확인해 주세요.
                </div>
                <button onclick="openResultsView()" style="margin-top:24px; padding:12px 24px; background:var(--doing-blue); color:white; border:none; border-radius:12px; font-weight:600; cursor:pointer;">지금 다시 확인하기</button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = depts.sort().map(dept => `
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

    // [v34.0.24] 부서 필터링 (어떤 칸에 있든 해당 부서명이면 포함)
    const filteredLogs = currentState.allLogs.filter(log => Object.values(log).includes(dept));
    
    // 이 부서의 작업들을 그룹화 (날짜 + 작업명 + 점검자 기준)
    const taskGroups = {};
    filteredLogs.forEach(log => {
        // [v34.0.24] 각 행에서 날짜, 작업자, 작업명을 지능적으로 추출
        const values = Object.values(log);
        const date = log.일시 || log.idx_0 || (values.find(v => typeof v === 'string' && v.includes(':')) || "날짜미상");
        const worker = log.점검자 || log.idx_2 || log.idx_3 || "미지정";
        const taskName = log.작업명 || log.idx_1 || log.idx_2 || "내용 없음";
        
        const key = `${date}|${taskName}|${worker}`;
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
    
    // [v34.0.27] 상세 조회 시에도 목록 생성 시와 100% 동일한 유연한 매칭 로직 적용
    const filtered = currentState.allLogs.filter(log => {
        const values = Object.values(log);
        
        // 1. 부서 일치 확인
        const isDeptMatch = values.includes(currentState.currentResultDept);
        if (!isDeptMatch) return false;
        
        // 2. 행 데이터에서 날짜, 작업명, 점검자 재추출 (목록 생성 시와 동일한 규칙)
        const logDate = log.일시 || log.idx_0 || (values.find(v => typeof v === 'string' && v.includes(':')) || "날짜미상");
        const logWorker = log.점검자 || log.idx_2 || log.idx_3 || "미지정";
        const logTask = log.작업명 || log.idx_1 || log.idx_2 || "내용 없음";
        
        return logDate === date && logTask === task && logWorker === worker;
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
        const step = log.작업단계 || log.step_name || "점검 단계";
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
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">부서명:</span> <span style="color: #1e293b; font-weight: 800;">${first.부서명 || first.소속 || currentState.selectedDept || "미지정"}</span></div>
            <div><span style="color: #64748b; font-weight: 700; margin-right: 8px;">작업명:</span> <span style="color: #1e293b; font-weight: 800;">${first.작업명 || first.task_name || first.task || currentState.selectedTask || "내용 없음"}</span></div>
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
                            // [v34.0.28] 위험도 자동 계산 엔진: 시트 이름표가 틀려도 (빈도 x 강도)로 자동 산출
                            const curF = parseInt(l.현재_빈도 || l.current_frequency || 1) || 0;
                            const curS = parseInt(l.현재_강도 || l.current_severity || 1) || 0;
                            let curScore = parseInt(l.현재_위험도 || l.현재위험도 || l.위험도 || l.current_score || l.current_risk) || 0;
                            if (curScore === 0 && curF > 0 && curS > 0) curScore = curF * curS;

                            const resF = parseInt(l.잔류_빈도 || l.residual_frequency || 1) || 0;
                            const resS = parseInt(l.잔류_강도 || l.residual_severity || 1) || 0;
                            let resScore = parseInt(l.잔류_위험도 || l.잔류위험도 || l.위험도_1 || l.residual_score || l.residual_risk) || 0;
                            if (resScore === 0 && resF > 0 && resS > 0) resScore = resF * resS;

                            return `
                            <div style="background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
                                <div style="background: #f8fafc; padding: 12px 18px; border-bottom: 1.5px solid #f1f5f9; font-weight: 800; color: #475569; font-size: 0.9rem;">
                                    <span style="color: var(--doing-blue);">항목 ${lIdx + 1}.</span> ${l.위험요인 || l.hazard || "내용 없음"}
                                </div>
                                
                                <div style="padding: 18px; display: flex; flex-direction: column; gap: 15px;">
                                    <!-- Section 1: 현재 안전조치 -->
                                    <div style="border-bottom: 1px dashed #f1f5f9; padding-bottom: 12px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div style="font-weight: 850; color: #64748b; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                                                <i data-lucide="shield-check" style="width:14px;"></i> 현재 안전조치
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size:0.6rem; padding:2px 6px; background:#f1f5f9; border-radius:6px; color:#475569; font-weight:800;">빈 ${curF}</span>
                                                <span style="font-size:0.6rem; padding:2px 6px; background:#f1f5f9; border-radius:6px; color:#475569; font-weight:800;">강 ${curS}</span>
                                                ${getReportScoreBadge(curScore)}
                                            </div>
                                        </div>
                                        <div style="font-size: 0.92rem; color: #1e293b; line-height: 1.6; white-space: pre-line; font-weight: 600; padding-left: 2px;">${l.현재안전조치 || l.current_measures || l.current_checked || "이상 없음"}</div>
                                    </div>

                                    <!-- Section 2: 개선대책 -->
                                    <div style="background: #f0fdf4; padding: 14px; border-radius: 16px; border: 1.5px solid #dcfce7;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                            <div style="font-weight: 850; color: #059669; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                                                <i data-lucide="wrench" style="width:14px;"></i> 추가 개선대책
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size:0.6rem; padding:2px 6px; background:white; border-radius:6px; color:#059669; font-weight:800; border:1px solid #bbf7d0;">빈 ${resF}</span>
                                                <span style="font-size:0.6rem; padding:2px 6px; background:white; border-radius:6px; color:#059669; font-weight:800; border:1px solid #bbf7d0;">강 ${resS}</span>
                                                ${getReportScoreBadge(resScore)}
                                            </div>
                                        </div>
                                        <div style="font-size: 0.92rem; color: #166534; line-height: 1.6; white-space: pre-line; font-weight: 700; padding-left: 2px;">${l.개선대책 || l.improvements_checked || l.improvement_measures || "추가 개선사항 없음"}</div>
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



