import { describe, expect, it } from 'vitest';
import { addDays, canMarkNoSpend, currentStreak, dayKinds, longestStreak, monthDays, streakOf, weekOf, type Activity } from './streak';

const TODAY = '2026-10-21';
const act = (p: Partial<Activity>): Activity => ({ logged: [], spent: [], noSpend: [], ...p });
/** 從 from 起連續 n 天 */
const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('dayKinds', () => {
  it('有記帳、無消費日；按了沒花錢但那天有支出就不算無消費', () => {
    const days = dayKinds(act({ logged: ['2026-10-18', '2026-10-19'], spent: ['2026-10-19'], noSpend: ['2026-10-19', '2026-10-20'] }), TODAY);
    expect(days.get('2026-10-18')).toBe('logged');
    expect(days.get('2026-10-19')).toBe('logged');
    expect(days.get('2026-10-20')).toBe('nospend');
    expect(days.has(TODAY)).toBe(false);
  });

  it('只記了收入的日子按了沒花錢，算無消費日', () => {
    expect(dayKinds(act({ logged: ['2026-10-20'], noSpend: ['2026-10-20'] }), TODAY).get('2026-10-20')).toBe('nospend');
  });

  it('今天以後的不算（記帳日期選到未來）', () => {
    expect(dayKinds(act({ logged: ['2026-10-22'] }), TODAY).size).toBe(0);
  });
});

describe('currentStreak', () => {
  it('今天記了：從今天往回數', () => {
    const days = dayKinds(act({ logged: run('2026-10-15', 7) }), TODAY);
    expect(currentStreak(days, TODAY)).toEqual({ days: 7, todayDone: true });
  });

  it('今天還沒記不算斷，從昨天往回數', () => {
    const days = dayKinds(act({ logged: run('2026-10-15', 6) }), TODAY);
    expect(currentStreak(days, TODAY)).toEqual({ days: 6, todayDone: false });
  });

  it('昨天沒記就斷了', () => {
    const days = dayKinds(act({ logged: run('2026-10-10', 10) }), TODAY);
    expect(currentStreak(days, TODAY)).toEqual({ days: 0, todayDone: false });
  });

  it('無消費日接得起來', () => {
    const days = dayKinds(act({ logged: ['2026-10-19', TODAY], noSpend: ['2026-10-20'] }), TODAY);
    expect(currentStreak(days, TODAY).days).toBe(3);
  });

  it('跨月、跨年都接得起來', () => {
    expect(currentStreak(dayKinds(act({ logged: run('2026-12-28', 7) }), '2027-01-03'), '2027-01-03').days).toBe(7);
  });
});

describe('longestStreak', () => {
  it('取最長的一段', () => {
    const days = dayKinds(act({ logged: [...run('2026-09-01', 15), ...run('2026-10-15', 7)] }), TODAY);
    expect(longestStreak(days)).toBe(15);
  });

  it('沒有資料是 0', () => {
    expect(longestStreak(new Map())).toBe(0);
  });
});

describe('streakOf', () => {
  it('今天剛好連續 7 天是里程碑', () => {
    expect(streakOf(act({ logged: run('2026-10-15', 7) }), TODAY).milestone).toBe(7);
  });

  it('今天還沒記、或不是剛好的天數就沒有', () => {
    expect(streakOf(act({ logged: run('2026-10-14', 7) }), TODAY).milestone).toBeNull();
    expect(streakOf(act({ logged: run('2026-10-14', 8) }), TODAY).milestone).toBeNull();
  });

  it('有支出的日子不能蓋無消費章，未來的也不行', () => {
    const s = streakOf(act({ logged: ['2026-10-20'], spent: ['2026-10-20'] }), TODAY);
    expect(canMarkNoSpend(s, '2026-10-20', TODAY)).toBe(false);
    expect(canMarkNoSpend(s, '2026-10-19', TODAY)).toBe(true);
    expect(canMarkNoSpend(s, TODAY, TODAY)).toBe(true);
    expect(canMarkNoSpend(s, '2026-10-22', TODAY)).toBe(false);
  });
});

describe('月曆', () => {
  it('weekOf：週日到週六', () => {
    // 2026-10-21 是星期三
    expect(weekOf(TODAY)).toEqual(run('2026-10-18', 7));
    expect(weekOf('2026-10-18')[0]).toBe('2026-10-18');
  });

  it('monthDays：1 號前空幾格、有幾天', () => {
    // 2026-10-01 是星期四
    const oct = monthDays('2026-10');
    expect(oct.blanks).toBe(4);
    expect(oct.days).toHaveLength(31);
    expect(monthDays('2028-02').days.at(-1)).toBe('2028-02-29');
  });
});
