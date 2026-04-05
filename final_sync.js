const fs = require('fs');

async function perfectRestore() {
    console.log('--- Phase: Restoration of THE Good Version (v25.4.4) ---');
    
    // 1. Read the "Good" Source from our found jewel
    let content = fs.readFileSync('index_gas_v25.html', 'utf8');

    // 2. GAS URL Update (The heart of data sync)
    const NEW_GAS_URL = "https://script.google.com/macros/s/AKfycbzmS6hN33FeJ9yZwpyTjJDjW4ogmsWv8Wu8JZZyqvHGcAdjudlPoud4wSdxlnONnu5w6w/exec/exec";
    content = content.replace(/const GAS_URL = \".*?\";/, `const GAS_URL = \"${NEW_GAS_URL}\";`);

    // 3. Header Sync (v25.0 -> v25.2 as seen in screenshot)
    content = content.replace(/v25\.0/g, 'v25.2');
    content = content.replace('?œêµ­ì¤‘ë?ë°œì „ ?¤ë§ˆ???ˆì „', '?œêµ­ì¤‘ë?ë°œì „');

    // 4. Stepper Labels Sync [?‘ì—…, ?„í—˜, ê°œì„ , ?œëª…]
    content = content.replace('<span>1</span><label>?•ë³´</label>', '<span>1</span><label>?‘ì—…</label>');
    content = content.replace('<span>2</span><label>?”ì¸</label>', '<span>2</span><label>?„í—˜</label>');

    // 5. Section 1: "?‰ê????•ë³´ ë°?ë¶€??? íƒ" Title & Subtext
    content = content.replace('<h2>?‰ê???ë°??‘ì—… ? íƒ</h2>', '<h2>?‰ê????•ë³´ ë°?ë¶€??? íƒ</h2>');
    content = content.replace('<p>?±í•¨???…ë ¥?˜ê³  ?Œì† ë¶€?œì? ?˜í–‰ ?‘ì—…??? íƒ?˜ì„¸??</p>', '<p>?±ëª…??? íƒ?˜ê³  ?Œì† ë¶€?œë? ?´ë¦­?˜ì„¸??</p>');

    // 6. Worker Input UI Enhancement (The '+ ì¶”ê?' Button)
    const workerInputUI = `
    <div class="worker-input-card" style="background:white; border-radius:24px; padding:20px; border:1px solid #f1f5f9; box-shadow:var(--shadow-sm); margin-bottom:20px;">
        <label style="font-size: 0.85rem; font-weight: 800; color: #64748b; margin-bottom: 8px; display: block;">?‰ê????±ëª… (?¤ì¤‘ ? íƒ ê°€??</label>
        <div style="display: flex; gap: 10px;">
            <input type="text" id="worker-input" class="ui-input" placeholder="?‰ê????±ëª… ?…ë ¥" style="margin-bottom:0;">
            <button class="btn btn-primary" style="width:100px; height:52px; background:var(--doing-indigo); font-size:0.9rem;">+ ì¶”ê?</button>
        </div>
        <p style="font-size:0.75rem; color:#94a3b8; font-style:italic; margin-top:8px;">? íƒ???‰ê??ê? ?†ìŠµ?ˆë‹¤.</p>
    </div>`;
    content = content.replace(/<div style=\"margin-bottom: 1\.5rem;\">[\s\S]*?<input type=\"text\" id=\"worker-input\"[\s\S]*?<\/div>/, workerInputUI);

    // 7. Dept Cards: Building Icon & Subtext Restoration
    content = content.replace(
        'btn.innerHTML = `<div class="icon-box color-blue" style="width:40px; height:40px; margin:0 15px 0 0;"><i data-lucide="layers"></i></div>\n                                 <strong style="font-size:1rem;">${dept}</strong>`;',
        'btn.innerHTML = `\n                    <div class="icon-box" style="background:#e0f2fe; color:#3b82f6; width:48px; height:48px; margin:0 15px 0 0;">\n                        <i data-lucide="building"></i>\n                    </div>\n                    <div style="display:flex; flex-direction:column; flex:1;">\n                        <strong style="font-size:1.1rem; color:#1e293b;">${dept}</strong>\n                        <span style="font-size:0.8rem; color:#64748b; font-weight:600;">?‰ê? ?€??ë¶€??/span>\n                    </div>\n                    <i data-lucide="chevron-right" style="color:#cbd5e1; width:20px;"></i>`;'
    );

    // 8. Style adjustment for building icon & chips (Adding building specifically if missing)
    if (!content.includes('data-lucide="building"')) {
        // Safe to assume lucide will handle 'building' if script is there
    }

    // 9. Ensuring all Logs and UI match the "Premium" look
    content = content.replace('<h3>?Œì† ë¶€??? íƒ</h3>', ''); // Removing redundant titles

    fs.writeFileSync('index.html', content, 'utf8');
    console.log('--- Restoration Success: index.html updated to v25.4.4 (The Good Version) ---');
}

perfectRestore().catch(console.error);
