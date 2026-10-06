# Monee Web

> 可愛輕量、懂你金流的個人生活財務助理。規格見 [`../monee_ux.md`](../monee_ux.md)，設計規範見 [`../design-system/monee/`](../design-system/monee/MASTER.md)。

Phase 1（MVP）：手機網頁版的手動記帳、收支分類、內部轉帳、帳戶與校準餘額、首頁／明細／資產／報表／我的。

## 技術

- **Next.js 16**（App Router、Turbopack）＋ **React 19** ＋ **TypeScript**
- **Tailwind CSS 4**：色彩、字級、圓角都讀 `src/styles/tokens.css`
- **Supabase**：登入（Email 魔法連結）＋ Postgres；每張表都開 RLS，每個人只看得到自己的資料
- **TanStack Query** 管伺服器資料，**Zustand** 管畫面狀態（面板、隱藏金額、深淺色）
- **Vitest**：預算計算等邏輯的單元測試

## 先試用（不用 Supabase）

```bash
npm install
npm run dev:demo
```

打開 <http://localhost:3000>，會用記憶體裡的範例資料（頂端有「示範模式」標示），可以記帳、校準、切換深淺色。重新整理就會還原。

## 正式使用：接上 Supabase

1. 到 [supabase.com](https://supabase.com) 建一個專案（免費方案即可）。
2. 後台 → **SQL Editor**，把 [`supabase/migrations/20261006000000_init.sql`](supabase/migrations/20261006000000_init.sql) 整份貼上執行。
3. 後台 → **Authentication → URL Configuration**：
   - Site URL：`http://localhost:3000`（上線後改成正式網址）
   - Redirect URLs 加上 `http://localhost:3000/**`
4. 後台 → **Project Settings → API**，把網址和 Publishable key（舊專案叫 anon key）填進 `.env.local`：

   ```bash
   cp .env.local.example .env.local
   ```

5. `npm run dev`，用 Email 登入（第一次登入會自動建立帳號）。

> Supabase 免費專案一週沒有任何存取會自動暫停，到後台按一下就能恢復。內建寄信服務每小時只能寄幾封登入信，正式上線前建議在 Authentication → SMTP 換成自己的寄信服務。

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
    login/              Email 魔法連結登入
    auth/callback/      登入信的連結回到這裡換成登入狀態
    layout.tsx          字體、深淺色（行內腳本避免閃爍）
    globals.css         Tailwind ＋ tokens ＋ 共用元件樣式
  proxy.ts              每次請求更新登入 cookie，未登入導到 /login（Next 16 的 middleware）
  components/
    screens/            五個頁面＋登入頁
    sheets/             記一筆、新增帳戶、校準餘額三個底部面板
  lib/
    budget.ts           今日額度、預算進度、分組、校準差額等純函式（有測試）
    data.ts             Supabase 讀寫（React Query hooks）
    demo.ts             示範模式的範例資料
    ui-store.ts         面板、提示訊息、隱藏金額、深淺色
supabase/migrations/    資料表、RLS、帳戶餘額 view
```

## 設計與實作決定

- **帳戶餘額不存欄位**，由 `account_balances` view 用「期初餘額＋交易」即時計算，不會跟流水帳對不上。
- **轉帳（TRANSFER）不算支出**：首頁、報表的支出都排除轉帳，首頁會另外標示「已排除內部轉帳」。
- **校準**：輸入銀行或信用卡 App 上的數字，有差額就補一筆「未記錄雜項（支出）」或「未記錄收入」，並記下校準時間。投資帳戶不提供校準，因為市值變動不是生活收支。
- **投資帳戶**：Phase 1 可以手動建立並轉帳進去；Phase 3 改由 Monee Invest 同步 `investment_snapshot`。
- **＋ 直接打開手動記帳**：語音、拍收據是 Phase 2，面板上先標「即將推出」。最近常用的品項可以一鍵帶入。
- **分類先固定**（`lib/categories.ts`），分類管理之後再做。
- **字體**：英數 Lexend Exa 由 `next/font` 託管；中文 Noto Sans TC 有上百個分片，交給 `next/font` 下載時只要一片逾時就會讓建置失敗，所以改由瀏覽器向 Google Fonts 按需載入。

## 還沒做（依 monee_ux.md 路線圖）

- Phase 2：語音記帳＋AI 草稿卡、發票 OCR、Google Sheets 匯出、資料備份
- Phase 3：Monee Invest 同步投資快照
- 交易編輯／刪除、分類管理、帳戶編輯／封存、帳戶排序
