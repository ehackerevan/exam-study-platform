# tasks/lessons.md: 經驗迭代與錯誤模式記錄

每次會話開始或修復重要問題後，記錄經驗與反思於此。

## 核心經驗規則
1. **單一 HTML 零外部依賴**：產出的 `study.html` 必須把所有 CSS 與 JS 內嵌，不能包含 `https://fonts.googleapis.com` 或任何外鏈 CDN，避免離線時破版或失效。
2. **安全規範**：絕對不可覆寫使用者正在執行的 Antigravity IDE 瀏覽器視窗。所有前端測試優先使用獨立 Node.js 無頭腳本或獨立 Chrome/Edge 進程。
3. **資料正規化優先**：任何來源格式（Markdown, CSV, JSON, TXT）都必須先通過 Parser 轉為統一的 `Study Pack Schema`，Renderer 絕不直接依賴來源格式。
4. **教材與進度分離**：產出的 HTML 內建教材與題庫資料，使用者的作答紀錄、錯題、書籤僅存在 localStorage，且支援 JSON 匯入匯出與重設，重設不能影響教材本體。
5. **文字解析優先級防禦 (TXT Parser)**：題號開頭通常為 `1.`、`2.` 等，若選項的正則表達式亦涵蓋單一數字（如 `1.`），必須防範題幹行被誤判為選項。選項格式應優先規範為英文字母 `(A)`、`A.` 或括號數字 `(1)`。
6. **CDP 真實瀏覽器除錯**：Chrome Remote Debugging 的 `/json/version` 提供的是 browser target，若需對網頁執行 `Runtime.evaluate` 或 `Page.navigate`，應查詢 `/json/list` 取得具備 page target 的 `webSocketDebuggerUrl`。
