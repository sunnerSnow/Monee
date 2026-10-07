// 對應 monee_ux.md「04. 資料結構模型」與 supabase/migrations 的資料表

/** FRIENDS：分帳用的「朋友往來」帳戶，由系統建立，餘額是朋友欠你的淨額 */
export type AccountType = 'CASH' | 'BANK' | 'CREDIT_CARD' | 'INVESTMENT_MIRROR' | 'FRIENDS';
export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type PnlColor = 'red_up' | 'green_up';

export interface InvestmentSnapshot {
  unrealizedPnl: number;
  pnlPercentage: number;
  lastSyncedAt: string;
  deepLinkUrl: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  /** 目前餘額；信用卡為待繳金額的負數 */
  currentBalance: number;
  openingBalance: number;
  icon: string | null;
  investmentSnapshot: InvestmentSnapshot | null;
  lastReconciledAt: string | null;
}

export interface Transaction {
  id: string;
  /** YYYY-MM-DD（使用者當地日期） */
  date: string;
  /** HH:mm */
  time: string | null;
  type: TransactionType;
  amount: number;
  categoryId: string;
  sourceAccountId: string;
  targetAccountId: string | null;
  /** 品項或備註 */
  note: string | null;
  createdAt: string;
  /** 分帳產生的交易：只能從群組裡修改 */
  splitExpenseId?: string | null;
  splitSettlementId?: string | null;
}

export interface Profile {
  pnlColor: PnlColor;
  /** 分帳分享頁上朋友看到的你的名字與收款方式 */
  displayName: string | null;
  payBank: string | null;
  payLine: string | null;
}

/** 預算紀錄：從 month（YYYY-MM）起生效；amount 為 null 代表從那個月起不設預算 */
export interface BudgetEntry {
  month: string;
  amount: number | null;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'splitExpenseId' | 'splitSettlementId'>;

// ---------- 分帳（monee_ux.md「06. 分帳」） ----------
export type SplitMode = 'equal' | 'exact' | 'shares';
export type SplitKind = 'daily' | 'event';

/** 朋友只有名字；isMe 是你自己 */
export interface SplitMember {
  id: string;
  name: string;
  isMe: boolean;
}

export interface SplitExpense {
  id: string;
  /** null 是還沒結清；結清後指向那一次的結清紀錄 */
  roundId: string | null;
  date: string;
  time: string | null;
  title: string;
  categoryId: string;
  amount: number;
  payerId: string;
  /** 你先付時從哪個帳戶付 */
  accountId: string | null;
  mode: SplitMode;
  /** 怎麼分的輸入：平分都是 1、份數、或指定金額（key 是成員 id） */
  weights: Record<string, number>;
  /** 每個人分到的金額（key 是成員 id） */
  amounts: Record<string, number>;
  createdAt: string;
}

export interface SplitSettlement {
  id: string;
  roundId: string | null;
  fromId: string;
  toId: string;
  amount: number;
  accountId: string | null;
  date: string;
  createdAt: string;
}

export interface SplitRound {
  id: string;
  closedAt: string;
}

/** 朋友在分享頁按「我已付款」：等你確認 */
export interface SplitClaim {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  status: 'waiting' | 'confirmed' | 'rejected';
  createdAt: string;
}

export interface SplitGroup {
  id: string;
  name: string;
  kind: SplitKind;
  createdAt: string;
  /** 分享連結的 token；null 代表沒有分享 */
  shareToken: string | null;
  claims: SplitClaim[];
  members: SplitMember[];
  /** 包含已結清的；用 lib/split.ts 的 openExpenses 取還沒結清的 */
  expenses: SplitExpense[];
  settlements: SplitSettlement[];
  /** 新的在前面 */
  rounds: SplitRound[];
}

export interface NewSplitExpense {
  id?: string;
  groupId: string;
  date: string;
  time: string | null;
  title: string;
  categoryId: string;
  amount: number;
  payerId: string;
  accountId: string | null;
  mode: SplitMode;
  weights: Record<string, number>;
  amounts: Record<string, number>;
}

/** 朋友點分享連結看到的資料（split_public_view 回傳） */
export interface PublicSplit {
  group: { id: string; name: string; kind: SplitKind };
  owner: { name: string; bank: string | null; line: string | null };
  members: SplitMember[];
  expenses: Pick<SplitExpense, 'id' | 'roundId' | 'date' | 'title' | 'categoryId' | 'amount' | 'payerId' | 'mode' | 'amounts'>[];
  settlements: Pick<SplitSettlement, 'id' | 'roundId' | 'fromId' | 'toId' | 'amount' | 'date'>[];
  rounds: SplitRound[];
  claims: SplitClaim[];
}

export interface NewSplitSettlement {
  groupId: string;
  fromId: string;
  toId: string;
  amount: number;
  accountId: string | null;
  date: string;
  time: string | null;
}

export interface NewAccount {
  name: string;
  type: AccountType;
  openingBalance: number;
}
