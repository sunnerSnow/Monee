import { describe, expect, it } from 'vitest';
import type { SavingsDeposit, SavingsGoal } from './goals';
import type { Activity } from './streak';
import type { SplitGroup, Transaction } from './types';
import { computeWrapped, defaultYear, hasWrapped, isPreview, parseYear, untilOf, type WrappedInput } from './wrapped';

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, date: '2025-03-10', time: '12:00', type: 'EXPENSE', amount: 100, categoryId: 'food', sourceAccountId: 'cash',
  targetAccountId: null, note: null, createdAt: `${p.date ?? '2025-03-10'}T04:00:00Z`, ...p,
});

const noActivity: Activity = { logged: [], spent: [], noSpend: [] };

const input = (p: Partial<WrappedInput>): WrappedInput => ({
  year: 2025, today: '2026-02-01', transactions: [], activity: noActivity, groups: [], goals: [], deposits: [], ...p,
});

const group = (p: Partial<SplitGroup>): SplitGroup => ({
  id: 'g', name: '群組', kind: 'daily', createdAt: '2025-01-01T00:00:00Z', shareToken: null, startDate: null, endDate: null, currency: 'TWD',
  budget: null, excludeFromBudget: false, allowFriendAdd: false, archivedAt: null, claims: [], proposals: [], expenses: [], settlements: [], rounds: [],
  members: [{ id: 'me', name: '我', isMe: true }], ...p,
});

const expense = (id: string, date: string) => ({
  id, roundId: null, date, time: null, title: 'x', categoryId: 'food', amount: 100, payerId: 'me', accountId: 'cash', mode: 'equal' as const,
  weights: {}, amounts: {}, currency: 'TWD', originalAmount: null, fxRate: null, createdAt: `${date}T00:00:00Z`,
});

describe('看哪一年', () => {
  it('12 月看今年，其他月份看去年', () => {
    expect(defaultYear('2026-12-01')).toBe(2026);
    expect(defaultYear('2026-11-30')).toBe(2025);
    expect(defaultYear('2027-01-05')).toBe(2026);
  });

  it('網址的年份要是今年或以前，不然用預設', () => {
    expect(parseYear('2026', '2026-11-03')).toBe(2026);
    expect(parseYear('2024', '2026-11-03')).toBe(2024);
    expect(parseYear('2027', '2026-11-03')).toBe(2025);
    expect(parseYear('abc', '2026-11-03')).toBe(2025);
    expect(parseYear('1999', '2026-11-03')).toBe(2025);
    expect(parseYear(undefined, '2026-12-03')).toBe(2026);
    expect(parseYear('', '2026-12-03')).toBe(2026);
  });

  it('今年算到今天、過去的年份算到年底；12 月以前看今年是偷看', () => {
    expect(untilOf(2026, '2026-11-03')).toBe('2026-11-03');
    expect(untilOf(2025, '2026-11-03')).toBe('2025-12-31');
    expect(isPreview(2026, '2026-11-03')).toBe(true);
    expect(isPreview(2026, '2026-12-01')).toBe(false);
    expect(isPreview(2025, '2026-11-03')).toBe(false);
  });
});

