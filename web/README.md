# Monee Web

> 可愛輕量、懂你金流的個人生活財務助理。規格見 [`../monee_ux.md`](../monee_ux.md)，設計規範見 [`../design-system/monee/`](../design-system/monee/MASTER.md)。

Phase 1（MVP）：手機網頁版的手動記帳、收支分類、內部轉帳、帳戶與校準餘額、首頁／明細／資產／報表／我的。
Phase 2（已完成）：說一句、拍收據的 AI 記帳（Gemini 整理成草稿，確認後才寫入）；跟朋友分帳（第 ①②③④ 階段：自己記帳、分享連結、旅程與外幣、外文收據、朋友從連結新增花費）；匯出到 Google Sheets、下載明細 CSV；資料備份與還原；收據照片存檔。

## 技術

- **Next.js 16**（App Router、Turbopack）＋ **React 19** ＋ **TypeScript**
- **Tailwind CSS 4**：色彩、字級、圓角都讀 `src/styles/tokens.css`
- **Supabase**：登入（Email ＋ 密碼）＋ Postgres；每張表都開 RLS，每個人只看得到自己的資料
- **TanStack Query** 管伺服器資料，**Zustand** 管畫面狀態（面板、隱藏金額、深淺色）
- **Gemini API**：AI 記帳，只在伺服器端（`/api/ai/draft`）呼叫，金鑰不會送到瀏覽器
- **Vitest**：預算計算等邏輯的單元測試

## 先試用（不用 Supabase）

```bash
npm install
npm run dev:demo
```

打開 <http://localhost:3000>，會用記憶體裡的範例資料（頂端有「示範模式」標示），可以記帳、校準、切換深淺色。重新整理就會還原。

## 正式使用：接上 Supabase

