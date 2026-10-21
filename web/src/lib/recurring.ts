// 固定收支：每月、每週、每年記一次的帳（房租、訂閱、薪水…）。這裡只放日期計算和說明文字（純函式，有測試）。
// 到期的處理：「自動記下」的打開 App 時由資料庫函式 recurring_post 寫入；「先問我」的列在首頁讓使用者記下或略過。
import type { TransactionType } from './types';

export type Frequency = 'monthly' | 'weekly' | 'yearly';

export interface RecurringRule {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  sourceAccountId: string;
  targetAccountId: string | null;
  note: string | null;
  frequency: Frequency;
  /** 每月：1–31（小月遇到 29–31 號記在最後一天）；每週：0–6（週日到週六）；每年：1–31 */
  day: number;
  /** 每年才有：1–12 */
  month: number | null;
  /** true 到日子自動記下；false 先在首頁問 */
  auto: boolean;
  /** 下一次要記的日期（YYYY-MM-DD） */
  nextDate: string;
  paused: boolean;
}

export type RuleSchedule = Pick<RecurringRule, 'frequency' | 'day' | 'month'>;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (date: string) => date.split('-').map(Number) as [number, number, number];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 某年某月的那一天；超過那個月的天數就記在最後一天（31 號遇到 4 月是 30 號、2 月 29 號遇到平年是 28 號） */
const clampDay = (y: number, m: number, day: number) => iso(y, m, Math.min(day, lastDay(y, m)));

function addDays(date: string, n: number) {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 在 date 當天或之後、第一次要記的日期 */
export function onOrAfter(rule: RuleSchedule, date: string): string {
  const [y, m, d] = parts(date);
  if (rule.frequency === 'weekly') {
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return addDays(date, (rule.day - weekday + 7) % 7);
  }
  if (rule.frequency === 'monthly') {
    const thisMonth = clampDay(y, m, rule.day);
    return thisMonth >= date ? thisMonth : clampDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, rule.day);
  }
  const month = rule.month ?? 1;
  const thisYear = clampDay(y, month, rule.day);
  return thisYear >= date ? thisYear : clampDay(y + 1, month, rule.day);
}

/** date 之後（不含當天）的下一次 */
export const after = (rule: RuleSchedule, date: string) => onOrAfter(rule, addDays(date, 1));

/** 從下一次起、到 today 為止所有要記的日期（很久沒打開 App 時一次補上），最多 max 筆 */
export function dueDates(rule: Pick<RecurringRule, 'frequency' | 'day' | 'month' | 'nextDate'>, today: string, max = 24): string[] {
  const out: string[] = [];
  for (let d = rule.nextDate; d <= today && out.length < max; d = after(rule, d)) out.push(d);
  return out;
}

/** 照記帳日期設定週期：每月是那天幾號、每週是星期幾、每年是幾月幾號 */
export function scheduleFrom(frequency: Frequency, date: string): RuleSchedule {
  const [y, m, d] = parts(date);
  if (frequency === 'weekly') return { frequency, day: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), month: null };
  return { frequency, day: d, month: frequency === 'yearly' ? m : null };
}

/** 「每月 5 號」「每週一」「每年 3 月 15 日」；29–31 號註明小月記在最後一天 */
export function describe(rule: RuleSchedule) {
  if (rule.frequency === 'weekly') return `每週${WEEKDAYS[rule.day]}`;
  if (rule.frequency === 'yearly') return `每年 ${rule.month} 月 ${rule.day} 日`;
  return rule.day >= 29 ? `每月 ${rule.day} 號（沒有這天就記在月底）` : `每月 ${rule.day} 號`;
}

/** 10/5（週日） */
export function shortDue(date: string) {
  const [y, m, d] = parts(date);
  return `${m}/${d}（週${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

/** 首頁要列的：到期了要問的（先問我）、接下來 days 天內會記的 */
export function homeLists(rules: RecurringRule[], today: string, days = 7) {
  const active = rules.filter((r) => !r.paused);
  const soon = addDays(today, days);
  return {
    ask: active.filter((r) => !r.auto && r.nextDate <= today).sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
    upcoming: active.filter((r) => r.nextDate > today && r.nextDate <= soon).sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
  };
}
