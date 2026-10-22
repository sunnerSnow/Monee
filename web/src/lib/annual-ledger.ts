// 年度帳本（Google Sheets）：每年一份「Monee_2026_年度帳本」，00_年度總覽＋01_一月…12_十二月＋99_分類設定。
// 這裡只排內容、組 Sheets API 的請求（純函式，有測試）；呼叫 Google 的部分在 server/google-ledger.ts。
// 使用者寫的字一律寫成文字（stringValue），不會被當成公式；公式只出現在年度總覽，都是固定的內容。
import { formatForeign, isForeign } from './currency';
import { sheetDate } from './sheets-export';

export const OVERVIEW = '00_年度總覽';
export const CATEGORY_SHEET = '99_分類設定';
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
/** 1 → 01_一月 */
export const monthSheet = (m: number) => `${String(m).padStart(2, '0')}_${MONTH_NAMES[m - 1]}`;
export const MONTH_SHEETS = MONTH_NAMES.map((_, i) => monthSheet(i + 1));
export const ALL_SHEETS = [OVERVIEW, ...MONTH_SHEETS, CATEGORY_SHEET];
export const workbookName = (year: number) => `Monee_${year}_年度帳本`;

/** 工作表 id 自己指定：之後用 id 就找得到，被刪掉也能用同一個 id 補回來 */
export const SHEET_IDS: Record<string, number> = Object.fromEntries([
  [OVERVIEW, 100], ...MONTH_SHEETS.map((t, i) => [t, 101 + i]), [CATEGORY_SHEET, 199],
]);

export const MONTH_HEADER = ['記帳 ID', '日期', '類型', '分類', '項目', '金額', '付款方式', '備註', '收據', '最後更新時間'];
const MONTH_WIDTHS = [90, 100, 60, 90, 200, 90, 110, 200, 90, 140];
/** 年度總覽的分類分析最多幾個支出分類 */
export const MAX_CATEGORIES = 40;

/** 一筆要寫進月份工作表的帳（只有收入、支出；轉帳不寫） */
export interface LedgerTx {
  id: string;
  date: string;
  time: string | null;
  type: 'EXPENSE' | 'INCOME';
  amount: number;
  categoryName: string;
  accountName: string | null;
  note: string | null;
  groupName: string | null;
  groupKind: 'trip' | 'split' | null;
  currency: string | null;
  originalAmount: number | null;
  receiptLink: string | null;
  createdAt: string;
}

/** 文字、數字、帶連結的文字、公式（只有年度總覽用）、空白 */
export type Cell = string | number | { text: string; link: string } | { formula: string } | null;

const byTime = (a: LedgerTx, b: LedgerTx) =>
  a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.createdAt.localeCompare(b.createdAt);

/** 備註：分帳／旅程的名字、外幣金額 */
function remarkOf(t: LedgerTx) {
  return [
    t.groupName ? `${t.groupKind === 'trip' ? '旅程' : '分帳'}：${t.groupName}` : null,
    isForeign(t.currency) && t.originalAmount != null ? `外幣 ${formatForeign(t.originalAmount, t.currency!)}` : null,
  ].filter(Boolean).join('・') || null;
}

/** 月份工作表的列（照日期、時間排）；金額一律正數，收入支出看「類型」 */
export function monthRows(txs: LedgerTx[], syncedAt: string): Cell[][] {
  return [...txs].sort(byTime).map((t) => [
    t.id,
    sheetDate(t.date),
    t.type === 'INCOME' ? '收入' : '支出',
    t.categoryName,
    t.note || t.categoryName,
    Math.abs(t.amount),
    t.accountName,
    remarkOf(t),
    t.receiptLink ? { text: '查看收據', link: t.receiptLink } : null,
    syncedAt,
  ]);
}

export function cellData(c: Cell) {
  if (c == null) return {};
  if (typeof c === 'number') return { userEnteredValue: { numberValue: c } };
  if (typeof c === 'string') return { userEnteredValue: { stringValue: c } };
  if ('formula' in c) return { userEnteredValue: { formulaValue: c.formula } };
  return { userEnteredValue: { stringValue: c.text }, userEnteredFormat: { textFormat: { link: { uri: c.link } } } };
}

