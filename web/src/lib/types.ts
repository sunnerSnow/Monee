// 對應 monee_ux.md「04. 資料結構模型」與 supabase/migrations 的資料表

export type AccountType = 'CASH' | 'BANK' | 'CREDIT_CARD' | 'INVESTMENT_MIRROR';
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
}

export interface Profile {
  monthlyBudget: number | null;
  pnlColor: PnlColor;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

export interface NewAccount {
  name: string;
  type: AccountType;
  openingBalance: number;
}
