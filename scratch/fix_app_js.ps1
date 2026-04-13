
$lines = Get-Content "app.js" -Encoding utf8
$newLines = @()

# Up to line 603
$newLines += $lines[0..602]

# New function
$func = @"
function selectAssessmentTask(task) {
    currentState.selectedTask = (task || "").trim();
    console.log("Selected Task: " + currentState.selectedTask);
    
    currentState.selectedExtra = (window.MASTER_DATA && window.MASTER_DATA.extraInfo) ? 
        window.MASTER_DATA.extraInfo.find(ex => 
            (ex.부서명||"").trim() === (currentState.selectedDept||"").trim() && 
            (ex.작업명||"").trim() === (task||"").trim()
        ) : null;
        
    renderExtraInfoInWorkerStep();
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
        homeBtn.innerHTML = '<button class=\"btn btn-secondary\" onclick=\"handleStep1Back()\">이전단계</button><button class=\"btn btn-primary\" onclick=\"nextStep(2)\">다음단계</button>';
        if (window.lucide) window.lucide.createIcons();
    }
}
"@
$newLines += $func

# Find hydrateStateFromLogs
$startIndex = 0
for ($i = 630; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "function hydrateStateFromLogs") {
        $startIndex = $i
        break
    }
}

if ($startIndex -gt 0) {
    $newLines += $lines[$startIndex..($lines.Length-1)]
}

# Toast removal
for ($i = 1400; $i -lt $newLines.Length -and $i -lt 1600; $i++) {
    if ($newLines[$i] -match "최신 데이터와 동기화되었습니다") {
        $newLines[$i] = "        // Toast removed: 최신 데이터와 동기화되었습니다."
    }
}

$newLines | Set-Content "app.js" -Encoding utf8