describe('computeWrapped：收支', () => {
  it('支出、收入只算這一年；轉帳不算；分帳收起來的代墊、固定收支不算進筆數', () => {
    const w = computeWrapped(input({
      transactions: [
        tx({ date: '2025-01-05', amount: 300 }),
        tx({ date: '2025-02-01', type: 'INCOME', amount: 50000, categoryId: 'salary' }),
        tx({ date: '2025-02-02', type: 'TRANSFER', amount: 9999, categoryId: 'transfer' }),
        tx({ date: '2025-02-03', amount: 400, splitExpenseId: 'se1' }),
        tx({ date: '2025-02-03', type: 'TRANSFER', amount: 800, categoryId: 'transfer', splitExpenseId: 'se1' }),
        tx({ date: '2025-03-01', amount: 149, recurringId: 'rc' }),
        tx({ date: '2024-12-31', amount: 7777 }),
      ],
    }));
    expect(w.expense).toBe(849);
    expect(w.income).toBe(50000);
    // 300、薪水、轉帳、分帳支出；代墊收起來，固定收支是自動記的
    expect(w.entries).toBe(4);
    expect(w.recurring).toBe(1);
    expect(w.partial).toBe(false);
    expect(hasWrapped(w)).toBe(true);
  });

  it('今年還沒過完：今天以後的帳不算，平均每天從第一筆算到今天', () => {
    const w = computeWrapped(input({
      year: 2026, today: '2026-11-03',
      transactions: [tx({ date: '2026-11-01', amount: 600 }), tx({ date: '2026-11-05', amount: 999 })],
    }));
    expect(w.until).toBe('2026-11-03');
    expect(w.partial).toBe(true);
    expect(w.expense).toBe(600);
    expect(w.firstDate).toBe('2026-11-01');
    expect(w.dailyAverage).toBe(200);
  });

  it('沒有資料', () => {
    const w = computeWrapped(input({}));
    expect(hasWrapped(w)).toBe(false);
    expect(w.firstDate).toBeNull();
    expect(w.dailyAverage).toBe(0);
    expect(w.peakMonth).toBeNull();
    expect(w.lowMonth).toBeNull();
    expect(w.topItem).toBeNull();
    expect(w.biggest).toBeNull();
    expect(w.categories).toEqual([]);
  });
});

describe('computeWrapped：分類與月份', () => {
  it('分類大到小，附百分比', () => {
    const w = computeWrapped(input({
      transactions: [
        tx({ amount: 600, categoryId: 'food' }), tx({ amount: 300, categoryId: 'transit' }), tx({ amount: 100, categoryId: 'fun' }),
      ],
    }));
    expect(w.categories).toEqual([
      { categoryId: 'food', amount: 600, share: 60 },
      { categoryId: 'transit', amount: 300, share: 30 },
      { categoryId: 'fun', amount: 100, share: 10 },
    ]);
  });

  it('花最多的月份；最省的只比開始記帳後、已經過完的月份', () => {
    const w = computeWrapped(input({
      year: 2026, today: '2026-11-03',
      transactions: [
        tx({ date: '2026-08-20', amount: 5000 }),
        tx({ date: '2026-09-10', amount: 9000 }),
        tx({ date: '2026-10-10', amount: 7000 }),
        // 這個月還沒過完，花得少也不算最省
        tx({ date: '2026-11-02', amount: 100 }),
      ],
    }));
    expect(w.months).toHaveLength(12);
    expect(w.months[10]).toEqual({ key: '2026-11', expense: 100, future: false });
    expect(w.months[11].future).toBe(true);
    expect(w.peakMonth).toBe('2026-09');
    expect(w.lowMonth).toBe('2026-08');
  });

  it('只有一個過完的月份比不出最省', () => {
    const w = computeWrapped(input({
      year: 2026, today: '2026-11-03',
      transactions: [tx({ date: '2026-10-10', amount: 7000 }), tx({ date: '2026-11-02', amount: 100 })],
    }));
    expect(w.peakMonth).toBe('2026-10');
    expect(w.lowMonth).toBeNull();
  });
});

describe('computeWrapped：最常買、最大一筆', () => {
  it('同樣的品項至少兩次；校準補記、固定收支不算', () => {
    const w = computeWrapped(input({
      transactions: [
        tx({ note: '咖啡', amount: 85 }), tx({ note: ' 咖啡 ', amount: 90 }), tx({ note: '咖啡', amount: 85 }),
        tx({ note: '便當', amount: 120 }), tx({ note: '便當', amount: 120 }),
        tx({ note: '未記錄雜項', amount: 50 }), tx({ note: '未記錄雜項', amount: 50 }), tx({ note: '未記錄雜項', amount: 50 }), tx({ note: '未記錄雜項', amount: 50 }),
        tx({ note: 'Spotify', amount: 149, recurringId: 'rc' }), tx({ note: 'Spotify', amount: 149, recurringId: 'rc' }),
        tx({ note: 'Spotify', amount: 149, recurringId: 'rc' }), tx({ note: 'Spotify', amount: 149, recurringId: 'rc' }),
        tx({ note: '房租', amount: 15000, recurringId: 'rent' }),
        tx({ note: '新手機', amount: 32900, categoryId: 'shopping' }),
      ],
    }));
    expect(w.topItem).toEqual({ note: '咖啡', count: 3, total: 260 });
    expect(w.biggest?.note).toBe('新手機');
  });

  it('每樣都只買一次就沒有最常買', () => {
    const w = computeWrapped(input({ transactions: [tx({ note: '咖啡' }), tx({ note: '便當' })] }));
    expect(w.topItem).toBeNull();
  });
});

