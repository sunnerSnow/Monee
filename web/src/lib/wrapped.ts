// 年度回顧（Wrapped）：把一年的帳整理成限時動態一張一張的內容（純函式，有測試）。
// 12 月 1 日起看今年（算到今天）；1～11 月預設看去年，也可以先偷看今年到目前為止。
import { visibleTransactions } from './budget';
import type { SavingsDeposit, SavingsGoal } from './goals';
import { dayKinds, longestStreak, MILESTONES, type Activity, type DayKind } from './streak';
import type { SplitGroup, Transaction } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const yearOf = (date: string) => Number(date.slice(0, 4));
const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
const sum = (list: { amount: number }[]) => list.reduce((s, x) => s + x.amount, 0);

/** 校準補記的帳不是真的買了什麼，不算「最常買」 */
const RECONCILE_NOTES = new Set(['未記錄雜項', '未記錄收入']);

/** 預設看哪一年：12 月看今年，其他月份看去年 */
export const defaultYear = (today: string) => (Number(today.slice(5, 7)) === 12 ? yearOf(today) : yearOf(today) - 1);

/** 網址帶的年份：今年或以前才算數（今年還沒到 12 月就是偷看），其他的用預設 */
export function parseYear(input: string | undefined, today: string) {
  const y = Number(input);
  return input && Number.isInteger(y) && y >= 2000 && y <= yearOf(today) ? y : defaultYear(today);
}

/** 今年還沒過完的算到今天，過去的年份算到 12 月 31 日 */
export const untilOf = (year: number, today: string) => (year === yearOf(today) ? today : `${year}-12-31`);

/** 12 月以前看今年是偷看版 */
export const isPreview = (year: number, today: string) => year === yearOf(today) && Number(today.slice(5, 7)) < 12;

export interface WrappedInput {
  year: number;
  today: string;
  /** 這一年的交易 */
  transactions: Transaction[];
  activity: Activity;
  groups: SplitGroup[];
  goals: SavingsGoal[];
  /** 到這一年年底為止的存入紀錄（算哪個目標在這一年存到） */
  deposits: SavingsDeposit[];
}

export interface WrappedTrip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  /** 你的部分（台幣） */
  spent: number;
}

export interface Wrapped {
  year: number;
  /** 算到哪天 */
  until: string;
  /** 今年還沒過完 */
  partial: boolean;
  /** 這一年第一筆紀錄（帳或無消費章）的日期；沒有紀錄是 null */
  firstDate: string | null;
  /** 記了幾筆：不含固定收支自動記的、分帳收起來的代墊 */
  entries: number;
  expense: number;
  income: number;
  /** 平均每天花多少：從 1 月 1 日（或第一筆）算到 until */
  dailyAverage: number;
  /** 各分類支出，大到小；share 是百分比（整數） */
  categories: { categoryId: string; amount: number; share: number }[];
  /** 1～12 月；future 是還沒到的月份 */
  months: { key: string; expense: number; future: boolean }[];
  peakMonth: string | null;
  /** 最省的月份：開始記帳後、已經過完、有支出的月份裡最少的；不到兩個月比不出來是 null */
  lowMonth: string | null;
  /** 最常買的（同樣的品項至少兩次） */
  topItem: { note: string; count: number; total: number } | null;
  /** 最大的一筆支出（固定收支不算） */
  biggest: Transaction | null;
  /** 有記帳或蓋無消費章的天數 */
  recordedDays: number;
  noSpendDays: number;
  /** 這一年裡最長連續幾天 */
  longestStreak: number;
  /** 這一年拿到的連續記帳徽章 */
  badges: number[];
  /** 固定收支自動記了幾筆 */
  recurring: number;
  trips: WrappedTrip[];
  /** 有花費的分帳群組（不含旅程） */
  splitGroups: number;
  /** 一起分帳、旅行的朋友（名字不重複） */
  friends: number;
  /** 這一年存進存錢目標的（拿出來的扣掉） */
  saved: number;
  /** 這一年存到的目標 */
  goalsAchieved: string[];
}

