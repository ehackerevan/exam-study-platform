# 六科知識點與法規／官方資料覆蓋分析

統計更新日：2026-10-24。資料版本：schema 2。

## 範圍與方法

逐筆使用清理後 canonical 題庫：信託使用 `教材/信託業務人員重點教材/full_exam_bank.json`，其他五科使用各自的 `questions.json`。每個知識點與法規／機關排名都保留完整 `question_ids` 以供追溯；排名題數按題庫紀錄計，重複題幹在不同考期仍分別計數。

四科（金融科技、消費金融、ESG、AML）延用分析器內人工整理的關鍵詞分類；信託沿用完整題庫既有 `topic` 欄；SFI 113 年版只沿用官方題庫的「金融市場常識」與「職業道德」兩類，不另造更細的出題分類。官方題庫下載頁公告題數為504題及616題；113/9/23修訂表已套用於職業道德第279題。

法規統計以題幹加正確選項，比對分析器明列的法規名稱與別名；SFI 的官方機關／機構統計使用同樣範圍。這些是詞彙命中數，不能解讀為官方命題比例、法規重要度、答案正確性或現行效力。關鍵詞可能漏判或誤命中；本報告不等於逐題語意及法律審查。

考期題次衝突組表示多筆題目被解析到同一考期、科目與題號，僅供來源回查；不等於重複題，也沒有因此刪題。

## 六科覆蓋總覽

| 科目 | 題數 | 已分類 | 覆蓋率 | 未分類 | 知識點數 | 法規命中題次 | 考期題次衝突組 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 金融科技力 | 839 | 547 | 65.20% | 292 | 11 | 9 | 0 |
| 消費金融內部控制與稽核 | 2989 | 1822 | 60.96% | 1167 | 7 | 540 | 0 |
| 永續發展基礎能力 | 1307 | 840 | 64.27% | 467 | 8 | 137 | 73 |
| 防制洗錢與打擊資恐 | 2376 | 2034 | 85.61% | 342 | 6 | 334 | 158 |
| 信託業務人員 | 2724 | 2724 | 100.00% | 0 | 73 | 620 | 0 |
| 金融市場常識與職業道德（證基會113年版） | 1120 | 1120 | 100.00% | 0 | 2 | 39 | 0 |

## 逐科點位、法規與官方資料命中

### 金融科技力

來源：`教材/金融科技力重點教材/questions.json`。題數 839；知識點分類覆蓋 547/839（65.20%）；未分類 292。
分類方法：題幹與所有選項比對此程式列出的觀念詞；無關鍵詞命中時才使用已配置的一般教材章節備援分類。

| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 大數據與人工智慧 | 163 | 19.43% | `ft-8-6、ft-8-8、ft-8-9、ft-8-10、ft-8-16` |
| 區塊鏈、分散式帳本與虛擬資產 | 103 | 12.28% | `ft-8-11、ft-8-12、ft-8-13、ft-8-35、ft-8-47` |
| 雲端運算 | 84 | 10.01% | `ft-8-2、ft-8-3、ft-8-4、ft-8-42、ft-8-43` |
| 純網銀、開放銀行與API | 81 | 9.65% | `ft-8-1、ft-8-19、ft-8-31、ft-8-32、ft-8-33` |
| RegTech、SupTech與監理沙盒 | 65 | 7.75% | `ft-8-34、ft-8-35、ft-8-38、ft-9-34、ft-9-35` |
| 數位身分與生物辨識 | 55 | 6.56% | `ft-8-14、ft-8-15、ft-8-16、ft-8-34、ft-8-35` |
| 行動支付、電子支付與第三方支付 | 35 | 4.17% | `ft-8-17、ft-8-18、ft-8-19、ft-8-50、ft-8-51` |
| 金融資安與零信任 | 34 | 4.05% | `ft-8-55、ft-8-58、ft-9-33、ft-9-37、ft-10-36` |
| 金融科技發展與數位轉型 | 22 | 2.62% | `ft-8-1、ft-9-34、ft-10-1、ft-10-57、ft-11-34` |
| 支付、數位身分與金融資安 | 18 | 2.15% | `ft-9-14、ft-9-17、ft-10-16、ft-11-19、ft-11-51` |
| 雲端運算、大數據與AI應用 | 6 | 0.72% | `ft-9-28、ft-13-28、ft-14-5、ft-17-22、ft-18-22` |

**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：

| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 個人資料保護法 | 3 | 0.36% | `ft-9-5、ft-18-43、ft-21-34` |
| 金融機構使用物聯網設備安全控管規範 | 2 | 0.24% | `ft-19-58、ft-21-59` |
| 金融科技發展與創新實驗條例 | 2 | 0.24% | `ft-18-41、ft-19-41` |
| 金融服務業辦理數位身分驗證指引 | 1 | 0.12% | `ft-20-37` |
| 金融機構運用新興科技作業規範 | 1 | 0.12% | `ft-17-59` |