1. 到 [supabase.com](https://supabase.com) 建一個專案（免費方案即可）。
2. 後台 → **SQL Editor**，依檔名順序把 [`supabase/migrations/`](supabase/migrations/) 裡的每個檔案整份貼上執行。之後新增的 migration 也要這樣手動跑一次（免費方案的 GitHub 整合不會自動套用），而且要**先跑 SQL 再部署新版程式**。`20261008000000_friends_account_type.sql` 要單獨執行完，再執行下一份（Postgres 規定新加的類型值要先生效）。
3. 後台 → **Authentication → URL Configuration**：
   - Site URL：`http://localhost:3000`（上線後改成正式網址）
   - Redirect URLs 加上 `http://localhost:3000/**`
4. 後台 → **Project Settings → API**，把網址和 Publishable key（舊專案叫 anon key）填進 `.env.local`：

   ```bash
   cp .env.local.example .env.local
   ```

5. `npm run dev`，在登入頁按「註冊」建立帳號（預設會寄確認信，點信裡的連結完成註冊），之後就用 Email 和密碼登入。
6. 只有自己用的話，註冊完到 Authentication → Sign In / Providers 關掉 **Allow new users to sign up**，別人就不能用你的網址註冊。

### AI 記帳（說一句、拍收據）

1. 到 [Google AI Studio](https://aistudio.google.com/apikey) 建立 API key。
2. 在 `.env.local` 加上 `GEMINI_API_KEY=…`；部署到 Vercel 時，在 Project → Settings → Environment Variables 加同一個變數，然後重新部署。**不要**加 `NEXT_PUBLIC_` 前綴，否則金鑰會被打包進網頁。
3. 沒設定也能正常記帳，只是按「說一句」「拍收據」會顯示 AI 還沒設定好。

- 預設用 `gemini-3.5-flash-lite`（實測語音、收據都約 2 秒），忙碌或額度用完時自動改用 `gemini-3.1-flash-lite`、`gemini-flash-lite-latest`。要換模型可設 `GEMINI_MODEL`（逗號分隔，依序嘗試）。
- 免費方案的內容可能被 Google 用來改善服務；介意的話在 AI Studio 開啟付費（費用很低），付費方案不會拿來訓練。收據照片送去辨識後就不會留在 Google；照片本身存在你自己的 Supabase（見下面的「收據照片」）。

### 匯出到 Google Sheets

「我的 → 匯出到 Google Sheets」會在你自己的 Google 雲端硬碟建一份「Monee 記帳」試算表，之後每次按都更新同一份。要先在 Google Cloud 建一個 OAuth 用戶端（一次就好）：

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建一個專案（例如叫 Monee）。
2. **APIs & Services → Library**，搜尋並啟用 **Google Sheets API** 和 **Google Drive API** 兩個（Drive API 用來確認上次的試算表還在、沒被丟進垃圾桶）。
3. **Google Auth Platform**（舊版叫 OAuth consent screen）：
   - **Branding**：App name 填 Monee，填你的 Email。
   - **Audience**：User type 選 External。狀態維持 Testing，在 **Test users** 加上你要用來匯出的 Gmail（只有加進去的帳號能授權）。
   - **Data Access**：Add or remove scopes，勾 `.../auth/drive.file`（只能存取 Monee 自己建立的檔案）。
4. **Clients → Create client**：Application type 選 **Web application**，**Authorized JavaScript origins** 加上 `http://localhost:3000` 和正式網址（例如 `https://monee-xxx.vercel.app`，不要加結尾的 `/`）。Redirect URIs 不用填。
5. 複製 **Client ID**（`….apps.googleusercontent.com`），在 `.env.local` 加上 `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…`；Vercel 也加同一個變數再重新部署。匯出用不到 Client secret（「Google 雲端同步」才要，而且只放在伺服器）。
6. 到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261014000000_sheets_export.sql`（記住匯出到哪一份試算表）。

- 狀態是 Testing 時，Google 授權畫面會先顯示「Google 尚未驗證這個應用程式」，按「繼續」就好。要給別人用的話，到 Audience 按 **Publish app**；只用 `drive.file` 這種非敏感權限，通常不用等 Google 審核。
- 在 LINE 內建瀏覽器裡 Google 不給登入，要改用 Safari 或 Chrome 打開。

### 資料備份

到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261021000000_backup.sql`，**先執行再部署**。之後「我的 → 資料備份」可以下載備份檔（`monee-backup-日期.json`），也可以上傳備份檔還原。

### 收據照片

到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261021000001_receipts.sql`，**先執行再部署**。它會建一個私人的儲存空間 `receipts` 和讀寫權限（後台 Storage 看得到）。免費方案的檔案空間是 1GB，一張照片約 300KB，大約可以存 3,000 張。

### 分類管理

到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261021000002_categories.sql`，**先執行再部署**。之後「我的 → 分類管理」可以新增、改名、換圖示、隱藏、調整順序。

### 固定收支

到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261021000003_recurring.sql`，**先執行再部署**。之後「我的 → 固定收支」可以管理，記一筆時也能直接勾「設成固定收支」。

### 連續記帳與無消費日

到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261021000004_no_spend_days.sql`，**先執行再部署**（確認右上角是 Monee 的專案，不要反白，整段執行）。最後一列應該是 has_table = true、policies = 3、has_activity = true、backup_has_no_spend = true。沒執行的話首頁不會出現連續記帳的卡片，其他功能照常。

### Google 雲端同步（收據、年度帳本）

「我的 → Google 雲端同步」連結一次 Google 帳號後，伺服器會自動把收據放進 Drive，並維護每年一份的年度帳本。跟上面的「匯出到 Google Sheets」共用同一個 OAuth 用戶端，先照那一節做好，再多做這幾步：

1. **Clients** → 點原本那個 Web client → **Authorized redirect URIs** 加上 `http://localhost:3000/api/google/callback` 和 `https://正式網址/api/google/callback`（跟 JavaScript origins 一樣，不要結尾的 `/`）。
2. 同一個 client 的 **Client secrets** → **Add secret**，複製下來，在 `.env.local` 和 Vercel 加上 `GOOGLE_CLIENT_SECRET=…`。**不要**加 `NEXT_PUBLIC_` 前綴，它只能在伺服器。
3. 產生加密授權用的金鑰：`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`，在 `.env.local` 和 Vercel 加上 `GOOGLE_TOKEN_KEY=…`。設定後不要再換：換了之前存的授權就解不開，要重新連結。
4. **Data Access** 再加 `openid` 和 `.../auth/userinfo.email`（顯示連的是哪個帳號），都是非敏感權限。
5. **Branding** 填好「應用程式首頁」`https://正式網址`、「隱私權政策連結」`https://正式網址/privacy`（Monee 內建，不用登入就看得到），「授權網域」加上正式網址的網域（例如 `monee-xxx.vercel.app`）。沒填的話下一步的發布按鈕可能按不了。
6. **Audience** 按 **Publish app**（狀態改成 In production）。維持 Testing 的話，Google 給的長期授權 7 天就失效，每週都要重新連結。只用非敏感權限，不用等 Google 審核。
7. 到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261022000000_google_sync.sql`（確認是 Monee 的專案，整段執行）。最後一列應該是 tables = 5、policies = 20、triggers = 6、functions = 3。
8. Vercel 加完變數後重新部署。

> Supabase 免費專案一週沒有任何存取會自動暫停，到後台按一下就能恢復。內建寄信服務（註冊確認信、重設密碼信）只寄給 Supabase 專案成員的 Email，而且每小時只能寄 2 封；要給別人用前，請在 Authentication → SMTP 換成自己的寄信服務。

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器（連 Supabase） |
| `npm run dev:demo` | 開發伺服器（示範模式，不連 Supabase） |
| `npm run build` / `npm start` | 正式建置／啟動 |
| `npm test` | 單元測試 |
| `npm run lint` / `npm run typecheck` | 程式檢查 |
| `npm run sync:tokens` | 從 `../design-system/monee/tokens.css` 同步設計 token（dev／build 前會自動執行） |

## 結構

```
src/
  app/
    (app)/              登入後的頁面：首頁、transactions、assets、reports、settings、streak（記帳月曆）
    login/              Email ＋ 密碼登入、註冊、忘記密碼
    reset-password/     設定新密碼（重設信回來、或從「我的」修改密碼）
    auth/callback/      登入信的連結回到這裡換成登入狀態
    api/ai/draft/       收錄音（WAV）／收據照片／一句文字，請 Gemini 整理成交易草稿（不寫資料庫）
    s/[token]/          分帳分享頁：朋友不用登入就能看帳、按「我已付款」、新增花費
    api/fx/             匯率（open.er-api.com，快取 6 小時；分享頁的朋友沒登入也能用）
    api/google/         Google 雲端同步：connect（導到 Google）、callback（存加密的授權）、disconnect、sync
    layout.tsx          字體、深淺色（行內腳本避免閃爍）
    globals.css         Tailwind ＋ tokens ＋ 共用元件樣式
  proxy.ts              每次請求更新登入 cookie，未登入導到 /login（Next 16 的 middleware）
  components/
    screens/            五個頁面＋登入頁
    sheets/             記一筆（含 AI 入口 AiEntryBar、分帳開關）、新增帳戶、校準餘額三個底部面板
    split/              分帳：分帳頁、群組頁、花費表單、還款與群組設定面板、分享頁（含朋友的新增表單）
  lib/
    budget.ts           今日額度、預算進度、分組、校準差額等純函式（有測試）
    ai-draft.ts         給 Gemini 的指示、回傳格式、草稿檢查（有測試）
    ai-client.ts        前端上傳（照片先縮小）；use-voice.ts 說一句的收音、voice-capture.ts 音量判斷與存成 WAV（有測試）
    split.ts            分帳的分攤、淨額、建議還款、旅程（有測試）
    currency.ts         幣別、外幣顯示與換算（有測試）
    sheets-export.ts    匯出到 Google Sheets 的內容：總覽、月報、明細、帳戶（有測試）
    csv.ts              下載明細 CSV（有測試）
    categories.ts       內建分類、圖示，加上使用者改過的分類（有測試）
    recurring.ts        固定收支的日期計算：下次哪天、到期要補記哪幾天、首頁要列哪些（有測試）
    streak.ts           連續記帳：每天算有記帳還是無消費、連續與最長天數、徽章、月曆（有測試）
    drive-receipts.ts   收據在 Drive 的檔名、資料夾，這個月要上傳／改名搬家／丟垃圾桶的有哪些（有測試）
    annual-ledger.ts    年度帳本：月份明細的列、年度總覽的公式和圖、建立與修補的 Sheets API 請求（有測試）
    server/             只在伺服器用：Google 授權（token 加密）、Drive／Sheets API、同步流程（有測試，用假的資料庫和 Google）
    backup.ts           備份檔的格式檢查、換帳號還原時換掉 id（有測試）
    use-receipt-draft.ts 表單上的收據照片：附上、換掉、存檔時上傳與清掉沒用到的檔案
    google-sheets.ts    Google 授權與寫入試算表（有測試，用假的 Google 回應）
    data.ts             Supabase 讀寫（React Query hooks）
    demo.ts             示範模式的範例資料
    ui-store.ts         面板、提示訊息、隱藏金額、深淺色、角色
supabase/migrations/    資料表、RLS、帳戶餘額 view
```

## 設計與實作決定

- **每月預算「從某月起生效」**（`budget_history`）：過去月份保留當時的預算，報表逐月比較。改預算時選套用範圍：從這個月起、只有這個月（下個月起回到原本的）、從下個月起。前端用 `planBudget` 算出本月起的新紀錄，資料庫函式 `budget_replace_from` 一次換掉，早於本月的一律拒絕。首頁的「本月預算」點了會到設定頁改。
- **帳戶餘額不存欄位**，由 `account_balances` view 用「期初餘額＋交易」即時計算，不會跟流水帳對不上。
- **轉帳（TRANSFER）不算支出**：首頁、報表的支出都排除轉帳，首頁會另外標示「已排除內部轉帳」。
- **校準**：輸入銀行或信用卡 App 上的數字，有差額就補一筆「未記錄雜項（支出）」或「未記錄收入」，並記下校準時間。投資帳戶不提供校準，因為市值變動不是生活收支。
- **投資帳戶**：Phase 1 可以手動建立並轉帳進去；Phase 3 改由 Monee Invest 同步 `investment_snapshot`。
- **點交易列可以編輯或刪除**：跟記一筆共用同一個表單；刪除要再按一次確認。
- **＋ 打開記一筆**：上方是「說一句」「拍收據」，下方是手動輸入；最近常用的品項可以一鍵帶入。
- **分帳**（規格見 monee_ux.md「06. 分帳」，原型見 `../prototype/split.html`）：朋友只有名字；你的帳只算你的部分，朋友欠你的錢記在系統建立的「朋友往來」帳戶（算進淨資產）。花費、還款連同個人帳的交易都由資料庫函式（`split_*`）一次寫完；全部還清時自動收進「已結清的紀錄」。分帳產生的交易只能在群組裡改，明細裡點它會帶你到群組；你先付時的「代墊」轉帳在明細收起來，只顯示你的部分。群組可以封存（`archived_at`，只是從列表收起來，帳都在）或刪除（`split_delete_group` 帶 `p_force`，連同你帳上的對應交易一起刪）。
- **分享連結**（`/s/<token>`）：沒登入的人只能呼叫 `split_public_*` 四個資料庫函式（看帳、說已付款、新增花費、撤回自己記的），只拿得到、只寫得到這個群組的分帳資料（不含帳戶、交易、Email）。朋友按「我已付款」只會建立待確認，你確認後才寫入還款。連結外流可以重設或停止分享。
- **朋友新增花費**（`split_proposals`）：朋友在分享頁記一筆，一律平分。跟你有關的（你先付，或有分到你）先放進待確認，不算進結算；你確認時可以改分類、你先付的要選付款帳戶，確認後照一般花費寫入（`split_save_expense`），也可以退回。跟你無關的（朋友之間）直接記進群組，不會動到你的帳。朋友可以撤回自己記的、還沒確認或跟你無關的那筆；已經進你帳的只能由你改。分享設定可以關掉「朋友可以新增花費」（`allow_friend_add`，預設開）。待確認最多 30 筆、朋友直接記的未結清花費最多 200 筆。
- **旅程**：kind 為 trip 的群組，有日期（在月曆上點出發和回來）、幣別、旅程預算，可以只有自己。外幣花費存原幣金額與當下匯率（可手動改），入帳一律換成台幣；原幣分攤直接照權重分原幣總額。設定「不算進每月預算」的旅程支出會標 `exclude_from_budget`，首頁今日額度、預算進度、報表的「預算已用」都不算它，總支出照算。旅程期間打開記一筆會自動記到這趟旅程。
- **AI 只產生草稿**：辨識結果直接填進同一個表單（上方顯示 AI 聽到／看到的內容），使用者檢查後按「記下」才寫入。伺服器會再檢查一次：分類、帳戶一定是現有的，金額照幣別取到該有的小數位，日期不晚於今天。
- **AI 認得幣別**：收據依店家所在國家判斷幣別（日本收據是日圓），外文品項翻成中文。分帳、旅程的新增花費也有「說一句／拍收據」，會多送成員名字與群組幣別，AI 才認得「小明付的」，沒說幣別時用旅程的當地貨幣。一般記帳只記台幣，外幣收據用今天的參考匯率換算，原幣金額寫進備註。
- **說一句：Web Audio 收音、存成 WAV 交給 Gemini 聽**（`use-voice.ts`、`voice-capture.ts`）：不用 MediaRecorder，也不用瀏覽器的語音辨識——這兩個在 iPhone 加到主畫面的 App 上常常卡住或錄不到（之前一直停在「準備麥克風」）。AudioContext 在按下「說一句」的當下建立並叫醒（iPhone 只有這時候肯打開聲音），拿到麥克風後用 ScriptProcessor 收聲音、算音量：波形跟著音量跳動（直接改樣式，不經過 React 重畫），真的有聲音進來才顯示「聆聽中」、開始計時。判斷有沒有在說話用底噪的 3 倍當門檻（開口前才更新底噪，說久了不會把自己的聲音當底噪），說過話後安靜 1.3 秒自動結束，8 秒都沒開口就提示沒聽到；按「說完了」或自動結束後多收 0.25 秒，最後一個字才不會被切掉。錄到的聲音降到 16kHz 單聲道 16-bit 的 WAV（10 秒約 320KB），Gemini 官方支援。每個可能卡住的地方都有時間限制：拿到麥克風 4 秒內沒有聲音進來就停下來提示，最長 30 秒。等權限超過 2.5 秒會提示按「允許」。聽錯時可以「聽錄音」確認錄得清不清楚，或「改用打字」（打字也可以用手機鍵盤的語音輸入，給 AI 的指示會提醒可能有同音錯字）。很短的一句（「蔥 19 塊」）AI 常聽不準品項而判成不是記帳，有聽到金額就照樣給草稿、標成不太確定，讓使用者改品項就好。回傳格式先寫逐字稿（`propertyOrdering`）再整理其他欄位，並要求聽不清楚不要自己編。
- **匯出到 Google Sheets**：瀏覽器向 Google 拿授權（Google Identity Services 的 token model，權限只有 `drive.file`：只能建立、讀寫 Monee 自己建立的檔案），直接呼叫 Sheets API 寫入，不經過我們的伺服器。授權只放在記憶體（約一小時內再按不用重新授權），資料庫只記試算表 id（`profiles.sheets_id`），換手機登入也會更新同一份。試算表有四張工作表：總覽（淨資產、本月收支、說明）、月報（每月收支、當月預算與預算已用、各分類支出）、明細（全部交易，不只最近 6 個月，含外幣與分帳群組）、帳戶。每次匯出只清掉並重寫這四張，使用者自己加的工作表不會動；被刪掉的工作表會補回來，整份被刪掉或丟進垃圾桶就建一份新的。文字一律照原樣寫入（`RAW`），朋友從分享連結記的品項寫成公式也不會被執行；日期寫成試算表的日期序號，可以排序、篩選。Google 的授權視窗必須在按鈕的 click 裡直接打開，所以進「我的」就先載入 Google 的程式。
- **下載明細 CSV**：「我的 → 下載明細（CSV）」下載全部交易，欄位跟 Google Sheets 的「明細」一樣（共用 `ledgerRows`），不用任何設定，示範模式也能下載。檔案開頭有 BOM，Excel 打開中文才不會亂碼；日期寫成 `YYYY-MM-DD`，Excel 會認成日期。開頭是 `=`、`+`、`-`、`@` 的文字前面加 `'`，朋友從分享連結記的品項寫成公式也不會被 Excel 執行。跟備份檔分開下載，因為一次觸發兩個下載，iPhone 常常只會存一個、Chrome 會跳出要不要允許的詢問。
- **資料備份**：備份檔由資料庫函式 `backup_export` 產生，是每張表的資料列照原樣（帳戶含封存的、交易、預算紀錄、分帳群組與旅程的成員、花費、還款、結清紀錄、朋友的待確認），加上分享頁的名字、收款方式與漲跌配色；不含 Google 試算表 id。還原是整個換掉（`backup_restore`）：先把現在的資料存進 `backup_snapshots`，再清掉、照備份寫回去，全部在同一個交易裡，中途有一筆寫不進去就整個不動。「換回還原前的資料」就是拿那一份再還原一次，所以再按一次又會換回來；只留最近一次還原前的那一份。函式都是 security invoker，照樣套用 RLS，備份檔被改過也只寫得進自己的資料、引用不到別人的帳戶。同一個帳號照原本的 id 寫回去，朋友手上的分享連結繼續有效；別的帳號的備份由前端換掉所有 id（`prepareRestore`，連花費分攤裡用成員 id 當 key 的也換），分享連結和收據照片不帶過來。收據照片不在備份檔裡（只記路徑），同一個帳號還原時照片還在就看得到。
- **收據照片**：存在 Supabase Storage 的 `receipts`（私人），路徑是 `{user id}/{隨機 id}.jpg`，Storage 的權限讓每個人只能讀寫自己的資料夾；畫面上用一小時內有效的簽名網址顯示。照片跟送去辨識的是同一張（手機上先縮成長邊 2000px 的 JPEG，約 300KB）。拍收據時照片馬上附到表單上，AI 認不出來也留著；手動記帳、改帳時也能附上、換一張或拿掉，按「記下」才上傳。一般記帳存在 `transactions.receipt_image_url`，跟交易一起寫入；分帳與旅程的花費存在 `split_expenses.receipt_path`，花費寫好後再補上照片路徑（補不上的話花費照樣記好，只提醒再附一次，避免重按記成兩筆），分帳寫進個人帳的交易不另外存。換掉或拿掉的舊照片、刪掉的交易／花費／群組的照片由前端一起刪；存檔失敗時剛上傳的照片也會刪掉。明細裡有照片的交易品項後面有迴紋針。朋友的分享頁不能附照片。
- **分類管理**：內建分類（支出 7 個、收入 4 個、轉帳）寫在 `lib/categories.ts`；`categories` 表只存使用者改過的內建分類和自己加的分類（`c_` 開頭）。改任何一個分類時，前端把那一類（支出或收入）的整份清單連同順序寫進去，表裡沒有的內建分類（沒改過，或程式之後新增的）接在最後面；轉帳固定不能改。登入後 AppShell 讀這張表，合成完整的清單放進 store，用到分類的元件都訂閱它（`useCategories()`），改名、隱藏、排序馬上反映到記一筆、明細、報表、分帳。隱藏只是記一筆時不出現（編輯舊的帳時目前選的那個照樣列出），以前的帳照樣保留、照樣算進報表；每一類至少要留一個看得到的。內建的只能隱藏，自己加的可以刪：先顯示有幾筆交易、分帳花費用到，選要移到哪個分類，`category_delete` 把交易、分帳花費、朋友的待確認移過去再刪掉，同一個交易裡做完。AI 記帳會把沒隱藏的分類一起送去（伺服器檢查 id 格式、名字長度並去掉換行，沒送就用內建的）。朋友的分享頁用 `split_public_categories` 讀群組擁有者的支出分類。Google Sheets 月報的分類欄照使用者的分類和順序，隱藏但有花費的也列出來。資料備份也帶上分類；換帳號還原時分類 id 不換（每個人的分類各自獨立）。
- **固定收支**（`recurring_rules`）：每月（幾號；29–31 號遇到小月記在月底）、每週（星期幾）、每年（幾月幾號），每筆自己選「自動記下」或「到時候問我」。沒有排程在伺服器跑：打開 App 時 `RecurringAuto` 把到期的「自動記下」一次記好（很久沒打開就補記，一筆最多補 24 期），提示記了什麼；「到時候問我」的列在首頁，金額可以改了再記下，或略過這期。7 天內會記的也列在首頁。記帳由 `recurring_post` 在同一個交易裡寫入交易、推下次日期，並帶著「以為的下次日期」比對，兩支手機同時打開也不會記兩次。產生的交易記 `recurring_id`，明細品項後面有重複的小圖示；刪掉固定收支時已經記的帳不動。記一筆勾「設成固定收支」時，這一筆照常記下，固定收支從下一期開始，週期照記帳日期（每月就是那天幾號）。改週期時下次日期從今天重算；暫停後恢復，暫停期間過掉的不補記。資料備份也帶上固定收支。
- **連續記帳與無消費日**（`no_spend_days`）：沒記帳的日子分不出是沒花錢還是忘了記，所以無消費日要按「今天沒花錢」（首頁）或在月曆上點那一天補蓋；那天有自己記的支出就不能蓋，蓋過之後又記了支出就不算（支出刪掉，章又會出現）。有自己記的帳或無消費日的日子都算進連續天數，照交易日期算，補記以前的帳也接得起來；今天還沒記不算斷，從昨天往回數。固定收支產生的交易不算自己記的，也不算花錢。首頁只讀最近 6 個月的交易，所以連續天數、最長紀錄、徽章用 `activity_days` 另外讀全部的日期（只有日期，用一個 jsonb 回傳，不受 API 一次最多 1000 列的限制）；它的 query key 放在 `transactions` 底下，記帳、改帳、刪帳時跟著重新讀。蓋章時畫面先改（樂觀更新），同一個 scope 照順序送出，連按也不會亂。連續剛好 7、30、100、365 天那天，首頁卡片換成角色慶祝並提示一次（localStorage 記著提示過了）；徽章看最長紀錄，拿過就一直在。月曆頁（`/streak`）可以翻回最早有資料的月份。資料備份也帶上無消費日。
- **Google 雲端同步**（規格是使用者的「Monee 實作規格」；跟「匯出到 Google Sheets」是兩件事，那個照舊手動）：Monee 的資料庫是唯一的主要資料，Google 上的收據和年度帳本都是另一份，同步失敗也不影響記帳。
  - **授權**：伺服器走 OAuth 授權碼流程，只要 `drive.file`（只碰得到 Monee 自己建立的檔案，不用 Google 審核）加上 `openid`、`email`。refresh token 用 `GOOGLE_TOKEN_KEY` 以 AES-256-GCM 加密、綁使用者 id 才存進 `google_integrations`；前端不讀這個欄位，token 不寫進 log。連結時用 state cookie 比對，避免被塞授權碼。授權失效（`invalid_grant`）就標成要重新連結。解除連結會撤銷授權，Drive 裡的檔案都不動。
  - **什麼要同步**：沒有排程在伺服器跑。資料庫 trigger 在交易有任何變動（記帳、改帳、刪帳、分帳、固定收支、資料還原；用 statement trigger，一次改很多筆也只觸發一次）、分帳花費換收據、分類改名時，把那個月記進 `google_sync_months`；只記有連結的人。連結時 `google_mark_all` 把有收支的月份全部記上。
  - **什麼時候跑**：記帳改帳後（交易重新讀到時）和打開 App 時，前端先看有沒有待同步的月份，有才叫 `/api/google/sync`，不等結果；設定頁有「立即同步」。同步用使用者自己的登入（照樣套用 RLS），`google_sync_begin` 拿到鎖才跑（3 分鐘自動失效），兩支手機同時叫也只跑一個。一次最多 40 秒，做不完下次接著做；某個月失敗就記下次數和原因，其他月份照做；空間滿了、授權過期就整個停。自動同步跳過失敗 5 次以上的月份，按「立即同步」才再試。月份做完時 `dirty_at` 沒變才清掉，同步途中又被改到就下次再做一次。
  - **收據**：Supabase 上的照片下載下來放進 Drive 的 `Monee/年/月`（照記帳日期），檔名 `2026-10-22_全聯_830.jpg`；分帳、旅程花費的收據也放。`drive_receipts` 用照片路徑對應 Drive 的檔案，同一張只放一次。品項、金額、日期改了就改檔名、搬資料夾；交易刪掉或換照片，對不到的那張丟進 Drive 垃圾桶（改到別的月份的不算，等那個月同步時搬過去）。資料夾被刪或換了 Google 帳號就重建、重新上傳。App 裡看收據的地方，同步過的會多一個「在 Google Drive 打開」。
  - **年度帳本**：每年一份 `Monee_2026_年度帳本` 放在 `Monee/2026`，`00_年度總覽`、`01_一月`～`12_十二月`、`99_分類設定`（工作表 id 自己指定，被刪了用同一個 id 補回）。月份工作表照規格 A–J 欄，**有變動就照資料庫整個月重寫**（不照規格用記帳 ID 逐列找、改、刪）：照日期排、不會重複，跨月和刪除自然處理，資料還原後也對得上；代價是月份工作表由 Monee 管，自己在裡面加的字會被蓋掉（改的時候 Google 會跳提醒），自己加的工作表不受影響。只寫收入、支出（轉帳不寫，跟 App 裡「轉帳不算支出」一致）；金額一律正數；收據欄是連到 Drive 的「查看收據」；備註寫旅程／分帳名稱和外幣金額。使用者寫的字一律寫成文字（`stringValue`），開頭是 `=` 也不會變成公式。年度總覽全部是固定的公式：KPI、每月統計（`SUMIFS` 那個月的工作表，沒資料是 0）、儲蓄率（收入是 0 時空白）、最高／最低支出月份（沒資料寫「尚無資料」，最低只看有支出的月份）、支出分類金額與占比（從分類設定讀名稱，最多 40 個）、自動排序的分類排行，加上四張圖。帳本被刪就建新的、工作表被刪或改名就補回或改回，都會全部重新同步（引用被刪工作表的公式會壞掉，所以年度總覽的公式也重寫）。只有轉帳的月份不會為了它建帳本。
- **街頭貼紙設計**（規則見 `design-system/monee/MASTER.md`）：預設深色（黑色牆面＋噴漆色點），淺色是奶油紙；卡片、按鈕、面板這些「貼紙」不分深淺都是淺色，有粗黑框和錯開的實心影。貼紙在 CSS 裡把 `--text`、`--text-2` 換成墨色並重新指定 `color`，直接放在頁面上的色塊要加 `.sticker`。分類、帳戶各有自己的顏色（`Category.color`、`lib/palette.ts`），圖示一律墨色。首頁今日卡片是傾斜的漫畫格，今日花費用卡通字加粗黑描邊。
- **角色**（`components/Mascot.tsx`）：硬幣小子、錢包兄弟、豬撲滿三選一（「我的 → 外觀」，存在 localStorage，預設硬幣小子），向量圖、四種表情（剛好、快用完了、超支、慶祝），首頁跟著今日額度換表情。App 圖示是硬幣小子。
- **字體**：英數 Rubik（金額）、Luckiest Guy（英文點綴、今日花費）、Sedgwick Ave Display（塗鴉小字）由 `next/font` 託管；中文粉圓（Huninn，標題）、Noto Sans TC（內文）有上百個分片，交給 `next/font` 下載時只要一片逾時就會讓建置失敗，所以改由瀏覽器向 Google Fonts 按需載入。

## 還沒做（依 monee_ux.md 路線圖）

- Phase 3：Monee Invest 同步投資快照
