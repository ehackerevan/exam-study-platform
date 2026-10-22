import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

function parseCount(text) {
  const count = Number(text.replaceAll(',', '').trim());
  assert(Number.isSafeInteger(count) && count >= 0, `無效題數：${text}`);
  return count;
}

const CHROME_PATH = process.env.CHROME_PATH || chromium.executablePath();
const HTML_FILE = path.resolve(process.cwd(), '考古題/歷屆考古題_完整題庫大全.html');
const FILE_URL = pathToFileURL(HTML_FILE).href;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl(port) {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const json = await res.json();
        const page = json.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch (_) {}
    await wait(300);
  }
  throw new Error('無法連線到 Chrome Remote Debugger');
}

async function main() {
  console.log('=== 啟動 Headless Chrome 驗證 歷屆考古題_完整題庫大全.html ===');
  const port = 9444;
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
    FILE_URL
  ]);

  try {
    const wsUrl = await getWsUrl(port);
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

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('載入頁面:', FILE_URL);
    await send('Page.navigate', { url: FILE_URL });
    await wait(1200);

    async function evalCode(expr) {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
      return res.result.value;
    }

    // 1. 驗證標題與總題數
    const title = await evalCode('document.title');
    const totalCountText = await evalCode('document.getElementById("totalCount").textContent');
    console.log(`1. 頁面標題: ${title}`);
    console.log(`   全庫總題數: ${totalCountText} 題`);
    if (parseCount(totalCountText) < 5000) throw new Error('題庫總數異常不足');

    // 2. 測試分類切換至「金融科技力」
    console.log('2. 測試類別切換至「金融科技力」...');
    await evalCode(`
      const sel = document.getElementById("categorySelect");
      sel.value = "金融科技力";
      sel.dispatchEvent(new Event("change"));
    `);
    await wait(300);
    const fintechCount = await evalCode('document.getElementById("displayCount").textContent');
    console.log(`   金融科技力題目數: ${fintechCount} 題`);
    if (parseCount(fintechCount) < 800) throw new Error('金融科技力題數不符');

    // 3. 測試搜尋關鍵字
    console.log('3. 測試即時搜尋功能（關鍵字: 鯰魚效應）...');
    await evalCode(`
      const search = document.getElementById("searchInput");
      search.value = "鯰魚";
      search.dispatchEvent(new Event("input"));
    `);
    await wait(400);
    const searchMatchCount = await evalCode('document.getElementById("displayCount").textContent');
    console.log(`   搜尋「鯰魚」匹配題數: ${searchMatchCount} 題`);
    if (parseCount(searchMatchCount) === 0) throw new Error('搜尋無結果');

    // 4. 測試選項點擊作答與揭曉答案
    console.log('4. 測試題目選項點擊互動與揭曉答案...');
    const firstCard = await evalCode('document.querySelector(".q-card") !== null');
    if (!firstCard) throw new Error('未找到題目卡片');

    // 點擊第一個選項
    await evalCode('document.querySelector(".opt-chip").click()');
    await wait(100);
    const isChipClicked = await evalCode('document.querySelector(".opt-chip").className.includes("opt-selected")');
    console.log(`   點擊選項回饋樣式生效: ${isChipClicked ? 'YES' : 'NO'}`);

    // 點擊揭曉答案
    await evalCode('document.querySelector(".btn-reveal").click()');
    await wait(100);
    const isAnswerRevealed = await evalCode('document.querySelector(".opt-chip.is-official-correct .opt-check").style.display !== "none"');
    console.log(`   標準答案標記顯示: ${isAnswerRevealed ? 'YES' : 'NO'}`);

    // 5. 測試主題切換
    console.log('5. 測試深色/淺色主題切換...');
    await evalCode('toggleTheme()');
    await wait(100);
    const darkTheme = await evalCode('document.documentElement.getAttribute("data-theme")');
    console.log(`   目前主題: ${darkTheme}`);
    if (darkTheme !== 'dark') throw new Error('深色主題切換失敗');

    console.log('\n✓ 歷屆考古題_完整題庫大全.html 驗證全部通過！');
    ws.close();
  } finally {
    proc.kill();
  }
}

main().catch(err => {
  console.error('\n✕ 驗證失敗:', err);
  process.exit(1);
});
