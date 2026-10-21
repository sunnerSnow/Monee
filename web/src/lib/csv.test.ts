import { describe, expect, it } from 'vitest';
import { ledgerCsv, ledgerFileName, toCsv } from './csv';
import type { ExportAccount, ExportTransaction } from './sheets-export';

const tx = (p: Partial<ExportTransaction>): ExportTransaction => ({
  id: 't1', date: '2026-10-06', time: '12:00', type: 'EXPENSE', amount: 100, categoryId: 'food',
  sourceAccountId: 'cash', targetAccountId: null, note: null, createdAt: '2026-10-06T04:00:00Z', groupName: null, ...p,
});
const account = (p: Partial<ExportAccount>): ExportAccount => ({
  id: 'cash', name: '現金', type: 'CASH', currency: 'TWD', currentBalance: 0, openingBalance: 0,
  icon: null, investmentSnapshot: null, lastReconciledAt: null, archived: false, ...p,
});
const lines = (csv: string) => csv.replace(/^﻿/, '').split('\r\n');

describe('toCsv', () => {
  it('開頭有 BOM，每列用 CRLF 結尾', () => {
    expect(toCsv([['a', 1], ['b', 2]])).toBe('﻿a,1\r\nb,2\r\n');
  });

  it('逗號、雙引號、換行用雙引號包起來，雙引號要重複', () => {
    expect(lines(toCsv([['全聯,衛生紙', '他說"好"', '第一行\n第二行']]))[0]).toBe('"全聯,衛生紙","他說""好""","第一行\n第二行"');
  });

  it('空的欄位是空字串，數字照原樣', () => {
    expect(lines(toCsv([[null, 1234.5, 0, -300]]))[0]).toBe(',1234.5,0,-300');
  });

  it('看起來像公式的文字前面加 \'，Excel 不會執行', () => {
    expect(lines(toCsv([['=HYPERLINK("x")', '+1 杯', '-折價', '@me', '午餐']]))[0]).toBe('"\'=HYPERLINK(""x"")",\'+1 杯,\'-折價,\'@me,午餐');
  });
});

describe('ledgerCsv', () => {
  it('表頭跟 Google Sheets 的明細一樣，日期是 YYYY-MM-DD，新的在前', () => {
    const csv = ledgerCsv({
      transactions: [
        tx({ id: 'old', date: '2026-10-01', note: '早餐', amount: 75 }),
        tx({ id: 'new', date: '2026-10-05', type: 'TRANSFER', categoryId: 'transfer', amount: 3000, targetAccountId: 'bank', note: '領錢' }),
        tx({ id: 'trip', date: '2026-10-03', note: '拉麵', amount: 600, currency: 'JPY', originalAmount: 2960, groupName: '東京', excludeFromBudget: true }),
      ],
      accounts: [account({}), account({ id: 'bank', name: '玉山銀行', type: 'BANK' })],
    });
    expect(lines(csv)).toEqual([
      '日期,時間,類型,分類,品項／備註,金額,帳戶,轉入帳戶,外幣,外幣金額,分帳／旅程,不算進預算',
      '2026-10-05,12:00,轉帳,轉帳,領錢,3000,現金,玉山銀行,,,,',
      '2026-10-03,12:00,支出,餐飲,拉麵,600,現金,,JPY,2960,東京,是',
      '2026-10-01,12:00,支出,餐飲,早餐,75,現金,,,,,',
      '',
    ]);
  });
});

describe('ledgerFileName', () => {
  it('檔名帶當地日期', () => {
    expect(ledgerFileName(new Date(2026, 9, 21, 23, 50))).toBe('monee-明細-2026-10-21.csv');
  });
});
