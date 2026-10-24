# 永續題庫逐題答案重審（2026-10-24）

## 結果

- 現行題庫共 1,307 題，題號唯一，皆為四個非空且不同的選項，答案索引有效；沒有 Unicode 取代字元或明顯截斷的短題幹。
- 歷屆題 1,287 題，逐題依考期、題號對照本機 17 份官方答案表，1,287 題相符，錯答 0 題。涵蓋 113-1 至 115-5，含 114-4 高雄補考；官方每份答案表都解析到 80 題。
- 114-4 一般場與高雄補考有相同題號。以兩份原卷的題號及題幹定位 153 題；第 6、44 題在兩份原卷題幹重合且官方答案也相同。第 53 題無後綴 ID 實屬高雄補考，原存答案 A 正確；不能單憑 ID 後綴指定場別。
- 官方曾公告複數答案或全題給分的題目不在現行題庫中；本輪沒有修改任何題目答案。
- 20 題「自編 115 年版補強」逐題檢查題幹、四選項、指定答案和解析，未發現選項與答案矛盾。特別核對巴黎協定溫控目標、CBAM 2026／2027 時點、GRI 重大主題、ESG 基金最低比重揭露、綠色及永續連結貸款、永續保險等易錯處。

## 可重跑的證據

`python tasks/esg-audit-20261024.py` 產生 `tasks/esg-audit-20261024.json`；若答案、結構或 114-4 場別定位有疑點即以非零狀態結束。來源是 `考古題/永續發展11301-11504/` 本機官方原卷及答案 PDF，PDF 不受 Git 追蹤。題庫為 `教材/永續發展基礎能力重點教材/questions.json`。

自編題的重點事實來源：

- [UNFCCC 巴黎協定目標](https://www.unfccc.int/process-and-meetings/the-paris-agreement)
- [歐盟執委會 CBAM 正式階段](https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en)、[憑證購買時點](https://taxation-customs.ec.europa.eu/news/first-cbam-certificate-price-be-published-7-april-2026-03-06_en)
- [GRI 3：重大主題](https://www.globalreporting.org/publications/documents/english/gri-3-material-topics-2021/)
- [金管會 ESG 基金資訊揭露事項](https://esg.fsc.gov.tw/SinglePage/Criterion/Product/)
- [LMA 永續連結貸款指引](https://www.lma.eu.com/application/files/3517/4298/0872/Guidance_on_Sustainability-Linked_Loan_Principles_-_26_March_2025.pdf)
- [UNEP FI 永續保險原則](https://www.unepfi.org/insurance/insurance/the-principles/)

## 限制

歷屆題比對的是**當次官方標準答案**，代表符合原考期答案，不能直接保證 113、114 年題目中的法規日期與門檻到 115 年 11 月仍適用。此輪沒有對全部 1,287 題逐字 OCR 核對原卷題幹與選項，也沒有取得 115 年版官方書籍全文；遇到時效性題目應以 115 年版書及官方修訂表為準。20 題自編題沒有官方標準答案，其審核屬人工內容判斷。