const rowsData = (rows: Cell[][]) => rows.map((r) => ({ values: r.map(cellData) }));
const grid = (sheetId: number, r0: number, r1?: number, c0 = 0, c1?: number) => ({
  sheetId, startRowIndex: r0, ...(r1 != null ? { endRowIndex: r1 } : {}), startColumnIndex: c0, ...(c1 != null ? { endColumnIndex: c1 } : {}),
});
/** 寫值時連同連結一起換掉（沒有收據的格子，舊的連結也會清掉） */
const VALUE_FIELDS = 'userEnteredValue,userEnteredFormat.textFormat.link';
const NUMBER_FORMATS = {
  date: { type: 'DATE', pattern: 'yyyy-mm-dd' },
  money: { type: 'NUMBER', pattern: '#,##0' },
  percent: { type: 'PERCENT', pattern: '0.0%' },
} as const;
const numberFormat = (range: object, format: keyof typeof NUMBER_FORMATS) => ({
  repeatCell: { range, cell: { userEnteredFormat: { numberFormat: NUMBER_FORMATS[format] } }, fields: 'userEnteredFormat.numberFormat' },
});
const bold = (range: object, size?: number) => ({
  repeatCell: { range, cell: { userEnteredFormat: { textFormat: { bold: true, ...(size ? { fontSize: size } : {}) } } }, fields: 'userEnteredFormat.textFormat' },
});
const widths = (sheetId: number, list: number[]) => list.map((pixelSize, i) => ({
  updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize }, fields: 'pixelSize' },
}));
const write = (sheetId: number, row: number, rows: Cell[][], fields = VALUE_FIELDS) =>
  ({ updateCells: { start: { sheetId, rowIndex: row, columnIndex: 0 }, rows: rowsData(rows), fields } });
/** 由 Monee 同步的工作表：使用者要改時跳出提醒（不擋） */
const warnOnly = (sheetId: number, description: string) => ({ addProtectedRange: { protectedRange: { range: { sheetId }, description, warningOnly: true } } });

/**
 * 重寫一個月：清掉第 2 列以後的 A–J，再寫新的；列數不夠就先加。
 * 使用者自己加在 K 欄以後的東西不會被清，但列的順序會變
 */
export function monthWriteRequests(sheetId: number, rows: Cell[][], rowCount: number) {
  const need = rows.length + 1;
  return [
    ...(need > rowCount ? [{ appendDimension: { sheetId, dimension: 'ROWS', length: need - rowCount + 100 } }] : []),
    { updateCells: { range: grid(sheetId, 1, undefined, 0, MONTH_HEADER.length), fields: VALUE_FIELDS } },
    ...(rows.length ? [write(sheetId, 1, rows)] : []),
  ];
}

/** 分類設定：A 欄支出分類、B 欄收入分類（照 App 裡的順序，隱藏的也列） */
export function categoryWriteRequests(expense: string[], income: string[]) {
  const id = SHEET_IDS[CATEGORY_SHEET];
  const rows: Cell[][] = Array.from({ length: Math.max(expense.length, income.length) }, (_, i) => [expense[i] ?? null, income[i] ?? null]);
  return [
    { updateCells: { range: grid(id, 1, undefined, 0, 2), fields: 'userEnteredValue' } },
    ...(rows.length ? [write(id, 1, rows, 'userEnteredValue')] : []),
  ];
}

// ---------- 年度總覽 ----------
// A4:B9 年度 KPI；A11:E23 每月統計；A25:C65 支出分類；E25:F65 分類排行（公式自動排序）；H 欄起四張圖
const KPI_ROW = 3;
const MONTH_HEAD_ROW = 10;
const CAT_HEAD_ROW = 24;
const q = (title: string) => `'${title}'`;
const sumifs = (s: string, type: string, extra = '') => `SUMIFS(${q(s)}!$F:$F,${q(s)}!$C:$C,"${type}"${extra})`;

