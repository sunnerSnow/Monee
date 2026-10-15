import { describe, expect, it } from 'vitest';
import { buildWorkbook, sheetDate, type ExportAccount, type ExportTransaction, type Tab } from './sheets-export';

let n = 0;
const tx = (p: Partial<ExportTransaction>): ExportTransaction => ({
  id: `t${++n}`,
  date: '2026-10-06',
  time: '12:00',
  type: 'EXPENSE',
  amount: 100,
  categoryId: 'food',
  sourceAccountId: 'cash',
  targetAccountId: null,
  note: null,
  createdAt: '2026-10-06T04:00:00Z',
  groupName: null,
  ...p,
});

const account = (p: Partial<ExportAccount>): ExportAccount => ({
  id: 'cash', name: '現金', type: 'CASH', currency: 'TWD', currentBalance: 0, openingBalance: 0,
  icon: null, investmentSnapshot: null, lastReconciledAt: null, archived: false, ...p,
});

const now = new Date(2026, 9, 14, 15, 30);
const tab = (tabs: Tab[], title: string) => tabs.find((t) => t.title === title)!;
/** 表頭 → 那一列的值，測試比較好讀 */
const record = (t: Tab, row: number) => Object.fromEntries(t.rows[0].map((h, i) => [h, t.rows[row][i]]));

describe('sheetDate', () => {
  it('換成試算表的日期序號', () => {
    expect(sheetDate('1899-12-31')).toBe(1);
    expect(sheetDate('1970-01-01')).toBe(25569);
    expect(sheetDate('2026-10-14')).toBe(46309);
  });
});

