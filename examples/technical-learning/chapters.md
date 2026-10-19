# 第一章 Git 三層區域與內部物件

## 工作區、暫存區與版本庫

Git 的核心架構分為三層：工作目錄 (Working Directory)、暫存索引區 (Staging Area / Index) 與本機儲存庫 (Repository / .git)。

Git 內部物件以 SHA-1 雜湊鍵值儲存，包含 Blob（檔案內容）、Tree（目錄結構）、Commit（提交紀錄）與 Tag（標籤）。

### 重點
- 工作區檔案經由 git add 存入暫存區 (Index)。
- 暫存區內容經由 git commit 生成新的 Commit 物件。
- Git 的快照 (Snapshot) 機制記錄檔案樹，而非單純差異比對。

### 備註
- git status 可隨時檢視各區域檔案的追蹤狀態。

# 第二章 分支原理與指標位移

## HEAD、分支與 Checkout

Git 的分支 (Branch) 實質上只是一個包含 40 碼 commit SHA-1 的輕量文字指標。

HEAD 則是指向當前所在分支的參考指標。

### 重點
- 建立分支 git branch <name> 不會耗費儲存空間，速度極快。
- HEAD 指向游離狀態 (Detached HEAD) 代表直接指向特定 commit 而非分支。
- 現代 Git 推薦使用 git switch 切換分支，git restore 還原檔案。

### 備註
- fast-forward 合併僅移動分支指標，不產生新的 merge commit。

# 第三章 遠端協作與衝突處理

## Fetch、Pull 與 Rebase

與遠端儲存庫同步涉及 Fetch 與 Merge 的組合操作。

git pull 等同於 git fetch 加上 git merge。使用 rebase 可以維持線性的提交歷史。

### 重點
- git fetch 僅下載遠端最新進度，不會自動改動工作目錄。
- git pull 預設會嘗試將遠端分支合併進當前本地分支。
- 衝突發生時，Git 會在檔案中插入 <<<<<<<, =======, >>>>>>> 衝突標記。

### 備註
- 切勿在已經推送到公開共享的遠端分支上執行破壞性 git rebase 或 push --force。
