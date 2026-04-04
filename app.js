/**
 * DOING-KOSHA Smart Safety System - 100% Master Data Sync (Clean Version)
 */

const currentState = {
    currentStep: 0,
    selectedWorkers: [], // [UPDATE] 다중 평가자 지원
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
    risks: [],      // Initialize to prevent TypeError
    expandedHazardKeys: new Set(), // [UPDATE] 여러 아코디언이 동시에 열릴 수 있도록 변경
    manualHazards: [], // [NEW] 수동 추가 위험요인
    manualHazardItems: {}, // [NEW] 수동 추가 위험요인의 개별 조치 항목들 { hazardId: { current: [], improve: [] } }
    improvementResults: {}, // [NEW] 개선 단계(Phase 3)의 개별 사진 및 결과 { measureId: { photo: null, note: "" } }
    allLogs: [] // [NEW] 전체 실시로그 데이터 (조회용)
};

const GAS_URL = "https://script.google.com/macros/s/AKfycbxXqNXF68HqVuTGaK8jX66Y2Exbdd3k3W2FEHhEs6EaQBAEHTO9R8ItBN__jFlRtwAtyg/exec"; // [FINAL] 사진 및 드라이브 연동 주소

// 1. 데이터 보안 우회(CORS) 및 정제 유틸리티
function cleanValue(val) {
    if (typeof val !== 'string') return val;
    // [cite: 41] 같은 인용구 제거 및 공백 정리
    return val.replace(/\[cite: \d+\]/g, '').trim(); 
}

function smartSplit(text) {
    if (!text || typeof text !== 'string') return [text];
    // 번호 패턴 정규식: 1., (1), ①, -, * 등을 감지하여 분리
    const items = text.split(/(?=[0-9]+\.|[0-9]+\)|[①-⑳]|\([0-9]+\)|(?:\n|^)[-*••])/)
        .map(item => item.replace(/^[0-9]+\.|^[0-9]+\)|^[①-⑳]|^\([0-9]+\)|^-|^\*|^\•|^\•/, '').trim())
        .filter(item => item.length > 0);
    return items.length > 0 ? items : [text.trim()];
}

