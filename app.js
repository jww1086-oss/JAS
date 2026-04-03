/**
 * DOING-KOSHA Smart Safety System - 100% Master Data Sync (Clean Version)
 */

const currentState = {
    currentStep: 0,
    selectedWorker: null,
    selectedDept: null,
    selectedTask: null,
    selectedStep: null,
    users: [],
    risks: [],
    incidents: {},
    checkedItems: new Set(),
    checkedMeasures: new Set(),
    improvedMeasures: new Set(),
    riskMatrixData: {},
    manualNotes: {}, // { "task-step-index": { current: "", improvement: "" } }
    photoBase64: null,
    signatureBase64: null
};

const GAS_URL = "https://script.google.com/macros/s/AKfycbxuLvc2ywLQri2vELWld5UcBYwdsNGXu_vN2NfYAl3fjYm5XSThOalrHckbSh0zFgODPg/exec";

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
    const targetPhase = document.getElementById(targetId);
    if (!targetPhase) return;

    // 히스토리 기록 (뒤로가기용)
    if (!skipHistory) {
        history.pushState({ phase: targetId }, "", targetId === 'dashboard' ? " " : "#" + targetId);
    }

    // Stepper & Step State
    const stepper = document.getElementById('stepper');
    if (targetId === 'dashboard') {
        if (stepper) stepper.style.display = 'none';
        currentState.currentStep = 0;
    } else {
        if (stepper) stepper.style.display = 'block';
        const stepNum = parseInt(targetId.replace('step-', ''));
        currentState.currentStep = stepNum;
        updateStepperUI(stepNum);
    }

    // 화면 페이즈 관리: 단 하나의 active만 존재하도록 강제
    document.querySelectorAll('.phase').forEach(p => {
        p.classList.remove('active');
        p.style.opacity = '0';
    });

    targetPhase.classList.add('active');
    setTimeout(() => {
        targetPhase.style.opacity = '1';
        targetPhase.style.transform = 'translateY(0)';
    }, 10);
    
    if (targetId !== 'dashboard') {
        initLucide();
    }
    window.scrollTo(0, 0); 
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
    switchPhase('step-1');
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

