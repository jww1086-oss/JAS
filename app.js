/**
 * [v35.8.8-ULTIMATE_STABILITY] KOMIPO 스마트 안전 시스템 전용 엔진
 * 1. 지능형 데이터 키 매핑 (부서명/작업부서 자동 탐색)
 * 2. UTF-8 무결성 및 유니코드 정규화 적용
 * 3. 드롭다운 위험도 보드 및 레드테마 Gap-Analysis 적용
 * 4. 작업단계(step_name) 연동 규격 맞춤 및 유실 방지 로직 강화
 */
window.APP_VERSION = "35.8.8";
console.log(`%c!!! [KOMIPO] ULTIMATE POWER v35.8.8 !!!`, "color: #0ea5e9; font-weight: 900; font-size: 1.5rem;");
const currentState = {
    currentStep: 0,
    selectedWorkers: [],
    selectedDept: null,
    selectedTask: null,
    selectedStep: null,
    availableSteps: [],
    risks: [],
    taskIndex: {},
    riskIndex: {},
    allLogs: [],
    checkedItems: new Set(),
    checkedMeasures: new Set(),
    checkedImprovements: new Set(),
    expandedHazardKeys: new Set(),
    expandedMeasureKeys: new Set(),
    customRiskScores: {},
    improvementData: {}, // [v35.4.6] { hazardKey: { photo: base64, memo: string } }
    isDataReady: false,
    lastUpdated: new Date()
};

// --- [환경 설정 및 API 엔드포인트] ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbyvavs2Dk-OKQpIsxNcs5LwXNHjibiUcHvTTEfngo4YMBBe94Vt5VTmrOWZo2otLuaieg/exec";
const MASTER_SHEET_NAME = "위험성평가자료";

/**
 * 2. 부팅 및 실시간 네트워크 감시 (v25.1-Watcher)
 * '개발_표준_및_규칙.md' Section 4.2 준수
 */
function updateNetworkStatus(isOnline, message = "") {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) return;

    const statusText = indicator.querySelector('.status-text') || indicator;
    
    if (isOnline) {
        indicator.className = 'status-indicator online';
        statusText.textContent = message || '실시간 온라인';
    } else {
        indicator.className = 'status-indicator offline';
        statusText.textContent = message || '오프라인 (로컬 모드)';
    }
}

// 윈도우 온라인/오프라인 트래킹
window.addEventListener('online', () => updateNetworkStatus(true));
window.addEventListener('offline', () => updateNetworkStatus(false));

// 전역 접근 보장 (window 바인딩)
window.goHome = function() {
    console.log("🏠 Navigating Home...");
    // 상태 초기화
    currentState.selectedDept = null;
    currentState.selectedTask = null;
    if (currentState.checkedItems) currentState.checkedItems.clear();
    
    window.switchPhase('step-home');
};

/**
 * [v35.4.4] 전역 단계(Phase) 전환 엔진
 * - 애니메이션, 스테퍼 연동, 자동 저장 포함
 */
window.switchPhase = function(phaseId) {
    console.log(`%c🚀 Switching to phase: ${phaseId}`, "color: #8b5cf6; font-weight: 700;");
    
    // [v35.6.6] 상태 동기화 및 오버레이 제거
    currentState.currentPhase = phaseId;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');

    const sections = document.querySelectorAll('.phase-section');
    sections.forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
        s.style.opacity = '0';
    });

    const target = document.getElementById(phaseId);
    if (!target) {
        console.error(`❌ Phase ID [${phaseId}]를 찾을 수 없습니다.`);
        return;
    }

    target.style.display = 'block';
    
    // 홈 화면인 경우와 그렇지 않은 경우를 명확히 구분하여 숨김 제어
    const homeNode = document.getElementById('step-home');
    if (homeNode) {
        if (phaseId === 'step-home') {
            homeNode.style.setProperty('display', 'block', 'important');
        } else {
            homeNode.style.setProperty('display', 'none', 'important');
        }
    }

    // [v35.7.7] 현재 단계 상태를 동기화 엔진에 전달하기 위해 즉시 갱신
    currentState.currentPhase = phaseId;

    requestAnimationFrame(() => {
        target.classList.add('active');
        target.style.opacity = '1';
    });


    // [v35.7.4] 전역 상태 동기화 (헤더 갱신)
    syncUIState();

    // 스테퍼 UI 업데이트
    updateStepper(phaseId);



    // 단계별 특화 렌더링 엔진 트리거
    if (phaseId === 'step-improvement') {
        renderImprovementPhase();
    } else if (phaseId === 'step-4') {
        renderRiskPreview();
        initSignaturePad(); 
    } else if (phaseId === 'step-assessment' || phaseId === 'step-2') {
        renderRiskChecklist();
    }

    // 자동 저장 및 아이콘 적용
    saveDraft();
    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};



window.handleStep1Back = function() { window.goHome(); };
window.startAssessment = function() { window.switchPhase('step-1'); };

/**
 * 3. 스마트 데이터 처리 유틸리티
 */
window.showToast = function(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    requestAnimationFrame(() => {
        toast.classList.add('active');
    });
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            if (!toast.classList.contains('active')) toast.style.display = 'none';
        }, 500);
    }, duration);
};

const getHash = s => String(s || "").replace(/\s/g, '').replace(/[\_\-]/g, '');

function normalizeSearch(s) {
    if (!s) return "";
    return s.toString().toLowerCase().replace(/\s/g, '').replace(/[\_\-\(\)]/g, '');
}

/**
 * [v35.4.2] 유틸리티: 숫자로 시작하는 리스트나 줄바꿈을 기준으로 텍스트 분리
 */
