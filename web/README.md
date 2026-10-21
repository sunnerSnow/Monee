# Monee Web

> 可愛輕量、懂你金流的個人生活財務助理。規格見 [`../monee_ux.md`](../monee_ux.md)，設計規範見 [`../design-system/monee/`](../design-system/monee/MASTER.md)。

Phase 1（MVP）：手機網頁版的手動記帳、收支分類、內部轉帳、帳戶與校準餘額、首頁／明細／資產／報表／我的。
Phase 2（進行中）：說一句、拍收據的 AI 記帳（Gemini 整理成草稿，確認後才寫入）；跟朋友分帳（第 ①②③④ 階段：自己記帳、分享連結、旅程與外幣、外文收據、朋友從連結新增花費）；匯出到 Google Sheets；資料備份與還原。

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
- 免費方案的內容可能被 Google 用來改善服務；介意的話在 AI Studio 開啟付費（費用很低），付費方案不會拿來訓練。收據照片只送去辨識，不會存起來。

### 匯出到 Google Sheets

「我的 → 匯出到 Google Sheets」會在你自己的 Google 雲端硬碟建一份「Monee 記帳」試算表，之後每次按都更新同一份。要先在 Google Cloud 建一個 OAuth 用戶端（一次就好）：

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建一個專案（例如叫 Monee）。
2. **APIs & Services → Library**，搜尋並啟用 **Google Sheets API** 和 **Google Drive API** 兩個（Drive API 用來確認上次的試算表還在、沒被丟進垃圾桶）。
3. **Google Auth Platform**（舊版叫 OAuth consent screen）：
   - **Branding**：App name 填 Monee，填你的 Email。
   - **Audience**：User type 選 External。狀態維持 Testing，在 **Test users** 加上你要用來匯出的 Gmail（只有加進去的帳號能授權）。
   - **Data Access**：Add or remove scopes，勾 `.../auth/drive.file`（只能存取 Monee 自己建立的檔案）。