未分類樣本 ID：`ft-8-5`、`ft-8-20`、`ft-8-21`、`ft-8-22`、`ft-8-23`、`ft-8-24`、`ft-8-25`、`ft-8-26`、`ft-8-27`、`ft-8-28`。完整未分類 ID 見統計 JSON。

### 消費金融內部控制與稽核

來源：`教材/消費金融內部控制與稽核重點教材/questions.json`。題數 2989；知識點分類覆蓋 1822/2989（60.96%）；未分類 1167。
分類方法：題幹與所有選項比對此程式列出的觀念詞；無關鍵詞命中時才使用已配置的一般教材章節備援分類。

| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 授信、徵信與擔保品 | 764 | 25.56% | `cf-25-法規-1、cf-25-法規-4、cf-25-法規-5、cf-25-法規-8、cf-25-法規-13` |
| 內部控制與內部稽核 | 519 | 17.36% | `cf-25-法規-2、cf-25-法規-3、cf-25-法規-5、cf-25-法規-6、cf-25-法規-7` |
| 信用卡與循環信用 | 402 | 13.45% | `cf-25-法規-9、cf-25-法規-38、cf-25-法規-39、cf-25-法規-50、cf-25-實務-44` |
| 銀行作業、委外與風險管理 | 361 | 12.08% | `cf-25-法規-8、cf-25-法規-12、cf-25-法規-21、cf-25-法規-34、cf-25-法規-35` |
| 逾期放款、催收與呆帳 | 255 | 8.53% | `cf-25-法規-39、cf-25-法規-40、cf-25-法規-50、cf-25-實務-3、cf-25-實務-12` |
| 消費者保護與個資 | 43 | 1.44% | `cf-25-法規-21、cf-25-實務-80、cf-26-法規-31、cf-29-實務-61、cf-30-法規-20` |
| 防制洗錢與交易監控 | 25 | 0.84% | `cf-25-法規-8、cf-25-法規-10、cf-25-法規-37、cf-26-法規-8、cf-26-法規-16` |

**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：

| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 金融控股公司及銀行業內部控制及稽核制度實施辦法 | 176 | 5.89% | `cf-25-法規-3、cf-25-法規-6、cf-25-法規-7、cf-25-法規-29、cf-25-法規-30` |
| 銀行法 | 142 | 4.75% | `cf-25-法規-1、cf-25-法規-22、cf-25-法規-23、cf-25-法規-25、cf-25-實務-22` |
| 信用卡業務機構管理辦法 | 67 | 2.24% | `cf-25-法規-38、cf-25-實務-44、cf-26-法規-13、cf-26-法規-14、cf-26-法規-15` |
| 中華民國銀行公會會員徵信準則 | 32 | 1.07% | `cf-25-法規-13、cf-25-法規-41、cf-26-法規-20、cf-26-實務-21、cf-29-法規-24` |
| 金融控股公司法 | 30 | 1.00% | `cf-25-法規-24、cf-25-法規-26、cf-25-法規-49、cf-26-法規-2、cf-26-法規-37` |
| 金融同業間遭歹徒詐騙案件通報要點 | 26 | 0.87% | `cf-25-法規-8、cf-26-法規-9、cf-29-法規-16、cf-30-實務-15、cf-31-法規-19` |
| 銀行資產評估損失準備提列及逾期放款催收款呆帳處理辦法 | 24 | 0.80% | `cf-25-實務-25、cf-25-實務-52、cf-29-法規-5、cf-29-實務-67、cf-30-法規-16` |
| 中華民國銀行公會會員授信準則 | 17 | 0.57% | `cf-26-實務-24、cf-30-實務-23、cf-32-實務-21、cf-33-實務-21、cf-38-法規-25` |
| 金融機構作業委託他人處理內部作業制度及程序辦法 | 12 | 0.40% | `cf-34-法規-16、cf-35-法規-15、cf-35-實務-73、cf-37-法規-17、cf-41-法規-16` |
| 消費者保護法 | 5 | 0.17% | `cf-41-法規-27、cf-46-法規-35、cf-47-法規-32、cf-49-法規-32、cf-49-法規-35` |
| 金融消費者保護法 | 5 | 0.17% | `cf-41-法規-27、cf-46-法規-35、cf-47-法規-32、cf-49-法規-32、cf-49-法規-35` |
| 個人資料保護法 | 4 | 0.13% | `cf-34-法規-40、cf-39-法規-47、cf-44-法規-41、cf-46-法規-16` |

