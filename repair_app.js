const fs = require('fs');

async function repairApp() {
    console.log('--- Phase: Repairing Master app.js ---');
    let content = fs.readFileSync('app.js', 'utf8');

    // 1. ìµœì‹  GAS URL (DB) ê³ ì •
    const NEW_GAS_URL = "https://script.google.com/macros/s/AKfycbzmS6hN33FeJ9yZwpyTjJDjW4ogmsWv8Wu8JZZyqvHGcAdjudlPoud4wSdxlnONnu5w6w/exec/exec";
    content = content.replace(/const GAS_URL = \".*?\";/, `const GAS_URL = \"${NEW_GAS_URL}\";`);

    // 2. updateDate ?¨ìˆ˜ ìµœìƒ??ì£¼ìž… (ReferenceError ?´ê²°)
    const updateDateFn = `
// [?¸å¿ƒ] ?œê°„ ?…ë°?´íŠ¸ ?”ì§„ (v25.3.4)
function updateDate() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = \`\${dateStr} \${timeStr}\`;
}
\n`;
    if (!content.includes('function updateDate()')) {
        content = content.replace('const currentState = {', updateDateFn + 'const currentState = {');
    }

    // 3. ê¹¨ì§„ ëª¨ë“  ?œê? ?¨í„´ ?•í™” (Mojibake Cleanup)
    const cleanMap = [
        [/\??¼ë–†åª??ON/g, '?¤ì‹œê°?ON'],
        [/\?ë¬’ëƒ½ ä»??\.\./g, '?‘ì† ì¤?.'],
        [/?ºâ‚¬\??•ì±¸/g, 'ë¶€?œëª…'],
        [/\?ë¬’ë¾½ï§??/g, '?‘ì—…ëª?],
        [/ï§£ì„????°ì¤ˆ/g, 'ì²˜ìŒ?¼ë¡œ'],
        [/?ºâ‚¬\???? \?ì¢ê¹®\??ê½­\?\?/g, 'ë¶€?œë? ? íƒ?˜ì„¸??],
        [/\?ë¬’ë¾½\?\? \?ì¢ê¹®\??ê½­\?\?/g, '?‘ì—…??? íƒ?˜ì„¸??],
        [/ï§¤ì’–??æ¹²ê³•ì¤??\? ?ºëˆ????»ë’— ä»??\.\./g, 'ìµœì‹  ê¸°ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?.'],
        [/\?ì¢‘íˆ˜ \?ê³—ì” \?\? æ¿¡ì’•ë±?\??½ë™£/g, '?°ì´??ë¡œë“œ ?¤íŒ¨']
    ];

    cleanMap.forEach(([regex, res]) => {
        content = content.replace(regex, res);
    });

    // 4. openResultsView ë¡œì§ ë³´ê°•
    content = content.replace(/async function openResultsView\(\) \{[\s\S]*?try \{/, `async function openResultsView() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        const p = overlay.querySelector('p');
        if (p) p.innerText = "ìµœì‹  ê¸°ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?.";
        overlay.classList.add('active');
    }
    try {`);

    // 5. fetchJSONP type ?Œë¼ë¯¸í„° ê·œê²© ìµœì‹ ??    const newFetchJSONP = `function fetchJSONP(url, type = "") {
    updateNetworkStatus(false, '?µì‹  ì¤?.');
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            delete window[callbackName];
            if (script.parentNode) document.body.removeChild(script);
            updateNetworkStatus(false, '?°ê²° ì§€??);
            reject(new Error('?¤íŠ¸?Œí¬ ?‘ë‹µ ?œê°„ ì´ˆê³¼'));
        }, 12000);
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

    fs.writeFileSync('app.js', content, 'utf8');
    console.log('--- Repair Complete: v25.3.4 (Bug Free) ---');
}

repairApp().catch(console.error);