4. **Clients → Create client**：Application type 選 **Web application**，**Authorized JavaScript origins** 加上 `http://localhost:3000` 和正式網址（例如 `https://monee-xxx.vercel.app`，不要加結尾的 `/`）。Redirect URIs 不用填。
5. 複製 **Client ID**（`….apps.googleusercontent.com`），在 `.env.local` 加上 `NEXT_PUBLIC_GOOGLE_CLIENT_ID=…`；Vercel 也加同一個變數再重新部署。Client secret 用不到，不要放進任何地方。
6. 到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261014000000_sheets_export.sql`（記住匯出到哪一份試算表）。

- 狀態是 Testing 時，Google 授權畫面會先顯示「Google 尚未驗證這個應用程式」，按「繼續」就好。要給別人用的話，到 Audience 按 **Publish app**；只用 `drive.file` 這種非敏感權限，通常不用等 Google 審核。
- 在 LINE 內建瀏覽器裡 Google 不給登入，要改用 Safari 或 Chrome 打開。

### 資料備份

到 Supabase 的 SQL Editor 執行 `supabase/migrations/20261021000000_backup.sql`，**先執行再部署**。之後「我的 → 資料備份」可以下載備份檔（`monee-backup-日期.json`），也可以上傳備份檔還原。

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
    (app)/              登入後的頁面：首頁、transactions、assets、reports、settings
    login/              Email ＋ 密碼登入、註冊、忘記密碼
    reset-password/     設定新密碼（重設信回來、或從「我的」修改密碼）
    auth/callback/      登入信的連結回到這裡換成登入狀態
    api/ai/draft/       收語音／收據照片／一句文字，請 Gemini 整理成交易草稿（不寫資料庫）
    s/[token]/          分帳分享頁：朋友不用登入就能看帳、按「我已付款」、新增花費
    api/fx/             匯率（open.er-api.com，快取 6 小時；分享頁的朋友沒登入也能用）
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
    ai-client.ts        前端上傳（照片先縮小）；use-recorder.ts 錄音
    split.ts            分帳的分攤、淨額、建議還款、旅程（有測試）
    currency.ts         幣別、外幣顯示與換算（有測試）
    sheets-export.ts    匯出到 Google Sheets 的內容：總覽、月報、明細、帳戶（有測試）
    backup.ts           備份檔的格式檢查、換帳號還原時換掉 id（有測試）
    google-sheets.ts    Google 授權與寫入試算表（有測試，用假的 Google 回應）
    data.ts             Supabase 讀寫（React Query hooks）
    demo.ts             示範模式的範例資料
    ui-store.ts         面板、提示訊息、隱藏金額、深淺色
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
- **AI 只產生草稿**：辨識結果直接填進同一個表單（上方顯示 AI 聽到／看到的內容），使用者檢查後按「記下」才寫入。伺服器會再檢查一次：分類、帳戶一定是現有的，金額照幣別取到該有的小數位，日期不晚於今天。不能錄音的瀏覽器會改成「打一句」。
- **AI 認得幣別**：收據依店家所在國家判斷幣別（日本收據是日圓），外文品項翻成中文。分帳、旅程的新增花費也有「說一句／拍收據」，會多送成員名字與群組幣別，AI 才認得「小明付的」，沒說幣別時用旅程的當地貨幣。一般記帳只記台幣，外幣收據用今天的參考匯率換算，原幣金額寫進備註。
- **錄音直接交給 Gemini**，不用瀏覽器的語音辨識：iPhone、Android、電腦的瀏覽器都能用，一次呼叫就完成聽寫與整理。最長 30 秒。麥克風真的開始錄才顯示「聆聽中」，按「說完了」後多錄 0.3 秒，頭尾的字才不會被切掉。瀏覽器有內建語音辨識（Android Chrome、Safari、電腦瀏覽器）時改用它邊說邊顯示字（`use-live-transcript.ts`），說完停一下自動結束，只把字送給 Gemini 整理；iPhone 加到主畫面的 App、LINE 內建瀏覽器沒有這個功能，照舊錄音交給 Gemini 聽。兩種不能同時用麥克風：同時用的話手機上第二次會錄不到聲音。瀏覽器的語音辨識會把聲音送到 Google（Chrome）或 Apple（Safari）轉字。很短的一句（「蔥 19 塊」）AI 常聽不準品項而判成不是記帳，有聽到金額就照樣給草稿、標成不太確定，讓使用者改品項就好。
- **匯出到 Google Sheets**：瀏覽器向 Google 拿授權（Google Identity Services 的 token model，權限只有 `drive.file`：只能建立、讀寫 Monee 自己建立的檔案），直接呼叫 Sheets API 寫入，不經過我們的伺服器。授權只放在記憶體（約一小時內再按不用重新授權），資料庫只記試算表 id（`profiles.sheets_id`），換手機登入也會更新同一份。試算表有四張工作表：總覽（淨資產、本月收支、說明）、月報（每月收支、當月預算與預算已用、各分類支出）、明細（全部交易，不只最近 6 個月，含外幣與分帳群組）、帳戶。每次匯出只清掉並重寫這四張，使用者自己加的工作表不會動；被刪掉的工作表會補回來，整份被刪掉或丟進垃圾桶就建一份新的。文字一律照原樣寫入（`RAW`），朋友從分享連結記的品項寫成公式也不會被執行；日期寫成試算表的日期序號，可以排序、篩選。Google 的授權視窗必須在按鈕的 click 裡直接打開，所以進「我的」就先載入 Google 的程式。
- **資料備份**：備份檔由資料庫函式 `backup_export` 產生，是每張表的資料列照原樣（帳戶含封存的、交易、預算紀錄、分帳群組與旅程的成員、花費、還款、結清紀錄、朋友的待確認），加上分享頁的名字、收款方式與漲跌配色；不含 Google 試算表 id。還原是整個換掉（`backup_restore`）：先把現在的資料存進 `backup_snapshots`，再清掉、照備份寫回去，全部在同一個交易裡，中途有一筆寫不進去就整個不動。「換回還原前的資料」就是拿那一份再還原一次，所以再按一次又會換回來；只留最近一次還原前的那一份。函式都是 security invoker，照樣套用 RLS，備份檔被改過也只寫得進自己的資料、引用不到別人的帳戶。同一個帳號照原本的 id 寫回去，朋友手上的分享連結繼續有效；別的帳號的備份由前端換掉所有 id（`prepareRestore`，連花費分攤裡用成員 id 當 key 的也換），分享連結不帶過來。收據照片目前不會存，所以也不在備份裡。
- **分類先固定**（`lib/categories.ts`），分類管理之後再做。
- **字體**：英數 Lexend Exa 由 `next/font` 託管；中文 Noto Sans TC 有上百個分片，交給 `next/font` 下載時只要一片逾時就會讓建置失敗，所以改由瀏覽器向 Google Fonts 按需載入。

## 還沒做（依 monee_ux.md 路線圖）

- Phase 2：收據照片存檔（目前辨識完就丟掉）
- Phase 3：Monee Invest 同步投資快照
- 外幣現金帳戶（例如錢包裡的日圓）
- 分類管理、帳戶編輯／封存、帳戶排序