未分類樣本 ID：`cf-25-法規-11`、`cf-25-法規-14`、`cf-25-法規-15`、`cf-25-法規-19`、`cf-25-法規-20`、`cf-25-法規-42`、`cf-25-法規-46`、`cf-25-法規-47`、`cf-25-法規-49`、`cf-25-實務-8`。完整未分類 ID 見統計 JSON。

### 永續發展基礎能力

來源：`教材/永續發展基礎能力重點教材/questions.json`。題數 1307；知識點分類覆蓋 840/1307（64.27%）；未分類 467。
分類方法：題幹與所有選項比對此程式列出的觀念詞；無關鍵詞命中時才使用已配置的一般教材章節備援分類。

| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 永續資訊揭露準則與反漂綠 | 326 | 24.94% | `esg-113-1-14、esg-113-1-22、esg-113-1-24、esg-113-1-25、esg-113-1-26` |
| ESG與永續治理 | 312 | 23.87% | `esg-113-1-1、esg-113-1-2、esg-113-1-3、esg-113-1-5、esg-113-1-6` |
| 溫室氣體盤查、查驗與確信 | 199 | 15.23% | `esg-113-1-6、esg-113-1-17、esg-113-1-21、esg-113-1-30、esg-113-1-35` |
| 永續金融、債券與責任投資 | 141 | 10.79% | `esg-113-1-22、esg-113-1-24、esg-113-1-61、esg-113-1-62、esg-113-1-65` |
| 氣候公約與轉型政策 | 67 | 5.13% | `esg-113-1-6、esg-113-1-12、esg-113-1-13、esg-113-1-40、esg-113-2-1` |
| 碳定價、碳費與碳交易 | 61 | 4.67% | `esg-113-1-10、esg-113-1-28、esg-113-1-33、esg-113-1-34、esg-113-2-11` |
| 溫室氣體盤查與碳定價（章節未細分） | 4 | 0.31% | `esg-113-4-74、esg-113-5-56、esg-114-6-75、esg-original-2026-04` |
| 社會與治理風險、第三方確信及永續保險 | 2 | 0.15% | `esg-original-2026-16、esg-original-2026-18` |

**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：

| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 上市櫃公司永續發展實務守則 | 32 | 2.45% | `esg-113-1-3、esg-113-1-17、esg-113-1-18、esg-113-1-23、esg-113-1-38` |
| 上市公司編製與申報永續報告書作業辦法 | 26 | 1.99% | `esg-113-1-26、esg-113-1-45、esg-113-2-33、esg-113-2-34、esg-113-2-39` |
| 永續金融揭露規範（SFDR） | 18 | 1.38% | `esg-113-1-22、esg-113-1-24、esg-113-2-19、esg-113-3-5、esg-113-3-9` |
| 巴黎協定 | 17 | 1.30% | `esg-113-2-79、esg-113-3-14、esg-113-3-80、esg-113-4-11、esg-113-5-67` |
| 氣候變遷因應法（含舊稱溫室氣體減量及管理法） | 14 | 1.07% | `esg-113-1-6、esg-113-2-16、esg-113-3-54、esg-113-5-8、esg-114-1-23` |
| 聯合國氣候變化綱要公約 | 14 | 1.07% | `esg-113-2-1、esg-113-2-22、esg-113-2-23、esg-113-3-22、esg-113-4-8` |
| 公開發行公司年報應行記載事項準則 | 6 | 0.46% | `esg-113-1-33、esg-113-4-36、esg-114-3-45、esg-114-5-47、esg-115-1-41` |
| 再生能源發展條例 | 5 | 0.38% | `esg-114-3-13、esg-114-4-11、esg-114-5-20、esg-115-1-24、esg-115-3-17` |
| 公開發行公司建立內部控制制度處理準則 | 3 | 0.23% | `esg-114-4-10-717、esg-115-2-4、esg-115-3-3` |
| 歐洲氣候法 | 2 | 0.15% | `esg-113-4-5、esg-114-6-14` |

未分類樣本 ID：`esg-113-1-7`、`esg-113-1-8`、`esg-113-1-9`、`esg-113-1-11`、`esg-113-1-15`、`esg-113-1-16`、`esg-113-1-31`、`esg-113-1-46`、`esg-113-1-50`、`esg-113-1-51`。完整未分類 ID 見統計 JSON。

### 防制洗錢與打擊資恐

來源：`教材/防制洗錢與打擊資恐重點教材/questions.json`。題數 2376；知識點分類覆蓋 2034/2376（85.61%）；未分類 342。
分類方法：題幹與所有選項比對此程式列出的觀念詞；無關鍵詞命中時才使用已配置的一般教材章節備援分類。

| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 資恐防制與金融制裁 | 929 | 39.10% | `aml-107年第1次-1、aml-107年第1次-8、aml-107年第1次-9、aml-107年第1次-12、aml-107年第1次-13` |
| 客戶審查、實質受益人與PEP | 778 | 32.74% | `aml-107年第1次-3、aml-107年第1次-6、aml-107年第1次-18、aml-107年第1次-19、aml-107年第1次-22` |
| 風險基礎方法、內控與FATF | 572 | 24.07% | `aml-107年第1次-1、aml-107年第1次-2、aml-107年第1次-3、aml-107年第1次-4、aml-107年第1次-9` |
| 大額通貨與可疑交易申報 | 506 | 21.30% | `aml-107年第1次-6、aml-107年第1次-14、aml-107年第1次-16、aml-107年第1次-23、aml-107年第1次-26` |
| 洗錢犯罪與法定要件 | 171 | 7.20% | `aml-107年第1次-5、aml-107年第1次-8、aml-107年第1次-25、aml-107年第1次-36、aml-107年第1次-37` |
| 保存期限、申報時限與罰則 | 111 | 4.67% | `aml-107年第1次-2、aml-107年第1次-5、aml-107年第1次-8、aml-107年第1次-31、aml-107年第2次-2` |

**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：

| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 洗錢防制法 | 120 | 5.05% | `aml-107年第1次-5、aml-107年第1次-7、aml-107年第1次-9、aml-107年第1次-10、aml-107年第1次-61` |
| 金融機構防制洗錢辦法 | 87 | 3.66% | `aml-107年第1次-51、aml-107年第1次-77、aml-107年第2次-15、aml-107年第2次-18、aml-107年第2次-45` |
| 資恐防制法 | 81 | 3.41% | `aml-107年第1次-1、aml-107年第1次-9、aml-107年第1次-12、aml-107年第1次-13、aml-107年第2次-11` |
| 銀行評估洗錢及資恐風險及訂定相關防制計畫指引 | 14 | 0.59% | `aml-107年第1次-76、aml-107年第2次-74、aml-107年第3次-55、aml-108年第3次-56、aml-108年第3次-61` |
| 銀行業及指定金融機構防制洗錢及打擊資恐內控與稽核實施辦法 | 12 | 0.51% | `aml-108年第2次-22、aml-108年第3次-69、aml-109年第1次-16、aml-109年第3次-66、aml-109年第4次-15` |
| 洗錢防制物品出入境申報及通報辦法 | 8 | 0.34% | `aml-107年第2次-9、aml-108年第1次-8、aml-108年第2次-7、aml-109年第1次-13、aml-109年第3次-35` |
| 金融機構辦理國內匯款作業確認客戶身分原則 | 5 | 0.21% | `aml-107年第2次-16、aml-109年第1次-16-568、aml-110年第2次-29-978、aml-110年第3次-17、aml-112年第3次-16` |
| 存款帳戶及其疑似不法或顯屬異常交易管理辦法 | 4 | 0.17% | `aml-109年第4次-67、aml-110年第2次-73、aml-112年第3次-67、aml-114年第4次-59` |
| 金融機構對達一定金額以上通貨交易及疑似洗錢交易申報辦法 | 2 | 0.08% | `aml-107年第3次-39、aml-113年第1次-8` |
| 銀行法 | 1 | 0.04% | `aml-113年第1次-74` |

未分類樣本 ID：`aml-107年第1次-7`、`aml-107年第1次-10`、`aml-107年第1次-20`、`aml-107年第1次-27`、`aml-107年第1次-38`、`aml-107年第1次-45`、`aml-107年第1次-56`、`aml-107年第1次-62`、`aml-107年第1次-79`、`aml-107年第2次-12`。完整未分類 ID 見統計 JSON。

### 信託業務人員

來源：`教材/信託業務人員重點教材/full_exam_bank.json`。題數 2724；知識點分類覆蓋 2724/2724（100.00%）；未分類 0。
分類方法：逐題沿用信託完整題庫既有 topic 欄位，不再另造分類。

| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 境外基金與國外證券投資 | 230 | 8.44% | `past-41-practice-3、past-41-practice-4、past-41-practice-5、past-41-practice-7、past-41-practice-12` |
| 成立方式與信託分類 | 154 | 5.65% | `past-41-law-2、past-41-law-3、past-41-law-4、past-41-law-6、past-41-law-16` |
| 基金保管交割與監督責任 | 142 | 5.21% | `past-41-practice-57、past-41-practice-62、past-41-practice-65、past-41-practice-66、past-41-practice-67` |
| 業務範圍與禁止保本保息 | 115 | 4.22% | `past-41-law-23、past-41-law-24、past-41-law-26、past-41-law-43、past-42-law-23` |
| 金錢信託分類權限與運用 | 112 | 4.11% | `past-41-practice-8、past-41-practice-9、past-41-practice-11、past-41-practice-18、past-41-practice-20` |
| 全權委託保管與越權交易 | 100 | 3.67% | `past-41-practice-59、past-41-practice-60、past-41-practice-61、past-41-practice-64、past-41-practice-68` |
| 特殊目的信託公司與參與機構 | 89 | 3.27% | `past-41-practice-48、past-41-practice-49、past-41-practice-51、past-41-practice-54、past-41-practice-55` |
| REIT募集投資標的與限制 | 87 | 3.19% | `past-41-practice-40、past-41-practice-43、past-41-practice-45、past-42-practice-42、past-42-practice-46` |
| 員工福利信託特性與制度 | 69 | 2.53% | `past-41-practice-23、past-41-practice-24、past-41-practice-28、past-41-practice-29、past-41-practice-30` |
| 受託人義務報酬與責任 | 61 | 2.24% | `past-41-law-8、past-41-law-11、past-41-law-50、past-41-practice-6、past-42-law-2` |
| 單獨及集合管理分類與權限 | 59 | 2.17% | `past-41-law-27、past-41-practice-74、past-41-practice-75、past-42-practice-69、past-42-practice-73` |
| 財產評審報告與會計公告 | 59 | 2.17% | `past-41-law-38、past-41-law-42、past-41-practice-10、past-42-law-36、past-42-law-43` |
| 持股會組織協議與當事人 | 58 | 2.13% | `past-41-practice-27、past-42-practice-24、past-42-practice-27、past-42-practice-31、past-43-practice-24` |
| 所得稅與扣繳 | 55 | 2.02% | `past-41-law-47、past-42-law-48、past-42-practice-35、past-42-practice-52、past-43-law-50` |
| 證券信託種類與保管差異 | 51 | 1.87% | `past-41-practice-38、past-42-practice-38、past-43-practice-37、past-43-practice-39、past-44-practice-12` |
| 經營組織與兼營獨立 | 50 | 1.84% | `past-41-law-36、past-41-law-39、past-41-law-40、past-42-law-21、past-42-law-39` |
| 集合帳戶投資限制與流動性 | 50 | 1.84% | `past-41-practice-73、past-41-practice-77、past-42-practice-76、past-43-practice-71、past-44-law-33` |
| 不動產證券化共通規定 | 49 | 1.80% | `past-41-practice-44、past-41-practice-47、past-42-practice-43、past-42-practice-44、past-42-practice-45` |
| 監理處分罰則與損害賠償 | 47 | 1.73% | `past-41-law-30、past-41-law-31、past-41-law-33、past-41-law-35、past-41-law-37` |
| 設立標準與分支機構 | 47 | 1.73% | `past-41-law-21、past-41-law-22、past-42-law-24、past-44-law-21、past-44-law-22` |
| 公益信託與監督機關 | 46 | 1.69% | `past-41-law-14、past-41-law-18、past-41-law-20、past-42-law-15、past-42-law-18` |
| 利害關係人與利益衝突 | 43 | 1.58% | `past-41-law-29、past-41-law-45、past-42-law-27、past-42-law-30、past-42-law-37` |
| 有價證券借貸交易與擔保 | 43 | 1.58% | `past-41-practice-34、past-42-practice-32、past-42-practice-37、past-43-practice-33、past-43-practice-40` |
| 投資運用與分別管理 | 39 | 1.43% | `past-41-practice-26、past-42-practice-80、past-43-practice-30、past-44-practice-28、past-44-practice-30` |
| 內部人持股申報與權益行使 | 38 | 1.40% | `past-41-practice-32、past-41-practice-36、past-41-practice-37、past-41-practice-39、past-42-practice-33` |
| 集合帳戶申請設置與合併 | 34 | 1.25% | `past-41-practice-70、past-41-practice-71、past-41-practice-72、past-41-practice-76、past-42-practice-70` |
| 登記公示與對抗效力 | 33 | 1.21% | `past-41-law-1、past-42-law-1、past-42-practice-34、past-43-law-1、past-43-law-19` |
| 賠償準備金與盈餘分配 | 33 | 1.21% | `past-41-law-34、past-42-law-25、past-42-law-31、past-43-law-35、past-44-law-28` |
| 委託人權利與信託標的 | 30 | 1.10% | `past-42-law-5、past-42-law-7、past-42-law-9、past-43-law-5、past-45-law-3` |
| 終止變更與剩餘財產歸屬 | 30 | 1.10% | `past-41-law-13、past-42-law-20、past-44-law-45、past-45-law-6、past-46-law-17` |
| 受益人權利與撤銷救濟 | 29 | 1.06% | `past-41-law-7、past-41-law-10、past-41-law-12、past-42-law-11、past-42-law-12` |
| 外資全球保管與代理登記 | 29 | 1.06% | `past-41-practice-56、past-41-practice-63、past-41-practice-79、past-43-practice-60、past-44-practice-56` |
| 基本義務與契約記載事項 | 28 | 1.03% | `past-41-law-25、past-41-law-28、past-42-law-32、past-43-law-26、past-44-law-19` |
| 信託監察人 | 26 | 0.95% | `past-41-law-17、past-42-law-14、past-43-law-15、past-43-law-17、past-44-law-9` |
| 共同信託基金募集與運用 | 26 | 0.95% | `past-42-law-22、past-43-law-36、past-44-law-42、past-45-law-20、past-46-law-24` |
| 受益證券募集發行與受益人會議 | 26 | 0.95% | `past-41-practice-50、past-42-practice-48、past-42-practice-50、past-42-practice-55、past-45-practice-44` |
| 證券化特性與經濟效益 | 26 | 0.95% | `past-41-practice-53、past-43-practice-53、past-43-practice-56、past-44-practice-49、past-45-practice-52` |
| 財產獨立性與強制執行 | 26 | 0.95% | `past-41-law-5、past-41-law-9、past-42-law-10、past-44-law-4、past-45-law-5` |
| 客戶認識商品適合度與投資人分類 | 25 | 0.92% | `past-42-practice-2、past-42-practice-16、past-43-practice-4、past-43-practice-5、past-44-practice-11` |
| 行銷訂約與風險揭露 | 24 | 0.88% | `past-42-law-40、past-42-practice-20、past-43-law-41、past-43-practice-12、past-45-law-42` |
| 預收款禮券與履約保障 | 24 | 0.88% | `past-41-practice-1、past-41-practice-2、past-41-practice-14、past-42-practice-1、past-42-practice-14` |
| 人員資格訓練與利益限制 | 23 | 0.84% | `past-42-law-26、past-42-law-44、past-43-law-40、past-44-law-26、past-44-law-27` |
| 信託課稅原則與形式移轉 | 22 | 0.81% | `past-41-law-46、past-43-law-48、past-45-practice-77、past-49-law-49、past-50-law-48` |
| 外匯結匯與國際金融業務 | 22 | 0.81% | `past-42-practice-21、past-44-practice-9、past-48-practice-18、past-50-practice-5、past-50-practice-7` |
| 內控稽核與風險管理 | 21 | 0.77% | `past-41-law-41、past-42-law-33、past-43-law-33、past-44-law-40、past-45-practice-19` |
| 土地開發與不動產管理信託 | 21 | 0.77% | `past-41-practice-42、past-42-practice-40、past-42-practice-41、past-43-practice-80、past-44-practice-40` |
| 遺產及贈與稅 | 21 | 0.77% | `past-41-law-48、past-42-law-50、past-43-law-47、past-45-law-46、past-46-law-49` |
| 其他資產保管與營業保證金 | 20 | 0.73% | `past-41-practice-58、past-42-practice-62、past-43-practice-59、past-45-practice-61、past-46-practice-63` |
| 設立能力與監督管轄 | 20 | 0.73% | `past-41-law-15、past-42-law-17、past-43-law-16、past-44-law-13、past-45-law-12` |
| 土地稅與土地增值稅 | 19 | 0.70% | `past-41-law-49、past-42-law-46、past-46-law-46、past-46-practice-41、past-46-practice-45` |
| 資產移轉債權與債務人通知 | 18 | 0.66% | `past-41-practice-41、past-41-practice-52、past-42-practice-53、past-43-practice-45、past-43-practice-54` |
| 公會自律與行為規範 | 16 | 0.59% | `past-42-law-42、past-43-law-42、past-46-law-40、past-46-law-41、past-46-practice-78` |
| 信用增強評等與風險分散 | 15 | 0.55% | `past-41-practice-46、past-43-practice-55、past-44-practice-53、past-46-practice-50、past-48-practice-56` |
| REAT資產信託與證券發行 | 14 | 0.51% | `past-43-practice-43、past-45-practice-42、past-45-practice-43、past-45-practice-46、past-46-practice-44` |
| 結構型商品與衍生性金融商品 | 14 | 0.51% | `past-46-practice-20、past-49-practice-1、past-49-practice-2、past-51-practice-4、past-51-practice-5` |
| 員工持股信託的課稅與返還 | 12 | 0.44% | `past-43-practice-28、past-44-practice-23、past-45-practice-24、past-46-practice-24、past-49-practice-23` |
| 房屋稅與契稅 | 12 | 0.44% | `past-43-law-49、past-45-law-47、past-46-law-50、past-49-law-19、past-52-law-46` |
| 贈與權利價值與折現計算 | 10 | 0.37% | `past-41-practice-33、past-42-law-47、past-53-law-48、past-54-law-47、past-55-law-50` |
| 退出終止與財產返還 | 10 | 0.37% | `past-41-practice-25、past-43-practice-31、past-46-practice-80、past-54-practice-30、past-55-practice-30` |
| 證券化商品分離課稅與交易稅 | 9 | 0.33% | `past-45-practice-40、past-45-practice-79、past-48-practice-3、past-51-practice-78、past-56-practice-45` |
| 資金提撥與公司獎勵 | 9 | 0.33% | `past-42-practice-26、past-46-practice-27、past-52-practice-25、past-52-practice-28、past-53-practice-30` |
| 集合帳戶受益權淨值與退出 | 9 | 0.33% | `past-42-practice-72、past-43-practice-79、past-50-practice-71、past-51-practice-71、past-53-practice-71` |
| 營業稅與印花稅 | 8 | 0.29% | `past-42-law-49、past-44-practice-18、past-51-practice-15、past-52-practice-20、past-53-practice-17` |
| 證券交易稅 | 8 | 0.29% | `past-41-practice-35、past-44-practice-33、past-44-practice-54、past-45-practice-33、past-49-practice-35` |
| 證券化計畫與其他制度 | 8 | 0.29% | `past-44-practice-48、past-44-practice-55、past-48-practice-4、past-50-practice-50、past-54-practice-47` |
| 評審委員會與內部職責 | 7 | 0.26% | `past-41-law-32、past-52-law-19、past-57-law-32、past-59-law-31、past-61-law-34` |
| 安養退休與保險金信託 | 4 | 0.15% | `past-42-practice-39、past-45-law-29、past-50-practice-17、past-53-practice-18` |
| 信託稅務綜合比較 | 3 | 0.11% | `past-43-law-46、past-45-law-50、past-53-law-49` |
| 子女教育與保險信託應用 | 2 | 0.07% | `past-46-practice-47、past-46-practice-62` |
| 特定指定不指定信託分類 | 2 | 0.07% | `past-46-law-25、past-55-law-38` |
| 信用評等與機構資格綜合比較 | 1 | 0.04% | `past-52-practice-78` |
| 業務種類與交付財產分類 | 1 | 0.04% | `past-49-law-38` |
| 自有財產運用限制 | 1 | 0.04% | `past-48-law-44` |

