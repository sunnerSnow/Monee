const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 使用者當地日期 YYYY-MM-DD */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** YYYY-MM */
export const monthKey = (iso: string) => iso.slice(0, 7);
export const monthKeyOf = (d: Date) => toISODate(d).slice(0, 7);

export const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** 往前推 n 個月的 YYYY-MM（n=0 為當月） */
export const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKeyOf(d);
};

export const monthStart = (key: string) => `${key}-01`;
export const monthLabel = (key: string) => `${Number(key.slice(5, 7))} 月`;
export const monthTitle = (key: string) => `${key.slice(0, 4)} 年 ${Number(key.slice(5, 7))} 月`;

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** 今天 · 10/6 週二 */
export function dayLabel(iso: string, today: Date) {
  const d = parse(iso);
  const md = `${d.getMonth() + 1}/${d.getDate()} 週${WEEKDAYS[d.getDay()]}`;
  const t = toISODate(today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (iso === t) return `今天 · ${md}`;
  if (iso === toISODate(yesterday)) return `昨天 · ${md}`;
  return md;
}

/** 10月6日 週二 */
export const longDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日 週${WEEKDAYS[d.getDay()]}`;

export function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早安';
  if (h < 18) return '午安';
  return '晚安';
}
