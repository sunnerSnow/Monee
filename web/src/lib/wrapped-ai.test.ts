import { describe, expect, it } from 'vitest';
import type { Transaction } from './types';
import { computeWrapped } from './wrapped';
import { fallbackSummary, parseWrappedStats, sanitizeWrappedSummary, wrappedStats, type WrappedStats } from './wrapped-ai';

const stats = (p: Partial<WrappedStats> = {}): WrappedStats => ({
  year: 2025, partial: false, until: '2025-12-31', firstDate: '2025-01-03', entries: 820, expense: 285000, income: 576000, dailyAverage: 783,
  topCategories: [{ name: '餐飲', share: 38 }, { name: '交通', share: 12 }], peakMonth: 4, lowMonth: 2, topItem: { name: '咖啡', count: 96 },
  biggest: { name: '新手機', amount: 32900 }, recordedDays: 300, longestStreak: 45, noSpendDays: 12, trips: ['東京五日遊'], splitGroups: 3,
  friends: 6, saved: 60000, goalsAchieved: ['日本賞櫻'], recurring: 36, ...p,
});

describe('wrappedStats', () => {
  it('分類換成名字、月份換成數字、只送前三個分類', () => {
    const tx = (p: Partial<Transaction>): Transaction => ({
      id: Math.random().toString(), date: '2025-04-01', time: null, type: 'EXPENSE', amount: 100, categoryId: 'food', sourceAccountId: 'cash',
      targetAccountId: null, note: null, createdAt: '2025-04-01T00:00:00Z', ...p,
    });
    const w = computeWrapped({
      year: 2025, today: '2026-02-01', activity: { logged: [], spent: [], noSpend: [] }, groups: [], goals: [], deposits: [],
      transactions: [
        tx({ amount: 500 }), tx({ amount: 300, categoryId: 'transit' }), tx({ amount: 100, categoryId: 'fun', date: '2025-06-01' }),
        tx({ amount: 50, categoryId: 'daily', date: '2025-06-02', note: '  ' }),
      ],
    });
    const s = wrappedStats(w, (id) => ({ food: '餐飲', transit: '交通', fun: '娛樂', daily: '日用' })[id] ?? id);
    expect(s.topCategories).toEqual([{ name: '餐飲', share: 53 }, { name: '交通', share: 32 }, { name: '娛樂', share: 11 }]);
    expect(s.peakMonth).toBe(4);
    expect(s.lowMonth).toBe(6);
    // 最大一筆沒有品項就用分類名
    expect(s.biggest).toEqual({ name: '餐飲', amount: 500 });
  });
});

describe('parseWrappedStats', () => {
  it('正常的統計原樣通過', () => {
    expect(parseWrappedStats(JSON.parse(JSON.stringify(stats())))).toEqual(stats());
  });

  it('年份不對、不是物件就丟出錯誤', () => {
    expect(() => parseWrappedStats(null)).toThrow();
    expect(() => parseWrappedStats([])).toThrow();
    expect(() => parseWrappedStats({ year: '20x5' })).toThrow();
    expect(() => parseWrappedStats({ year: 1990 })).toThrow();
  });

  it('數字夾在範圍內、名稱截短、清單最多 5 個、少的欄位補預設', () => {
    const s = parseWrappedStats({
      year: 2025, expense: -50, recordedDays: 9999, peakMonth: 15, entries: 'abc',
      topCategories: [{ name: 'x'.repeat(50), share: 300 }, { name: '' }, 'oops'],
      trips: ['a', 'b', 'c', 'd', 'e', 'f', 42], topItem: { name: '   ' }, until: 'tomorrow',
    });
    expect(s.expense).toBe(0);
    expect(s.recordedDays).toBe(366);
    expect(s.peakMonth).toBe(12);
    expect(s.lowMonth).toBeNull();
    expect(s.entries).toBe(0);
    expect(s.topCategories).toEqual([{ name: 'x'.repeat(20), share: 100 }]);
    expect(s.trips).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(s.topItem).toBeNull();
    expect(s.until).toBe('2025-12-31');
    expect(s.partial).toBe(false);
    expect(s.goalsAchieved).toEqual([]);
  });
});

describe('sanitizeWrappedSummary', () => {
  it('截短、去掉多的空白', () => {
    expect(sanitizeWrappedSummary({ title: ' 咖啡續命王 ', summary: '一年\n喝了 96 杯咖啡。', tip: 't'.repeat(80) }))
      .toEqual({ title: '咖啡續命王', summary: '一年 喝了 96 杯咖啡。', tip: 't'.repeat(60) });
  });

  it('沒有稱號或小結當作失敗', () => {
    expect(sanitizeWrappedSummary({ title: '', summary: 'x', tip: '' })).toBeNull();
    expect(sanitizeWrappedSummary({ title: 'x', summary: 3 })).toBeNull();
    expect(sanitizeWrappedSummary('x')).toBeNull();
  });
});

describe('fallbackSummary', () => {
  it('用最常買的當稱號，提到筆數、分類和連續記帳', () => {
    const s = fallbackSummary(stats());
    expect(s.title).toBe('咖啡愛好者');
    expect(s.summary).toBe('2025 年你記了 820 筆帳，錢最常花在「餐飲」（38%）。最長連續記帳 45 天，超有毅力！');
    expect(s.tip).toBe('4 月花最多，明年那個月可以先多留一點');
  });

  it('今年還沒過完說「今年到目前為止」；沒有最常買用分類', () => {
    const s = fallbackSummary(stats({ partial: true, topItem: null, longestStreak: 3, noSpendDays: 0 }));
    expect(s.title).toBe('餐飲達人');
    expect(s.summary).toBe('今年到目前為止你記了 820 筆帳，錢最常花在「餐飲」（38%）。還存了 $60,000 進存錢罐，很棒！');
    expect(s.tip).toBe('每個月留幾天無消費日，荷包會很感謝你');
  });

  it('連續 100 天以上是記帳鐵人；什麼都沒有也有一段', () => {
    expect(fallbackSummary(stats({ longestStreak: 120 })).title).toBe('記帳鐵人');
    const empty = fallbackSummary(stats({ topItem: null, topCategories: [], longestStreak: 0, saved: 0, trips: [], entries: 1, noSpendDays: 5, peakMonth: null }));
    expect(empty).toEqual({ title: '認真記帳人', summary: '2025 年你記了 1 筆帳。', tip: '明年也一起把每一筆記清楚' });
  });
});
