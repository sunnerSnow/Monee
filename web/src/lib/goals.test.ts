import { describe, expect, it } from 'vitest';
import { daysLeft, deadlineText, depositError, homeGoal, progress, sortGoals, type SavingsGoal } from './goals';

const goal = (p: Partial<SavingsGoal>): SavingsGoal => ({
  id: 'g', name: '日本旅行', target: 60000, deadline: null, icon: 'plane', pinned: false, archived: false, createdAt: '2026-10-01T00:00:00Z', saved: 0, ...p,
});

describe('progress', () => {
  it('存了多少、還差多少、比例', () => {
    expect(progress({ target: 60000, saved: 15000 })).toEqual({ saved: 15000, remaining: 45000, ratio: 0.25, achieved: false });
  });

  it('存超過也算達成，比例最多 1、還差 0', () => {
    expect(progress({ target: 8990, saved: 9000 })).toEqual({ saved: 9000, remaining: 0, ratio: 1, achieved: true });
  });

  it('拿出來拿到負的就當 0', () => {
    expect(progress({ target: 100, saved: -50 })).toMatchObject({ saved: 0, ratio: 0, achieved: false });
  });
});

describe('日期', () => {
  it('還有幾天、今天到期、過了幾天、沒有日期', () => {
    expect(daysLeft('2026-12-05', '2026-10-22')).toBe(44);
    expect(deadlineText('2026-12-05', '2026-10-22')).toBe('還有 44 天');
    expect(deadlineText('2026-10-22', '2026-10-22')).toBe('今天到期');
    expect(deadlineText('2026-10-19', '2026-10-22')).toBe('過了 3 天');
    expect(deadlineText(null, '2026-10-22')).toBeNull();
  });

  it('跨年也算得對', () => {
    expect(daysLeft('2027-01-01', '2026-12-31')).toBe(1);
  });
});

describe('sortGoals', () => {
  it('還在存的在前（有日期的照日期、沒日期的在後），存到了的最後，收起來的不列', () => {
    const list = sortGoals([
      goal({ id: 'done', saved: 60000 }),
      goal({ id: 'nodate-new', createdAt: '2026-10-10T00:00:00Z' }),
      goal({ id: 'late', deadline: '2027-03-01' }),
      goal({ id: 'archived', archived: true, deadline: '2026-11-01' }),
      goal({ id: 'soon', deadline: '2026-12-01' }),
      goal({ id: 'nodate-old', createdAt: '2026-09-01T00:00:00Z' }),
    ]);
    expect(list.map((g) => g.id)).toEqual(['soon', 'late', 'nodate-old', 'nodate-new', 'done']);
  });
});

describe('homeGoal', () => {
  it('釘選的優先', () => {
    expect(homeGoal([goal({ id: 'a', deadline: '2026-11-01' }), goal({ id: 'b', pinned: true })])?.id).toBe('b');
  });

  it('沒釘選：還在存、最近到期的', () => {
    expect(homeGoal([goal({ id: 'a', deadline: '2027-01-01' }), goal({ id: 'b', deadline: '2026-11-01' })])?.id).toBe('b');
  });

  it('收起來的釘選不算；沒有目標是 null', () => {
    expect(homeGoal([goal({ id: 'a', pinned: true, archived: true }), goal({ id: 'b' })])?.id).toBe('b');
    expect(homeGoal([])).toBeNull();
  });
});

describe('depositError', () => {
  it('金額要大於 0；拿出來不能超過已經存的', () => {
    expect(depositError(0, false, 0)).toBe('請輸入金額');
    expect(depositError(500, false, 0)).toBeNull();
    expect(depositError(500, true, 300)).toBe('最多只能拿出 300');
    expect(depositError(300, true, 300)).toBeNull();
  });
});
