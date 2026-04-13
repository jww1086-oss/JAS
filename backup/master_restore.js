const fs = require("fs");
const https = require("https");

async function download(url, path) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error("Status: " + res.statusCode));
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                fs.writeFileSync(path, Buffer.concat(chunks));
                resolve();
            });
        }).on("error", reject);
    });
}

async function finalRestore() {
    console.log("--- Phase: Real Deep Recovery ---");
    
    // 1. Download masters directly
    await download("https://jungbu.vercel.app/", "index_master.html");
    await download("https://jungbu.vercel.app/style.css", "style_master.css");
    await download("https://jungbu.vercel.app/app.js", "app_master.js");
    console.log("1. Masters Downloaded Successfully");

    // 2. index.html Repaired (UTF-8 safe)
    let html = fs.readFileSync("index_master.html", "utf8");
    html = html.replace(/<title>.*?<\/title>/i, "<title>KOMIPO | 스마트 안전 점검 시스템</title>");
    fs.writeFileSync("index.html", html, "utf8");
    console.log("2. index.html Restored");

    // 3. style.css Restored
    let css = fs.readFileSync("style_master.css", "utf8");
    fs.writeFileSync("style.css", css, "utf8");
    console.log("3. style.css Restored");

    // 4. app.js Repaired
    let js = fs.readFileSync("app_master.js", "utf8");
    const NEW_GAS_URL = 'https://script.google.com/macros/s/AKfycbwW2wXUmHNGSlCROkgIZ4PdSkgKY-nky_lDwIwgsYG98J1suPyTO0qE1V7PMraXwbD3FA/exec';
    
    // Fix GAS_URL precisely
    js = js.replace(/const GAS_URL = \".*?\";/g, "const GAS_URL = \"" + NEW_GAS_URL + "\";");
    
    // Ensure updateDate is at top
    if (!js.includes("function updateDate()")) {
        const updateDateFn = "function updateDate(){const n=new Date();const d=n.toLocaleDateString(\"ko-KR\",{year:\"numeric\",month:\"long\",day:\"numeric\",weekday:\"short\"});const t=n.toLocaleTimeString(\"ko-KR\",{hour:\"2-digit\",minute:\"2-digit\"});const e=document.getElementById(\"current-date\");if(e)e.innerText=`${d} ${t}`}\n";
        js = updateDateFn + js;
    }
    
    fs.writeFileSync("app.js", js, "utf8");
    console.log("4. app.js Fully Repaired with New GAS URL");
    
    console.log("--- Deep Recovery FINISHED ---");
}

finalRestore().catch(console.error);