function smartSplit(text) {
    if (!text) return [];
    if (typeof text !== 'string') text = String(text);
    // 1. 2. 3. ... 또는 신규 라인을 기준으로 분리
    return text.split(/\s*\d+\.|\s*[\n\r]+\s*/).map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * [v35.4.3] 동적 위험도 점수 관리 유틸리티
 */
function getTaskRiskScore(hazardKey) {
    const base = currentState.riskIndex[hazardKey] || {};
    const custom = currentState.customRiskScores[hazardKey] || {
        current: { L: parseInt(base.현재빈도 || 1), S: parseInt(base.현재강도 || 1) },
        improved: { L: parseInt(base.개선빈도 || 1), S: parseInt(base.개선강도 || 1) }
    };
    
    custom.current.R = custom.current.L * custom.current.S;
    custom.improved.R = custom.improved.L * custom.improved.S;
    
    return custom;
}

function updateRiskScore(hazardKey, type, field, value) {
    if (!currentState.customRiskScores[hazardKey]) {
        currentState.customRiskScores[hazardKey] = getTaskRiskScore(hazardKey);
    }
    currentState.customRiskScores[hazardKey][type][field] = parseInt(value);
    currentState.customRiskScores[hazardKey][type].R = currentState.customRiskScores[hazardKey][type].L * currentState.customRiskScores[hazardKey][type].S;
    
    renderRiskChecklist();
    saveDraft();
}

function toggleImprovementCheck(hazardKey, index) {
    if (!currentState.checkedImprovements) currentState.checkedImprovements = new Set();
    const impKey = `${hazardKey}_IMP_${index}`;
    if (currentState.checkedImprovements.has(impKey)) {
        currentState.checkedImprovements.delete(impKey);
    } else {
        currentState.checkedImprovements.add(impKey);
    }
    renderRiskChecklist();
    saveDraft();
}

/**
 * [v35.4.6] 사진 촬영 및 개선의견 입력 핸들러
 */
function handlePhotoUpload(hazardKey) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'camera';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
            if (!currentState.improvementData[hazardKey]) {
                currentState.improvementData[hazardKey] = { photo: "", memo: "" };
            }
            currentState.improvementData[hazardKey].photo = re.target.result;
            showToast("📸 사진이 성공적으로 첨부되었습니다.");
            renderImprovementPhase(); // 즉시 리렌더링하여 미리보기 표시
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function handleMemoInput(hazardKey, value) {
    if (!currentState.improvementData[hazardKey]) {
        currentState.improvementData[hazardKey] = { photo: "", memo: "" };
    }
    currentState.improvementData[hazardKey].memo = value;
}
function updateDate() {
    const headerDate = document.querySelector('.header-date');
    if (!headerDate) return;
    
    const now = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const formatted = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${days[now.getDay()]}`;
    headerDate.textContent = formatted;
}

/**
 * [v34.7.1] Offline-Ready Inline SVG Provider
 */
function getIconSVG(name, size = 20) {
    const icons = {
        'building-2': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>',
        'chevron-right': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
        'clipboard-list': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
        'search-x': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="8"/><path d="m13 13-4-4"/><path d="m9 13 4-4"/></svg>',
        'alert-triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
        'shield-check': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
        'info': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
        'users': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        'check': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        'clock-rewind': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',
        'zap': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        'activity': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
        'cpu': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>',
        'settings': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        'plug-2': '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v2"/><path d="M15 2v2"/><path d="M12 17v5"/><path d="M5 8h14"/><path d="M6 11V8h12v3a6 6 0 1 1-12 0Z"/></svg>'
    };
    return icons[name] || '';
}

/**
 * 4. 자동 저장 및 복원 (Save Draft)
 * '개발_표준_및_규칙.md' Section 3.1 준수
 */
function saveDraft() {
    if (!currentState.selectedDept) return;
    const key = `KOMIPO_V34_DRAFT_${currentState.selectedDept}`;
    const draftData = {
        부서명: currentState.selectedDept,
        작업명: currentState.selectedTask,
        점검자: currentState.selectedWorkers.join(', '),
        checkedItems: Array.from(currentState.checkedItems),
        일시: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(draftData));
}

function loadDrafts() {
    const drafts = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('KOMIPO_V34_DRAFT_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                drafts.push({ ...data, draftKey: key });
            } catch (e) { }
        }
    }
    return drafts;
}

async function renderDraftSelection() {
    const drafts = loadDrafts();
    const container = document.getElementById('draft-selection-container');
    if (!container) return;
    if (!container) return;

    if (drafts.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const draftList = document.getElementById('draft-list');
    if (!draftList) return;

    draftList.innerHTML = drafts.map(draft => `
        <div class="draft-card" onclick="resumeDraft('${draft.draftKey}')" style="min-width: 240px; background: white; border-radius: 20px; padding: 18px; border: 1.5px solid #f1f5f9; box-shadow: var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div style="font-weight:800; color:var(--doing-blue); font-size:0.8rem;">작성 중인 평가</div>
                <div style="font-size:0.65rem; color:#94a3b8;">${new Date(draft.일시).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            <div style="font-weight:900; color:#1e293b; font-size:1.05rem; margin-bottom:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${draft.부서명}</div>
            <div style="font-weight:700; color:#475569; font-size:0.85rem; margin-bottom:12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${draft.작업명}</div>
            <div style="display:flex; align-items:center; gap:6px; color:#64748b; font-size:0.75rem;">
                <i data-lucide="users" style="width:14px;"></i>
                <span>${draft.점검자 || '점검자 미입력'}</span>
            </div>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

async function init() {
    updateDate();
    setInterval(updateDate, 60000);

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('active'); 
    
    try {
        await loadLocalHistory();
        renderDraftSelection();
        
        console.log(`%c🚀 [v${window.APP_VERSION}] 데이터 동기화 엔진 가동...`, "color: #0ea5e9; font-weight: 800;");
        
        let rawData = null;
        try {
            const response = await fetch(`master_data.json?t=${Date.now()}`);
            if (response.ok) {
                rawData = await response.json();
            }
        } catch (e) {
            console.warn("⚠️ fetch(master_data.json) 실패. 내부 메모리 데이터로 전환합니다.");
        }

        // Fallback: master_data.js 에 있는 데이터 사용
        if (!rawData && typeof MASTER_DATA !== 'undefined') {
            rawData = MASTER_DATA;
        }

        if (!Array.isArray(rawData) || rawData.length === 0) {
            throw new Error("데이터를 로드할 수 없습니다. (master_data.json 누락 또는 형식 오류)");
        }

        // [v35.4.2-ULTIMATE] 지능형 키 필드명 탐색 (정규식 강화)
        const sample = rawData[0];
        const keys = Object.keys(sample);
        const findKey = (candidates, fallback) => {
            return keys.find(k => {
                const cleanK = k.replace(/[^가-힣a-zA-Z]/g, '');
                return candidates.some(c => cleanK.includes(c));
            }) || fallback;
        };

        const KEY_DEPT = findKey(['부서', '팀', '소속', '설비'], '부서명');
        const KEY_TASK = findKey(['작업명', '공사명', '점검명'], '작업명'); // [v35.8.7] 작업명 키 필터 강화
        const KEY_HAZARD = findKey(['위험요인', '재해유형', '위험항목'], '위험요인');
        
        // [v35.8.7] 지능형 작업단계 탐지: 이름 매칭 실패 시 위험요인 바로 이전 컬럼 선택
        let KEY_STEP = findKey(['단계', '순서', '준비'], '작업단계');
        if (!sample[KEY_STEP] || KEY_STEP === KEY_TASK) {
            const hazardIdx = keys.indexOf(KEY_HAZARD);
            if (hazardIdx > 0) {
                KEY_STEP = keys[hazardIdx - 1];
                console.log(`%c💡 [STEP_DETECTED_BY_POSITION] 위험요인 앞 컬럼 사용: ${KEY_STEP}`, "color: #f59e0b; font-weight: 700;");
            }
        }

        console.log(`%c📊 [STRUCTURE_DETECTED]`, "color: #6366f1; font-weight: 800;");
        console.table({ KEY_DEPT, KEY_TASK, KEY_STEP, KEY_HAZARD });

        const standardized = [];
        const tIndex = {};
        const rIndex = {};

        // [v35.6.9] Fill-Down 엔진: 병합된 셀 또는 반복 생략된 데이터 보정
        let lastDept = "";
        let lastTask = "";
        let lastStep = "";

        rawData.forEach(r => {
            const rawD = (String(r[KEY_DEPT] || "")).trim().normalize('NFC');
            const rawT = (String(r[KEY_TASK] || "")).trim().normalize('NFC');
            const rawS = (String(r[KEY_STEP] || "")).trim().normalize('NFC');

            // [v35.7.0] 가비지 데이터(스크립트 조각 등) 필터링
            if (rawT.startsWith('var ') || rawT.includes('https://') || rawT.includes('out:json')) {
                return; 
            }

            // 값이 있으면 갱신, 없으면 이전 값 유지 (Fill-Down)

            if (rawD) lastDept = rawD;
            if (rawT) lastTask = rawT;
            if (rawS) lastStep = rawS;

            const d = lastDept || "미분류";
            const t = lastTask || "내용없음";
            const s = lastStep || "일반";

            const item = { ...r, 부서명: d, 작업명: t, 작업단계: s };
            standardized.push(item);

            if (!tIndex[d]) tIndex[d] = new Set();
            tIndex[d].add(t);

            const k = `${normalizeSearch(d)}|${normalizeSearch(t)}`;
            if (!rIndex[k]) rIndex[k] = [];
            rIndex[k].push(item);
        });


        currentState.risks = standardized;
        currentState.taskIndex = tIndex;
        currentState.riskIndex = rIndex;
        currentState.isDataReady = true;

        console.log(`%c✅ [LOAD_COMPLETE] ${standardized.length}건 데이터 로드 완료`, "color: #10b981; font-weight: 800;");

        renderDeptBanners();
        if (overlay) overlay.classList.remove('active');

        if (currentState.selectedDept) {
            renderTaskBanners(currentState.selectedDept);
        }

        // [v35.7.4] 초기화 완료 후 UI 상태 강제 동기화
        syncUIState();


    } catch (error) {
        console.error("❌ Critical Indexing Error:", error);
        if (overlay) overlay.classList.remove('active');
        showErrorUI(`[시스템 오류] ${error.message}`);
    }
}

function showErrorUI(msg) {
    const container = document.getElementById('selection-container');
    if (container) {
        container.innerHTML = `
            <div style="background:#fff1f2; border:2px solid #fecaca; padding:25px; border-radius:24px; color:#e11d48; text-align:center;">
                <i data-lucide="alert-circle" style="width:40px; height:40px; margin-bottom:12px;"></i>
                <div style="font-weight:950; font-size:1.1rem;">시스템 통신 오류</div>
                <div style="font-size:0.85rem; margin-top:8px; line-height:1.5;">${msg}<br>브라우저를 새로고침(Ctrl+F5) 하거나 관리자에게 문의하세요.</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

async function loadMasterData() {
    if (typeof MASTER_DATA !== 'undefined' && MASTER_DATA.length > 0) {
        currentState.risks = MASTER_DATA;
    } else {
        showToast("⚠️ 마스터 데이터를 찾을 수 없습니다.");
    }
}

async function loadLocalHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
        currentState.allLogs = history;
    } catch (e) {
        currentState.allLogs = [];
    }
}

function saveToHistory(payload) {
    const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    history.unshift(payload);
    if (history.length > 100) history.pop();
    localStorage.setItem('kosha_history', JSON.stringify(history));
    currentState.allLogs = history;
}



/**
 * [v34.7.2] 스테퍼 UI 업데이트 로직
 */
function updateStepper(phaseId) {
    const stepper = document.getElementById('stepper');
    if (!stepper) return;

    // 단계별 숫자 매핑
    const stepMap = {
        'step-1': 1, 'step-tasks': 1,
        'step-2': 2, 'step-assessment': 2,
        'step-improvement': 3,
        'step-4': 4
    };

    const currentStepNum = stepMap[phaseId];
    if (!currentStepNum) {
        stepper.style.display = 'none';
        return;
    }

    stepper.style.display = 'block';
    const nodes = stepper.querySelectorAll('.step-node');
    const fill = document.getElementById('progress-fill');

    nodes.forEach(node => {
        const step = parseInt(node.getAttribute('data-step'));
        node.classList.remove('active', 'completed');
        if (step < currentStepNum) node.classList.add('completed');
        if (step === currentStepNum) node.classList.add('active');
    });

    if (fill) {
        const progress = ((currentStepNum - 1) / (nodes.length - 1)) * 100;
        fill.style.width = `${progress}%`;
    }
}

/**
 * [v35.4.4] 서명 패드 초기화 유틸리티 (Premium Canvas)
 */
/**
 * [v35.6.2] 서명 패드 활성화 (오버레이 제거 및 캔버스 초기화)
 */
function activateSignature(type) {
    console.log(`🖋 Activating Signature Pad: ${type}`);
    const overlayId = type === 'final' ? 'signature-overlay-final' : 'signature-overlay-tbm';
    const overlay = document.getElementById(overlayId);
    const placeholder = document.getElementById('sig-placeholder');
    
    if (overlay) {
        overlay.style.display = 'none'; // 오버레이 숨김
    }
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // 오버레이가 사라진 후 캔버스 크기를 다시 계산해야 정확한 좌표가 잡힘
    initSignaturePad();
}

function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;

    // [v35.6.2] 매번 초기화하지 않고 인스턴스 존재 여부 확인
    if (!window.signaturePad) {
        window.signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgba(255, 255, 255, 0)',
            penColor: 'rgb(30, 41, 59)',
            velocityFilterWeight: 0.7
        });
    }

    // 캔버스 크기 조정 (고해상도 대응 및 실제 표시 크기 동기화)
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = window.signaturePad.toData();
    
    // 부모 컨테이너의 크기를 기준으로 캔버스 크기 고정
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    
    window.signaturePad.clear();
    if (data && data.length > 0) {
        window.signaturePad.fromData(data);
    }

    // 윈도우 리사이즈 대응
    window.removeEventListener("resize", initSignaturePad);
    window.addEventListener("resize", initSignaturePad);
}
/**
 * [v35.7.5] 문자열 유사도 측정 (Levenshtein Distance)
 */
function getSimilarity(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * [v35.7.4] 전역 UI 상태 동기화 엔진 (Flow-Locked)
 */
function syncUIState() {
    const phase = currentState.currentPhase || "";
    const banner = document.getElementById('context-banner');
    
    // 1. 배너 노출 여부 결정
    if (!phase || phase === 'step-home' || phase === 'step-choice') {
        updateHeaderContext(null, null);
        return;
    }

    // 2. 단계별 컨텐츠 구성 (v35.8.0: 독립 헤더 정책)
    switch (phase) {
        case 'step-1':
        case 'step-tasks':
            // [v35.8.0] 부서만 노출 (작업 선택 전)
            updateHeaderContext(currentState.selectedDept, null);
            break;
        case 'step-home':
        case 'step-choice':
            updateHeaderContext(null, null);
            break;
        default:
            // 그 외 모든 평가/제출/기록 단계에서는 부서 + 작업 노출
            updateHeaderContext(currentState.selectedDept, currentState.selectedTask);
            break;
    }
}






/**
 * [v35.7.2] 상단 컨텍스트 배너 동적 제어 (Breadcrumb)
 */
function updateHeaderContext(dept, task) {
    const banner = document.getElementById('context-banner');
    const deptLabel = document.getElementById('context-dept');
    const taskLabel = document.getElementById('context-task');
    const separator = document.getElementById('context-separator');
    const stepper = document.getElementById('stepper');

    if (!dept) {
        if (banner) banner.style.setProperty('display', 'none', 'important');
        return;
    }

    if (deptLabel) deptLabel.innerText = dept;
    if (banner) {
        banner.style.setProperty('display', 'flex', 'important');
        banner.style.setProperty('visibility', 'visible', 'important');
    }
    if (stepper) stepper.style.display = 'block';

    // 작업명이 명시적으로 있는 경우에만 표시 (null이거나 빈값이면 파괴)
    if (task && task.trim().length > 0) {
        if (taskLabel) {
            taskLabel.innerText = task;
            taskLabel.style.display = 'inline';
        }
        if (separator) separator.style.display = 'inline-block';
    } else {
        // [v35.7.5] 잔상 방지를 위해 텍스트 노드를 완전히 삭제하고 숨김
        if (taskLabel) {
            taskLabel.innerText = "";
            taskLabel.style.display = 'none';
        }
        if (separator) separator.style.display = 'none';
    }
}




function renderDeptBanners() {
    const container = document.getElementById('selection-container');
    if (!container) return;

    // [v35.4.2] 데이터 준비 확인 및 유연한 추출
    if (!currentState.isDataReady || !currentState.risks || currentState.risks.length === 0) {
        container.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton-card" style="height:80px; background:#f8fafc; border-radius:24px; margin-bottom:12px; position:relative; overflow:hidden; border:1px solid #f1f5f9;">
                <div class="shimmer" style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent); animation: shimmer 1.5s infinite;"></div>
            </div>
        `).join('');
        return;
    }

    const uniqueDepts = [...new Set(currentState.risks.map(r => r.부서명))].filter(Boolean).sort();
    
    if (uniqueDepts.length === 0) {
        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.7); backdrop-filter:blur(10px); padding:40px; border-radius:30px; border:1px solid #e5e7eb; text-align:center;">
                <i data-lucide="database-zap" style="width:48px; height:48px; color:#6366f1; margin-bottom:20px;"></i>
                <div style="font-weight:950; font-size:1.2rem; color:#1f2937;">데이터 추출 실패</div>
                <div style="font-size:0.9rem; color:#6b7280; margin-top:10px;">유효한 부서 데이터를 찾을 수 없습니다.<br>마스터 데이터의 컬럼명을 확인해 주세요.</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    if (uniqueDepts.length === 0) {
        showErrorUI("데이터 구조 내에서 부서 정보를 찾을 수 없습니다.");
        return;
    }

    // 부서별 스타일 매핑
    const deptStyles = {
        "제주_전기_2계전": { icon: "zap", color: "color-blue" },
        "제주_ST_2계전": { icon: "activity", color: "color-cyan" },
        "제주_GT_2계전": { icon: "cpu", color: "color-purple" },
        "제주_GT_2기계": { icon: "settings", color: "color-orange" },
        "제주_HRSG_2기계": { icon: "shield-check", color: "color-teal" },
        "제주_ST_2기계": { icon: "plug-2", color: "color-green" }
    };

    const draftContainer = document.getElementById('draft-selection-container');
    if (draftContainer) draftContainer.style.display = 'none';

    container.innerHTML = uniqueDepts.map(name => {
        const style = deptStyles[name] || { icon: "building-2", color: "color-slate" };
        return `
            <div class="dept-banner-card" onclick="selectDept('${name}')" style="display:flex; align-items:center; width:100%;">
                <div class="dbc-icon ${style.color}">${getIconSVG(style.icon, 24)}</div>
                <div class="dbc-text" style="flex:1;">
                    <div class="title" style="font-weight:950; font-size:1.15rem; color:#1e293b;">${name}</div>
                    <div class="desc" style="font-size:0.75rem; color:#64748b; font-weight:700;">한국중부발전 스마트 안전</div>
                </div>
                <div class="dbc-arrow">${getIconSVG('chevron-right', 20)}</div>
            </div>
        `;
    }).join('');
}

function selectDept(dept) {
    currentState.selectedDept = dept;
    currentState.selectedTask = null; 

    // [v35.7.4] 동기화 엔진 호출 (부서 선택 상태로 UI 갱신)
    syncUIState();

    const header = document.getElementById('step1-header');


    if (header) {
        header.querySelector('h2').innerText = "작업 선택";
        header.querySelector('p').innerText = `${dept} 부서의 점검 작업을 선택하세요.`;
    }
    switchPhase('step-tasks'); // 작업 선택 전용 섹션으로 이동 (index.html 구조 확인 필요)
    renderTaskBanners(dept);
}

/**
 * [v34.7.0] 1단계-2: 작업 선택 화면 렌더링 (149개 작업 동적 추출)
 */
function renderTaskBanners(dept) {
    const container = document.getElementById('task-selection-container');
    if (!container) return;

    // [v34.7.2-SPEED_INDEX] 미리 생성된 인덱스에서 작업 리스트 즉시 추출
    let tasks = [];
    const deptKey = dept.trim();
    
    if (currentState.taskIndex && currentState.taskIndex[deptKey]) {
        tasks = Array.from(currentState.taskIndex[deptKey]).filter(Boolean).sort();
    } else if (currentState.risks && currentState.risks.length > 0) {
        // 인덱스가 아직 생성 중일 때의 Fallback (전수 조사)
        tasks = [...new Set(currentState.risks
            .filter(r => (r.부서명 || r.작업부서 || "").trim() === deptKey)
            .map(r => (r.작업명 || "").trim()))]
            .filter(Boolean)
            .sort();
    }

    if (tasks.length === 0 && currentState.risks.length === 0) {
        container.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton-card" style="height:80px; background:#f1f5f9; border-radius:24px; margin-bottom:12px; position:relative; overflow:hidden;">
                <div class="shimmer" style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent); animation: shimmer 1.5s infinite;"></div>
            </div>
        `).join('');
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="task-banner-card" onclick="selectTask('${task}')">
            <div class="tbc-icon">${getIconSVG('clipboard-list', 22)}</div>
            <div class="tbc-text">
                <div class="title">${task}</div>
                <div class="desc-tag">${dept}</div>
            </div>
            <div class="tbc-arrow">${getIconSVG('chevron-right', 20)}</div>
        </div>
    `).join('');
}

function selectTask(task) {
    currentState.selectedTask = (task || "").trim();
    console.log(`🚀 Task Selected: ${currentState.selectedTask}`);
    
    // [v35.7.4] 동기화 엔진 호출 (작업 선택 상태로 UI 갱신)
    syncUIState();

    // 지능형 데이터 로드 (EXTRA_INFO 연동)


    const extraSource = (window.EXTRA_INFO) || currentState.extraInfo || [];
    const normalize = s => String(s || "").replace(/\s/g, '').replace(/[\_\-]/g, '');
    const targetDept = normalize(currentState.selectedDept);
    const targetTask = normalize(currentState.selectedTask);

    currentState.selectedExtra = extraSource.find(ex =>
        normalize(ex.부서명 || ex.작업부서) === targetDept &&
        normalize(ex.작업명) === targetTask
    );

    // [v35.6.8] 필터링된 평가 문항 준비 (실제 렌더링은 Step-2 진입 시 수행)
    // selection-container 로직은 selectTask 완료 시점에 점검자 입력 단계로 이동
    renderEvaluatorPhase();
    switchPhase('step-evaluators');
    
    if (window.lucide) window.lucide.createIcons();
}

/**
 * [v35.7.2] 키워드 기반 유사도 측정 (Token Overlap Score)
 */
function calculateMatchScore(s1, s2) {
    const norm = s => String(s || "").replace(/[^가-힣a-zA-Z0-9\s]/g, '').normalize('NFC');
    const t1 = norm(s1).split(/\s+/).filter(t => t.length > 0 && !['점검', '작업', '사전', '정비', '공사', '관리', '유지'].includes(t));
    const t2 = norm(s2).split(/\s+/).filter(t => t.length > 0);
    
    if (t1.length === 0) return 0;
    
    let totalSimilarity = 0;
    let sequenceBonus = 0;
    let lastFoundIdx = -1;

    t1.forEach(word => {
        // [v35.7.5] 레벤슈타인 기반 단어별 최대 유사도 탐색 (도입관 vs 도압관 등 대응)
        let maxWordSim = 0;
        let bestIdx = -1;

        t2.forEach((tw, idx) => {
            const sim = getSimilarity(word, tw);
            if (sim > maxWordSim) {
                maxWordSim = sim;
                bestIdx = idx;
            }
        });

        if (maxWordSim > 0.6) {
            totalSimilarity += maxWordSim;
            if (bestIdx > lastFoundIdx) sequenceBonus += 0.1;
            lastFoundIdx = bestIdx;
        }
    });
    
    return (totalSimilarity + sequenceBonus) / t1.length;
}




/**
 * [v35.7.2] 정밀 지능형 사전정보 검색 엔진 (Scoring System)
 */
function getFuzzyPreInfo(dept, task) {
    const data = window.PRE_INFO_DATA || [];
    if (data.length === 0) return null;

    const norm = s => String(s || "").replace(/[^가-힣a-zA-Z0-9]/g, '').normalize('NFC').trim();
    const targetDept = norm(dept);
    const targetTask = norm(task);

    // [v35.8.0] Level 1: 완전 일치 탐색 (부서 + 작업) - CSV 원본 일치 최우선
    let match = data.find(d => norm(d.부서명 || d.작업부서) === targetDept && norm(d.작업명) === targetTask);
    if (match) return { ...match, matchType: 'exact_full' };

    // Level 2: 부서 관계 없이 작업명 완전 일치
    match = data.find(d => norm(d.작업명) === targetTask);
    if (match) return { ...match, matchType: 'exact_task' };


    // Level 3: 점수제 정밀 매칭 (v35.7.2 New)
    let bestMatch = null;
    let maxScore = 0;

    data.forEach(d => {
        const score = calculateMatchScore(task, d.작업명);
        if (score > maxScore) {
            maxScore = score;
            bestMatch = d;
        }
    });

    // 최소 임계치 (50% 이상의 키워드 일치 시에만 매칭)
    if (bestMatch && maxScore >= 0.6) {
        return { ...bestMatch, matchType: 'partial', score: Math.round(maxScore * 100) };
    }


    // Level 4: 고정 키워드 기반 기본 가이드
    if (targetTask.includes("사다리")) return { 작업명: "사다리 작업", 사용공구_장비: "A형 사다리 (아웃트리거 장착)", 관련자료: "고소작업 안전지침", 보호구_안전장비: "안전모(턱끈), 안전화, 안전대", matchType: 'keyword' };
    if (targetTask.includes("전기") || targetTask.includes("계전")) return { 작업명: "전기/계전 작업", 사용공구_장비: "방폭공구, 검전기, 접지기구", 관련자료: "전기안전작업 수칙", 보호구_안전장비: "특고압 절연장갑, 절연화, 방전복", matchType: 'keyword' };
    if (targetTask.includes("중량물") || targetTask.includes("크레인")) return { 작업명: "중량물 취급", 사용공구_장비: "크레인, 슬링벨트, 샤클", 관련자료: "중량물 취급 계획서", 보호구_안전장비: "안전모, 안전화, 유도로프", matchType: 'keyword' };

    return null;
}


/**
 * [v35.6.8] 평가자 입력 및 참고자료 렌더링
 */
function renderEvaluatorPhase() {
    const infoContent = document.getElementById('reference-info-content');
    if (!infoContent) return;

    // [v35.7.0] Fuzzy 매칭 엔진 적용
    const refData = getFuzzyPreInfo(currentState.selectedDept, currentState.selectedTask);

    if (refData) {
        let badgeHtml = "";
        if (refData.matchType === 'task_only') badgeHtml = `<span style="background:#fefce8; color:#854d0e; padding:2px 6px; border-radius:6px; font-size:0.6rem; vertical-align:middle; margin-left:8px; border:1px solid #fef08a;">타 부서 참조</span>`;
        if (refData.matchType === 'partial') badgeHtml = `<span style="background:#f0fdf4; color:#15803d; padding:2px 6px; border-radius:6px; font-size:0.6rem; vertical-align:middle; margin-left:8px; border:1px solid #bbf7d0;">유사도 ${refData.score}% 매칭</span>`;
        if (refData.matchType === 'keyword') badgeHtml = `<span style="background:#f0fdf4; color:#15803d; padding:2px 6px; border-radius:6px; font-size:0.6rem; vertical-align:middle; margin-left:8px; border:1px solid #bbf7d0;">표준 가이드</span>`;


        infoContent.innerHTML = `
            <div style="font-size:0.75rem; color:#64748b; font-weight:800; margin-bottom:12px; border-bottom:1px dashed #e2e8f0; padding-bottom:8px; display:flex; align-items:center;">
                <i data-lucide="tag" style="width:12px; margin-right:4px;"></i> 매칭 작업: ${refData.작업명} ${badgeHtml}
            </div>
            <div style="display:grid; gap:15px;">
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="background:#e0f2fe; color:#0369a1; padding:8px; border-radius:10px;"><i data-lucide="wrench" style="width:18px; height:18px;"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem; color:#64748b; margin-bottom:2px;">사용공구 및 장비</div>
                        <div style="font-weight:900; color:#0f172a; line-height:1.4;">${refData.사용공구_장비 || "기본 수공구"}</div>
                    </div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="background:#fef2f2; color:#b91c1c; padding:8px; border-radius:10px;"><i data-lucide="shield-alert" style="width:18px; height:18px;"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem; color:#64748b; margin-bottom:2px;">보호구 및 안전장비</div>
                        <div style="font-weight:900; color:#ef4444; line-height:1.4;">${refData.보호구_안전장비 || "표준 보호구(안전모, 안전화 등)"}</div>
                    </div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="background:#f0fdf4; color:#15803d; padding:8px; border-radius:10px;"><i data-lucide="file-text" style="width:18px; height:18px;"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem; color:#64748b; margin-bottom:2px;">관련 자료</div>
                        <div style="font-weight:900; color:#166534; line-height:1.4;">${refData.관련자료 || "위험성평가(JSA), TBM일지"}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        infoContent.innerHTML = `
            <div style="display:grid; gap:15px;">
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="background:#e0f2fe; color:#0369a1; padding:8px; border-radius:10px;"><i data-lucide="wrench" style="width:18px; height:18px;"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem; color:#64748b; margin-bottom:2px;">사용공구 및 장비</div>
                        <div style="font-weight:900; color:#0f172a; line-height:1.4;">표준 수공구 및 해당 설비용 전용공구</div>
                    </div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="background:#fef2f2; color:#b91c1c; padding:8px; border-radius:10px;"><i data-lucide="shield-alert" style="width:18px; height:18px;"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem; color:#64748b; margin-bottom:2px;">보호구 및 안전장비</div>
                        <div style="font-weight:900; color:#ef4444; line-height:1.4;">기본 안전구(안전모, 안전화, 장갑) + 작업 특성별 추가 보호구</div>
                    </div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    <div style="background:#f0fdf4; color:#15803d; padding:8px; border-radius:10px;"><i data-lucide="file-text" style="width:18px; height:18px;"></i></div>
                    <div>
                        <div style="font-weight:800; font-size:0.8rem; color:#64748b; margin-bottom:2px;">관련 자료</div>
                        <div style="font-weight:900; color:#166534; line-height:1.4;">위험성평가(JSA), PTW, TBM일지</div>
                    </div>
                </div>
            </div>
        `;
    }

    addWorkerTags();
    if (window.lucide) window.lucide.createIcons();
}





/**
 * [v34.7.2] 2단계: 순차 체크리스트 엔진 (Card Workflow) - 통합 버전
 */
function toggleRiskItem(hash) {
    if (currentState.checkedItems.has(hash)) {
        currentState.checkedItems.delete(hash);
    } else {
        currentState.checkedItems.add(hash);
    }
    renderRiskChecklist();
    saveDraft();
}
function startAssessment() {
    switchPhase('step-1');
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
        header.querySelector('p').innerText = "소속 부서를 선택해 주세요.";
    }
    if (confirmArea) confirmArea.style.display = 'none';
    if (homeBtn) homeBtn.style.display = 'block';

    renderDeptBanners();
}

/**
 * [v34.6.9-FINAL] 뒤로가기 시 부서 선택 화면으로 초기화 및 모든 입력창 숨김
 */
function handleStep1Back() {
    if (currentState.selectedDept) {
        currentState.selectedDept = null;
        currentState.selectedTask = null;

        const workerCard = document.getElementById('worker-input-card-wrap');
        const extraContainer = document.getElementById('extra-info-container');
        const container = document.getElementById('selection-container');

        if (workerCard) workerCard.style.display = 'none';
        if (extraContainer) extraContainer.style.display = 'none';
        if (container) container.style.display = 'block';

        const header = document.getElementById('step1-header');
        if (header) {
            header.querySelector('h2').innerText = "부서 선택";
            header.querySelector('p').innerText = "소속 부서를 선택해 주세요.";
        }
        renderDeptBanners();
    } else {
        goHome();
    }
}



function renderLastLog() {
    const container = document.getElementById('last-log-container');
    if (!container) return;

    if (!currentState.allLogs || currentState.allLogs.length === 0) {
        container.style.display = 'none';
        return;
    }

    const lastLog = currentState.allLogs[0];
    container.style.display = 'block';

    document.getElementById('last-log-dept').textContent = lastLog.부서명 || lastLog.작업부서 || lastLog.소속 || "미지정";
    document.getElementById('last-log-task').textContent = lastLog.작업명 || "내용 없음";
    document.getElementById('last-log-worker').textContent = lastLog.worker || lastLog.점검자 || "미입력";
    document.getElementById('last-log-time').textContent = lastLog.timestamp || "방금 전";
}

function hydrateStateFromLogs(task) {
    if (!currentState.allLogs || currentState.allLogs.length === 0) return;

    const log = currentState.allLogs.find(l => getHash(l.작업명) === getHash(task));
    if (log && log.worker) {
        const workers = log.worker.split(',').map(w => w.trim()).filter(w => w);
        currentState.selectedWorkers = workers;
        addWorkerTags();
    }
}

function addWorkerTags() {
    const list = document.getElementById('selected-workers-chips');
    if (!list) return;
    list.innerHTML = currentState.selectedWorkers.map((w, index) => `
        <div class="worker-tag">
            <span>${w}</span>
            <i data-lucide="x" onclick="removeWorker(${index})"></i>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
}

function removeWorker(index) {
    currentState.selectedWorkers.splice(index, 1);
    addWorkerTags();
}

async function addWorker() {
    const input = document.getElementById('worker-input');
    const val = input.value.trim();
    if (!val) return;

    if (val.includes(',')) {
        const names = val.split(',').map(n => n.trim()).filter(n => n);
        currentState.selectedWorkers = [...new Set([...currentState.selectedWorkers, ...names])];
    } else {
        if (!currentState.selectedWorkers.includes(val)) {
            currentState.selectedWorkers.push(val);
        }
    }
    input.value = '';
    addWorkerTags();
}

function goAssessment() {
    if (currentState.selectedWorkers.length === 0) {
        showToast("⚠️ 평가 참여자를 최소 1명 이상 입력해 주세요.");
        return;
    }
    renderRiskChecklist();
    switchPhase('step-2');
}

/**
 * [v34.6.4] Robust Match: 부서명/작업명을 지능적으로 그룹화하여 체크리스트 생성
 */
function renderRiskChecklist(phase) {
    const container = document.getElementById('risk-checklist');
    if (!container) return;

    // [v34.7.2-FAST_LOOKUP] 인덱스에서 즉시 추출 (0.1초)
    const combinedKey = `${normalizeSearch(currentState.selectedDept)}|${normalizeSearch(currentState.selectedTask)}`;
    const filteredRisks = currentState.riskIndex[combinedKey] || [];


    if (filteredRisks.length === 0) {
        container.innerHTML = `
            <div style="padding:40px; text-align:center; color:#94a3b8;">
                <i data-lucide="alert-triangle" style="width:48px; height:48px; margin:0 auto 15px; display:block; opacity:0.3;"></i>
                <div style="font-weight:700; font-size:1.1rem; color:#475569;">매핑된 위험성평가 데이터가 없습니다.</div>
                <div style="font-size:0.85rem; margin-top:8px;">마스터 시트의 [설비명]과 [작업명]을 확인해 주세요.</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    // 작업단계별 그룹화
    const groups = {};
    filteredRisks.forEach(r => {
        const step = r.작업단계 || "일반 작업";
        if (!groups[step]) groups[step] = [];
        groups[step].push(r);
    });

    container.innerHTML = Object.entries(groups).map(([step, items], groupIndex) => `
        <div class="risk-group-card" style="background:white; border-radius:20px; padding:1.5rem; margin-bottom:1.5rem; border:1.5px solid #f1f5f9; box-shadow:var(--shadow-sm);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                <div style="background:var(--doing-blue); color:white; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem;">${groupIndex + 1}</div>
                <h3 style="font-weight:900; color:#1e293b; font-size:1.05rem; margin:0;">${step}</h3>
            </div>
            <div class="risk-items-wrap" style="display:grid; gap:16px;">
                ${items.map(item => renderRiskItem(item)).join('')}
            </div>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
    
    // [v34.6.9-FINAL] 단계 전환 버튼 생성 연동
    renderPhaseButtons('step-2');
}
function toggleMeasureCheck(hazardKey, index) {
    if (!currentState.checkedMeasures) currentState.checkedMeasures = new Set();
    const measureKey = `${hazardKey}_MEASURE_${index}`;
    if (currentState.checkedMeasures.has(measureKey)) {
        currentState.checkedMeasures.delete(measureKey);
    } else {
        currentState.checkedMeasures.add(measureKey);
    }
    renderRiskChecklist();
    saveDraft();
}

function toggleHazardExpand(key) {
    if (!currentState.expandedHazardKeys) currentState.expandedHazardKeys = new Set();
    if (currentState.expandedHazardKeys.has(key)) {
        currentState.expandedHazardKeys.delete(key);
    } else {
        currentState.expandedHazardKeys.add(key);
    }
    renderRiskChecklist();
}

function renderRiskItem(item) {
    if (!currentState.expandedHazardKeys) currentState.expandedHazardKeys = new Set();
    if (!currentState.checkedMeasures) currentState.checkedMeasures = new Set();
    if (!currentState.checkedImprovements) currentState.checkedImprovements = new Set();
    if (!currentState.customRiskScores) currentState.customRiskScores = {};

    const hazardKey = item.hash || getHash(item.위험요인 || item.작업단계);
    const isExpanded = currentState.expandedHazardKeys.has(hazardKey);
    const scores = getTaskRiskScore(hazardKey);
    
    // 조치 사항 분리 (Gap-Analysis)
    const allMeasures = smartSplit(item.현재안전조치_이행내역 || item.현재안전조치 || "");
    const uncheckedMeasures = [];
    allMeasures.forEach((m, idx) => {
        if (!currentState.checkedMeasures.has(`${hazardKey}_MEASURE_${idx}`)) {
            uncheckedMeasures.push({ text: m, index: idx });
        }
    });

    const isFullyChecked = allMeasures.length > 0 && uncheckedMeasures.length === 0;

    return `
        <div class="risk-item-row" id="risk-${hazardKey}" style="background:white; border-radius:24px; padding:1.25rem; border:1.5px solid ${isFullyChecked ? 'var(--doing-blue)' : '#f1f5f9'}; margin-bottom:1rem; box-shadow: var(--shadow-sm); transition:all 0.3s ease;">
            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div onclick="toggleHazardExpand('${hazardKey}')" style="flex:1; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <span style="background:${isFullyChecked ? '#eff6ff' : '#f8fafc'}; color:${isFullyChecked ? 'var(--doing-blue)' : '#64748b'}; padding:4px 10px; border-radius:30px; font-size:0.7rem; font-weight:850; border: 1px solid ${isFullyChecked ? '#dbeafe' : '#f1f5f9'};">
                            ${isFullyChecked ? '점검완료' : '점검필요'}
                        </span>
                        <span style="color:#94a3b8; font-size:0.75rem; font-weight:800;">${item.재해유형 || "안전유형"}</span>
                    </div>
                    <div style="font-weight:950; color:#1e293b; font-size:1.15rem; line-height:1.4;">${item.위험요인}</div>
                </div>
                <button onclick="toggleHazardExpand('${hazardKey}')" style="background:${isExpanded ? '#f1f5f9' : 'transparent'}; border:none; width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="chevron-down" style="width:20px; color:#64748b; transform:rotate(${isExpanded ? '180deg' : '0deg'}); transition:0.3s;"></i>
                </button>
            </div>

            <!-- Body -->
            <div id="hazard-extra-${hazardKey}" style="display:${isExpanded ? 'block' : 'none'}; margin-top:20px; padding-top:20px; border-top:1.5px dashed #f1f5f9;">
                
                <!-- 현재 조치 -->
                <div style="margin-bottom:20px;">
                    <div style="font-size:0.8rem; color:#64748b; font-weight:850; margin-bottom:12px;">🧪 현재 안전조치 확인 (이행 체크)</div>
                    <div style="display:grid; gap:8px;">
                        ${allMeasures.map((m, idx) => {
                            const isMChecked = currentState.checkedMeasures.has(`${hazardKey}_MEASURE_${idx}`);
                            return `
                                <div onclick="toggleMeasureCheck('${hazardKey}', ${idx})" style="display:flex; align-items:center; gap:12px; padding:14px; background:${isMChecked ? '#f0f9ff' : '#f8fafc'}; border:1px solid ${isMChecked ? '#bae6fd' : '#f1f5f9'}; border-radius:16px; cursor:pointer;">
                                    <div style="width:22px; height:22px; border-radius:7px; background:${isMChecked ? 'var(--doing-blue)' : 'white'}; border: 2px solid ${isMChecked ? 'var(--doing-blue)' : '#cbd5e1'}; display:flex; align-items:center; justify-content:center;">
                                        ${isMChecked ? '<i data-lucide="check" style="width:14px; color:white; stroke-width:3.5;"></i>' : ''}
                                    </div>
                                    <div style="font-size:0.95rem; color:${isMChecked ? '#0369a1' : '#475569'}; font-weight:${isMChecked ? '800' : '650'};">${m}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- 위험도 선택 (Dropdown Inline) -->
                    <div style="margin-top:15px; background:#f8fafc; padding:12px 15px; border-radius:18px; border:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <span style="font-size:0.75rem; font-weight:900; color:#475569; white-space:nowrap;">현재 위험성</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                             <label style="font-size:0.75rem; color:#94a3b8; font-weight:800;">빈도</label>
                             <select onchange="updateRiskScore('${hazardKey}', 'current', 'L', this.value)" style="border:1px solid #e2e8f0; border-radius:8px; padding:4px 8px; font-weight:800; color:#1e293b; background:white;">
                                ${[1,2,3,4,5].map(v => `<option value="${v}" ${scores.current.L == v ? 'selected' : ''}>${v}</option>`).join('')}
                             </select>
                             <label style="font-size:0.75rem; color:#94a3b8; font-weight:800;">강도</label>
                             <select onchange="updateRiskScore('${hazardKey}', 'current', 'S', this.value)" style="border:1px solid #e2e8f0; border-radius:8px; padding:4px 8px; font-weight:800; color:#1e293b; background:white;">
                                ${[1,2,3,4,5].map(v => `<option value="${v}" ${scores.current.S == v ? 'selected' : ''}>${v}</option>`).join('')}
                             </select>
                             <span style="background:var(--doing-blue); color:white; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.9rem; min-width:45px; text-align:center;">R: ${scores.current.R}</span>
                        </div>
                    </div>
                </div>

                <!-- 개선 대책 (Red Thema) -->
                <div style="border-top:1.5px solid #f8fafc; padding-top:20px;">
                    <div style="font-size:0.8rem; color:#ef4444; font-weight:850; margin-bottom:12px;">🚀 추가 개선대책 (미이행 조치 자동 전이)</div>
                    <div style="display:grid; gap:8px;">
                        ${uncheckedMeasures.length > 0 ? 
                            uncheckedMeasures.map(item => {
                                const isIChecked = currentState.checkedImprovements.has(`${hazardKey}_IMP_${item.index}`);
                                return `
                                    <div onclick="toggleImprovementCheck('${hazardKey}', ${item.index})" style="display:flex; align-items:center; gap:12px; padding:15px; border-radius:18px; cursor:pointer; background:${isIChecked ? '#ecfdf5' : '#fff1f2'}; border:1.5px solid ${isIChecked ? '#6ee7b7' : '#fecaca'}; transition:0.2s;">
                                        <div style="width:22px; height:22px; border-radius:7px; background:${isIChecked ? '#10b981' : 'white'}; border: 2px solid ${isIChecked ? '#10b981' : '#f87171'}; display:flex; align-items:center; justify-content:center;">
                                            ${isIChecked ? '<i data-lucide="check" style="width:14px; color:white; stroke-width:3.5;"></i>' : ''}
                                        </div>
                                        <div style="font-size:0.95rem; color:${isIChecked ? '#065f46' : '#b91c1c'}; font-weight:800; line-height:1.5;">${item.text}</div>
                                    </div>
                                `;
                            }).join('') :
                            `<div style="background:#f0fdf4; color:#16a34a; padding:15px; border-radius:16px; text-align:center; font-weight:800; font-size:0.9rem;">✅ 모든 위험 요인이 제거되었습니다.</div>`
                        }
                    </div>

                    <!-- 개선 후 위험도 (Dropdown Inline) -->
                    <div style="margin-top:15px; background:#f0fdf4; padding:12px 15px; border-radius:18px; border:1px solid #dcfce7; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                        <span style="font-size:0.75rem; font-weight:900; color:#166534; white-space:nowrap;">개선 후 목표</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                             <label style="font-size:0.75rem; color:#86efac; font-weight:800;">빈도</label>
                             <select onchange="updateRiskScore('${hazardKey}', 'improved', 'L', this.value)" style="border:1px solid #bbf7d0; border-radius:8px; padding:4px 8px; font-weight:800; color:#166534; background:white;">
                                ${[1,2,3,4,5].map(v => `<option value="${v}" ${scores.improved.L == v ? 'selected' : ''}>${v}</option>`).join('')}
                             </select>
                             <label style="font-size:0.75rem; color:#86efac; font-weight:800;">강도</label>
                             <select onchange="updateRiskScore('${hazardKey}', 'improved', 'S', this.value)" style="border:1px solid #bbf7d0; border-radius:8px; padding:4px 8px; font-weight:800; color:#166534; background:white;">
                                ${[1,2,3,4,5].map(v => `<option value="${v}" ${scores.improved.S == v ? 'selected' : ''}>${v}</option>`).join('')}
                             </select>
                             <span style="background:#10b981; color:white; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.9rem; min-width:45px; text-align:center;">R: ${scores.improved.R}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}





function clearSignature() {
    if (window.signaturePad) window.signaturePad.clear();
}

async function submitLog() {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay ? overlay.querySelector('.loader-text') || overlay.querySelector('p') : null;

    const activeTask = (currentState.selectedTask || "").trim();
    const activeDept = (currentState.selectedDept || "").trim();
    const workerNames = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : (currentState.selectedWorker || '');

    const logs = preparePreviewData();

    if (!logs || logs.length === 0) {
        showToast("⚠️ 제출할 점검 항목이 없습니다.");
        return;
    }

    // [v35.4.4] 최종 데이터 페이로드 구성
    const formattedLogs = logs.map(l => {
        const hazardKey = l.hash || getHash(l.위험요인 || l.작업단계);
        const impData = currentState.improvementData[hazardKey] || { photo: "", memo: "" };
        
        // [v35.8.6] code.gs (서버) 100라인 로직에 맞춘 키 정렬 및 폴백 강화 (step, 작업단계)
        const currentStep = (l.작업단계 || l.step || "").trim() || (currentState.selectedTask || "작업 진행").trim();
        
        return {
            "step_name": currentStep,   // [v35.8.8] code.gs v32.0 (라인 101) 규격 호환
            "step": currentStep,        
            "작업단계": currentStep,    
            "작업 단계": currentStep,   
            "hazard": (l.위험요인 || "결과 요약").trim(),




            current_measures: l.현재안전조치_이행내역 || "이상 없음",
            improvements_checked: l.개선대책_이행내역 || "추가 개선사항 없음",
            current_frequency: l.현재_빈도 || "1",
            current_severity: l.현재_강도 || "1",
            current_score: l.현재_위험성 || "1",
            residual_frequency: l.개선_빈도 || "1",
            residual_severity: l.개선_강도 || "1",
            residual_score: l.개선_위험성 || "1",
            improvement_photo: impData.photo, // 개별 항목 개선 사진
            improvement_memo: impData.memo      // 현장 조치 의견
        };


    });

    const signatureData = (window.signaturePad && !window.signaturePad.isEmpty()) ? window.signaturePad.toDataURL() : "";

    const payload = {
        type: "LOG_SUBMISSION",
        targetSheet: "위험성평가실시",
        department: activeDept,
        task: activeTask,
        worker: workerNames,
        logs: formattedLogs,
        signature: signatureData,
        timestamp: new Date().toISOString()
    };

    try {
        if (overlay) overlay.classList.add('active');
        if (loadingText) loadingText.textContent = "구글 시트로 데이터를 전송하고 있습니다...";

        // [v35.4.4] GAS 전송 프로토콜 (CORS 무시 모드)
        const response = await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        // no-cors 모드에서는 응답을 읽을 수 없으므로 성공으로 간주하고 처리
        showToast("✅ 위험성평가가 성공적으로 제출되었습니다.");
        
        // 제출 후 상태 클린업
        const draftKey = `KOMIPO_V34_DRAFT_${activeDept}`;
        localStorage.removeItem(draftKey);
        saveToHistory(payload);

        // [v35.6.3] 성공 화면 전환 및 자동 홈 복귀 로직
        switchPhase('step-success');
        const successTaskName = document.getElementById('success-task-name');
        if (successTaskName) successTaskName.textContent = activeTask;

        // 3초 후 메인 홈페이지로 자동 복귀
        setTimeout(() => {
            console.log("⏱ Auto-redirecting to Home...");
            if (currentState.currentPhase === 'step-success') {
                goHome();
            }
        }, 3000);

    } catch (error) {
        console.error("Submission Error:", error);
        showToast("❌ 전송 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
        if (overlay) overlay.classList.remove('active');
    }
}


/**
 * [v35.6.1] 데이터 가공 엔진: 체크된 항목만 추출하도록 고도화
 */
function preparePreviewData() {
    const logs = [];
    if (!currentState.selectedDept || !currentState.selectedTask) return [];

    const combinedKey = `${normalizeSearch(currentState.selectedDept)}|${normalizeSearch(currentState.selectedTask)}`;
    const filteredRisks = currentState.riskIndex[combinedKey] || [];
    
    filteredRisks.forEach(item => {
        const hazardKey = item.hash || getHash(item.위험요인 || item.작업단계);
        const scores = getTaskRiskScore(hazardKey);
        
        const allMeasures = smartSplit(item.현재안전조치_이행내역 || item.현재안전조치 || "");
        const implementedList = []; // BLUE Checked
        const improvementList = []; // RED Checked

        allMeasures.forEach((m, idx) => {
            const mKey = `${hazardKey}_MEASURE_${idx}`;
            const iKey = `${hazardKey}_IMP_${idx}`;
            
            if (currentState.checkedMeasures.has(mKey)) {
                implementedList.push(m);
            }
            if (currentState.checkedImprovements.has(iKey)) {
                improvementList.push(m);
            }
        });

        // [v35.8.6] 체크가 하나라도 있는 항목만 결과 리스트에 포함
        if (implementedList.length > 0 || improvementList.length > 0) {
            const stepName = (item.작업단계 || "작업 진행").toString().trim().normalize('NFC');
            logs.push({
                ...item,
                step: stepName, 
                작업단계: stepName, // [v35.8.6] NFC 정규화 및 고정 매핑
                현재안전조치_이행내역: implementedList.join('\n'), 
                개선대책_이행내역: improvementList.join('\n'),   

                hasBlueCheck: implementedList.length > 0,
                hasActiveImprovement: improvementList.length > 0,
                부서명: currentState.selectedDept,
                작업명: currentState.selectedTask,
                // [v35.6.4] 점수 데이터 복구
                현재_빈도: scores.current.L,
                현재_강도: scores.current.S,
                현재_위험성: scores.current.R,
                개선_빈도: scores.improved.L,
                개선_강도: scores.improved.S,
                개선_위험성: scores.improved.R
            });
        }
    });
    return logs;
}






/**
 * [v34.7.2-PREMIUM] 최종 서명 전 점검 결과 미리보기 렌더링
 */
function renderRiskPreview() {
    const container = document.getElementById('preview-results-area');
    if (!container) return;
    
    const logs = preparePreviewData();
    const workerNames = currentState.selectedWorkers.join(', ') || '미입력';
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div style="padding:60px; text-align:center; color:#94a3b8; font-weight:700;">
                <i data-lucide="alert-circle" style="width:40px; height:40px; margin-bottom:12px; display:block; margin:0 auto; opacity:0.3;"></i>
                <div>체크된 점검 항목이 없습니다.</div>
                <div style="font-size:0.8rem; margin-top:5px; font-weight:500;">이전 단계에서 위험 요소를 확인해 주세요.</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }
    
    let html = `
        <div class="preview-wrap" style="padding: 1.5rem;">
            <!-- [v34.7.2] Summary Header Card -->
            <div class="summary-header-card" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 20px; padding: 1.5rem; margin-bottom: 2rem; color: white; box-shadow: var(--shadow-lg);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                    <div>
                        <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.5px;">안전 점검 요약 리포트</div>
                        <div style="font-weight: 950; font-size: 1.3rem; letter-spacing: -0.5px;">${currentState.selectedTask}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 12px; text-align: right;">
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800;">총 점검 건수</div>
                        <div style="font-size: 1.1rem; font-weight: 900; color: #38bdf8;">${logs.length}건</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                    <div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; margin-bottom: 2px;">담당 부서</div>
                        <div style="font-size: 0.85rem; font-weight: 700;">${currentState.selectedDept}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; margin-bottom: 2px;">평가 참여자</div>
                        <div style="font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${workerNames}</div>
                    </div>
                </div>
            </div>
            <div style="display: grid; gap: 16px;">
    `;
    
    logs.forEach((l, i) => {
        const hazardKey = l.hash || getHash(l.위험요인 || l.작업단계);
        const impData = currentState.improvementData[hazardKey] || { photo: "", memo: "" };
        
        html += `
            <div class="preview-item-card" style="background: white; border-radius: 22px; padding: 1.5rem; border: 1.5px solid #f1f5f9; box-shadow: 0 4px 20px rgba(0,0,0,0.03); margin-bottom:15px;">
                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                    <div style="background: #eff6ff; color: #2563eb; width: 28px; height: 28px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; flex-shrink: 0; border: 1px solid #dbeafe;">${i+1}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.75rem; color: #2563eb; font-weight: 900; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; background: #eff6ff; width: fit-content; padding: 2px 8px; border-radius: 6px; border: 1px solid #dbeafe;">
                            <i data-lucide="layers" style="width:12px;"></i> ${l.작업단계}
                        </div>

                        <div style="font-weight: 850; color: #1e293b; font-size: 1rem; line-height: 1.45;">${l.위험요인}</div>
                    </div>
                </div>
                <div style="display: grid; gap: 10px;">
                    <!-- 현재 조치 (Blue Checked) -->
                    ${l.현재안전조치_이행내역 ? `
                    <div style="background: #f8fafc; border-radius: 14px; padding: 12px 16px; border-left: 4px solid #3b82f6;">
                        <div style="font-size: 0.65rem; color: #3b82f6; font-weight: 850; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="shield-check" style="width:12px;"></i> 이행 완료 안전조치 (Blue)
                        </div>
                        <div style="font-size: 0.85rem; color: #334155; font-weight: 600; line-height: 1.6; white-space: pre-wrap;">${l.현재안전조치_이행내역}</div>
                    </div>
                    ` : ''}

                    <!-- 개선 조치 (Red Checked) -->
                    ${l.개선대책_이행내역 || impData.photo || impData.memo ? `
                    <div style="background: #fff1f2; border-radius: 14px; padding: 12px 16px; border-left: 4px solid #ef4444; border: 1px solid #fecaca;">
                        <div style="font-size: 0.65rem; color: #ef4444; font-weight: 850; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="zap" style="width:12px;"></i> 추가 개선 조치 (Red)
                        </div>
                        ${l.개선대책_이행내역 ? `<div style="font-size: 0.85rem; color: #b91c1c; font-weight: 700; line-height: 1.6; margin-bottom: 8px; white-space: pre-wrap;">${l.개선대책_이행내역}</div>` : ''}
                        ${impData.photo ? `<img src="${impData.photo}" style="width:100%; border-radius:10px; margin-bottom:10px; border:1px solid #fecaca;">` : ''}
                        ${impData.memo ? `<div style="font-size: 0.85rem; color: #b91c1c; font-weight: 600; font-style: italic;">조치 의견: ${impData.memo}</div>` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    
    html += `
            </div>
            <div style="margin-top:25px; text-align:center; color:#94a3b8; font-size:0.75rem; font-weight:700; background: #f1f5f9; padding: 12px; border-radius: 14px;">
                <i data-lucide="lock" style="width:14px; vertical-align:middle; margin-right:4px;"></i>
                위 내용은 블록체인 방식으로 보안 저장되며 수정이 불가능합니다.
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

/**
 * [v35.6.0] Phase 3: 개선 조치 및 사진 촬영 렌더링 엔진 (빨간 체크박스 전용)
 * - 사용자가 2단계에서 빨간색 체크박스(추가 개선대책)를 누른 항목만 노출합니다.
 */
function renderImprovementPhase() {
    const container = document.querySelector('#step-improvement .improvement-content-area');
    if (!container) return;
    
    // 1. 현재 필터링된 모든 로그 가져오기
    const allLogs = preparePreviewData();
    
    // 2. [v35.6.0] 빨간색 체크박스(checkedImprovements)가 선택된 항목만 필터링
    const improvementTargetLogs = allLogs.filter(l => l.hasActiveImprovement === true);
    
    console.log(`[DEBUG] Step 3 Filtered Logs:`, improvementTargetLogs.length);

    if (improvementTargetLogs.length === 0) {
        container.innerHTML = `
            <div style="background:#fefce8; padding:40px; border-radius:30px; border:1px solid #fef08a; text-align:center;">
                <i data-lucide="shield-check" style="width:48px; height:48px; color:#eab308; margin-bottom:20px;"></i>
                <div style="font-weight:900; font-size:1.2rem; color:#854d0e;">별점/빨간색 체크 없음</div>
                <p style="font-size:0.9rem; color:#a16207; margin-top:10px;">이전 단계에서 **빨간색 체크박스**를 누르지 않았습니다.<br>추가 개선 사진이 불필요한 경우 그대로 진행하세요.</p>
                <button class="btn btn-primary" onclick="switchPhase('step-4')" style="margin-top:25px; width:100%;">최종 리포트로 진행하기</button>
                <button class="btn btn-secondary" onclick="switchPhase('step-2')" style="margin-top:10px; width:100%;">누락된 체크 하러 가기 (RED)</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="display:grid; gap:16px; padding: 5px;">
                <div style="background: #fef2f2; border-radius: 18px; padding: 15px; border: 1.5px solid #fecaca; color: #b91c1c; font-size: 0.85rem; font-weight: 800; display: flex; gap: 10px; align-items: center;">
                    <i data-lucide="camera"></i>
                    RED 체크박스를 선택한 항목(${improvementTargetLogs.length}건)에 대해서만 개선 사진을 등록하세요.
                </div>
                
                ${improvementTargetLogs.map((l, i) => {
                    const hKey = l.hash || getHash(l.위험요인 || l.작업단계);
                    const data = currentState.improvementData[hKey] || { photo: "", memo: "" };
                    return `
                        <div class="improvement-card" style="background:white; border-radius:24px; padding:1.5rem; border:1.5px solid #f1f5f9; box-shadow: var(--shadow-sm);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                                <div style="font-size:0.75rem; color:#ef4444; font-weight:900; letter-spacing:1px;">개선 증빙 #${i+1}</div>
                                <div style="background:#fef2f2; color:#ef4444; padding:4px 10px; border-radius:8px; font-size:0.65rem; font-weight:800;">RED CHECK 필수</div>
                            </div>
                            <div style="font-weight:950; color:#1e293b; font-size:1.05rem; margin-bottom:14px; line-height:1.4;">${l.위험요인}</div>
                            
                            <div onclick="handlePhotoUpload('${hKey}')" style="width:100%; height:180px; background:#f8fafc; border:2px dashed #e2e8f0; border-radius:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; position:relative; margin-bottom:15px;">
                                ${data.photo ? 
                                    `<img src="${data.photo}" style="width:100%; height:100%; object-fit:cover;">` : 
                                    `<div style="text-align:center; color:#94a3b8;">
                                        <i data-lucide="camera" style="width:36px; height:36px; margin:0 auto 10px; display:block;"></i>
                                        <div style="font-size:0.85rem; font-weight:800;">현장 조치 후 촬영</div>
                                     </div>`
                                }
                            </div>
                            <textarea oninput="handleMemoInput('${hKey}', this.value)" placeholder="현장 조치 의견을 입력하세요..." style="width:100%; min-height:80px; border:1px solid #e2e8f0; border-radius:14px; padding:12px; font-size:0.9rem; font-family:inherit; resize:none;">${data.memo}</textarea>
                        </div>
                    `;
                }).join('')}
                
                <div style="display:grid; grid-template-columns: 1fr 2fr; gap:12px; margin-top:10px;">
                    <button class="btn btn-secondary" onclick="switchPhase('step-2')" style="height:72px; border-radius:24px; font-weight:800;">
                        <i data-lucide="arrow-left" style="width:18px;"></i> 이전단계
                    </button>
                    <button class="btn btn-primary" onclick="switchPhase('step-4')" style="height:72px; border-radius:24px; font-size: 1.1rem; box-shadow: 0 15px 30px rgba(13, 110, 253, 0.25);">
                        리포트 결과 확인 <i data-lucide="chevron-right"></i>
                    </button>
                </div>
                <p style="text-align:center; font-size:0.75rem; color:#94a3b8; font-weight:700; margin-top:15px;">v35.6.8 | Strict Filtering Applied</p>

            </div>
        `;
    }
    
    if (window.lucide) window.lucide.createIcons();
}




/**
 * [v34.6.9-FINAL] 하단 공통 단계 이동 버튼 렌더러
 */
function renderPhaseButtons(phase) {
    const container = document.getElementById('next-action-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (phase === 'step-2') {
        const checkedCount = currentState.checkedItems.size;
        container.innerHTML = `
            <div style="margin-top:20px; padding:20px; background:white; border-radius:24px; border:1px solid #f1f5f9; box-shadow:var(--shadow-md);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span style="font-size:0.85rem; font-weight:800; color:#64748b;">점검 진행 현황</span>
                    <span style="font-size:0.85rem; font-weight:900; color:var(--doing-blue);">${checkedCount}개 항목 확인됨</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 2fr; gap:12px;">
                    <button class="btn btn-secondary" onclick="switchPhase('step-evaluators')" style="height:64px; border-radius:18px; font-weight:800;">
                        <i data-lucide="arrow-left" style="width:18px;"></i> 이전단계
                    </button>
                    <button class="btn btn-primary" onclick="switchPhase('step-improvement')" style="height:64px; border-radius:18px;">
                        개선 조치 단계로 이동 <i data-lucide="chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

    }
    
    if (window.lucide) window.lucide.createIcons();
}

// [v34.6.4] 로컬 데이터 동기화 및 부팅 시퀀스
window.onload = init;

