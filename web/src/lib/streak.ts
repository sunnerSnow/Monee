// 連續記帳與無消費日：每一天算什麼、連續幾天、最長幾天、徽章（純函式，有測試）。
// 資料來自資料庫函式 activity_days（只有日期）：自己記過帳的日子、自己記過支出的日子、按了「今天沒花錢」的日子。
// 固定收支產生的交易不算自己記的，也不算花錢：那天照樣可以按「今天沒花錢」。

export interface Activity {
  /** 有自己記的帳（不含固定收支產生的）的日子 */
  logged: string[];
  /** 有自己記的支出的日子 */
  spent: string[];
  /** 按了「今天沒花錢」的日子 */
  noSpend: string[];
}

/** 連續幾天拿徽章 */
export const MILESTONES = [7, 30, 100, 365] as const;

/** logged：有記帳；nospend：無消費日（按了沒花錢、那天也沒有支出） */
export type DayKind = 'logged' | 'nospend';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (n: number) => String(n).padStart(2, '0');
const parts = (date: string) => date.split('-').map(Number) as [number, number, number];

export function addDays(date: string, n: number) {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const weekday = (date: string) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/**
 * 到今天為止，每一天算什麼（沒有的就是沒記）。
 * 按過沒花錢、後來那天又記了支出，就不算無消費日；那天的支出刪掉，章又會出現。
 */
export function dayKinds(a: Activity, today: string): Map<string, DayKind> {
  const spent = new Set(a.spent);
  const out = new Map<string, DayKind>();
  for (const d of a.logged) if (d <= today) out.set(d, 'logged');
  for (const d of a.noSpend) if (d <= today && !spent.has(d)) out.set(d, 'nospend');
  return out;
}

/** 連續幾天：今天還沒記不算斷，從昨天往回數；todayDone 是今天記了沒 */
export function currentStreak(days: Map<string, DayKind>, today: string) {
  const todayDone = days.has(today);
  let n = 0;
  for (let d = todayDone ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) n++;
  return { days: n, todayDone };
}

/** 最長連續幾天 */
export function longestStreak(days: Map<string, DayKind>) {
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of [...days.keys()].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface Streak {
  days: Map<string, DayKind>;
  spent: Set<string>;
  current: number;
  todayDone: boolean;
  longest: number;
  /** 今天剛好達成的天數（7、30、100、365），沒有就是 null */
  milestone: number | null;
}

export function streakOf(a: Activity, today: string): Streak {
  const days = dayKinds(a, today);
  const { days: current, todayDone } = currentStreak(days, today);
  const milestone = todayDone && (MILESTONES as readonly number[]).includes(current) ? current : null;
  return { days, spent: new Set(a.spent), current, todayDone, longest: longestStreak(days), milestone };
}

/** 可以蓋（或拿掉）無消費章：今天以前、那天沒有自己記的支出 */
export const canMarkNoSpend = (s: Streak, date: string, today: string) => date <= today && !s.spent.has(date);

/** 包含 date 的那一週（週日到週六） */
export function weekOf(date: string) {
  const start = addDays(date, -weekday(date));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 月曆：1 號前面空幾格（週日開始）、這個月的每一天 */
export function monthDays(month: string) {
  const [y, m] = month.split('-').map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    blanks: weekday(`${month}-01`),
    days: Array.from({ length: total }, (_, i) => `${month}-${pad(i + 1)}`),
  };
}

/** 10月18日 星期六 */
export const dayName = (date: string) => {
  const [, m, d] = parts(date);
  return `${m}月${d}日 星期${WEEKDAYS[weekday(date)]}`;
};

export const weekdayLabel = (date: string) => WEEKDAYS[weekday(date)];
