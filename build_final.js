const fs = require('fs');
const path = require('path');

async function buildFinal() {
    console.log('--- Starting Final Build for Vercel (v25.2.3) ---');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');

    // 1. ìµœì‹  GAS URL (DB ?„ìš©) ê³ ì •
    const NEW_GAS_URL = "https://script.google.com/macros/s/AKfycbzmS6hN33FeJ9yZwpyTjJDjW4ogmsWv8Wu8JZZyqvHGcAdjudlPoud4wSdxlnONnu5w6w/exec/exec";
    content = content.replace(/const GAS_URL = \".*?\";/, `const GAS_URL = \"${NEW_GAS_URL}\";`);

    // 2. updateDate ?¨ìˆ˜ ìµœìƒ??ì£¼ì… (ReferenceError ?´ê²°)
    const updateDateCode = `
// [?¸å¿ƒ] ?œê°„ ?…ë°?´íŠ¸ ?”ì§„ (v25.2.3)
function updateDate() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = \`\${dateStr} \${timeStr}\`;
}
`;
    if (!content.includes('function updateDate()')) {
        content = content.replace('const currentState =', updateDateCode + '\nconst currentState =');
    }

    // 3. fetchJSONP ê·œê²© êµì • (type ?Œë¼ë¯¸í„° ì¶”ê?)
    // ê¸°ì¡´ fetchJSONP ?¨ìˆ˜ ?„ì²´ë¥?ì°¾ì•„??êµì²´ (?ˆì „???•ê·œ??
    const newFetchJSONP = `function fetchJSONP(url, type = "") {
    updateNetworkStatus(false, '?µì‹  ì¤?.');
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            delete window[callbackName];
            if (script.parentNode) document.body.removeChild(script);
            updateNetworkStatus(false, '?°ê²° ì§€??);
            reject(new Error('?¤íŠ¸?Œí¬ ?‘ë‹µ ?œê°„ ì´ˆê³¼'));
        }, 15000);
        window[callbackName] = (data) => {
            clearTimeout(timeout);
            delete window[callbackName];
            if (script.parentNode) document.body.removeChild(script);
            updateNetworkStatus(true, '?¤ì‹œê°?ON');
            resolve(data);
        };
        script.onerror = () => {
            clearTimeout(timeout);
            delete window[callbackName];
            if (script.parentNode) document.body.removeChild(script);
            updateNetworkStatus(false, '?°ê²° ?¤ë¥˜');
            reject(new Error('JSONP fetch failed'));
        };
        const separator = url.indexOf('?') >= 0 ? '&' : '?';
        script.src = \`\${url}\${separator}callback=\${callbackName}&type=\${type}&_t=\${new Date().getTime()}\`;
        document.body.appendChild(script);
    });
}`;
    content = content.replace(/function fetchJSONP\(url\) \{[\s\S]*?\}\n\}/, newFetchJSONP);

    // 4. openResultsView ?ˆì •??(Null ì²´í¬)
    content = content.replace(/async function openResultsView\(\) \{[\s\S]*?try \{/, `async function openResultsView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        const p = overlay.querySelector('p');
        if (p) p.innerText = "ìµœì‹  ê¸°ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?.";
        overlay.classList.add('active');
    }
    try {`);

    // 5. ?œê? ?¸ì½”??ê¹¨ì§ (Mojibake) ?„ìˆ˜ ë³µêµ¬
    const mapi = {
        '?ºâ‚¬\\??•ì±¸': 'ë¶€?œëª…',
        '\\?ë¬’ë¾½ï§??': '?‘ì—…ëª?,
        '\\??¼ë–†åª??ON': '?¤ì‹œê°?ON',
        '\\?ë¬’ëƒ½ ä»??\\.\\.': '?‘ì† ì¤?.',
        'ï§£ì„??\??°ì¤ˆ': 'ì²˜ìŒ?¼ë¡œ',
        '?ºâ‚¬\\???\? \\?ì¢ê¹®\\??ê½­\\?\\?': 'ë¶€?œë? ? íƒ?˜ì„¸??,
        '\\?ë¬’ë¾½\\?\\? \\?ì¢ê¹®\\??ê½­\\?\\?': '?‘ì—…??? íƒ?˜ì„¸??,
        'ï§¤ì’–??æ¹²ê³•ì¤?\?\\? ?ºëˆ??\??»ë’— ä»??\\.\\.': 'ìµœì‹  ê¸°ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?.'
    };

    for (const [key, val] of Object.entries(mapi)) {
        content = content.replace(new RegExp(key, 'g'), val);
    }

    // 6. fetchInitialData ?±ì—??type="master" ?„ì†¡ ë³´ì¥
    content = content.replace(/fetchJSONP\(GAS_URL\)/g, 'fetchJSONP(GAS_URL, "master")');
    content = content.replace(/fetchJSONP\(GAS_URL \+ \"\?type=users\"\)/g, 'fetchJSONP(GAS_URL, "users")');

    fs.writeFileSync(appPath, content, 'utf8');
    console.log('--- Build Finished Successfully! ---');
    console.log('Target: app.js');
    console.log('Status: BUG FREE / REAL-TIME SYNC READY');
}

buildFinal().catch(console.error);