describe('computeWrapped：記帳習慣', () => {
  it('只算這一年的記帳天數、無消費日、最長連續和徽章', () => {
    const logged = Array.from({ length: 8 }, (_, i) => `2025-03-${String(i + 1).padStart(2, '0')}`);
    const w = computeWrapped(input({
      activity: { logged: ['2024-12-30', '2024-12-31', '2025-01-01', ...logged], spent: [], noSpend: ['2025-03-09', '2025-06-01'] },
    }));
    // 1/1、3/1～3/9（3/9 無消費）、6/1 無消費
    expect(w.recordedDays).toBe(11);
    expect(w.noSpendDays).toBe(2);
    // 跨年的那段從 1/1 開始算；3/1～3/9 連續 9 天
    expect(w.longestStreak).toBe(9);
    expect(w.badges).toEqual([7]);
    expect(w.firstDate).toBe('2025-01-01');
  });
});

describe('computeWrapped：旅程、分帳、存錢', () => {
  it('旅程花了多少是你的部分；分帳群組和朋友只算這一年有花費的', () => {
    const tokyo = group({
      id: 'tokyo', name: '東京五日遊', kind: 'trip', startDate: '2025-04-01', endDate: '2025-04-05',
      members: [{ id: 'me', name: '我', isMe: true }, { id: 'm1', name: '小明', isMe: false }],
      expenses: [expense('se1', '2025-04-01'), expense('se2', '2025-04-02')],
    });
    const room = group({
      id: 'room', name: '室友', members: [{ id: 'me', name: '我', isMe: true }, { id: 'm2', name: '小明', isMe: false }, { id: 'm3', name: '阿凱', isMe: false }],
      expenses: [expense('se3', '2025-05-01')],
    });
    const old = group({ id: 'old', name: '去年的', members: [{ id: 'me', name: '我', isMe: true }, { id: 'm4', name: 'Joy', isMe: false }], expenses: [expense('se4', '2024-05-01')] });
    const w = computeWrapped(input({
      groups: [tokyo, room, old],
      transactions: [
        tx({ date: '2025-04-01', amount: 1480, splitExpenseId: 'se1', excludeFromBudget: true }),
        tx({ date: '2025-04-02', amount: 4300, splitExpenseId: 'se2', excludeFromBudget: true }),
        tx({ date: '2025-04-02', type: 'TRANSFER', amount: 4300, categoryId: 'transfer', splitExpenseId: 'se2' }),
      ],
    }));
    expect(w.trips).toEqual([{ id: 'tokyo', name: '東京五日遊', startDate: '2025-04-01', endDate: '2025-04-05', spent: 5780 }]);
    expect(w.splitGroups).toBe(1);
    expect(w.friends).toBe(2);
  });

  it('存了多少只算這一年；目標在這一年第一次存到才算', () => {
    const goal = (id: string, name: string, target: number): SavingsGoal => ({
      id, name, target, deadline: null, icon: 'piggy', pinned: false, archived: false, createdAt: '2024-01-01T00:00:00Z', saved: 0,
    });
    const dep = (goalId: string, amount: number, date: string): SavingsDeposit => ({ id: `${goalId}${date}`, goalId, amount, date, note: null, createdAt: `${date}T00:00:00Z` });
    const w = computeWrapped(input({
      goals: [goal('japan', '日本賞櫻', 30000), goal('phone', '新耳機', 5000), goal('fund', '緊急預備金', 100000)],
      deposits: [
        dep('japan', 20000, '2024-11-01'), dep('japan', 12000, '2025-02-01'),
        // 去年就存到了
        dep('phone', 5000, '2024-06-01'), dep('phone', 1000, '2025-03-01'),
        dep('fund', 20000, '2025-05-01'), dep('fund', -3000, '2025-06-01'),
      ],
    }));
    expect(w.saved).toBe(30000);
    expect(w.goalsAchieved).toEqual(['日本賞櫻']);
  });
});
