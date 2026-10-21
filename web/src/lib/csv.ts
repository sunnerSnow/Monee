// 下載明細 CSV：Excel、Numbers、Google 試算表都能直接打開（純函式，有測試）。
// 欄位跟 Google Sheets 匯出的「明細」一樣（sheets-export.ts 的 ledgerRows）。
import { toISODate } from './dates';
import { LEDGER_HEADER, ledgerRows, type Cell, type ExportData } from './sheets-export';

/** 開頭是 = + - @ 的文字，Excel 會當成公式執行；前面加 ' 讓它照原樣顯示（朋友從分享連結記的品項也會在這裡） */
const FORMULA = /^[=+\-@\t\r]/;

function field(v: Cell): string {
  if (v === null) return '';
  if (typeof v === 'number') return String(v);
  const s = FORMULA.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 開頭加 BOM，Excel 才認得是 UTF-8，中文不會變亂碼；換行用 CRLF */
export const toCsv = (rows: Cell[][]) => `﻿${rows.map((r) => r.map(field).join(',')).join('\r\n')}\r\n`;

/** 全部交易，新的在前；日期寫成 YYYY-MM-DD，Excel 會自動認成日期 */
export const ledgerCsv = (data: Pick<ExportData, 'transactions' | 'accounts'>) => toCsv([LEDGER_HEADER, ...ledgerRows(data, (iso) => iso)]);

export const ledgerFileName = (now: Date) => `monee-明細-${toISODate(now)}.csv`;