// [NEW] 정규화된 문자열 기반 고유 해시 생성 (공백/특수문자 무시)
function getHash(str) {
    if (typeof str !== "string") return "0";
    // 한글, 영문, 숫자만 남기고 모두 제거 (정규화)
    const normalized = str.replace(/[^ㄱ-ㅎ|가-힣|a-z|A-Z|0-9]/g, ""); 
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
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

    // 초기 히스토리 상태 설정 (메인 화면)
    if (!history.state) {
        history.replaceState({ phase: 'dashboard' }, "", "");
    }

    // 브라우저/물리 뒤로가기 감지
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
    } else if (targetId.startsWith('step-')) {
        if (stepper) stepper.style.display = 'block';
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
    
    // 해당 부서의 작업 목록 추출
    const tasks = [...new Set(currentState.risks.filter(r => r.부서명 === dept).map(r => r.작업명))];
    
    container.innerHTML = tasks.map(task => `
        <div class="task-banner-card" onclick="selectAssessmentTask('${task}')">
            <div class="tbc-icon"><i data-lucide="activity"></i></div>
            <div class="tbc-text">
                <div class="title">${task}</div>
                <div class="desc">현재 작업명</div>
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
            { id: 101, department: "발전운영실", task: "수소 설비 점검", worker: "홍길동", timestamp: "2024-04-03 10:00:00", logs: [] },
            { id: 102, department: "주간전기팀", task: "변압기 점검", worker: "김철수", timestamp: "2024-04-03 14:30:00", logs: [] },
            { id: 103, department: "기계정비팀", task: "펌프 교체 작업", worker: "이영희", timestamp: "2024-04-02 09:15:00", logs: [] }
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
    title.innerText = "부서별 점검표 조회";
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
    const logs = data.logs || [];
    return `
        <div class="report-view-container">
            <!-- 요약 정보 카드 -->
            <div class="report-summary-card">
                <div class="summary-title">위험성평가 결과 보고서</div>
                <div class="summary-info-grid">
                    <div class="summary-label">부서명</div>
                    <div class="summary-value">${data.department}</div>
                    
                    <div class="summary-label">작업일시</div>
                    <div class="summary-value">${data.timestamp}</div>
                    
                    <div class="summary-label">작업명</div>
                    <div class="summary-value">${data.task}</div>
                    
                    <div class="summary-label">점검자</div>
                    <div class="summary-value">${data.worker} 님</div>
                </div>
            </div>

            <!-- 위험요인별 상세 카드 스택 -->
            ${logs.map((log, i) => `
                <div class="hazard-report-card">
                    <div class="hazard-card-header">
                        <h3><i data-lucide="alert-triangle" style="width:18px; color:#ff4757;"></i> 항목 ${i + 1}. ${log.hazard}</h3>
                    </div>
                    <div class="hazard-card-body">
                        <!-- 현재 상태 섹션 -->
                        <div class="hazard-section">
                            <div class="section-label"><i data-lucide="shield-check" style="width:14px;"></i> 현재 안전조치 이행내역</div>
                            <div class="section-content">${log.current_checked.replace(/\n/g, '<br>')}</div>
                            <div class="score-display-row">
                                <div class="score-item">
                                    <span class="score-label">현재 위험도:</span>
                                    ${getScoreBadge(log.current_score)}
                                    <span style="font-size:0.7rem; color:#94a3b8;">(강도 ${log.current_severity} × 빈도 ${log.current_frequency})</span>
                                </div>
                            </div>
                        </div>

                        <div style="border-top:1px dashed #e2e8f0; margin:1rem 0;"></div>

                        <!-- 개선 대책 섹션 -->
                        <div class="hazard-section">
                            <div class="section-label" style="color:#22c55e;"><i data-lucide="trending-up" style="width:14px;"></i> 개선대책 및 잔류 위험성</div>
                            <div class="section-content" style="background:#f0fdf4; border-left:4px solid #22c55e;">
                                ${log.improvements_checked ? log.improvements_checked.replace(/\n/g, '<br>') : '추가 개선사항 없음 (현재 조치 유지)'}
                            </div>
                            <div class="score-display-row">
                                <div class="score-item">
                                    <span class="score-label">잔류 위험도:</span>
                                    ${getScoreBadge(log.residual_score)}
                                    <span style="font-size:0.7rem; color:#94a3b8;">(강도 ${log.residual_severity} × 빈도 ${log.residual_frequency})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}

            <!-- 미디어 카드 섹션 -->
            <div class="report-media-section">
                <div class="media-card">
                    <h4><i data-lucide="camera" style="width:16px; vertical-align:middle; margin-right:4px;"></i> 현장 점검 사진</h4>
                    ${data.photo ? `<img src="${data.photo}" class="media-full-img">` : '<div class="section-content">등록된 사진이 없습니다.</div>'}
                </div>
                
                <div class="media-card">
                    <h4><i data-lucide="pen-tool" style="width:16px; vertical-align:middle; margin-right:4px;"></i> 점검자 서명</h4>
                    ${data.signature ? `<img src="${data.signature}" class="media-full-img" style="max-height:150px; background:#fff;">` : '<div class="section-content">서명이 등록되지 않았습니다.</div>'}
                </div>
            </div>
        </div>
    `;
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
    // 시트 로드 실패(CORS 등) 시에도 기본적으로 발전운영실이 나타나도록 조치
    currentState.users = [
        { 이름: "홍길동", 소속: "발전운영실", 직책: "과장", 경력: "10년" }
    ];
    
    currentState.risks = [
        { 
            부서명: "발전운영실", 
            작업명: "수소, 질소, 탄산 가스설비 점검", 
            작업단계: "작업준비", 
            위험요인: "데이터 로딩 대기 중...", 
            개선대책: ["인터넷 연결 및 구글 시트 권한을 확인하세요."] 
        }
    ];
    currentState.incidents = {};
}

async function fetchInitialData() {
    console.log("⏳ 구글 시트 데이터 실시간 동기화 시도 중...");
    
    // 1. 위험성_마스터 데이터 가져오기 (독립적 처리)
    try {
        const riskData = await fetchJSONP(GAS_URL);
        if (Array.isArray(riskData) && riskData.length > 0) {
            const allRisks = [];
            riskData.forEach(item => {
                const cleanedHazard = cleanValue(item.위험요인 || "내용 없음");
                const cleanedMeasures = cleanValue(item.현재안전조치_이행내역 || item.현재안전조치 || "");
                
                // 위험요인과 개선대책을 각각 번호순으로 분리
                const hazards = smartSplit(cleanedHazard);
                const measures = smartSplit(cleanedMeasures);
                
                // 위험요인별로 개별 점검 항목 생성
                hazards.forEach(h => {
                    allRisks.push({
                        부서명: cleanValue(item.부서명 || item.소속 || "미지정"),
                        작업명: cleanValue(item.작업명 || "미정의 작업"),
                        작업단계: cleanValue(item.작업단계 || "미정의 단계"),
                        위험요인: h,
                        개선대책: measures
                    });
                });
            });
            currentState.risks = allRisks;
            
            // [오프라인 지원] 로컬 스토리지에 백업 저장
            localStorage.setItem('kosha_cached_risks', JSON.stringify(allRisks));
            
            // 현재 화면이 Step 1(부서 선택)인 경우 UI 업데이트
            const container = document.getElementById('selection-container');
            if (container && container.offsetParent !== null) {
                renderDeptBanners();
            }
            
            console.log("✅ 실시간 위험성 마스터 로드 및 자동 분할 완료:", currentState.risks.length, "건");
        }
    } catch (error) {
        console.warn("⚠️ 위험성 데이터 로드 실패, 캐시된 데이터를 확인합니다:", error);
        const cached = localStorage.getItem('kosha_cached_risks');
        if (cached) {
            currentState.risks = JSON.parse(cached);
            console.log("📂 로컬 캐시 데이터 로드 완료:", currentState.risks.length, "건");
            renderDeptBanners();
            showToast("📡 오프라인 모드: 기존 점검 데이터를 사용합니다.");
        } else if (currentState.risks.length === 0) {
            loadMockData();
            renderDeptBanners();
        }
    }

    // 2. 사용자명단 데이터 가져오기 (독립적 처리)
    try {
        const userData = await fetchJSONP(GAS_URL + "?type=users");
        if (Array.isArray(userData) && userData.length > 0) {
            currentState.users = userData.map(u => ({
                이름: cleanValue(u.이름 || u.성명 || ""),
                소속: cleanValue(u.소속 || u.부서명 || ""),
                직책: cleanValue(u.직책 || ""),
                경력: cleanValue(u.경력 || "")
            }));
            localStorage.setItem('kosha_cached_users', JSON.stringify(currentState.users));
            renderWorkers();
            console.log("✅ 실시간 근로자 명단 로드 성공:", currentState.users.length, "건");
        }
    } catch (error) {
        const cachedUsers = localStorage.getItem('kosha_cached_users');
        if (cachedUsers) {
            currentState.users = JSON.parse(cachedUsers);
            renderWorkers();
        }
        console.warn("⚠️ 근로자 명단 로드 실패 (캐시 사용 시도)");
    }
    
    if (currentState.risks.length > 0 && navigator.onLine) {
        showToast("📱 구글 시트와 실시간 연결되었습니다.");
    }
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
                    <i data-lucide="check-circle-2" style="width:16px; color:#3b82f6;"></i>
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
        <div class="manual-input-area" style="background:white; border-radius:20px; padding:1.25rem; border:1px solid #f1f5f9; margin-bottom: 1.5rem;">
            <label class="ui-label" style="display:flex; align-items:center; gap:6px; font-weight: 900; font-size: 0.9rem;">
                <i data-lucide="message-square" style="width:16px;"></i> 종합 개선 조치 의견
            </label>
            <textarea id="overall-improvement" class="manual-textarea" style="min-height:100px; margin-top:10px; font-size: 0.9rem;" 
                      placeholder="현장 전체에 대한 종합적인 개선 의견을 입력하세요..." 
                      oninput="currentState.overallImprovement = this.value">${currentState.overallImprovement || ""}</textarea>
        </div>

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
            
            // Lucide 아이콘 재생성 및 부드러운 스크롤
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
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

    // 현재 단계의 모든 위험요인 가져오기 (이미 렌더링 시 필터링된 count 사용)
    const currentCheckedCount = Array.from(currentState.checkedItems).filter(key => 
        key.startsWith(`${getHash(currentState.selectedTask)}-${getHash(currentState.selectedStep)}`)
    ).length;
    
    // [개선] 모든 항목 체크 의무화 해제 및 이전/다음 유연한 네비게이션
    const isFirstStep = currentState.currentStepIndex === 0;
    const isLastStep = currentState.currentStepIndex === currentState.availableSteps.length - 1;
    
    const nextBtnText = isLastStep ? "평가 완료 <i data-lucide='check-check'></i>" : "다음단계 <i data-lucide='arrow-right'></i>";
    const prevBtnText = "<i data-lucide='arrow-left'></i> 이전단계";
    const totalSteps = currentState.availableSteps.length;
    const currentStepNum = currentState.currentStepIndex + 1;
    // 다음 단계 번호 표시 (마지막 단계가 아니면 +1, 마지막이면 현재 번호 유지)
    const nextStepDisplay = isLastStep ? currentStepNum : currentStepNum + 1;
    const progressText = `(${nextStepDisplay} / ${totalSteps} 단계)`;

    container.innerHTML = `
        <div class="next-action-area active" style="margin-top:2rem; display: flex; flex-direction: column; gap: 12px; animation: fadeInUp 0.5s ease-out;">
            <!-- 단계 이동 버튼 그룹 -->
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

            <!-- 처음으로 버튼 (대시보드) -->
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
    // 1단계 부서 선택 -> 작업 목록 팝업
    document.getElementById('task-select')?.addEventListener('change', (e) => {
        currentState.selectedDept = e.target.value;
        if (e.target.value) populateTasks(e.target.value);
    });

    // 1단계 작업명 선택 -> 초기화
    document.getElementById('step1-task-select')?.addEventListener('change', (e) => {
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
                    
                    // 최대 가로 크기 800px로 제한 (용량 최적화)
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
                    
                    // JPEG 형식으로 화질 0.5(50%) 압축 (최저 용량 지향)
                    const optimizedData = canvas.toDataURL('image/jpeg', 0.5);
                    
                    currentState.photoBase64 = optimizedData;
                    const preview = document.getElementById('photo-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${optimizedData}" style="width:100%; border-radius:20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">`;
                    }
                };
                img.src = f.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('clear-signature')?.addEventListener('click', () => signaturePad.clear());
}

async function submitLog() {
    const workerNames = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : '';
    if (!workerNames) { 
        showToast("⚠️ 평가자 성명을 1단계 상단에서 추가해 주세요."); 
        switchPhase('step-1');
        return; 
    }
    if (signaturePad.isEmpty()) { showToast("⚠️ 본인 서명이 필요합니다."); return; }
    
    const today = new Date().toLocaleDateString('ko-KR');
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay ? overlay.querySelector('p') : null;
    if (loadingText) loadingText.innerText = "데이터를 처리 중입니다...";
    if (overlay) overlay.classList.add('active');

    // 1. 실시로그용 데이터 생성
    const logs = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        if (parts.length < 3) return null;
        
        // 정규화된 해시를 사용하여 정확한 리스크 객체 찾기
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
        
        // [수정] 표준 현재안전조치 컬럼 참조 (기존엔 개선대책을 참조하여 undefined가 발생함)
        const currentMeasuresMaster = Array.isArray(r.현재안전조치) ? r.현재안전조치 : (r.현재안전조치 ? [r.현재안전조치] : []);
        const improvementMeasuresMaster = Array.isArray(r.개선대책) ? r.개선대책 : (r.개선대책 ? [r.개선대책] : []);
        
        // 체크된 현재안전조치 텍스트 추출
        const currentChecked = [...currentMeasuresMaster.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`)), mNotes.current]
            .filter(v => v && v.trim()).join('\n');
            
        // 체크된 개선대책 텍스트 추출
        const improvedList = [...improvementMeasuresMaster.filter((_, mi) => currentState.improvedMeasures.has(`${key}-m-${mi}`)), mNotes.improvement]
            .filter(v => v && v.trim()).join('\n');
            
        // [중요] 구글 시트 헤더 순서 및 필드명 최적화 (열 밀림 방지)
        return {
            department: currentState.selectedDept,
            task_name: currentState.selectedTask,
            step_name: r.작업단계 || currentState.selectedStep, // 개별 로그의 고유 단계명 유지
            hazard: r.위험요인,
            current_measures: currentChecked || currentMeasuresMaster.filter(v => v).join('\n'), // [수정] 미체크 시 마스터 내용 전체 기입
            improvements_checked: improvedList || "", // [수정] 미체크 시 빈칸 처리
            current_frequency: riskData.current.frequency,
            current_severity: riskData.current.severity,
            current_score: riskData.current.score,
            residual_frequency: riskData.residual.frequency,
            residual_severity: riskData.residual.severity,
            residual_score: riskData.residual.score
        };
    }).filter(Boolean);

    // 2. 개선대책 실행계획서용 데이터 생성
    const improvementPlan = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        const r = currentState.risks.find(risk => getHash(risk.작업명) === parts[0] && getHash(risk.작업단계) === parts[1] && getHash(risk.위험요인) === parts[2]);
        if (!r) return null;

        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        const riskData = currentState.riskMatrixData[key];
        const measuresMaster = Array.isArray(r.개선대책) ? r.개선대책 : [r.개선대책];
        
        // 개선이 필요한 항목인지 판단
        const currentMeasuresChecked = measuresMaster.filter((_, mi) => currentState.checkedMeasures.has(`${key}-m-${mi}`));
        const needsImprovement = mNotes.improvement.trim() !== "" || (riskData && riskData.current.score >= 9) || (currentMeasuresChecked.length < measuresMaster.length);
        if (!needsImprovement) return null;

        // 개선대책 텍스트 병합
        const improvements = [...measuresMaster.filter((_, mi) => !currentState.checkedMeasures.has(`${key}-m-${mi}`)), mNotes.improvement].filter(v => v && v.trim()).join('\n');
        
        // [사진 추출] 해당 위험요인(key)과 연결된 Phase 3의 사진들 중 첫 번째 것을 가져옴
        const itemPhotoKey = Array.from(currentState.improvedMeasures).find(mKey => mKey.startsWith(key));
        const itemPhoto = itemPhotoKey ? currentState.improvementResults[itemPhotoKey]?.photo : null;

        return { 
            department: currentState.selectedDept, 
            task_name: currentState.selectedTask, 
            hazard: r.위험요인, 
            improvement_measure: improvements || "현재 조치 완료 및 유지관리", 
            improvement_date: today, 
            manager: workerNames,
            photo: itemPhoto // 개별 사진 포함
        };
    }).filter(Boolean);

    const payload = {
        worker: workerNames,
        department: currentState.selectedDept,
        task: currentState.selectedTask,
        step: currentState.selectedStep,
        logs: logs,
        improvement_plan: improvementPlan,
        overall_improvement: document.getElementById('overall-improvement')?.value || "",
        photo: currentState.photoBase64,
        signature: signaturePad.toDataURL()
    };

    // [전략 변경] 오프라인 상태일 경우 즉시 큐에 저장
    if (!navigator.onLine) {
        queueSubmission(payload);
        overlay.classList.remove('active');
        showToast("📡 오프라인: 평가 내용이 기기에 저장되었습니다. (통신 연결 시 자동 전송)");
        saveToHistory(payload); // 히스토리는 오프라인에서도 저장
        setTimeout(() => location.reload(), 2000);
        return;
    }

    try {
        if (loadingText) loadingText.innerText = "데이터를 전송 중입니다...";
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }
        });

        saveToHistory(payload);
        setTimeout(() => {
            overlay.classList.remove('active');
            showToast("✅ 전송 완료되었습니다.");
            setTimeout(() => location.reload(), 2000);
        }, 1500);

    } catch (error) {
        console.warn("⚠️ 전송 실패 (오프라인 저장 시도):", error);
        queueSubmission(payload);
        saveToHistory(payload);
        overlay.classList.remove('active');
        showToast("📂 전송 오류로 내용을 로컬에 백업했습니다. (연결 시 자동 재시도)");
        setTimeout(() => location.reload(), 2500);
    }
}

// [NEW] 오프라인 전송 큐 관리
function queueSubmission(payload) {
    const queue = JSON.parse(localStorage.getItem('kosha_pending_queue') || '[]');
    queue.push({
        id: Date.now(),
        payload: payload
    });
    localStorage.setItem('kosha_pending_queue', JSON.stringify(queue));
    updateConnectionStatusUI();
}

// [NEW] 동기화 로직
async function syncPendingSubmissions() {
    const queue = JSON.parse(localStorage.getItem('kosha_pending_queue') || '[]');
    if (queue.length === 0 || !navigator.onLine) return;

    console.log(`📡 동기화 시작: ${queue.length}건 대기 중`);
    showToast(`🔄 연결 복구: 대기 중인 ${queue.length}건을 전송합니다...`);

    const newQueue = [];
    for (const item of queue) {
        try {
            await fetch(GAS_URL, {
                method: "POST",
                mode: "no-cors",
                body: JSON.stringify(item.payload),
                headers: { 'Content-Type': 'text/plain' }
            });
            console.log(`✅ 성공: ${item.id} 전송 완료`);
        } catch (e) {
            console.error(`❌ 실패: ${item.id} 전송 오류`, e);
            newQueue.push(item); // 실패한 건 다시 큐에 유지
        }
    }
    
    localStorage.setItem('kosha_pending_queue', JSON.stringify(newQueue));
    updateConnectionStatusUI();
    if (newQueue.length === 0) {
        showToast("✅ 모든 대기 데이터가 전송되었습니다.");
    }
}

// [NEW] 네트워크 상태 UI 업데이트
function updateConnectionStatusUI() {
    const isOnline = navigator.onLine;
    const queue = JSON.parse(localStorage.getItem('kosha_pending_queue') || '[]');
    const indicator = document.getElementById('network-indicator');
    if (!indicator) return;

    if (!isOnline) {
        indicator.innerHTML = `<span class="status-offline"><i data-lucide="wifi-off"></i> 오프라인</span>`;
    } else if (queue.length > 0) {
        indicator.innerHTML = `<span class="status-sync"><i data-lucide="refresh-cw"></i> 대기 ${queue.length}건</span>`;
    } else {
        indicator.innerHTML = `<span class="status-online"><i data-lucide="wifi"></i> 온라인</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
}

// 이벤트 리스너 등록
window.addEventListener('online', syncPendingSubmissions);
window.addEventListener('offline', updateConnectionStatusUI);
document.addEventListener('DOMContentLoaded', () => {
    // 5초마다 동기화 시도 (혹시 온라인 이벤트가 누락될 경우 대비)
    setInterval(syncPendingSubmissions, 10000);
    updateConnectionStatusUI();
});
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
// [NEW] 위험성평가 결과 조회 기능 (Phase: Results)
async function openResultsView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) overlay.classList.add('active');
    
    try {
        const response = await fetchJSONP(GAS_URL + "?type=logs");
        if (Array.isArray(response)) {
            currentState.allLogs = response;
            
            // 부서 목록 중복 제거 및 필터링
            const depts = [...new Set(response.map(log => log.부서명 || log.소속 || "미지정"))].filter(d => d);
            const deptSelect = document.getElementById('result-dept-select');
            if (deptSelect) {
                deptSelect.innerHTML = '<option value="">부서를 선택하세요</option>' + 
                    depts.map(d => `<option value="${d}">${d}</option>`).join('');
            }
            
            switchPhase('step-results');
            resetResultsView(); // 데이터 유실 방지 및 초기화
        } else {
            showToast("데이터 형식 오류: 로그를 불러올 수 없습니다.");
        }
    } catch (error) {
        console.error("로그 로드 실패:", error);
        showToast("⚠️ 실시간 로그 데이터를 불러오는데 실패했습니다.");
    } finally {
        if(overlay) overlay.classList.remove('active');
    }
}

