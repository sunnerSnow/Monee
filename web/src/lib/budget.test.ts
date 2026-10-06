import { describe, expect, it } from 'vitest';
import {
  accountSummary, budgetPace, dailyBudget, expenseByCategory, frequentEntries, groupByDay, monthTotals,
  monthlyExpenses, reconcileDiff,
} from './budget';
import type { Account, Transaction } from './types';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  date: '2026-10-06',
  time: '12:00',
  type: 'EXPENSE',
  amount: 100,
  categoryId: 'food',
  sourceAccountId: 'cash',
  targetAccountId: null,
  note: null,
  createdAt: '2026-10-06T04:00:00Z',
  ...p,
});

const account = (p: Partial<Account>): Account => ({
  id: 'a', name: 'A', type: 'BANK', currency: 'TWD', currentBalance: 0, openingBalance: 0,
  icon: null, investmentSnapshot: null, lastReconciledAt: null, ...p,
});

describe('dailyBudget', () => {
  // 原型的「日常」情境：10/6，月預算 24,000，今天以前花 4,234，今天花 370
  const base = { budget: 24000, day: 6, daysInMonth: 31 };

  it('節奏剛好：還能花 390', () => {
    const r = dailyBudget({ ...base, monthExpense: 4604, todaySpent: 370 });
    expect(r).toEqual({ allowance: 760, left: 390, status: 'ok', nextDaily: 775 });
  });

  it('剩不到兩成算快用完了', () => {
    const r = dailyBudget({ ...base, monthExpense: 4904, todaySpent: 670 });
    expect(r.left).toBe(90);
    expect(r.status).toBe('tight');
  });

  it('超支時明天起每天的額度會變少', () => {
    const r = dailyBudget({ ...base, monthExpense: 6184, todaySpent: 1950 });
    expect(r.left).toBe(-1190);
    expect(r.status).toBe('over');
    expect(r.nextDaily).toBe(712);
  });

  it('本月預算在今天之前就用完：額度 0、算超支', () => {
    const r = dailyBudget({ ...base, monthExpense: 25000, todaySpent: 0 });
    expect(r.allowance).toBe(0);
    expect(r.status).toBe('over');
    expect(r.nextDaily).toBe(0);
  });

  it('月底最後一天沒有「明天」', () => {
    const r = dailyBudget({ budget: 24000, day: 31, daysInMonth: 31, monthExpense: 23000, todaySpent: 200 });
    expect(r.allowance).toBe(1200);
    expect(r.nextDaily).toBe(0);
  });
});

describe('budgetPace', () => {
  it('用掉 19% 而時間過了 19%：剛好', () => {
    expect(budgetPace({ budget: 24000, monthExpense: 4604, day: 6, daysInMonth: 31 })).toMatchObject({ usedPct: 19, diff: 0, onTrack: true });
  });
  it('比時間進度快 7%', () => {
    expect(budgetPace({ budget: 24000, monthExpense: 6184, day: 6, daysInMonth: 31 })).toMatchObject({ usedPct: 26, diff: 7, onTrack: false });
  });
});

describe('monthTotals', () => {
  it('轉帳不算進支出或收入', () => {
    const txs = [
      tx({ amount: 260 }),
      tx({ type: 'INCOME', amount: 48000, categoryId: 'salary' }),
      tx({ type: 'TRANSFER', amount: 10000, categoryId: 'transfer', targetAccountId: 'invest' }),
      tx({ date: '2026-09-30', amount: 999 }),
    ];
    expect(monthTotals(txs, '2026-10')).toEqual({ expense: 260, income: 48000, transfer: 10000 });
  });
});

describe('expenseByCategory', () => {
  it('依金額由大到小，只算當月支出', () => {
    const txs = [
      tx({ categoryId: 'food', amount: 100 }),
      tx({ categoryId: 'transit', amount: 300 }),
      tx({ categoryId: 'food', amount: 150 }),
      tx({ categoryId: 'salary', type: 'INCOME', amount: 5000 }),
      tx({ categoryId: 'fun', amount: 999, date: '2026-09-01' }),
    ];
    expect(expenseByCategory(txs, '2026-10')).toEqual([
      { categoryId: 'transit', amount: 300 },
      { categoryId: 'food', amount: 250 },
    ]);
  });
});

describe('monthlyExpenses', () => {
  it('跨年也能往前推', () => {
    const txs = [tx({ date: '2026-01-05', amount: 100 }), tx({ date: '2025-12-31', amount: 50 })];
    expect(monthlyExpenses(txs, '2026-01', 3)).toEqual([
      { key: '2025-11', value: 0 },
      { key: '2025-12', value: 50 },
      { key: '2026-01', value: 100 },
    ]);
  });
});

describe('groupByDay', () => {
  it('新的日期在前，同一天依時間排序，並加總當日支出', () => {
    const txs = [
      tx({ date: '2026-10-05', time: '09:00', amount: 50 }),
      tx({ date: '2026-10-06', time: '08:00', amount: 75 }),
      tx({ date: '2026-10-06', time: '12:30', amount: 260 }),
      tx({ date: '2026-10-06', time: '13:00', type: 'INCOME', amount: 1000 }),
    ];
    const groups = groupByDay(txs);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-06', '2026-10-05']);
    expect(groups[0].items.map((t) => t.time)).toEqual(['13:00', '12:30', '08:00']);
    expect(groups[0].spent).toBe(335);
  });
});

describe('accountSummary', () => {
  it('淨資產 = 現金銀行 + 投資 + 信用卡（負數）', () => {
    const s = accountSummary([
      account({ type: 'CASH', currentBalance: 3200 }),
      account({ type: 'BANK', currentBalance: 242400 }),
      account({ type: 'CREDIT_CARD', currentBalance: -12360 }),
      account({ type: 'INVESTMENT_MIRROR', currentBalance: 153000 }),
    ]);
    expect(s.liquidSum).toBe(245600);
    expect(s.assets).toBe(398600);
    expect(s.net).toBe(386240);
  });
});

describe('reconcileDiff', () => {
  it('銀行實際比紀錄少 150', () => {
    expect(reconcileDiff({ type: 'BANK', currentBalance: 186400 }, 186250)).toBe(-150);
  });
  it('信用卡輸入待繳金額：實際多欠 150 也是 −150', () => {
    expect(reconcileDiff({ type: 'CREDIT_CARD', currentBalance: -8960 }, 9110)).toBe(-150);
  });
  it('一致時差額為 0', () => {
    expect(reconcileDiff({ type: 'CASH', currentBalance: 3200 }, 3200)).toBe(0);
  });
});

describe('frequentEntries', () => {
  it('次數多的在前，沒有品項的不算', () => {
    const txs = [
      tx({ note: '捷運', amount: 35, categoryId: 'transit' }),
      tx({ note: '早餐', amount: 75 }),
      tx({ note: '捷運', amount: 35, categoryId: 'transit' }),
      tx({ note: null, amount: 999 }),
    ];
    expect(frequentEntries(txs).map((t) => t.note)).toEqual(['捷運', '早餐']);
  });
});