**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：

| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 信託業法 | 173 | 6.35% | `past-44-law-38、past-44-practice-38、past-46-law-43、past-49-practice-36、past-55-practice-80` |
| 信託法 | 108 | 3.96% | `past-41-law-7、past-41-law-9、past-41-practice-6、past-42-law-3、past-42-law-11` |
| 金融資產證券化條例 | 75 | 2.75% | `past-44-law-19、past-57-law-20、past-61-law-28、past-43-practice-50、past-51-practice-54` |
| 不動產證券化條例 | 45 | 1.65% | `past-43-law-23、past-55-law-22、past-55-practice-48、past-56-law-22、past-57-law-21` |
| 信託資金集合管理運用管理辦法 | 33 | 1.21% | `past-52-practice-78、past-41-practice-70、past-41-practice-72、past-41-practice-75、past-42-practice-70` |
| 境外基金管理辦法 | 32 | 1.17% | `past-56-practice-20、past-61-practice-9、past-42-practice-13、past-43-practice-11、past-43-practice-18` |
| 有價證券借貸辦法 | 21 | 0.77% | `past-41-practice-34、past-42-practice-37、past-43-practice-33、past-43-practice-40、past-44-practice-37` |
| 信託業設立標準 | 16 | 0.59% | `past-41-law-21、past-44-law-21、past-45-law-22、past-45-law-23、past-49-law-23` |
| 證券交易法 | 16 | 0.59% | `past-49-law-39、past-52-law-39、past-60-law-35、past-43-practice-38、past-44-practice-34` |
| 所得稅法 | 15 | 0.55% | `past-41-law-47、past-44-law-47、past-44-law-50、past-46-law-48、past-50-law-50` |
| 銀行法 | 15 | 0.55% | `past-42-law-38、past-44-law-24、past-46-law-20、past-48-law-41、past-50-law-38` |
| 民法 | 14 | 0.51% | `past-44-law-49、past-49-law-46、past-52-law-48、past-62-law-16、past-41-practice-42` |
| 信託業應負之義務及相關行為規範 | 11 | 0.40% | `past-42-law-42、past-43-law-42、past-45-law-42、past-46-law-41、past-52-law-26` |
| 證券投資信託事業證券投資顧問事業證券商兼營信託業務管理辦法 | 11 | 0.40% | `past-42-law-41、past-43-law-43、past-52-law-41、past-54-law-42、past-55-law-42` |
| 證券投資信託及顧問法 | 9 | 0.33% | `past-44-law-24、past-41-practice-66、past-49-practice-58、past-50-practice-68、past-52-practice-61` |
| 信託業負責人應具備資格條件暨經營與管理人員應具備信託專門學識或經驗準則 | 8 | 0.29% | `past-42-law-26、past-44-law-39、past-46-law-36、past-48-law-31、past-53-law-29` |
| 境外結構型商品管理規則 | 8 | 0.29% | `past-44-practice-22、past-45-practice-17、past-53-practice-13、past-49-practice-2、past-51-practice-5` |
| 信託業營運範圍受益權轉讓限制風險揭露及行銷訂約管理辦法 | 6 | 0.22% | `past-42-practice-20、past-43-practice-12、past-45-practice-10、past-51-practice-19、past-57-practice-20` |
| 遺產及贈與稅法 | 3 | 0.11% | `past-42-law-50、past-48-law-49、past-55-law-46` |
| 公司法 | 1 | 0.04% | `past-41-law-23` |