function resetResultsView() {
    document.getElementById('result-search-form').style.display = 'block';
    document.getElementById('result-detail-viewer').style.display = 'none';
    document.getElementById('results-empty-state').style.display = 'block';
    document.getElementById('result-task-select').innerHTML = '<option value="">작업을 선택하세요</option>';
    document.getElementById('result-dept-select').value = "";
}

function updateResultTasks() {
    const selectedDept = document.getElementById('result-dept-select').value;
    const taskSelect = document.getElementById('result-task-select');
    if (!selectedDept || !taskSelect) return;
    
    const tasks = [...new Set(currentState.allLogs
        .filter(log => (log.부서명 || log.소속) === selectedDept)
        .map(log => log.작업명 || "제목 없음")
    )].filter(t => t);
    
    taskSelect.innerHTML = '<option value="">작업을 선택하세요</option>' + 
        tasks.map(t => `<option value="${t}">${t}</option>`).join('');
    
    document.getElementById('results-empty-state').style.display = 'block';
    document.getElementById('result-detail-viewer').style.display = 'none';
}

function showResultDetail() {
    const dept = document.getElementById('result-dept-select').value;
    const task = document.getElementById('result-task-select').value;
    if (!dept || !task) return;

    const filteredLogs = currentState.allLogs.filter(log => (log.부서명 || log.소속) === dept && log.작업명 === task);
    if (filteredLogs.length === 0) return;

    // UI 전환
    document.getElementById('result-search-form').style.display = 'none';
    document.getElementById('result-detail-viewer').style.display = 'block';
    document.getElementById('results-empty-state').style.display = 'none';
    
    renderReportToViewer(filteredLogs);
    initLucide();
}

