# Exam Study Platform

五科教材與題庫使用同一套 Study Pack Compiler、共用題目格式與離線練習介面。

## 本機建置

需要 Node.js 22 或更新版本。在專案根目錄執行：

```sh
npm run build:ui
npm run validate:offline
```

開啟 `dist/index.html` 可閱讀五科教材與題庫；各科 HTML 也能獨立離線使用。GitHub Pages 工作流程使用相同建置輸出。

信託歷屆題庫採去重後的 2,722 題，題幹、選項及來源答案沿用來源資料；題目備註不作為解析顯示。
