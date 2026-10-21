# DEVELOPMENT.md: 開發者指引與架構說明

本文件旨在為未來的維護者、Antigravity 代理人與協同開發者提供清晰的系統架構細節與生命週期說明。

---

## 一、系統架構 (Architecture)

Study Pack Compiler 採用分層管線化（Pipeline）設計：

```text
+-------------------------------------------------------+
| 1. Input Sources: Markdown / CSV / JSON / TXT         |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| 2. Core Parsers (src/core/parser/)                    |
|    - markdown-parser: H1/H2/H3/Lists/Sanitize         |
|    - csv-parser: RFC 4180 / Answer Normalization      |
|    - json-parser: Contract Validation / Fallbacks     |
|    - txt-parser: Flexible Question/Options Extraction |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| 3. Normalized Study Pack (StudyPack Object)           |
|    (Adheres strictly to study-pack.schema.json)       |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| 4. Validator Engine (src/core/validator/)             |
|    - Schema & Integrity Check                         |
|    - Quality Checks (Duplicates, Missing Explanations)|
|    - Severity Levels: ERROR (Blocks build), WARNING   |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| 5. Single HTML Compiler (src/core/compiler/)          |
|    - Reads template.html, styles.css, app.js          |
|    - Injects serialized data & inlines assets         |
|    - Verifies Zero-CDN / Offline Safety               |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
| 6. Final Distributable Single HTML (dist/study.html)  |
|    - 100% Offline Capable                             |
|    - Embedded Dashboard, Reader, Search, Quiz, Storage|
+-------------------------------------------------------+
```

---

## 二、生命週期剖析 (Lifecycles)

### 1. Parser 生命週期
1. **讀取來源檔案**：收集傳入的文字或檔案內容。
2. **語意解析與對齊**：
   - Markdown：依標題層級切分 Chapter 與 Section，將 `### 重點` 自動提煉為 `keyPoints`。
   - CSV：解析欄位映射，將各類答案形式（如 `'A'`, `'1'`, `'True'`, `'A,C'`）正規化為 0-based 數字索引或數字陣列。
   - TXT：正則化切分題幹、選項與答案行。
3. **安全消毒 (Sanitization)**：執行 `sanitizeHtml` 去除 `<script>`、`javascript:`、`onclick` 等潛在 XSS 內容。
4. **輸出 Normalized Study Pack**：合流組裝成唯一標準物件結構。

### 2. Validator 生命週期
1. **契約完整性驗證 (Integrity Check)**：
   - 驗證 `id`、`title`、`chapters` 陣列存在且非空。
   - 驗證 Chapter ID 與 Question ID 唯一性。
   - 驗證 Question 所參照之 `chapterId` 確實存在。
   - 驗證 Question 的 `answer` 索引落在 `options` 範圍內。
2. **品質審核 (Quality Auditing)**：
   - 空白章節偵測。
   - 無重點提示警告。
   - 題目解析不是必要欄位；目前學習頁只顯示答案回饋。
   - 重複題幹文字檢測 (normalized exact match)。
3. **分級輸出**：
   - 若存在任一 `ERROR`，標記 `isValid = false`，編譯程序將被強制阻擋。
   - 產生條列分明的文字驗證報告 (`report.toString()`)。

### 3. Compile 生命週期
1. **前置驗證**：呼叫 Validator，確認 `isValid === true`。
2. **資產內聯 (Asset Inlining)**：
   - 讀取原生 CSS (`styles.css`) 替換 `/* __INLINE_CSS__ */`。
   - 讀取原生 JS (`app.js`) 替換 `/* __INLINE_JS__ */`。
   - 將 Study Pack 資料進行安全序列化（防範 `</script>` 提早閉合）替換 `/* __STUDY_PACK_DATA__ */`。
   - 動態替換 `<title>`。
3. **離線安全性檢查 (Offline Check)**：
   - 掃描最終生成的 HTML 字串，確保不存在任何 `<script src="http...">` 或 `<link rel="stylesheet" href="http...">`。
4. **檔案寫出與指標輸出**：輸出最終檔案路徑、大小與統計資訊。

---

## 三、前端客戶端架構 (Renderer & Storage)

產出的單一 HTML 不依賴任何前端框架，使用純原生 JavaScript (ES2022)：

- **單向資料流與全域狀態**：
  - 資料本體：`window.__STUDY_PACK__`（唯讀）。
  - 使用者進度：`progress` 物件，包含 `completedChapters`、`questionStats`、`lastPosition`、`settings`。
- **儲存契約 (Storage Contract)**：
  - 本地快取鍵值：`study-pack.${packId}.progress`。
  - 備份格式：`study-progress-${packId}.json`，包含 `format: 'study-pack-progress-v1'` 與 `packId` 防呆檢核。
- **作答演算法與弱點判定**：
  - `THRESHOLDS.WEAK = 60`（正確率低於 60% 標記紅色加強）。
  - `THRESHOLDS.MODERATE = 80`（60% 至 80% 標記黃色觀察中；高於 80% 標記綠色穩定）。

---

## 四、自動化測試策略 (Testing)

本專案堅持「實證原則」，具備多層級測試：

1. **單元測試 (`node:test`)**：
   - `tests/parser.test.js`：驗證 Markdown、CSV、JSON、TXT 解析與答案正規化。
   - `tests/validator.test.js`：邊界條件測試（缺少 ID、重複章節、索引越界、無效題型等）。
2. **打包與整合測試**：
   - `tests/compiler.test.js`：驗證四組範例專案均能順利編譯為實體 HTML。
   - `tests/offline.test.js`：驗證所有產出物均為 100% 零外部 CDN 依賴。
3. **真實瀏覽器端對端測試 (`tests/e2e-headless-test.js`)**：
   - 透過獨立 Headless Chrome 與 Chrome DevTools Protocol (CDP)，真實模擬使用者開啟 `file:///` 單檔 HTML、閱讀教材、切換章節、標記完成、全文搜尋、速查篩選、測驗作答、查看詳解、主題切換，以及驗證行動裝置 360px ~ 768px 無水平滾動溢出。