function renderHistoryList() {
    const container = document.getElementById('history-list-container');
    const detailArea = document.getElementById('history-detail-container');
    if (!container || !detailArea) return;

    // 초기 상태 리셋
    container.style.display = 'block';
    detailArea.style.display = 'none';

    const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    
    if (history.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem; color:#64748b;">
                <i data-lucide="info" style="width:40px; height:40px; margin-bottom:1rem; opacity:0.3;"></i>
                <p>제출된 내역이 없습니다.</p>
            </div>
        `;
        initLucide();
        return;
    }

    container.innerHTML = history.map((entry, index) => `
        <div class="history-item-card" onclick="showHistoryDetail(${index})">
            <div class="history-info">
                <span class="historical-date">${entry.timestamp}</span>
                <span class="historical-title">${entry.department} | ${entry.task}</span>
                <span class="historical-subtitle">점검자: ${entry.worker}</span>
            </div>
            <i data-lucide="chevron-right" class="history-arrow"></i>
        </div>
    `).join('');
    initLucide();
}

function showHistoryDetail(index) {
    const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    const entry = history[index];
    if (!entry) return;

    const listArea = document.getElementById('history-list-container');
    const detailArea = document.getElementById('history-detail-container');
    const content = document.getElementById('report-view-content');

    listArea.style.display = 'none';
    detailArea.style.display = 'block';
    
    content.innerHTML = generateReportHTML(entry);
    initLucide();
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
        const worker = document.getElementById('worker-input').value.trim();
        const dept = document.getElementById('task-select').value;
        if (!worker || !dept) {
            showToast("⚠️ 근로자와 부서명을 모두 선택하세요.");
            return;
        }
        currentState.selectedWorker = worker;
        currentState.selectedDept = dept;
        populateTasks(dept);
    }
    
    if (step === 3) {
        if (!currentState.selectedStep) {
            showToast("⚠️ 작업단계를 최종 선택하세요.");
            return;
        }
    }

    switchPhase(`step-${step}`);
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
            renderDepartmentList();
            console.log("✅ 실시간 위험성 마스터 로드 및 자동 분할 완료:", currentState.risks.length, "건");
        }
    } catch (error) {
        console.warn("⚠️ 위험성 데이터 로드 실패, 기본 데이터를 유지합니다:", error);
        if (currentState.risks.length === 0) loadMockData();
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
            renderWorkers();
            console.log("✅ 실시간 근로자 명단 로드 성공:", currentState.users.length, "건");
        }
    } catch (error) {
        console.warn("⚠️ 근로자 명단 로드 실패 (보안 차단 가능성)");
    }
    
    if (currentState.risks.length > 0) {
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
    setupCustomDropdown(
        'worker-input', 
        'worker-dropdown', 
        () => currentState.users.map(u => ({ 
            value: u.이름, 
            sub: `${u.소속} | ${u.직책}` 
        })),
        (val) => { currentState.selectedWorker = val; }
    );
}

function populateTasks(dept) {
    const taskArea = document.getElementById('task-selection-area');
    if (taskArea) taskArea.style.display = 'block';
    
    const deptTasks = [...new Set(currentState.risks.filter(r => r.부서명 === dept).map(r => r.작업명))];
    
    setupCustomDropdown(
        'step2-task-select', 
        'step2-task-dropdown', 
        () => deptTasks.map(t => ({ value: t })),
        (val) => {
            currentState.selectedTask = val;
            populateWorkSteps(val);
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
    const container = document.getElementById('risk-checklist');
    if (!container) return;
    
    const taskRisks = currentState.risks.filter(r => r.작업단계 === stepName && r.작업명 === currentState.selectedTask);
    
    container.innerHTML = taskRisks.map((r, i) => {
        const key = `${currentState.selectedTask}-${stepName}-${i}`;
        const isChecked = currentState.checkedItems.has(key);
        const notes = currentState.manualNotes[key] || { current: "", improvement: "" };
        
        // Initialize dual risk matrix data if not exist
        const riskData = currentState.riskMatrixData[key] || { 
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        
        const measures = Array.isArray(r.개선대책) ? r.개선대책 : [r.개선대책];
        
        return `
            <div class="check-item ${isChecked ? 'checked' : ''} ${isChecked ? 'expanded' : ''}" id="risk-${i}">
                <div class="check-item-header">
                    <div class="check-indicator" onclick="toggleRisk(${i}, '${stepName}')">
                        <i data-lucide="check"></i>
                    </div>
                    <span class="risk" onclick="toggleAccordion(${i})">${r.위험요인}</span>
                    <i data-lucide="chevron-down" class="expand-icon" onclick="toggleAccordion(${i})"></i>
                </div>

                <div class="measure-container">
                    <!-- Section 1: 현재안전조치 -->
                    <p style="font-size:0.8rem; font-weight:800; color:var(--doing-blue); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <i data-lucide="shield-check" style="width:14px;"></i> [현재안전조치]
                    </p>
                    <ul class="measure-list">
                        ${measures.map((m, mi) => {
                            const mKey = `${key}-m-${mi}`;
                            const isMChecked = currentState.checkedMeasures.has(mKey);
                            return `
                                <li class="${isMChecked ? 'checked' : ''}" onclick="toggleMeasure('${mKey}', 'current', event)">
                                    <div class="m-checkbox ${isMChecked ? 'active' : ''}">
                                        <i data-lucide="check"></i>
                                    </div>
                                    <span>${m}</span>
                                </li>
                            `;
                        }).join('')}
                    </ul>

                    <!-- Matrix 1: 현재 위험성 수준 평가 -->
                    <div class="risk-matrix-controls current-matrix">
                        <div class="manual-input-area">
                            <label class="manual-label"><i data-lucide="edit-3" style="width:14px;"></i> 현재 추가 안전조치 (수기 입력)</label>
                            <textarea class="manual-textarea" placeholder="기존 대책 외 추가된 현장 조치 내용을 입력하세요..." 
                                oninput="updateManualNote('${key}', 'current', this.value)">${notes.current || ""}</textarea>
                        </div>
                        
                        <p class="matrix-title" style="margin-top:20px;">현재 위험성 수준 평가</p>
                        <div class="matrix-row-unified">
                            <div class="row-item">
                                <span class="row-label">강도</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'current', 'severity', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">×</div>
                            <div class="row-item">
                                <span class="row-label">빈도</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'current', 'frequency', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.current.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">=</div>
                            <div class="row-result current">
                                <span class="row-label">위험도</span>
                                <span class="row-score ${getScoreClass(riskData.current.score)}">${riskData.current.score}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: 개선대책 및 잔류 위험성 -->
                    <p style="font-size:0.8rem; font-weight:800; color:var(--doing-accent); margin-top:24px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                        <i data-lucide="wrench" style="width:14px;"></i> [개선대책 및 잔류 위험도 점검]
                    </p>
                    
                    ${measures.some((_, mi) => !currentState.checkedMeasures.has(`${key}-m-${mi}`)) ? `
                        <ul class="measure-list improvement">
                            ${measures.map((m, mi) => {
                                const mKey = `${key}-m-${mi}`;
                                if (currentState.checkedMeasures.has(mKey)) return '';
                                const isMImproved = currentState.improvedMeasures.has(mKey);
                                return `
                                    <li class="${isMImproved ? 'improved' : ''}" onclick="toggleMeasure('${mKey}', 'improve', event)">
                                        <div class="m-checkbox ${isMImproved ? 'active-improve' : ''}">
                                            <i data-lucide="check"></i>
                                        </div>
                                        <span>${m}</span>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    ` : '<p style="font-size:0.75rem; color:#64748b; margin-bottom:12px; padding-left:4px;">현재 조치가 모두 완료되었습니다. 최종 위험도를 평가하세요.</p>'}

                    <!-- Matrix 2: 개선 후 위험성 수준 -->
                    <div class="risk-matrix-controls residual-matrix">
                        <div class="manual-input-area" style="border-color: #f87171; background: rgba(254, 242, 242, 0.5);">
                            <label class="manual-label" style="color: #ef4444;"><i data-lucide="wrench" style="width:14px;"></i> 추가 개선대책 입력 (수기)</label>
                            <textarea class="manual-textarea" placeholder="위험을 줄이기 위한 추가 개선 의견을 자유롭게 입력하세요..." 
                                oninput="updateManualNote('${key}', 'improvement', this.value)">${notes.improvement || ""}</textarea>
                        </div>

                        <p class="matrix-title improved" style="margin-top:20px;">개선 후 위험성 수준 평가</p>
                        <div class="matrix-row-unified">
                            <div class="row-item">
                                <span class="row-label">강도</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'residual', 'severity', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">×</div>
                            <div class="row-item">
                                <span class="row-label">빈도</span>
                                <select class="row-select" onchange="updateRiskScore(${i}, '${stepName}', 'residual', 'frequency', this.value)">
                                    ${[1,2,3,4].map(v => `<option value="${v}" ${riskData.residual.frequency == v ? 'selected' : ''}>${v}</option>`).join('')}
                                </select>
                            </div>
                            <div class="row-symbol">=</div>
                            <div class="row-result residual">
                                <span class="row-label">잔류위험</span>
                                <span class="row-score ${getScoreClass(riskData.residual.score)}">${riskData.residual.score}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    initLucide();
    updateNextButton(taskRisks.length);
    checkIncidents(taskRisks);
}

function checkIncidents(taskRisks) {
    const incidentContainer = document.getElementById('incident-container');
    const incidentContent = document.getElementById('incident-content');
    
    // Find if any of the hazard has a matching incident
    const matchingIncidents = taskRisks
        .map(r => currentState.incidents[r.위험요인])
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

    const currentCheckedCount = Array.from(currentState.checkedItems).filter(key => key.startsWith(`${currentState.selectedTask}-${currentState.selectedStep}`)).length;
    
    if (currentCheckedCount >= totalInStep && totalInStep > 0) {
        container.innerHTML = `
            <div class="next-action-area active">
                <button class="btn btn-primary" onclick="nextStep(3)">
                    다음 단계 (현장 사진 촬영) <i data-lucide="camera"></i>
                </button>
            </div>
        `;
        initLucide();
    } else {
        container.innerHTML = '';
    }
}

function initEventListeners() {
    document.getElementById('task-select')?.addEventListener('change', (e) => populateTasks(e.target.value));

    document.getElementById('step2-task-select')?.addEventListener('change', (e) => {
        currentState.selectedTask = e.target.value;
        if (e.target.value) populateWorkSteps(e.target.value);
    });

    document.getElementById('step2-step-select')?.addEventListener('change', (e) => {
        currentState.selectedStep = e.target.value;
        if (e.target.value) renderRiskChecklist(e.target.value);
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
    if (!workerName) { showToast("⚠️ 점검자 성명을 입력하거나 선택해 주세요."); return; }
    if (signaturePad.isEmpty()) { showToast("⚠️ 본인 서명이 필요합니다."); return; }
    
    const today = new Date().toLocaleDateString('ko-KR');
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay.querySelector('p');
    if (loadingText) loadingText.innerText = "데이터를 구글 시트로 전송 중입니다...";
    overlay.classList.add('active');

    // 1. 실시로그용 데이터
    const logs = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        const index = parseInt(parts[parts.length - 1]);
        const step = parts.slice(1, parts.length - 1).join('-');
        const task = parts[0];
        const risksAtStep = currentState.risks.filter(r => r.작업단계 === step && r.작업명 === task);
        const r = risksAtStep[index];
        if (!r) return null;

        const riskData = currentState.riskMatrixData[key] || {
            current: { severity: 1, frequency: 1, score: 1 },
            residual: { severity: 1, frequency: 1, score: 1 }
        };
        const measures = Array.isArray(r.개선대책) ? r.개선대책 : [r.개선대책];
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
            hazard: r.위험요인,
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

    // 2. 개선대책 실행계획서용 데이터
    const improvementPlan = Array.from(currentState.checkedItems).map(key => {
        const parts = key.split('-');
        const index = parseInt(parts[parts.length - 1]);
        const step = parts.slice(1, parts.length - 1).join('-');
        const task = parts[0];
        const risksAtStep = currentState.risks.filter(r => r.작업단계 === step && r.작업명 === task);
        const r = risksAtStep[index];
        if (!r) return null;

        const mNotes = currentState.manualNotes[key] || { current: "", improvement: "" };
        const riskData = currentState.riskMatrixData[key];
        const measures = Array.isArray(r.개선대책) ? r.개선대책 : [r.개선대책];
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
            hazard: r.위험요인,
            improvement_measure: improvements || "현재 조치 완료 및 유지관리",
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

        // 3. 로컬 내역 저장 추가
        saveToHistory(payload);

        // 전송 완료 안내 (no-cors 특성상 성공 가정)
        setTimeout(() => {
            overlay.classList.remove('active');
            showToast("✅ 점검 결과가 구글 시트로 전송되었습니다.");
            setTimeout(() => location.reload(), 2000);
        }, 1500);

    } catch (error) {
        console.error("전송 오류:", error);
        overlay.classList.remove('active');
        showToast("❌ 전송 실패: 인터넷 연결 또는 설정을 확인하세요.");
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