### 金融市場常識與職業道德（證基會113年版）

來源：`教材/金融市場常識與職業道德題庫/questions.json`。題數 1120；知識點分類覆蓋 1120/1120（100.00%）；未分類 0。
分類方法：逐題依證基會113年題庫既有 chapterId 對應官方兩大分類，不細分官方分類。

| 知識點 | 題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 職業道德 | 616 | 55.00% | `professional-ethics-001、professional-ethics-002、professional-ethics-003、professional-ethics-004、professional-ethics-005` |
| 金融市場常識 | 504 | 45.00% | `financial-market-001、financial-market-002、financial-market-003、financial-market-004、financial-market-005` |

**法規／規範名稱命中**（題幹與正確選項詞彙比對；項目可重疊）：

| 法規／規範 | 命中題數 | 題庫占比 | 樣本題目 ID |
| --- | ---: | ---: | --- |
| 金融消費者保護法 | 8 | 0.71% | `financial-market-064、professional-ethics-572、professional-ethics-573、professional-ethics-574、professional-ethics-577` |
| 保險法 | 6 | 0.54% | `financial-market-401、financial-market-405、financial-market-414、financial-market-415、financial-market-416` |
| 信託業法 | 6 | 0.54% | `financial-market-324、financial-market-325、financial-market-326、financial-market-327、financial-market-336` |
| 信託法 | 5 | 0.45% | `financial-market-307、financial-market-323、financial-market-334、financial-market-335、financial-market-336` |
| 洗錢防制法 | 5 | 0.45% | `financial-market-081、financial-market-140、financial-market-273、professional-ethics-521、professional-ethics-526` |
| 證券交易法 | 5 | 0.45% | `financial-market-054、professional-ethics-020、professional-ethics-509、professional-ethics-576、professional-ethics-579` |
| 銀行法 | 2 | 0.18% | `financial-market-087、financial-market-263` |
| 公司法 | 1 | 0.09% | `financial-market-167` |
| 證券投資人及期貨交易人保護法 | 1 | 0.09% | `professional-ethics-199` |