export function overviewCells(year: number): Cell[][] {
  const rows: Cell[][] = Array.from({ length: CAT_HEAD_ROW + 1 + MAX_CATEGORIES }, () => []);
  const f = (formula: string) => ({ formula });
  rows[0] = [`Monee ${year} 年度帳本`];
  rows[1] = ['01–12 月的明細由 Monee 同步（改了會被蓋掉）；這張的數字由公式自動統計。'];
  [
    ['年度總收入', f('=SUM(B12:B23)')],
    ['年度總支出', f('=SUM(C12:C23)')],
    ['年度結餘', f('=B4-B5')],
    ['儲蓄率', f('=IF(B4=0,"",B6/B4)')],
    ['最高支出月份', f('=IF(MAX(C12:C23)=0,"尚無資料",INDEX(A12:A23,MATCH(MAX(C12:C23),C12:C23,0)))')],
    ['最低支出月份', f('=IF(COUNTIF(C12:C23,">0")=0,"尚無資料",INDEX(A12:A23,MATCH(MINIFS(C12:C23,C12:C23,">0"),C12:C23,0)))')],
  ].forEach((r, i) => (rows[KPI_ROW + i] = r as Cell[]));
  rows[MONTH_HEAD_ROW] = ['月份', '收入', '支出', '結餘', '儲蓄率'];
  MONTH_SHEETS.forEach((s, i) => {
    const r = MONTH_HEAD_ROW + 2 + i; // 試算表的列號（從 1 起算）
    rows[MONTH_HEAD_ROW + 1 + i] = [`${i + 1} 月`, f(`=${sumifs(s, '收入')}`), f(`=${sumifs(s, '支出')}`), f(`=B${r}-C${r}`), f(`=IF(B${r}=0,"",D${r}/B${r})`)];
  });
  rows[CAT_HEAD_ROW] = ['支出分類', '金額', '占比', null, '排行', '金額'];
  const first = CAT_HEAD_ROW + 2;
  const last = first + MAX_CATEGORIES - 1;
  for (let k = 0; k < MAX_CATEGORIES; k++) {
    const r = first + k;
    const src = `${q(CATEGORY_SHEET)}!A${k + 2}`;
    rows[CAT_HEAD_ROW + 1 + k] = [
      f(`=IF(${src}="","",${src})`),
      f(`=IF(A${r}="","",${MONTH_SHEETS.map((s) => sumifs(s, '支出', `,${q(s)}!$D:$D,A${r}`)).join('+')})`),
      f(`=IF(OR(A${r}="",$B$5=0),"",B${r}/$B$5)`),
    ];
  }
  rows[CAT_HEAD_ROW + 1].push(null, f(`=IFERROR(SORT(FILTER(A${first}:B${last},A${first}:A${last}<>"",B${first}:B${last}>0),2,FALSE),"尚無資料")`));
  return rows;
}

function overviewRequests(year: number) {
  const id = SHEET_IDS[OVERVIEW];
  const catEnd = CAT_HEAD_ROW + 1 + MAX_CATEGORIES;
  return [
    { updateCells: { range: grid(id, 0, catEnd, 0, 6), fields: 'userEnteredValue' } },
    write(id, 0, overviewCells(year), 'userEnteredValue'),
    bold(grid(id, 0, 1, 0, 1), 16),
    bold(grid(id, KPI_ROW, KPI_ROW + 6, 0, 1)),
    bold(grid(id, MONTH_HEAD_ROW, MONTH_HEAD_ROW + 1, 0, 5)),
    bold(grid(id, CAT_HEAD_ROW, CAT_HEAD_ROW + 1, 0, 6)),
    numberFormat(grid(id, KPI_ROW, KPI_ROW + 3, 1, 2), 'money'),
    numberFormat(grid(id, KPI_ROW + 3, KPI_ROW + 4, 1, 2), 'percent'),
    numberFormat(grid(id, MONTH_HEAD_ROW + 1, MONTH_HEAD_ROW + 13, 1, 4), 'money'),
    numberFormat(grid(id, MONTH_HEAD_ROW + 1, MONTH_HEAD_ROW + 13, 4, 5), 'percent'),
    numberFormat(grid(id, CAT_HEAD_ROW + 1, catEnd, 1, 2), 'money'),
    numberFormat(grid(id, CAT_HEAD_ROW + 1, catEnd, 2, 3), 'percent'),
    numberFormat(grid(id, CAT_HEAD_ROW + 1, catEnd, 5, 6), 'money'),
    ...widths(id, [120, 110, 110, 110, 120, 110]),
  ];
}

