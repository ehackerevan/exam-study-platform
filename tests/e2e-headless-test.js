import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTML_FILE = path.resolve(process.cwd(), 'dist/general-exam.html');
const FILE_URL = 'file:///' + HTML_FILE.replace(/\\/g, '/');

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl(port) {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const json = await res.json();
        const page = json.find(t => t.type === 'page' || t.url.includes('general-exam.html'));
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch (_) {}
    await wait(300);
  }
  throw new Error('無法連線到 Chrome Page Remote Debugger');
}

async function runE2e() {
  console.log('=== 啟動獨立 Headless Chrome 進行真機端對端互動測試 ===');
  const port = 9333;
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    FILE_URL
  ]);

  try {
    const wsUrl = await getWsUrl(port);
    console.log('連線至 CDP WebSocket:', wsUrl);

    // 建立 WebSocket
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = id++;
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === curId) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    // 啟用必要領域
    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    console.log('導航至頁面:', FILE_URL);
    await send('Page.navigate', { url: FILE_URL });
    await wait(1000);

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res.result.value;
    }

    // 1. 測試首頁 Dashboard 資訊
    console.log('1. 驗證 Dashboard 渲染與標題...');
    const pageTitle = await evalCode('document.title');
    const brandTitle = await evalCode('document.getElementById("app-brand-title").textContent');
    const heroTitle = await evalCode('document.getElementById("hero-pack-title").textContent');
    console.log(`   - 標題: ${pageTitle}`);
    console.log(`   - 品牌名稱: ${brandTitle}`);
    console.log(`   - Hero 標題: ${heroTitle}`);
    if (!pageTitle.includes('通識與專業綜合能力測驗')) throw new Error('首頁標題不符');

    // 2. 測試章節閱讀與切換
    console.log('2. 測試教材閱讀 Reader...');
    await evalCode('document.querySelector(".tab-btn[data-view=\\"reader\\"]").click()');
    await wait(200);
    const chapterHeading = await evalCode('document.getElementById("chapter-heading").textContent');
    console.log(`   - 目前章節: ${chapterHeading}`);
    if (!chapterHeading.includes('第一章')) throw new Error('章節標題未能正確顯示');

    // 標記完成
    console.log('   - 測試標記章節為完成...');
    await evalCode('document.getElementById("btn-toggle-complete").click()');
    await wait(200);
    const completeBtnText = await evalCode('document.getElementById("btn-toggle-complete").textContent');
    console.log(`   - 完成按鈕狀態: ${completeBtnText}`);
    if (!completeBtnText.includes('已讀本章')) throw new Error('標記完成失敗');

    // 3. 測試全文搜尋
    console.log('3. 測試全文搜尋 Search...');
    await evalCode('document.querySelector(".tab-btn[data-view=\\"search\\"]").click()');
    await wait(200);
    await evalCode(`
      const input = document.getElementById("search-input");
      input.value = "演繹";
      input.dispatchEvent(new Event("input"));
    `);
    await wait(300);
    const resultCount = await evalCode('document.querySelectorAll(".search-result-card").length');
    console.log(`   - 搜尋「演繹」獲得結果數: ${resultCount}`);
    if (resultCount === 0) throw new Error('搜尋未能找到符合項目');

    console.log('4. 測試測驗模式 Quiz 作答流程...');
    await evalCode('document.querySelector(".tab-btn[data-view=\\"quiz\\"]").click()');
    await wait(200);
    // 點擊開始隨機測驗
    await evalCode('document.getElementById("btn-start-random-quiz").click()');
    await wait(300);
    const stem = await evalCode('document.getElementById("quiz-stem").textContent');
    console.log(`   - 測驗題目: ${stem.slice(0, 30)}...`);

    // 選取第一個選項並提交
    console.log('   - 點選選項 A 並提交答案...');
    await evalCode('document.querySelectorAll("#quiz-options-container .option-item")[0].click()');
    await wait(100);
    await evalCode('document.getElementById("btn-quiz-submit").click()');
    await wait(200);

    const feedbackVisible = await evalCode('document.getElementById("quiz-feedback-box").style.display !== "none"');
    const feedbackText = await evalCode('document.getElementById("quiz-feedback-box").textContent');
    console.log(`   - 詳解回饋顯示: ${feedbackVisible ? 'YES' : 'NO'}`);
    console.log(`   - 回饋內容: ${feedbackText.trim().replace(/\\s+/g, ' ').slice(0, 50)}...`);
    if (!feedbackVisible) throw new Error('作答後詳解未正常顯示');

    // 6. 測試主題切換
    console.log('6. 測試外觀主題切換 (Dark / Light)...');
    await evalCode('document.querySelector(".tab-btn[data-view=\\"settings\\"]").click()');
    await wait(200);
    await evalCode(`
      const sel = document.getElementById("theme-select");
      sel.value = "dark";
      sel.dispatchEvent(new Event("change"));
    `);
    await wait(100);
    const currentTheme = await evalCode('document.documentElement.getAttribute("data-theme")');
    console.log(`   - 目前主題屬性: ${currentTheme}`);
    if (currentTheme !== 'dark') throw new Error('主題切換失敗');

    // 7. 測試行動裝置 Viewport (360px, 390px, 430px)
    console.log('7. 測試行動裝置各解析度響應式佈局 (無水平滾動條)...');
    for (const w of [360, 390, 430, 768]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true
      });
      await wait(100);
      const scrollWidth = await evalCode('document.documentElement.scrollWidth');
      const clientWidth = await evalCode('document.documentElement.clientWidth');
      const hasHorizontalOverflow = scrollWidth > clientWidth;
      console.log(`   - Viewport ${w}px: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}, 水平溢出: ${hasHorizontalOverflow ? 'FAIL' : 'PASS'}`);
      if (hasHorizontalOverflow) throw new Error(`在 ${w}px 解析度下發生水平溢出`);
    }

    console.log('\n✓ 真機端對端瀏覽器自動化測試全部通過！');
    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runE2e().catch(err => {
  console.error('\n✕ 端對端測試失敗:', err);
  process.exit(1);
});