**SFI 官方機關／機構名稱命中**（不代表正式引註）：

| 機關／機構 | 命中題數 | 樣本題目 ID |
| --- | ---: | --- |
| 中央銀行 | 13 | `financial-market-013、financial-market-259、financial-market-260、financial-market-261、financial-market-290` |
| 金融監督管理委員會 | 11 | `financial-market-007、financial-market-010、financial-market-013、financial-market-033、financial-market-060` |
| 金融消費評議中心 | 5 | `financial-market-503、professional-ethics-577、professional-ethics-582、professional-ethics-583、professional-ethics-588` |
| 臺灣證券交易所 | 2 | `financial-market-025、financial-market-112` |
| 證券投資人及期貨交易人保護中心 | 2 | `financial-market-078、professional-ethics-199` |
| 證券櫃檯買賣中心 | 1 | `financial-market-068` |

## 與目前教材包知識點的串接

`concept_ranking[].question_ids` 是精確逐題映射，也是教材包的知識點選單與章末練習挑題依據；未分類題目使用 JSON 中的 `unclassified_knowledge_point` 標籤，不隱藏覆蓋缺口。信託排名使用題庫既有 topic；SFI 選單只提供官方兩大類。統計 JSON 也供教材的高頻觀念、法規排行文字使用。

原始排名、完整題目 ID、考期樣本與分類限制見 `tasks/exam_frequency_20261020.json`。