function renderReportToViewer(logs) {
    const container = document.getElementById('pdf-content-area');
    if (!container) return;

    const first = logs[0];
    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    // HTML 보고서 템플릿 생성 (시트 헤더와 정확히 매핑: 점검자, 부서명, 작업명 등)
    let html = `
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 0.9rem; color: var(--doing-blue); font-weight: 800; margin-bottom: 8px;">KOSHA SMART SAFETY REPORT</div>
            <h1 style="font-size: 2.2rem; color: #1e293b; margin-bottom: 5px; font-weight: 900; letter-spacing: -1px;">위험성평가 실시 결과 보고서</h1>
            <p style="color: #64748b; font-size: 1rem;">본 보고서는 실시간 스마트 안전 점검 시스템을 통해 생성된 공식 문서입니다.</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 0.95rem; border: 2px solid #e2e8f0;">
            <tr>
                <th style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; width: 20%; text-align: center; color: #475569;">부서명</th>
                <td style="border: 1px solid #e2e8f0; padding: 14px; width: 30%; font-weight: 600;">${first.부서명 || first.소속 || "미지정"}</td>
                <th style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; width: 20%; text-align: center; color: #475569;">작업명</th>
                <td style="border: 1px solid #e2e8f0; padding: 14px; width: 30%; font-weight: 600;">${first.작업명 || "내용 없음"}</td>
            </tr>
            <tr>
                <th style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; text-align: center; color: #475569;">평가자(점검자)</th>
                <td style="border: 1px solid #e2e8f0; padding: 14px; font-weight: 600;">${first.점검자 || first.평가자 || "미지정"}</td>
                <th style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; text-align: center; color: #475569;">평가 일자</th>
                <td style="border: 1px solid #e2e8f0; padding: 14px; font-weight: 600;">${first.일시 ? new Date(first.일시).toLocaleDateString() : today}</td>
            </tr>
        </table>

        <h3 style="color: #0f172a; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; font-size: 1.25rem; font-weight: 800;">
            <span style="width: 6px; height: 22px; background: var(--doing-blue); display: inline-block; border-radius: 3px;"></span>
            상세 점검 요인 및 평가 결과
        </h3>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 40px; border: 1px solid #e2e8f0;">
            <thead>
                <tr style="background: #1e293b; color: white;">
                    <th style="border: 1px solid #334155; padding: 12px; width: 15%;">작업단계</th>
                    <th style="border: 1px solid #334155; padding: 12px; width: 20%;">위험요인</th>
                    <th style="border: 1px solid #334155; padding: 12px; width: 25%;">현재 안전조치</th>
                    <th style="border: 1px solid #334155; padding: 12px; width: 25%;">추가 개선대책</th>
                    <th style="border: 1px solid #334155; padding: 12px; width: 15%;">위험도<br>(현재/잔류)</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(l => `
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 12px; font-weight: 600; background: #fdfdfd;">${l.작업단계 || "-"}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 12px; color: #334155;">${l.위험요인 || "-"}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 0.75rem; white-space: pre-line;">${l.현재안전조치 || "이상 없음"}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 12px; font-size: 0.75rem; color: #b91c1c; white-space: pre-line;">${l.개선대책 || "-"}</td>
                        <td style="border: 1px solid #e2e8f0; padding: 12px; text-align: center;">
                            <div style="font-weight: 700; color: #64748b; font-size: 0.7rem;">${l.현재_위험도 || "-"}</div>
                            <div style="font-weight: 800; color: ${parseInt(l.잔류_위험도) >= 9 ? '#e11d48' : '#059669'}; font-size: 1.1rem; margin-top: 2px;">
                                ${l.잔류_위험도 || "-"}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 60px; text-align: center; border-top: 2px dashed #e2e8f0; padding-top: 30px;">
            <div style="font-weight: 900; font-size: 1.4rem; color: #1e293b; letter-spacing: 2px;">한국중부발전(주)</div>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 5px;">KOMIPO SMART SAFETY SYSTEM PORTAL</p>
        </div>
    `;
    
    container.innerHTML = html;
}

function exportResultToPDF() {
    const element = document.getElementById('pdf-content-area');
    const taskName = document.getElementById('result-task-select').value;
    
    if (!element || !taskName) return;

    const opt = {
        margin: 10,
        filename: `위험성평가_보고서_${taskName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    showToast("📄 PDF 보고서를 생성 중입니다...");
    html2pdf().set(opt).from(element).save().then(() => {
        showToast("✅ PDF 다운로드가 완료되었습니다.");
    });
}
