# Monee Web

> 可愛輕量、懂你金流的個人生活財務助理。規格見 [`../monee_ux.md`](../monee_ux.md)，設計規範見 [`../design-system/monee/`](../design-system/monee/MASTER.md)。

Phase 1（MVP）：手機網頁版的手動記帳、收支分類、內部轉帳、帳戶與校準餘額、首頁／明細／資產／報表／我的。
Phase 2（進行中）：說一句、拍收據的 AI 記帳（Gemini 整理成草稿，確認後才寫入）。

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
2. 後台 → **SQL Editor**，依檔名順序把 [`supabase/migrations/`](supabase/migrations/) 裡的每個檔案整份貼上執行。之後新增的 migration 也要這樣手動跑一次（免費方案的 GitHub 整合不會自動套用），而且要**先跑 SQL 再部署新版程式**。
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
    layout.tsx          字體、深淺色（行內腳本避免閃爍）
    globals.css         Tailwind ＋ tokens ＋ 共用元件樣式
  proxy.ts              每次請求更新登入 cookie，未登入導到 /login（Next 16 的 middleware）
  components/
    screens/            五個頁面＋登入頁
    sheets/             記一筆（含 AI 入口 AiEntryBar）、新增帳戶、校準餘額三個底部面板
  lib/
    budget.ts           今日額度、預算進度、分組、校準差額等純函式（有測試）
    ai-draft.ts         給 Gemini 的指示、回傳格式、草稿檢查（有測試）
    ai-client.ts        前端上傳（照片先縮小）；use-recorder.ts 錄音
    data.ts             Supabase 讀寫（React Query hooks）
    demo.ts             示範模式的範例資料
    ui-store.ts         面板、提示訊息、隱藏金額、深淺色
supabase/migrations/    資料表、RLS、帳戶餘額 view
```

## 設計與實作決定

- **每月預算「從某月起生效」**（`budget_history`）：改預算只影響當月以後，過去月份保留當時的預算，報表逐月比較。
- **帳戶餘額不存欄位**，由 `account_balances` view 用「期初餘額＋交易」即時計算，不會跟流水帳對不上。
- **轉帳（TRANSFER）不算支出**：首頁、報表的支出都排除轉帳，首頁會另外標示「已排除內部轉帳」。
- **校準**：輸入銀行或信用卡 App 上的數字，有差額就補一筆「未記錄雜項（支出）」或「未記錄收入」，並記下校準時間。投資帳戶不提供校準，因為市值變動不是生活收支。
- **投資帳戶**：Phase 1 可以手動建立並轉帳進去；Phase 3 改由 Monee Invest 同步 `investment_snapshot`。
- **點交易列可以編輯或刪除**：跟記一筆共用同一個表單；刪除要再按一次確認。
- **＋ 打開記一筆**：上方是「說一句」「拍收據」，下方是手動輸入；最近常用的品項可以一鍵帶入。
- **AI 只產生草稿**：辨識結果直接填進同一個表單（上方顯示 AI 聽到／看到的內容），使用者檢查後按「記下」才寫入。伺服器會再檢查一次：分類、帳戶一定是現有的，金額取整數，日期不晚於今天。不能錄音的瀏覽器會改成「打一句」。
- **錄音直接交給 Gemini**，不用瀏覽器的語音辨識：iPhone、Android、電腦的瀏覽器都能用，一次呼叫就完成聽寫與整理。最長 30 秒。
- **分類先固定**（`lib/categories.ts`），分類管理之後再做。
- **字體**：英數 Lexend Exa 由 `next/font` 託管；中文 Noto Sans TC 有上百個分片，交給 `next/font` 下載時只要一片逾時就會讓建置失敗，所以改由瀏覽器向 Google Fonts 按需載入。

## 還沒做（依 monee_ux.md 路線圖）

- Phase 2：Google Sheets 匯出、資料備份、收據照片存檔（目前辨識完就丟掉）
- Phase 3：Monee Invest 同步投資快照
- 分類管理、帳戶編輯／封存、帳戶排序
