# Monee — Product & UX Specification

> **核心定位**：可愛輕量、懂你金流的個人生活財務助理（AI Personal Finance Web App）  
> **核心標語**：*Know your money. Grow your money.*  
> **架構原則**：**雙產品解耦（Decoupled Architecture）**。日常金流記帳歸 `Monee`，股票持股與曲線管理歸 `Monee Invest`。

---

## 01. 產品邊界與生態系劃分 (Product Boundary)

```
                 【 個人整體財務視圖 】
                           │
      ┌────────────────────┴────────────────────┐
      ↓                                         ↓
💰 Monee (生活日常財務)                   📈 Monee Invest (股票績效管理)
├─ 核心問題：「錢花去哪？存下多少？」       ├─ 核心問題：「我投資到底賺多少？加碼成效？」
├─ 高頻使用（每日 2~4 次）                  ├─ 低頻使用（每月 1~2 次 / 交易日）
├─ 輸入：AI 語音、紙本收據 OCR、手動記帳      ├─ 輸入：券商月結對帳單 OCR、交易明細
├─ 核心指標：收入、支出、結餘、預算達成率    ├─ 核心指標：加權成本、加碼點走勢曲線、真實報酬率
└─ 視覺風格：可愛、溫暖、無壓力生活感        └─ 視覺風格：數據可視化、清晰專業（保留微量品牌調性）
```

### 兩端唯一的數據交會點 (Sync Protocol)
1. **投資資產快照同步 (Asset Snapshot)**：
   * `Monee` 資產頁僅保留一個 `外部投資卡片`，唯讀顯示由 `Monee Invest` 同步過來的「總市值」與「未實現損益」。點擊深層連結（Deep-link）直接跳轉至 Invest 查看明細。
2. **金流調撥閉環 (Capital Transfer)**：
   * **日常投入投資**：Monee 記為「帳戶內部轉移（銀行 $\rightarrow$ 投資戶）」，**嚴格禁止計入日常消費支出**，避免扭曲生活儲蓄率。
   * **配息匯回生活**：Invest 記錄配息出金時，可勾選同步至 Monee 記為「投資收益流入」。

---

## 02. Monee 核心頁面結構 (Mobile Web - 390px 優先)

底部五大 Navigation：
* 🏠 **首頁 (Home)**：今日花費、本月結餘、資產簡報、最近交易、高頻 `[+]` 記帳入口
* 💸 **記帳明細 (Transactions)**：時序流水帳、快速篩選、關鍵字搜尋
* 💰 **資產 (Assets)**：現金、各家銀行餘額、信用卡待繳、外部投資市值快照
* 📊 **報表 (Reports)**：本月收支圓餅圖、趨勢柱狀圖、年度 Wrapped
* 👤 **我的 (Settings)**：分類管理、每月預算設定、Google Sheets 一鍵匯出、資料備份

---

## 03. 核心 UX 流程規範

### A. 極簡化高頻「＋」按鈕流程
為降低認知負擔，對帳單匯入已移至投資端，「＋」按鈕只專注於**當下高頻記帳**：

```
           [ 點擊底部中心 ＋ 按鈕 ]
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
   🎤 說一句       📷 拍收據/發票   ✏️ 手動計算機
  (AI 自然語言)    (OCR 辨識)      (手動輸入)
       │              │              │
       └──────────────┬──────────────┘
                      ↓
           【 AI 結構化草稿預覽卡片 】
           • 品項：午餐拉麵
           • 金額：$260
           • 分類：🍽️ 餐飲
           • 帳戶：💳 國泰信用卡
                      ↓
               [ 確認寫入 / 修改 ]
```

### B. 資產校準機制 (Reconciliation UX)
* 針對信用卡待繳與銀行餘額，提供月結快速校對：
  * 使用者可在資產頁點選「校準餘額」，輸入目前銀行 App 顯示金額。
  * 系統自動計算差額，提示：「與系統紀錄差額 $150，是否以『未記錄雜項』補齊？」確保淨資產隨時精確。

---

## 04. 資料結構模型 (Data Schema / TypeScript Interface)

為確保模組化開發並預留與 `Monee Invest` 串接之介面，核心 Schema 定義如下：

