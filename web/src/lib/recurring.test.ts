import { describe as group, expect, it } from 'vitest';
import { after, describe, dueDates, homeLists, onOrAfter, scheduleFrom, shortDue, type RecurringRule } from './recurring';

const monthly = (day: number) => ({ frequency: 'monthly' as const, day, month: null });
const rule = (p: Partial<RecurringRule>): RecurringRule => ({
  id: 'r', type: 'EXPENSE', amount: 100, categoryId: 'other', sourceAccountId: 'cash', targetAccountId: null, note: null,
  frequency: 'monthly', day: 5, month: null, auto: false, nextDate: '2026-10-05', paused: false, ...p,
});

group('onOrAfter', () => {
  it('每月：還沒過就是這個月，過了就是下個月；當天也算', () => {
    expect(onOrAfter(monthly(5), '2026-10-03')).toBe('2026-10-05');
    expect(onOrAfter(monthly(5), '2026-10-05')).toBe('2026-10-05');
    expect(onOrAfter(monthly(5), '2026-10-06')).toBe('2026-11-05');
    expect(onOrAfter(monthly(5), '2026-12-20')).toBe('2027-01-05');
  });

  it('每月 31 號：小月記在最後一天，2 月是 28 號（閏年 29 號）', () => {
    expect(onOrAfter(monthly(31), '2026-04-01')).toBe('2026-04-30');
    expect(onOrAfter(monthly(31), '2026-02-01')).toBe('2026-02-28');
    expect(onOrAfter(monthly(31), '2028-02-01')).toBe('2028-02-29');
    expect(onOrAfter(monthly(30), '2026-02-28')).toBe('2026-02-28');
  });

  it('每週：當天或之後第一個星期幾', () => {
    const monday = { frequency: 'weekly' as const, day: 1, month: null };
    expect(onOrAfter(monday, '2026-10-21')).toBe('2026-10-26'); // 週三 → 下週一
    expect(onOrAfter(monday, '2026-10-26')).toBe('2026-10-26');
  });

  it('每年：今年還沒過就是今年；2 月 29 日遇到平年記在 28 日', () => {
    expect(onOrAfter({ frequency: 'yearly', day: 15, month: 3 }, '2026-01-01')).toBe('2026-03-15');
    expect(onOrAfter({ frequency: 'yearly', day: 15, month: 3 }, '2026-03-16')).toBe('2027-03-15');
    expect(onOrAfter({ frequency: 'yearly', day: 29, month: 2 }, '2026-01-01')).toBe('2026-02-28');
    expect(onOrAfter({ frequency: 'yearly', day: 29, month: 2 }, '2027-03-01')).toBe('2028-02-29');
  });
});

group('after', () => {
  it('下一次不含當天：每月 31 號從 1 月 31 日接到 2 月 28 日，再接到 3 月 31 日', () => {
    expect(after(monthly(31), '2026-01-31')).toBe('2026-02-28');
    expect(after(monthly(31), '2026-02-28')).toBe('2026-03-31');
    expect(after({ frequency: 'weekly', day: 1, month: null }, '2026-10-26')).toBe('2026-11-02');
  });
});

group('dueDates', () => {
  it('從下一次到今天全部列出（很久沒打開 App 時補上）', () => {
    expect(dueDates({ ...monthly(5), nextDate: '2026-08-05' }, '2026-10-21')).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
  });

  it('還沒到日子是空的；最多列 max 筆', () => {
    expect(dueDates({ ...monthly(5), nextDate: '2026-11-05' }, '2026-10-21')).toEqual([]);
    expect(dueDates({ frequency: 'weekly', day: 1, month: null, nextDate: '2025-01-06' }, '2026-10-21', 3)).toHaveLength(3);
  });
});

group('scheduleFrom', () => {
  it('照記帳日期設定週期', () => {
    expect(scheduleFrom('monthly', '2026-10-21')).toEqual({ frequency: 'monthly', day: 21, month: null });
    expect(scheduleFrom('weekly', '2026-10-21')).toEqual({ frequency: 'weekly', day: 3, month: null });
    expect(scheduleFrom('yearly', '2026-10-21')).toEqual({ frequency: 'yearly', day: 21, month: 10 });
  });
});

group('describe / shortDue', () => {
  it('寫成白話', () => {
    expect(describe(monthly(5))).toBe('每月 5 號');
    expect(describe(monthly(31))).toBe('每月 31 號（沒有這天就記在月底）');
    expect(describe({ frequency: 'weekly', day: 1, month: null })).toBe('每週一');
    expect(describe({ frequency: 'yearly', day: 15, month: 3 })).toBe('每年 3 月 15 日');
    expect(shortDue('2026-10-21')).toBe('10/21（週三）');
  });
});

group('homeLists', () => {
  it('首頁：到期要問的（先問我）、7 天內會記的；暫停的不列，自動記的不問', () => {
    const rules = [
      rule({ id: 'ask', auto: false, nextDate: '2026-10-20' }),
      rule({ id: 'auto-due', auto: true, nextDate: '2026-10-21' }),
      rule({ id: 'soon', auto: true, nextDate: '2026-10-25' }),
      rule({ id: 'later', nextDate: '2026-11-05' }),
      rule({ id: 'paused', paused: true, nextDate: '2026-10-20' }),
    ];
    const { ask, upcoming } = homeLists(rules, '2026-10-21');
    expect(ask.map((r) => r.id)).toEqual(['ask']);
    expect(upcoming.map((r) => r.id)).toEqual(['soon']);
  });
});
