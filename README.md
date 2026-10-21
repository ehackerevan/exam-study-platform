# Study Pack Compiler

把教材與來源題庫編譯成單一 HTML，離線閱讀、作答並保存進度。

## 開始學習

開啟 [學科目錄](dist/index.html)，選擇「教材閱讀」或「題庫練習」。不需安裝程式或登入帳號。

- 讀完一章，直接做下方 10 題練習，再標記已讀。
- 測驗可依章節、知識點或歷屆考期出題；也可隨機抽題與複習目前錯題。
- 歷屆考期按原題號排列；提前結束時，只結算已答題目。
- 進度留在目前瀏覽器，可在「設定」匯出備份或匯入到另一台裝置。同一科的閱讀與測驗共用進度。
- 錯題重練只收最後一次答錯的題目；答對後會移出待加強清單。
- 「查答案」需連網，會將題幹送到 Google 並開啟新分頁。

金融市場常識與職業道德收錄證基會 116 年版：金融市場常識 558 題、職業道德 616 題，自 2027-01-01 起適用。請按報考版本使用。題目與答案依來源整理，不代表已核對現行法規效力。

每頁可單獨攜帶；「學科目錄」返回連結需保留目錄 HTML 在原來的相對位置。瀏覽器限制或清除網站資料可能影響進度，請定期備份。

## 維護與重建

編譯器使用 Node.js 22 以上；題庫統計使用 Python 3。核心建置不需第三方 npm 套件。

```sh
# 更新統計並產生教材、範例、目錄與共用樣式
npm run build:ui

# 單元測試與離線資源檢查
npm test
npm run validate:offline

# 依序建置、測試、離線檢查、瀏覽器 E2E；任何步驟失敗即停止
npm run verify
```

`test:e2e` 目前使用 Windows 的 Chrome。其他瀏覽器驗收腳本位於 `tests/*-browser.cjs`，使用既有 Playwright 執行環境（可透過 `PLAYWRIGHT_MODULE` 指定）。

建置會先依 canonical 題庫重新產生知識點及法規名稱詞彙統計，避免新增題目後映射過期。這是機械索引，不判斷答案語意或法規效力。教材包會全部驗證與編譯成功後再寫入，避免資料錯誤留下半套輸出。

## 資料與程式放在哪裡

| 位置 | 用途 |
| --- | --- |
| `教材/` | 在用教材與 canonical 題庫；信託正文來自 `course_data.json` |
| `考古題/` | 本機來源資料與歷屆完整題庫頁 |
| `src/core/parser/` | Markdown、CSV、JSON、TXT 匯入與正規化 |
| `src/core/validator/` | 檢查結構、文字編碼、選項與答案索引 |
| `src/core/compiler/` | 把資料、介面與資源嵌入單一 HTML |
| `src/renderer/` | 共用學習介面、文字呈現與樣式 |
| `scripts/` | 統計、建置與離線檢查 |
| `dist/` | 供使用者直接開啟的 HTML |
| `tasks/todo.md` | Current 與完成紀錄 |

共用色票在 `src/renderer/ui-theme.css`。規範用語提示與答案搜尋分別由 `legal-terms.js`、`answer-search.js` 注入，不需在模板另外維護副本。

## 編譯自己的學習包

```sh
node bin/study-pack.js validate ./examples/general-exam
node bin/study-pack.js build ./examples/general-exam ./dist/general-exam.html
node bin/study-pack.js --help
```

支援 Markdown、JSON、CSV、TXT。資料契約見 [study-pack.schema.json](src/core/schema/study-pack.schema.json)，範例見 [examples](examples)，架構說明見 [DEVELOPMENT.md](DEVELOPMENT.md)。JSON 答案使用 0 起算索引；CSV／TXT 可用 A、B 或 1、2 等來源標記。缺答案、空白選項或無法識別的答案會被擋下，不會推定成 A。

輸入資料需為 UTF-8，可接受 BOM。題目原文、選項與答案應先對照來源；建置驗證只確認可讀取與可正確執行，不代替內容審定。

## 額外單檔整合版

`npm run build:ui` 也會輸出根目錄與 `dist/學習平台_單檔整合版.html`，內含目錄、六科頁面與歷屆題庫共八頁，可直接開啟。單檔保留在 GitHub，Pages 沿用分頁版。網站與本機檔案的進度可能分開儲存，轉移前請匯出備份；查答案等外部連結仍需網路。

Pages 發布打包時會在八個公開頁面加入 Cloudflare Web Analytics；`dist`、教材來源及單檔整合版不包含追蹤碼。Web Analytics 網站 token 是公開頁面識別碼，並非 Cloudflare API Token。