```typescript
// 1. 帳戶類型定義
export type AccountType = 
  | 'CASH'               // 現金皮夾
  | 'BANK'               // 銀行活存
  | 'CREDIT_CARD'        // 信用卡（負債）
  | 'INVESTMENT_MIRROR'; // 外部投資帳戶鏡像 (由 Monee Invest 同步)

export interface Account {
  id: string;
  name: string;            // 例如：玉山銀行、台新 FlyGo
  type: AccountType;
  currency: string;        // 預設 TWD
  currentBalance: number;  // 目前餘額（信用卡為待繳負數）
  icon: string;            // 圖示代碼
  // 專門為外部投資帳戶保留的唯讀同步欄位
  investmentSnapshot?: {
    unrealizedPnl: number; // 未實現損益金額
    pnlPercentage: number; // 報酬率 %
    lastSyncedAt: string;  // 最近同步時間 ISO String
    deepLinkUrl: string;   // 點擊前往 Monee Invest 的網址
  };
}

// 2. 交易類型定義（解決投資轉帳混淆問題）
export type TransactionType = 
  | 'EXPENSE'   // 日常消費支出（扣減現金，算入月支出）
  | 'INCOME'    // 日常收入（薪資、獎金等）
  | 'TRANSFER'; // 內部轉移（如：銀行轉投資、提款、繳卡費，不算日常支出！）

export interface Transaction {
  id: string;
  date: string;              // YYYY-MM-DD
  time?: string;             // HH:mm
  type: TransactionType;
  amount: number;
  categoryId: string;        // 分類 ID（如：餐飲、交通）
  sourceAccountId: string;   // 扣款帳戶 ID
  targetAccountId?: string;  // 若為 TRANSFER 則必填轉入帳戶（例如轉入投資帳戶）
  note?: string;             // 備註
  receiptImageUrl?: string;  // 收據圖檔
  createdAt: string;
}

// 3. AI 快速記帳草稿物件
export interface AiDraftTransaction {
  rawInput: string;          // 語音文字或 OCR 原始字串
  confidence: number;        // AI 辨識信心指數 (0 ~ 1)
  suggestedType: TransactionType;
  suggestedAmount: number;
  suggestedCategoryId: string;
  suggestedAccountId: string;
  suggestedDate: string;
}
```

---

## 05. 開發階段路線圖 (Implementation Roadmap)

* **Phase 1 — Monee Core (MVP 本期目標)**：
  * Mobile Web (390px 響應式佈局)。
  * 核心記帳引擎（手動記帳鍵盤、收支流水分類）。
  * 基礎資產管理（現金、銀行、信用卡餘額手動更新）。
  * 內部帳戶轉帳（確保投資調撥不污染生活消費報表）。
* **Phase 2 — AI & Automation**：
  * Web Audio 語音記帳 + LLM 實體萃取（產生 Draft 卡片）。
  * 發票收據圖片 OCR 解析。
  * 月報與 Google Sheets 單向匯出備份。
* **Phase 3 — Monee Invest (獨立專案開發)**：
  * 股票與 ETF 持倉管理。
  * 券商對帳單 OCR 與持股差異同步演算法。
  * 「投入成本 vs 市值成長」走勢曲線與加碼點標記。
  * 產生 API Token 供 Monee 讀取資產快照。

---

## 06. 分帳 (Split)

> 互動原型：[`prototype/split.html`](prototype/split.html)（左邊是你的 App，右邊是朋友點分享連結看到的網頁）。

### A. 核心規則
* **群組**：一群常一起花錢的人（室友、午餐團、一次出遊）。朋友**只有名字、不用帳號**；同一個朋友在不同群組是不同的人。
* **一個群組記很多筆**：一整天出去的每一筆都可以是不同人先付，最後一起結算，不用每筆各自還。
* **怎麼分**：平分、指定金額（各點各的）、份數（有人點兩杯就給 2 份）。金額取整數，除不盡的零頭給小數最大的人。
* **結算**：算出每個人的淨額，建議最少的轉帳方式（最多 人數−1 筆）。可以只還一部分。朋友之間的還款任何人都能標記。
* **結清自動收起**：全部還清時，那段期間的花費和還款收進「已結清的紀錄」，群組列表只留還沒結清的；結清的群組摺到最下面。結算記錯可以重新打開。

### B. 跟個人帳的整合
每個人有一個系統建立的「朋友往來」帳戶（`FRIENDS`），餘額＝朋友欠你的淨額，算進淨資產。

| 情況 | 個人帳怎麼記 |
|---|---|
| 你先付 $1,840，你的部分 $520 | 支出 $520（從付款帳戶）＋轉帳 $1,320（付款帳戶 → 朋友往來） |
| 朋友先付，你的部分 $90 | 支出 $90（從朋友往來，餘額變負＝你欠朋友） |
| 朋友還你 $550 | 轉帳 $550（朋友往來 → 存入帳戶） |
| 你還朋友 $50 | 轉帳 $50（付款帳戶 → 朋友往來） |
| 朋友之間還款、你沒參與的花費 | 不影響你的帳 |

* 報表與預算只算「你的部分」；代墊與還款都是轉帳，不算收支。
* 分帳產生的交易只能從群組裡修改，明細裡點它會帶你到群組。

### C. 入口
* 平常：資產 →「朋友往來」→ 分帳頁；有還沒結清的群組時，首頁也會出現。
* 建立群組：分帳頁「建立群組」，或記一筆打開「分帳」→「＋ 新群組」當場輸入朋友名字。
* 編輯：群組右上角「⋯」改名、加人、改成員名字；有花費紀錄的成員只能改名、不能移除；有花費的群組不能刪除。

### D. 分階段
1. 分帳記帳＋朋友往來＋結算（只有你自己記、自己看）
2. 分享連結：朋友不用註冊就能看帳、按「我已付款」，你確認後才記帳
3. 旅程：有日期、國家與外幣的群組（匯率、外文收據翻譯）
4. 朋友從連結新增花費，跟你有關的要你確認才寫入
