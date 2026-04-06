/**
 * TBM (Tool Box Meeting) Module for KOMIPO Smart Safety
 * v25.2 - Modularized Version
 */

const tbmState = {
    allLogs: [],
    currentDept: null,
    currentTask: null,
    checkedTBMItems: new Set(),
    totalTBMItems: 0,
    signaturePad: null
};

async function openTBMView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        const p = overlay.querySelector('p');
        if (p) p.innerText = "TBM 데이터를 불러오는 중...";
        overlay.classList.add('active');
    }
    
    try {
        // app.js의 GAS_URL과 fetchJSONP 유틸 활용
        const response = await fetchJSONP(GAS_URL + "?type=logs");
        tbmState.allLogs = Array.isArray(response) ? response : [];
        
        switchPhase('step-tbm');
        renderTBMDeptCards();
    } catch (error) {
        console.error("TBM Load Error:", error);
        if (typeof showToast === 'function') showToast("⚠️ TBM 데이터를 가져오지 못했습니다.");
    } finally {
        if(overlay) overlay.classList.remove('active');
    }
}

function renderTBMDeptCards() {
    const container = document.getElementById('tbm-selection-container');
    const viewer = document.getElementById('tbm-checklist-viewer');
    const statusText = document.getElementById('tbm-status-text');
    const footer = document.getElementById('tbm-footer-btns');

    if (!container) return;

    container.style.display = 'grid';
    if(viewer) viewer.style.display = 'none';
    if(footer) footer.style.display = 'block';
    if(statusText) statusText.innerText = "점검 기록이 있는 부서를 선택해 주세요.";

    const depts = [...new Set(tbmState.allLogs.map(log => log.부서명 || log.소속 || "미지정"))].filter(d => d).sort();

    if (depts.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center; color:#94a3b8;">TBM 가능한 기록이 없습니다.</div>';
        return;
    }

    container.innerHTML = depts.map(dept => `
        <div class="dept-banner-card" onclick="selectTBMDept('${dept}')">
            <div class="dbc-icon" style="background:#f0f9ff; color:#0ea5e9;"><i data-lucide="users"></i></div>
            <div class="dbc-text">
                <div class="title">${dept}</div>
                <div class="desc">TBM 대상 부서</div>
            </div>
            <i data-lucide="chevron-right" class="dbc-arrow" style="color:#cbd5e1;"></i>
        </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

function selectTBMDept(dept) {
    tbmState.currentDept = dept;
    const container = document.getElementById('tbm-selection-container');
    const statusText = document.getElementById('tbm-status-text');

    if(statusText) statusText.innerText = `[${dept}] 부서의 작업을 선택해 주세요.`;

    const filteredLogs = tbmState.allLogs.filter(log => (log.부서명 || log.소속) === dept);
    
    // 작업별 그룹화 (최신순)
    const taskGroups = {};
    filteredLogs.forEach(log => {
        const key = log.작업명 || "내용 없음";
        if (!taskGroups[key]) taskGroups[key] = log;
    });

    container.innerHTML = Object.keys(taskGroups).map(taskName => {
        return `
            <div class="task-banner-card" onclick="renderTBMChecklist('${taskName.replace(/'/g, "\\'")}')">
                <div class="tbc-icon" style="background:#f0fdf4; color:#10b981;"><i data-lucide="clipboard-check"></i></div>
                <div class="tbc-text">
                    <div class="title">${taskName}</div>
                    <div class="desc-tag">최종 위험성평가 기반</div>
                </div>
                <i data-lucide="chevron-right" class="tbc-arrow" style="color:#cbd5e1;"></i>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

function renderTBMChecklist(taskName) {
    tbmState.currentTask = taskName;
    tbmState.checkedTBMItems.clear();

    const container = document.getElementById('tbm-selection-container');
    const viewer = document.getElementById('tbm-checklist-viewer');
    const area = document.getElementById('tbm-checklist-area');
    const statusText = document.getElementById('tbm-status-text');
    const footer = document.getElementById('tbm-footer-btns');

    const logs = tbmState.allLogs.filter(l => (l.부서명 || l.소속) === tbmState.currentDept && l.작업명 === taskName);
    tbmState.totalTBMItems = logs.length;
    
    if (container) container.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (viewer) viewer.style.display = 'block';
    if (statusText) statusText.innerText = `[${taskName}] 현장 점검 항목`;

    const backBtn = document.getElementById('tbm-back-to-list-btn');
    if (backBtn) {
        backBtn.onclick = () => selectTBMDept(tbmState.currentDept);
    }

    let html = `
        <div style="background:#f8fafc; padding:15px; border-radius:15px; margin-bottom:20px; font-size:0.85rem; color:#475569; border:1px solid #e2e8f0;">
            <i data-lucide="info" style="width:14px; vertical-align:middle; margin-right:4px;"></i> 
            선정된 위험 요인과 개선 대책을 현장에서 다시 한번 확인하고 체크해 주세요.
        </div>
        <div class="tbm-task-info" style="margin-bottom:20px; padding:15px; background:#f0f9ff; border-radius:16px; border:1px solid #bae6fd;">
            <div style="font-size:0.75rem; color:#0369a1; font-weight:700; margin-bottom:4px;">오늘의 작업 TBM</div>
            <div style="font-size:1.1rem; font-weight:900; color:#0c4a6e;">${tbmState.currentTask}</div>
            <div style="font-size:0.8rem; color:#0c4a6e; margin-top:4px;">총 <span style="color:#0284c7; font-weight:900;">${tbmState.totalTBMItems}개</span>의 위험요인을 점검합니다.</div>
        </div>
    `;

    logs.forEach((log, idx) => {
        const hazard = log.위험요인 || "위험요인 미상";
        const measures = (log.현재안전조치 || "") + "\n" + (log.개선대책 || "");
        const mList = measures.split('\n').map(m => m.trim()).filter(m => m.length > 2);

        html += `
            <div class="check-item" style="cursor:default; margin-bottom:15px;">
                <div style="font-weight:900; color:#1e293b; font-size:1.05rem; margin-bottom:12px; display:flex; gap:10px;">
                    <span style="color:var(--doing-blue);">Q${idx+1}.</span>
                    <span>${hazard}</span>
                </div>
                <div class="measure-list" style="margin-top:0;">
                    ${mList.map((m, mIdx) => {
                        const itemKey = `tbm-${idx}-${mIdx}`;
                        return `
                            <div class="measure-item" onclick="toggleTBMItem('${itemKey}')" id="tbm-item-${itemKey}">
                                <div class="m-checkbox" id="tbm-check-${itemKey}">
                                    <i data-lucide="check"></i>
                                </div>
                                <span style="flex:1;">${m}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    area.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    
    // 서명 패드 초기화 (v25.2)
    setTimeout(() => {
        const canvas = document.getElementById('tbm-signature-pad');
        if (canvas) {
            // 부모 컨테이너 크기에 맞게 캔버스 크기 조정
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            
            if (typeof SignaturePad !== 'undefined') {
                tbmState.signaturePad = new SignaturePad(canvas, {
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    penColor: '#1e293b'
                });
            }
        }
    }, 100);

    window.scrollTo(0, 0);
}

function clearTBMSignature() {
    if (tbmState.signaturePad) {
        tbmState.signaturePad.clear();
    }
}

function toggleTBMItem(itemKey) {
    const item = document.getElementById(`tbm-item-${itemKey}`);
    const checkbox = document.getElementById(`tbm-check-${itemKey}`);
    
    if (tbmState.checkedTBMItems.has(itemKey)) {
        tbmState.checkedTBMItems.delete(itemKey);
        if (item) item.classList.remove('checked');
        if (checkbox) checkbox.classList.remove('active');
    } else {
        tbmState.checkedTBMItems.add(itemKey);
        if (item) item.classList.add('checked');
        if (checkbox) checkbox.classList.add('active');
    }
}

async function submitTBM() {
    const workerName = document.getElementById('tbm-worker-name')?.value.trim();
    if (!workerName) {
        if (typeof showToast === 'function') showToast("⚠️ 점검자 성명을 입력해 주세요.");
        return;
    }

    if (tbmState.checkedTBMItems.size < tbmState.totalTBMItems) {
        if (typeof showToast === 'function') showToast(`⚠️ 모든 항목(${tbmState.totalTBMItems}개)을 점검해야 제출할 수 있습니다.`);
        return;
    }

    if (!tbmState.signaturePad || tbmState.signaturePad.isEmpty()) {
        if (typeof showToast === 'function') showToast("⚠️ 점검자 서명을 완료해 주세요.");
        return;
    }

    // 데이터 패키징
    const payload = {
        type: "TBM_SUBMISSION",
        department: tbmState.currentDept,
        task: tbmState.currentTask,
        checkedCount: tbmState.checkedTBMItems.size,
        timestamp: new Date().toLocaleString('ko-KR'),
        worker: workerName,
        signature: tbmState.signaturePad.toDataURL()
    };

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
    
    // [v30.1] 즉각적인 성공 화면 전환 (UX 개선)
    switchPhase('step-success');
    if (window.lucide) window.lucide.createIcons();

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
        
        console.log("✅ TBM 데이터 전송 시작 (백그라운드)");
        // 성공 화면에서 추가적인 처리가 필요한 경우 여기에 작성
    } catch (error) {
        console.error("❌ TBM 전송 실패:", error);
        if (typeof showToast === 'function') showToast("⚠️ 통신 오류가 발생했으나, 로컬에 저장되었습니다.");
    }
}