/** 四張圖：每月收入與支出、每月結餘、支出分類占比、支出分類排行 */
export function chartRequests() {
  const id = SHEET_IDS[OVERVIEW];
  const col = (r0: number, r1: number, c: number) => ({ sourceRange: { sources: [grid(id, r0, r1, c, c + 1)] } });
  const at = (row: number) => ({ overlayPosition: { anchorCell: { sheetId: id, rowIndex: row, columnIndex: 7 }, widthPixels: 560, heightPixels: 300 } });
  const months = [MONTH_HEAD_ROW, MONTH_HEAD_ROW + 13] as const;
  const cats = [CAT_HEAD_ROW + 1, CAT_HEAD_ROW + 1 + MAX_CATEGORIES] as const;
  const chart = (title: string, spec: object, row: number) => ({ addChart: { chart: { spec: { title, ...spec }, position: at(row) } } });
  return [
    chart('每月收入與支出', {
      basicChart: {
        chartType: 'COLUMN', legendPosition: 'BOTTOM_LEGEND', headerCount: 1,
        axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS' }],
        domains: [{ domain: col(...months, 0) }],
        series: [{ series: col(...months, 1), targetAxis: 'LEFT_AXIS' }, { series: col(...months, 2), targetAxis: 'LEFT_AXIS' }],
      },
    }, 2),
    chart('每月結餘', {
      basicChart: {
        chartType: 'LINE', legendPosition: 'NO_LEGEND', headerCount: 1,
        axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS' }],
        domains: [{ domain: col(...months, 0) }],
        series: [{ series: col(...months, 3), targetAxis: 'LEFT_AXIS' }],
      },
    }, 19),
    chart('支出分類占比', { pieChart: { legendPosition: 'RIGHT_LEGEND', domain: col(...cats, 4), series: col(...cats, 5) } }, 36),
    chart('支出分類排行', {
      basicChart: {
        chartType: 'BAR', legendPosition: 'NO_LEGEND',
        axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS' }],
        domains: [{ domain: col(...cats, 4) }],
        series: [{ series: col(...cats, 5), targetAxis: 'BOTTOM_AXIS' }],
      },
    }, 53),
  ];
}

function addSheet(title: string) {
  const isOverview = title === OVERVIEW;
  return {
    addSheet: {
      properties: {
        sheetId: SHEET_IDS[title], title, index: ALL_SHEETS.indexOf(title),
        gridProperties: { rowCount: isOverview ? 80 : 1000, columnCount: isOverview ? 16 : MONTH_HEADER.length, frozenRowCount: isOverview ? 0 : 1 },
      },
    },
  };
}

/** 月份或分類設定工作表的表頭、格式、提醒 */
function sheetSetup(title: string) {
  const id = SHEET_IDS[title];
  if (title === CATEGORY_SHEET) {
    return [write(id, 0, [['支出分類', '收入分類']], 'userEnteredValue'), bold(grid(id, 0, 1)), ...widths(id, [140, 140]), warnOnly(id, '由 Monee 同步，改了會被蓋掉')];
  }
  return [
    write(id, 0, [MONTH_HEADER], 'userEnteredValue'),
    bold(grid(id, 0, 1)),
    numberFormat(grid(id, 1, undefined, 1, 2), 'date'),
    numberFormat(grid(id, 1, undefined, 5, 6), 'money'),
    ...widths(id, MONTH_WIDTHS),
    warnOnly(id, '由 Monee 同步，改了會被蓋掉'),
  ];
}

/** 新的年度帳本：語系、時區，建好 14 張工作表、拿掉預設的那張，寫好表頭、公式和圖 */
export function newWorkbookRequests(year: number, defaultSheetId: number) {
  return [
    { updateSpreadsheetProperties: { properties: { locale: 'zh_TW', timeZone: 'Asia/Taipei' }, fields: 'locale,timeZone' } },
    ...ALL_SHEETS.map(addSheet),
    { deleteSheet: { sheetId: defaultSheetId } },
    ...ALL_SHEETS.filter((t) => t !== OVERVIEW).flatMap(sheetSetup),
    ...overviewRequests(year),
    ...chartRequests(),
  ];
}

/**
 * 有工作表被刪掉：補回來。年度總覽的公式也重寫一次（引用被刪的工作表的公式會壞掉，補回同名的也不會自己好）；
 * 年度總覽本身被刪掉才重畫圖
 */
export function repairRequests(year: number, missing: string[]) {
  return [
    ...missing.map(addSheet),
    ...missing.filter((t) => t !== OVERVIEW).flatMap(sheetSetup),
    ...overviewRequests(year),
    ...(missing.includes(OVERVIEW) ? chartRequests() : []),
  ];
}
