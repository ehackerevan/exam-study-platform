# 學科瀏覽與作答統計

目錄顯示每科瀏覽與作答總次數，章末及測驗題目顯示該題作答次數；統計頁面載入時查詢，送出後更新本次讀取的數字，其他人的新作答在下次載入後可見。此功能僅在 GitHub Pages 的發布副本加入事件程式；本機 `dist` 和單檔離線版不送事件。瀏覽是學科頁每次載入，重新整理會再計一次。章末與測驗於選擇答案並送出時各記一次；空白送出與重設不計，重做並再次送出會再計一次。歷屆四科舊瀏覽頁僅支援直接點選／揭曉答案，沒有相同的送出流程，本統計不包含該頁。

事件只包含學科 ID、題目 ID、類型，按 UTC 日期匯總；不記錄選項、對錯、姓名、個人進度。公開 Worker 使用 Cloudflare IP 暫時限流，不將 IP 存入 D1。限流可能影響共用 IP 的使用者；廣告攔截、離線或網路／服務失敗也可能漏計，數值不等於不重複訪客。彙總數字公開顯示，不包含個人答題紀錄。公開請求可被偽造，不能視為防作弊或精確審計。統計從上線後開始，不會補回歷史資料。

## 查詢

Cloudflare 後台 → Workers & Pages → D1 → `study-pack-metrics` → Console，執行：

```sql
-- 學科瀏覽次數（每日；日期為 UTC）
SELECT day, course, SUM(count) AS views
FROM counts WHERE type = 'view'
GROUP BY day, course ORDER BY day DESC, views DESC;

-- 每學科與每題的累計作答次數
SELECT course, question, SUM(count) AS answers
FROM counts WHERE type = 'answer'
GROUP BY course, question ORDER BY answers DESC;

-- 每學科的累計作答次數
SELECT course, SUM(count) AS answers
FROM counts WHERE type = 'answer'
GROUP BY course ORDER BY answers DESC;
```

學科 ID 與名稱：`trust-exam` 信託、`fintech-exam-pack` 金融科技力、`consumer-finance-exam-pack` 消金內控、`esg-sustainability-pack` 永續、`aml-cft-exam-pack` 防制洗錢、`financial-market-ethics-official-bank-113`／`-116` 金融常識兩版、`investment-insurance-exam` 投資型保險、`derivatives-sales-exam` 衍生性商品。

## 上線前置

`study-pack-metrics` D1 與 Worker 使用 `wrangler.jsonc` 的資料庫 ID；部署時先套用 `schema.sql`，部署 Worker，再發布 GitHub Pages。`client.js` 的 workers.dev 網址以目前帳戶的 `ehackerevan` 子網域及 Worker 名稱為準。準備發布的測試環境不得連到正式統計端點或寫入正式統計資料；正式驗收應明確記錄測試事件。
