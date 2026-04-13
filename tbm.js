/**
 * TBM (Tool Box Meeting) Core Logic
 * Only Risk assessment & Feedback system
 */

let signaturePad;

document.addEventListener('DOMContentLoaded', () => {
    initSignature();
    loadTBMData();
});

function initSignature() {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgba(255, 255, 255, 0)',
            penColor: 'rgb(30, 41, 59)'
        });
        
        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
            signaturePad.clear();
        }
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
    }
}

function clearSignature() {
    if (signaturePad) signaturePad.clear();
}

/**
 * [v34.4.3] TBM 데이터 로드 및 렌더링
 */
async function loadTBMData() {
    const container = document.getElementById('tbm-checklist-container');
    if (!container) return;

    // 로컬 히스토리에서 가장 최근 데이터 가져오기
    const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    if (history.length === 0) {
        container.innerHTML = `
            <div style="padding:40px; text-align:center; color:#94a3b8;">
                <i data-lucide="search" style="width:48px; height:48px; margin:0 auto 15px; display:block; opacity:0.3;"></i>
                <div style="font-weight:700;">진행 중인 위험성평가 기록이 없습니다.</div>
                <div style="font-size:0.8rem; margin-top:8px;">평가를 먼저 완료해 주세요.</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const data = history[0];
    document.getElementById('tbm-dept-name').textContent = data.작업부서 || data.부서명 || "-";
    document.getElementById('tbm-task-name').textContent = data.작업명 || "-";
    document.getElementById('tbm-worker-names').textContent = data.worker || "-";

    const logs = data.logs || [];
    container.innerHTML = logs.map((l, i) => `
        <div class="tbm-item-card" style="background:white; border-radius:16px; padding:1.25rem; margin-bottom:12px; border:1px solid #f1f5f9;">
            <div style="display:flex; align-items:flex-start; gap:12px;">
                <div style="background:#f0f9ff; color:#0ea5e9; width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.75rem;">${i+1}</div>
                <div style="flex:1;">
                    <div style="font-size:0.7rem; color:#94a3b8; font-weight:700; margin-bottom:4px;">${l.작업단계 || "일반"}</div>
                    <div style="font-weight:700; color:#1e293b; font-size:0.95rem; margin-bottom:12px;">${l.위험요인 || l.hazard}</div>
                    
                    <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:12px;">
                        <div style="font-size:0.65rem; color:#64748b; font-weight:800; margin-bottom:4px;">안전조치 및 교육내용</div>
                        <div style="font-size:0.85rem; color:#475569; font-weight:600; line-height:1.4;">${l.개선대책 || l.improvement_measure || "이상 없음"}</div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">내용을 확인하고 이해하였습니까?</span>
                        <div style="display:flex; gap:8px;">
                            <label class="tbm-check">
                                <input type="radio" name="tbm_check_${i}" value="yes" checked>
                                <span>예</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

/**
 * [v34.4.3] TBM 완료 처리
 */
async function submitTBM() {
    if (signaturePad && signaturePad.isEmpty()) {
        alert("서명을 완료해 주세요.");
        return;
    }

    const feedback = document.getElementById('tbm-feedback')?.value || "";
    const signature = signaturePad.toDataURL();

    // 로컬 히스토리에 TBM 상태 업데이트
    const history = JSON.parse(localStorage.getItem('kosha_history') || '[]');
    if (history.length > 0) {
        history[0].tbm_completed = true;
        history[0].tbm_feedback = feedback;
        history[0].tbm_signature = signature;
        localStorage.setItem('kosha_history', JSON.stringify(history));
    }

    // 서버 전송 (배경)
    const payload = {
        type: 'TBM',
        feedback: feedback,
        signature: signature,
        timestamp: new Date().toLocaleString()
    };

    // [v34.4.3] 배경 전송 시도
    fetch("https://script.google.com/macros/s/AKfycbyvavs2Dk-OKQpIsxNcs5LwXNHjibiUcHvTTEfngo4YMBBe94Vt5VTmrOWZo2otLuaieg/exec", {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("TBM sync success");
    }).catch(e => console.warn("TBM sync failed:", e));

    document.getElementById('tbm-main').style.display = 'none';
    document.getElementById('tbm-success').style.display = 'block';
    
    if (window.lucide) window.lucide.createIcons();
}

function closeTBM() {
    window.close();
}
