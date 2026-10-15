// 匯出到 Google Sheets 的內容：總覽、月報、明細、帳戶四張工作表。
// 這裡只把資料排成表格（純函式，有測試）；寫進 Google 的部分在 google-sheets.ts。
import { accountSummary, budgetFor, monthTotals, sortNewestFirst } from './budget';
import { CATEGORIES, getCategory } from './categories';
import { isForeign } from './currency';
import { monthKey, monthKeyOf, shiftMonth, toISODate, toTime } from './dates';
import type { Account, AccountType, BudgetEntry, Transaction, TransactionType } from './types';

/** 分帳產生的交易附上群組名稱 */
export type ExportTransaction = Transaction & { groupName: string | null };
/** 匯出包含封存的帳戶，明細裡的帳戶名稱才對得上 */
export type ExportAccount = Account & { archived: boolean };

export interface ExportData {
  transactions: ExportTransaction[];
  accounts: ExportAccount[];
  budgets: BudgetEntry[];
}

/** 文字照原樣寫入（不當成公式），數字是數字，日期是試算表的日期序號 */
export type Cell = string | number | null;
export type ColumnFormat = 'date' | 'money' | 'percent';

export interface Tab {
  title: string;
  rows: Cell[][];
  /** 第一列固定在上方（表頭）；第一列一律粗體 */
  freeze: boolean;
  /** 欄位格式（欄的索引 → 格式），從第二列起套用 */
  formats: Partial<Record<number, ColumnFormat>>;
  /** 指定欄寬（像素）；沒指定就依內容自動調整 */
  widths?: number[];
}

export const SHEET_TITLE = 'Monee 記帳';

const TYPE_LABEL: Record<TransactionType, string> = { EXPENSE: '支出', INCOME: '收入', TRANSFER: '轉帳' };
const ACCOUNT_LABEL: Record<AccountType, string> = {
  CASH: '現金', BANK: '銀行', CREDIT_CARD: '信用卡', INVESTMENT_MIRROR: '投資帳戶', FRIENDS: '朋友往來',
};
const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === 'EXPENSE');

/** YYYY-MM-DD 換成試算表的日期序號（1899-12-30 起算的天數），匯出後是真的日期，可以排序、篩選 */
export function sheetDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** 從 first 到 last（都是 YYYY-MM）的每個月，新的在前 */
function monthsBetween(first: string, last: string) {
  const list: string[] = [];
  for (let key = last; key >= first; key = shiftMonth(key, -1)) list.push(key);
  return list;
}

export function buildWorkbook({ transactions, accounts, budgets }: ExportData, now: Date): Tab[] {
  const txs = sortNewestFirst(transactions);
  const current = monthKeyOf(now);
  // 月報從第一筆交易的月份排到本月（有記到之後月份的交易，就排到那個月），中間沒記帳的月份也列出來
  const oldest = txs.length ? monthKey(txs[txs.length - 1].date) : current;
  const newest = txs.length ? monthKey(txs[0].date) : current;
  const months = monthsBetween(oldest < current ? oldest : current, newest > current ? newest : current);

  const byMonth = new Map<string, ExportTransaction[]>();
  txs.forEach((t) => {
    const list = byMonth.get(monthKey(t.date)) ?? [];
    list.push(t);
    byMonth.set(monthKey(t.date), list);
  });

  const report: Cell[][] = months.map((key) => {
    const list = byMonth.get(key) ?? [];
    const totals = monthTotals(list, key);
    const budget = budgetFor(budgets, key);
    const cats = new Map<string, number>();
    list.filter((t) => t.type === 'EXPENSE').forEach((t) => {
      // 不認得或不是支出的分類算進「其他」，各分類加起來才會等於支出
      const cat = getCategory(t.categoryId);
      const id = cat.type === 'EXPENSE' ? cat.id : 'other';
      cats.set(id, (cats.get(id) ?? 0) + t.amount);
    });
    return [
      key, totals.income, totals.expense, totals.income - totals.expense, budget,
      budget ? totals.budgetExpense / budget : null,
      ...EXPENSE_CATEGORIES.map((c) => cats.get(c.id) ?? 0),
    ];
  });

  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const ledger: Cell[][] = txs.map((t) => [
    sheetDate(t.date),
    t.time,
    TYPE_LABEL[t.type],
    getCategory(t.categoryId).name,
    t.note,
    t.amount,
    names.get(t.sourceAccountId) ?? null,
    t.targetAccountId ? names.get(t.targetAccountId) ?? null : null,
    isForeign(t.currency) ? t.currency! : null,
    isForeign(t.currency) ? t.originalAmount ?? null : null,
    t.groupName,
    t.excludeFromBudget ? '是' : null,
  ]);

  const accountRows: Cell[][] = accounts.map((a) => [
    a.name,
    ACCOUNT_LABEL[a.type],
    a.currentBalance,
    a.openingBalance,
    a.lastReconciledAt ? sheetDate(toISODate(new Date(a.lastReconciledAt))) : null,
    a.archived ? '已封存' : null,
  ]);

  // 淨資產跟 App 的資產頁一樣，只算沒封存的帳戶
  const summary = accountSummary(accounts.filter((a) => !a.archived));
  const thisMonth = monthTotals(byMonth.get(current) ?? [], current);
  const overview: Cell[][] = [
    [SHEET_TITLE, null],
    ['更新時間', `${toISODate(now)} ${toTime(now)}`],
    ['淨資產', summary.net],
    ['資產', summary.assets],
    ['負債', summary.liabilities],
    ['本月收入', thisMonth.income],
    ['本月支出', thisMonth.expense],
    ['交易筆數', txs.length],
    ['記帳期間', txs.length ? `${txs[txs.length - 1].date} ～ ${txs[0].date}` : '還沒有交易'],
    [null, null],
    ['說明', null],
    ['每次匯出都會用最新資料蓋掉「總覽」「月報」「明細」「帳戶」這四張工作表，在這四張裡改的內容會不見；要自己整理，請新增別的工作表或建立副本。', null],
    ['金額都是新台幣；外幣花費在「明細」另外列出原幣和原幣金額。', null],
    ['轉帳（繳卡費、轉進證券戶、分帳代墊、朋友還款）不算收入或支出。', null],
    ['「預算已用」不含設定「不算進每月預算」的旅程支出。', null],
  ];

  return [
    // 說明文字放在 A 欄、往右溢出到空白的欄，所以總覽用固定欄寬
    { title: '總覽', rows: overview, freeze: false, formats: { 1: 'money' }, widths: [120, 140] },
    {
      title: '月報',
      rows: [['月份', '收入', '支出', '結餘', '預算', '預算已用', ...EXPENSE_CATEGORIES.map((c) => c.name)], ...report],
      freeze: true,
      formats: { 1: 'money', 2: 'money', 3: 'money', 4: 'money', 5: 'percent', ...Object.fromEntries(EXPENSE_CATEGORIES.map((_, i) => [6 + i, 'money'])) },
    },
    {
      title: '明細',
      rows: [['日期', '時間', '類型', '分類', '品項／備註', '金額', '帳戶', '轉入帳戶', '外幣', '外幣金額', '分帳／旅程', '不算進預算'], ...ledger],
      freeze: true,
      formats: { 0: 'date', 5: 'money' },
    },
    {
      title: '帳戶',
      rows: [['帳戶', '類型', '目前餘額', '期初餘額', '上次校準', '狀態'], ...accountRows],
      freeze: true,
      formats: { 2: 'money', 3: 'money', 4: 'date' },
    },
  ];
}