export function computeWrapped({ year, today, transactions, activity, groups, goals, deposits }: WrappedInput): Wrapped {
  const until = untilOf(year, today);
  const inYear = (date: string) => yearOf(date) === year && date <= until;
  const txs = transactions.filter((t) => inYear(t.date));
  const expenses = txs.filter((t) => t.type === 'EXPENSE');
  const expense = sum(expenses);

  const days = new Map<string, DayKind>([...dayKinds(activity, until)].filter(([d]) => inYear(d)));
  const firstDate = [...days.keys(), ...txs.map((t) => t.date)].sort()[0] ?? null;
  const from = firstDate && firstDate > `${year}-01-01` ? firstDate : `${year}-01-01`;
  const elapsed = dayNumber(until) - dayNumber(from) + 1;

  const byCategory = new Map<string, number>();
  for (const t of expenses) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  const categories = [...byCategory]
    .map(([categoryId, amount]) => ({ categoryId, amount, share: Math.round((amount / expense) * 100) }))
    .sort((a, b) => b.amount - a.amount);

  const untilMonth = until.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${pad(i + 1)}`;
    return { key, expense: sum(expenses.filter((t) => t.date.startsWith(key))), future: key > untilMonth };
  });
  const spentMonths = months.filter((m) => !m.future && m.expense > 0);
  const peak = spentMonths.reduce<(typeof months)[number] | null>((best, m) => (!best || m.expense > best.expense ? m : best), null);
  // 這個月還沒過完、開始記帳以前的月份不拿來比最省
  const complete = spentMonths.filter((m) => (m.key < untilMonth || until === `${year}-12-31`) && firstDate && m.key >= firstDate.slice(0, 7));
  const low = complete.length >= 2 ? complete.reduce((best, m) => (m.expense < best.expense ? m : best)) : null;

  const oneOff = expenses.filter((t) => !t.recurringId);
  const items = new Map<string, { note: string; count: number; total: number }>();
  for (const t of oneOff) {
    const note = t.note?.trim();
    if (!note || RECONCILE_NOTES.has(note)) continue;
    const hit = items.get(note) ?? { note, count: 0, total: 0 };
    hit.count += 1;
    hit.total += t.amount;
    items.set(note, hit);
  }
  const topItem = [...items.values()].filter((x) => x.count >= 2).sort((a, b) => b.count - a.count || b.total - a.total)[0] ?? null;
  const biggest = oneOff.reduce<Transaction | null>((best, t) => (!best || t.amount > best.amount ? t : best), null);

  const longest = longestStreak(days);

  // 分帳：這一年有花費的群組；旅程另外列，花了多少是你帳上的支出（你的部分）
  const active = groups.filter((g) => g.expenses.some((e) => inYear(e.date)));
  const trips = active
    .filter((g) => g.kind === 'trip')
    .map((g): WrappedTrip => {
      const ids = new Set(g.expenses.map((e) => e.id));
      return {
        id: g.id, name: g.name, startDate: g.startDate, endDate: g.endDate,
        spent: sum(expenses.filter((t) => t.splitExpenseId && ids.has(t.splitExpenseId))),
      };
    })
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  const friends = new Set(active.flatMap((g) => g.members.filter((m) => !m.isMe).map((m) => m.name)));

  // 存錢目標：第一次存到目標金額那天落在這一年
  const goalsAchieved = goals.flatMap((g) => {
    let saved = 0;
    const list = deposits.filter((d) => d.goalId === g.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    for (const d of list) {
      saved += d.amount;
      if (g.target > 0 && saved >= g.target) return inYear(d.date) ? [g.name] : [];
    }
    return [];
  });

  return {
    year,
    until,
    partial: until !== `${year}-12-31`,
    firstDate,
    entries: visibleTransactions(txs).filter((t) => !t.recurringId).length,
    expense,
    income: sum(txs.filter((t) => t.type === 'INCOME')),
    dailyAverage: firstDate ? Math.round(expense / elapsed) : 0,
    categories,
    months,
    peakMonth: peak?.key ?? null,
    lowMonth: low && low.key !== peak?.key ? low.key : null,
    topItem,
    biggest,
    recordedDays: days.size,
    noSpendDays: [...days.values()].filter((k) => k === 'nospend').length,
    longestStreak: longest,
    badges: MILESTONES.filter((m) => longest >= m),
    recurring: txs.filter((t) => t.recurringId).length,
    trips,
    splitGroups: active.filter((g) => g.kind !== 'trip').length,
    friends: friends.size,
    saved: sum(deposits.filter((d) => inYear(d.date))),
    goalsAchieved,
  };
}

/** 這一年有沒有東西可以回顧 */
export const hasWrapped = (w: Wrapped) => w.entries > 0 || w.recordedDays > 0;
