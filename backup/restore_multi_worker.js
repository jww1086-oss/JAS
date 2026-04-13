const fs = require('fs');

async function enableMultiWorker() {
    console.log('--- Phase: Enabling Multi-Worker Feature (v25.4.5) ---');
    let content = fs.readFileSync('index.html', 'utf8');

    // 1. HTML: Add ID to the '+ ì¶”ê?' button and the chips container
    content = content.replace(
        '<button class="btn btn-primary" style="width:100px; height:52px; background:var(--doing-indigo); font-size:0.9rem;">+ ì¶”ê?</button>',
        '<button type="button" id="add-worker-btn" class="btn btn-primary" style="width:100px; height:52px; background:var(--doing-indigo); font-size:0.9rem;">+ ì¶”ê?</button>\n        </div>\n        <div id="selected-workers-chips" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;"></div>'
    );
    // Ensure the ID of the 'No workers' text is present
    content = content.replace('<p style="font-size:0.75rem; color:#94a3b8; font-style:italic; margin-top:8px;">? íƒ???‰ê??ê? ?†ìŠµ?ˆë‹¤.</p>', '<p id="no-worker-msg" style="font-size:0.75rem; color:#94a3b8; font-style:italic; margin-top:8px;">? íƒ???‰ê??ê? ?†ìŠµ?ˆë‹¤.</p>');

    // 2. JS: Logic to manage selectedWorkers
    const multiWorkerJS = `
        // [Engine] ?‰ê????¤ì¤‘ ì¶”ê? ë¡œì§ (v25.4.5)
        function addWorker() {
            const input = document.getElementById('worker-input');
            const name = input.value.trim();
            if (!name) return showToast("?±ëª…???…ë ¥??ì£¼ì„¸??");
            if (currentState.selectedWorkers.includes(name)) return showToast("?´ë? ì¶”ê????±ëª…?…ë‹ˆ??");
            
            currentState.selectedWorkers.push(name);
            input.value = '';
            renderWorkerChips();
        }

        function renderWorkerChips() {
            const container = document.getElementById('selected-workers-chips');
            const noMsg = document.getElementById('no-worker-msg');
            if(!container) return;
            
            container.innerHTML = '';
            if (currentState.selectedWorkers.length === 0) {
                if(noMsg) noMsg.style.display = 'block';
            } else {
                if(noMsg) noMsg.style.display = 'none';
                currentState.selectedWorkers.forEach((name, index) => {
                    const chip = document.createElement('div');
                    chip.style = "background:var(--doing-blue); color:white; padding:4px 12px; border-radius:30px; display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:800; animation:fadeIn 0.3s forwards;";
                    chip.innerHTML = \`\${name} <i data-lucide="x" style="width:14px; cursor:pointer;" onclick="deleteWorker(\${index})"></i>\`;
                    container.appendChild(chip);
                });
                initLucide();
            }
        }

        function deleteWorker(index) {
            currentState.selectedWorkers.splice(index, 1);
            renderWorkerChips();
        }
    `;

    // Inject JS into the script block
    content = content.replace('const currentState = {', multiWorkerJS + '\n        const currentState = {');

    // Connect event listener
    content = content.replace('initLucide();', 'initLucide();\n            const addBtn = document.getElementById("add-worker-btn");\n            if(addBtn) addBtn.onclick = addWorker;');

    // 3. Output logic sync: Multiple workers joined by comma
    content = content.replace(
        "const worker = document.getElementById('worker-input').value || \"ë¯¸ì???";",
        "const worker = currentState.selectedWorkers.length > 0 ? currentState.selectedWorkers.join(', ') : (document.getElementById('worker-input').value || 'ë¯¸ì???);"
    );

    fs.writeFileSync('index.html', content, 'utf8');
    console.log('--- Success: Multi-Worker Feature Restored! ---');
}

enableMultiWorker().catch(console.error);
