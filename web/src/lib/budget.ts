import type { Account, BudgetEntry, Transaction } from './types';
import { monthKey, shiftMonth } from './dates';

const sum = (list: Pick<Transaction, 'amount'>[]) => list.reduce((s, t) => s + t.amount, 0);

/** 某個月（YYYY-MM）的預算：生效月份 ≤ 該月的最後一筆紀錄；沒有紀錄或設成不設預算時回傳 null */
export function budgetFor(entries: BudgetEntry[], month: string): number | null {
  let found: BudgetEntry | undefined;
  for (const e of entries) {
    if (e.month <= month && (!found || e.month > found.month)) found = e;
  }
  return found?.amount ?? null;
}

export type BudgetStatus = 'ok' | 'tight' | 'over';

export interface DailyBudget {
  /** 今天可以花的額度 */
  allowance: number;
  /** 今天還能花多少（負數代表超出） */
  left: number;
  status: BudgetStatus;
  /** 照目前花費，明天起每天可花 */
  nextDaily: number;
}

/**
 * 今日額度 =（月預算 − 今天以前已花）÷ 本月剩餘天數（含今天）
 * 剩餘不到 20% 為「快用完了」，小於 0 為「超支」。
 */
export function dailyBudget(input: {
  budget: number;
  monthExpense: number;
  todaySpent: number;
  day: number;
  daysInMonth: number;
}): DailyBudget {
  const { budget, monthExpense, todaySpent, day, daysInMonth } = input;
  const remainingBeforeToday = budget - (monthExpense - todaySpent);
  const allowance = Math.max(0, Math.floor(remainingBeforeToday / (daysInMonth - day + 1)));
  const left = allowance - todaySpent;
  const status: BudgetStatus = left < 0 || allowance === 0 ? 'over' : left / allowance < 0.2 ? 'tight' : 'ok';
  const daysAfterToday = daysInMonth - day;
  const nextDaily = daysAfterToday > 0 ? Math.max(0, Math.floor((budget - monthExpense) / daysAfterToday)) : 0;
  return { allowance, left, status, nextDaily };
}

export interface Pace {
  usedPct: number;
  timePct: number;
  /** 預算使用率比時間進度快幾個百分點 */
  diff: number;
  onTrack: boolean;
}

export function budgetPace(input: { budget: number; monthExpense: number; day: number; daysInMonth: number }): Pace {
  const usedPct = Math.round((input.monthExpense / input.budget) * 100);
  const timePct = (input.day / input.daysInMonth) * 100;
  const diff = usedPct - Math.round(timePct);
  return { usedPct, timePct, diff, onTrack: diff <= 2 };
}

export interface MonthTotals {
  expense: number;
  income: number;
  transfer: number;
}

/** 轉帳另外計，不算進支出或收入 */
export function monthTotals(txs: Transaction[], key: string): MonthTotals {
  const inMonth = txs.filter((t) => monthKey(t.date) === key);
  return {
    expense: sum(inMonth.filter((t) => t.type === 'EXPENSE')),
    income: sum(inMonth.filter((t) => t.type === 'INCOME')),
    transfer: sum(inMonth.filter((t) => t.type === 'TRANSFER')),
  };
}

export function expenseByCategory(txs: Transaction[], key: string) {
  const totals = new Map<string, number>();
  txs
    .filter((t) => t.type === 'EXPENSE' && monthKey(t.date) === key)
    .forEach((t) => totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount));
  return [...totals].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
}

/** 以 endKey 為最後一個月，往前 count 個月的支出 */
export function monthlyExpenses(txs: Transaction[], endKey: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(endKey, i - count + 1);
    return { key, value: monthTotals(txs, key).expense };
  });
}

export const sortNewestFirst = (txs: Transaction[]) =>
  [...txs].sort((a, b) =>
    `${b.date} ${b.time ?? ''} ${b.createdAt}`.localeCompare(`${a.date} ${a.time ?? ''} ${a.createdAt}`));

export function groupByDay(txs: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  sortNewestFirst(txs).forEach((t) => {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  });
  return [...groups].map(([date, items]) => ({
    date,
    items,
    spent: sum(items.filter((t) => t.type === 'EXPENSE')),
  }));
}

export function accountSummary(accounts: Account[]) {
  const liquid = accounts.filter((a) => a.type === 'CASH' || a.type === 'BANK');
  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');
  const investments = accounts.filter((a) => a.type === 'INVESTMENT_MIRROR');
  const total = (list: Account[]) => list.reduce((s, a) => s + a.currentBalance, 0);
  const liquidSum = total(liquid);
  const cardSum = total(cards);
  const investSum = total(investments);
  const assets = liquidSum + investSum;
  return { liquid, cards, investments, liquidSum, cardSum, investSum, assets, net: assets + cardSum };
}

/** 校準：實際餘額與紀錄的差額。信用卡輸入的是待繳金額（正數）。 */
export function reconcileDiff(account: Pick<Account, 'type' | 'currentBalance'>, input: number) {
  const actual = account.type === 'CREDIT_CARD' ? -input : input;
  return actual - account.currentBalance;
}

/** 最近常用：依「品項＋金額＋分類＋帳戶」出現次數排序 */
export function frequentEntries(txs: Transaction[], limit = 3) {
  const counts = new Map<string, { t: Transaction; n: number }>();
  txs
    .filter((t) => t.type === 'EXPENSE' && t.note)
    .forEach((t) => {
      const k = `${t.note}|${t.amount}|${t.categoryId}|${t.sourceAccountId}`;
      const hit = counts.get(k);
      if (hit) hit.n += 1;
      else counts.set(k, { t, n: 1 });
    });
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((x) => x.t);
}
