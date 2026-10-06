// 示範模式：NEXT_PUBLIC_MONEE_DEMO=1 時改用記憶體裡的範例資料，不連 Supabase。
// 用途：還沒建 Supabase 專案時先試用、截圖檢查畫面。重新整理頁面就會回到初始資料。
import { reconcileDiff } from './budget';
import { RECONCILE_EXPENSE_CATEGORY, RECONCILE_INCOME_CATEGORY } from './categories';
import { monthKeyOf, shiftMonth, toISODate, toTime } from './dates';
import type { Account, NewAccount, NewTransaction, Profile, Transaction } from './types';

export const isDemo = process.env.NEXT_PUBLIC_MONEE_DEMO === '1';

type DemoAccount = Omit<Account, 'currentBalance' | 'currency' | 'icon'>;

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

function seed() {
  const now = new Date();
  const day = (offset: number) => toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
  const accounts: DemoAccount[] = [
    { id: 'cash', name: '現金', type: 'CASH', openingBalance: 4596, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'esun', name: '玉山銀行', type: 'BANK', openingBalance: 148700, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'taishin', name: '台新銀行', type: 'BANK', openingBalance: 56000, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'cathay', name: '國泰信用卡', type: 'CREDIT_CARD', openingBalance: -6474, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'flygo', name: '台新 FlyGo', type: 'CREDIT_CARD', openingBalance: -1997, investmentSnapshot: null, lastReconciledAt: null },
    {
      id: 'invest', name: '證券戶', type: 'INVESTMENT_MIRROR', openingBalance: 143000, lastReconciledAt: null,
      investmentSnapshot: { unrealizedPnl: 11800, pnlPercentage: 8.4, lastSyncedAt: now.toISOString(), deepLinkUrl: '#' },
    },
  ];
  const t = (offset: number, time: string, note: string, categoryId: string, source: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
    id: id('t'), date: day(offset), time, type: 'EXPENSE', amount, categoryId, sourceAccountId: source, targetAccountId: null, note,
    createdAt: new Date(now.getTime() - offset * 86_400_000).toISOString(), ...extra,
  });
  const txs: Transaction[] = [
    t(0, '12:30', '午餐・拉麵', 'food', 'cathay', 260),
    t(0, '08:50', '捷運', 'transit', 'flygo', 35),
    t(0, '08:20', '早餐・蛋餅豆漿', 'food', 'cash', 75),
    t(1, '19:40', '全聯・日用品', 'daily', 'flygo', 528),
    t(1, '09:30', '轉入證券戶', 'transfer', 'esun', 10000, { type: 'TRANSFER', targetAccountId: 'invest' }),
    t(1, '09:00', '薪資', 'salary', 'esun', 48000, { type: 'INCOME' }),
    t(2, '19:30', '電影', 'fun', 'cathay', 650),
    t(2, '17:10', '捷運', 'transit', 'flygo', 60),
    t(2, '11:00', '早午餐', 'food', 'cathay', 320),
    t(3, '19:00', '晚餐・火鍋', 'food', 'cathay', 580),
    t(3, '15:20', '洗衣精・衛生紙', 'daily', 'flygo', 600),
    t(4, '18:00', '診所掛號', 'health', 'cash', 250),
    t(4, '12:20', '午餐・便當', 'food', 'cash', 150),
    t(4, '08:40', '捷運', 'transit', 'flygo', 35),
    t(5, '12:30', '午餐・便當', 'food', 'cash', 150),
    t(5, '08:40', '捷運', 'transit', 'flygo', 35),
  ];
  // 前 5 個月的支出，讓報表的每月趨勢有資料。記在玉山銀行，並把同樣金額加回期初餘額，目前餘額才合理
  const current = monthKeyOf(now);
  const esun = accounts.find((a) => a.id === 'esun')!;
  [22800, 25600, 21300, 23900, 22100].forEach((total, i) => {
    const key = shiftMonth(current, i - 5);
    const parts: [string, number][] = [['food', 0.42], ['daily', 0.18], ['transit', 0.1], ['fun', 0.15], ['shopping', 0.15]];
    parts.forEach(([categoryId, share]) => {
      const amount = Math.round(total * share);
      esun.openingBalance += amount;
      txs.push({
        id: id('h'), date: `${key}-15`, time: '12:00', type: 'EXPENSE', amount, categoryId,
        sourceAccountId: 'esun', targetAccountId: null, note: null, createdAt: `${key}-15T04:00:00Z`,
      });
    });
  });
  return { accounts, txs, profile: { monthlyBudget: 24000, pnlColor: 'red_up' } as Profile };
}

let store: ReturnType<typeof seed> | undefined;
const db = () => (store ??= seed());
const pause = () => new Promise((r) => setTimeout(r, 150));

function balanceOf(a: DemoAccount, txs: Transaction[]) {
  return txs.reduce((sum, t) => {
    if (t.sourceAccountId === a.id) return sum + (t.type === 'INCOME' ? t.amount : -t.amount);
    if (t.targetAccountId === a.id) return sum + t.amount;
    return sum;
  }, a.openingBalance);
}

const recent = (t: Transaction) => t.date >= `${shiftMonth(monthKeyOf(new Date()), -5)}-01`;

export const demo = {
  async accounts(): Promise<Account[]> {
    await pause();
    const { accounts, txs } = db();
    return accounts.map((a) => ({ ...a, currency: 'TWD', icon: null, currentBalance: balanceOf(a, txs) }));
  },
  async transactions(): Promise<Transaction[]> {
    await pause();
    return db().txs.filter(recent);
  },
  async profile(): Promise<Profile> {
    await pause();
    return { ...db().profile };
  },
  async addTransaction(t: NewTransaction) {
    await pause();
    const row: Transaction = { ...t, id: id('n'), createdAt: new Date().toISOString() };
    db().txs.push(row);
    return row.id;
  },
  async updateTransaction(id: string, t: NewTransaction) {
    await pause();
    const row = db().txs.find((x) => x.id === id);
    if (!row) throw new Error('找不到這筆交易，可能已經刪除');
    Object.assign(row, t, { targetAccountId: t.type === 'TRANSFER' ? t.targetAccountId : null });
    return id;
  },
  async deleteTransaction(id: string) {
    await pause();
    const index = db().txs.findIndex((x) => x.id === id);
    if (index < 0) throw new Error('找不到這筆交易，可能已經刪除');
    db().txs.splice(index, 1);
  },
  async addAccount(a: NewAccount) {
    await pause();
    const row: DemoAccount = { id: id('a'), name: a.name, type: a.type, openingBalance: a.openingBalance, investmentSnapshot: null, lastReconciledAt: null };
    db().accounts.push(row);
    return row.id;
  },
  async reconcile(account: Account, input: number) {
    await pause();
    const diff = reconcileDiff(account, input);
    const now = new Date();
    if (diff !== 0) {
      db().txs.push({
        id: id('n'), date: toISODate(now), time: toTime(now), type: diff < 0 ? 'EXPENSE' : 'INCOME', amount: Math.abs(diff),
        categoryId: diff < 0 ? RECONCILE_EXPENSE_CATEGORY : RECONCILE_INCOME_CATEGORY, sourceAccountId: account.id, targetAccountId: null,
        note: diff < 0 ? '未記錄雜項' : '未記錄收入', createdAt: now.toISOString(),
      });
    }
    const target = db().accounts.find((a) => a.id === account.id);
    if (target) target.lastReconciledAt = now.toISOString();
    return diff;
  },
  async updateProfile(patch: Partial<Profile>) {
    await pause();
    Object.assign(db().profile, patch);
  },
};