describe('buildWorkbook', () => {
  it('四張工作表依序是總覽、月報、明細、帳戶', () => {
    expect(buildWorkbook({ transactions: [], accounts: [], budgets: [] }, now).map((t) => t.title)).toEqual(['總覽', '月報', '明細', '帳戶']);
  });

  it('明細新的在前，帶出分類、帳戶名稱、外幣與分帳群組', () => {
    const tabs = buildWorkbook({
      transactions: [
        tx({ date: '2026-10-01', note: '早餐', amount: 75 }),
        tx({
          date: '2026-10-05', time: '19:00', note: '拉麵', amount: 603, categoryId: 'food', sourceAccountId: 'friends',
          currency: 'JPY', originalAmount: 3000, groupName: '東京五日', excludeFromBudget: true,
        }),
        tx({ date: '2026-10-03', time: null, type: 'TRANSFER', categoryId: 'transfer', sourceAccountId: 'cash', targetAccountId: 'bank', amount: 1000 }),
      ],
      accounts: [account({}), account({ id: 'bank', name: '玉山銀行', type: 'BANK' }), account({ id: 'friends', name: '朋友往來', type: 'FRIENDS' })],
      budgets: [],
    }, now);
    const ledger = tab(tabs, '明細');
    expect(ledger.rows).toHaveLength(4);
    expect(record(ledger, 1)).toEqual({
      日期: sheetDate('2026-10-05'), 時間: '19:00', 類型: '支出', 分類: '餐飲', '品項／備註': '拉麵', 金額: 603, 帳戶: '朋友往來',
      轉入帳戶: null, 外幣: 'JPY', 外幣金額: 3000, '分帳／旅程': '東京五日', 不算進預算: '是',
    });
    expect(record(ledger, 2)).toMatchObject({ 類型: '轉帳', 分類: '轉帳', 帳戶: '現金', 轉入帳戶: '玉山銀行', 時間: null });
    expect(record(ledger, 3)).toMatchObject({ '品項／備註': '早餐', 外幣: null, 外幣金額: null, 不算進預算: null });
    expect(ledger.formats).toEqual({ 0: 'date', 5: 'money' });
  });

  it('台幣交易不列外幣欄位', () => {
    const ledger = tab(buildWorkbook({ transactions: [tx({ currency: 'TWD', originalAmount: 100 })], accounts: [], budgets: [] }, now), '明細');
    expect(record(ledger, 1)).toMatchObject({ 外幣: null, 外幣金額: null });
  });

  it('月報從第一筆交易的月份排到本月，新的在前，沒記帳的月份也列出', () => {
    const report = tab(buildWorkbook({
      transactions: [tx({ date: '2026-07-20', amount: 500 }), tx({ date: '2026-10-02', amount: 300 })],
      accounts: [], budgets: [],
    }, now), '月報');
    expect(report.rows.slice(1).map((r) => r[0])).toEqual(['2026-10', '2026-09', '2026-08', '2026-07']);
    expect(record(report, 2)).toMatchObject({ 月份: '2026-09', 收入: 0, 支出: 0, 結餘: 0, 預算: null, 預算已用: null });
  });

  it('月報：收支、結餘、當月預算與預算已用（不含不算預算的旅程），轉帳不算', () => {
    const report = tab(buildWorkbook({
      transactions: [
        tx({ date: '2026-10-01', type: 'INCOME', categoryId: 'salary', amount: 48000 }),
        tx({ date: '2026-10-02', categoryId: 'food', amount: 6000 }),
        tx({ date: '2026-10-03', categoryId: 'transit', amount: 2000 }),
        tx({ date: '2026-10-04', categoryId: 'food', amount: 4000, excludeFromBudget: true }),
        tx({ date: '2026-10-05', type: 'TRANSFER', categoryId: 'transfer', targetAccountId: 'bank', amount: 10000 }),
        tx({ date: '2026-09-10', categoryId: 'shopping', amount: 1000 }),
      ],
      accounts: [],
      budgets: [{ month: '2026-01', amount: 20000 }, { month: '2026-10', amount: 16000 }],
    }, now), '月報');
    expect(record(report, 1)).toMatchObject({
      月份: '2026-10', 收入: 48000, 支出: 12000, 結餘: 36000, 預算: 16000, 預算已用: 0.5, 餐飲: 10000, 交通: 2000, 購物: 0,
    });
    expect(record(report, 2)).toMatchObject({ 月份: '2026-09', 支出: 1000, 結餘: -1000, 預算: 20000, 預算已用: 0.05, 購物: 1000 });
  });

  it('月報：不認得的分類算進「其他」，各分類加起來等於支出', () => {
    const report = tab(buildWorkbook({
      transactions: [tx({ categoryId: 'pets', amount: 300 }), tx({ categoryId: 'other', amount: 200 }), tx({ categoryId: 'food', amount: 100 })],
      accounts: [], budgets: [],
    }, now), '月報');
    const row = record(report, 1);
    expect(row.其他).toBe(500);
    const categoryTotal = report.rows[0].slice(6).reduce((s: number, h) => s + Number(row[h as string]), 0);
    expect(categoryTotal).toBe(row.支出);
  });

  it('沒有交易時月報只有本月', () => {
    const report = tab(buildWorkbook({ transactions: [], accounts: [], budgets: [] }, now), '月報');
    expect(report.rows.slice(1).map((r) => r[0])).toEqual(['2026-10']);
  });

  it('帳戶列出全部（含封存），總覽的淨資產只算沒封存的', () => {
    const tabs = buildWorkbook({
      transactions: [tx({ date: '2026-10-01', type: 'INCOME', categoryId: 'salary', amount: 5000 }), tx({ date: '2026-09-01', amount: 300 })],
      accounts: [
        account({ currentBalance: 3000, openingBalance: 1000, lastReconciledAt: '2026-10-10T04:00:00Z' }),
        account({ id: 'card', name: '國泰信用卡', type: 'CREDIT_CARD', currentBalance: -1200 }),
        account({ id: 'old', name: '舊帳戶', type: 'BANK', currentBalance: 500, archived: true }),
      ],
      budgets: [],
    }, now);
    const accounts = tab(tabs, '帳戶');
    expect(accounts.rows.slice(1)).toEqual([
      ['現金', '現金', 3000, 1000, sheetDate('2026-10-10'), null],
      ['國泰信用卡', '信用卡', -1200, 0, null, null],
      ['舊帳戶', '銀行', 500, 0, null, '已封存'],
    ]);
    const overview = Object.fromEntries(tab(tabs, '總覽').rows.filter((r) => r[1] !== null));
    expect(overview).toMatchObject({
      更新時間: '2026-10-14 15:30', 淨資產: 1800, 資產: 3000, 負債: -1200, 本月收入: 5000, 本月支出: 0, 交易筆數: 2,
      記帳期間: '2026-09-01 ～ 2026-10-01',
    });
  });
});
