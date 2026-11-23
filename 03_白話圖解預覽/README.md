# 03_白話圖解預覽（建置必要依賴，不可刪除）

- `npm run build:ui` 會執行 `build-preview.mjs` 產生各科白話導讀與圖解，再由 `scripts/integrate-teaching.js` 編入正式閱讀頁面。
- `text-format.mjs` 亦由核心編譯器 `src/core/compiler/index.js` 直接讀取。
