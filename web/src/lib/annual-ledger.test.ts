import { describe, expect, it } from 'vitest';
import {
  ALL_SHEETS, CATEGORY_SHEET, categoryWriteRequests, cellData, chartRequests, monthRows, monthSheet, monthWriteRequests, newWorkbookRequests,
  OVERVIEW, overviewCells, repairRequests, SHEET_IDS, workbookName, type LedgerTx,
} from './annual-ledger';

const tx = (p: Partial<LedgerTx>): LedgerTx => ({
  id: 't1', date: '2026-10-22', time: '12:30', type: 'EXPENSE', amount: 830, categoryName: '日用', accountName: '現金', note: '全聯',
  groupName: null, groupKind: null, currency: null, originalAmount: null, receiptLink: null, createdAt: '2026-10-22T04:30:00Z', ...p,
});
const formulaAt = (row: number, col: number) => {
  const c = overviewCells(2026)[row][col];
  return c && typeof c === 'object' && 'formula' in c ? c.formula : null;
};

describe('名稱', () => {
  it('工作表與檔名照規格', () => {
    expect(ALL_SHEETS).toHaveLength(14);
    expect(ALL_SHEETS[0]).toBe('00_年度總覽');
    expect(monthSheet(1)).toBe('01_一月');
    expect(monthSheet(12)).toBe('12_十二月');
    expect(ALL_SHEETS.at(-1)).toBe('99_分類設定');
    expect(workbookName(2026)).toBe('Monee_2026_年度帳本');
    expect(new Set(Object.values(SHEET_IDS)).size).toBe(14);
  });
});

describe('monthRows', () => {
  it('A–J 欄照規格；金額正數、日期是試算表日期、照時間排', () => {
    const rows = monthRows([
      tx({ id: 'b', time: '18:00' }),
      tx({ id: 'a', time: '08:00', type: 'INCOME', amount: 48000, categoryName: '薪資', note: null }),
    ], '2026-10-22 11:05');
    expect(rows[0]).toEqual(['a', 46317, '收入', '薪資', '薪資', 48000, '現金', null, null, '2026-10-22 11:05']);
    expect(rows[1][0]).toBe('b');
    expect(rows[1][4]).toBe('全聯');
  });

  it('備註：旅程名稱、外幣金額；有收據就是「查看收據」連結', () => {
    const [row] = monthRows([tx({ groupName: '東京五日遊', groupKind: 'trip', currency: 'JPY', originalAmount: 1600, receiptLink: 'https://drive/x' })], 'now');
    expect(row[7]).toBe('旅程：東京五日遊・外幣 ¥1,600');
    expect(row[8]).toEqual({ text: '查看收據', link: 'https://drive/x' });
  });

  it('使用者寫的字就算開頭是 = 也只當文字', () => {
    const [row] = monthRows([tx({ note: '=IMPORTXML("http://evil")' })], 'now');
    expect(cellData(row[4])).toEqual({ userEnteredValue: { stringValue: '=IMPORTXML("http://evil")' } });
    expect(cellData(row[8])).toEqual({});
  });
});

describe('寫入月份', () => {
  it('先清第 2 列以後再寫；列數不夠先加', () => {
    const rows = monthRows([tx({})], 'now');
    const reqs = monthWriteRequests(110, rows, 1000);
    expect(reqs).toHaveLength(2);
    expect(reqs[0]).toMatchObject({ updateCells: { range: { sheetId: 110, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 } } });
    expect(reqs[1]).toMatchObject({ updateCells: { start: { sheetId: 110, rowIndex: 1 } } });
    expect(monthWriteRequests(110, Array(1200).fill(rows[0]), 1000)[0]).toEqual({ appendDimension: { sheetId: 110, dimension: 'ROWS', length: 301 } });
  });

  it('這個月都刪光了：只清不寫', () => {
    expect(monthWriteRequests(110, [], 1000)).toHaveLength(1);
  });

  it('分類設定：支出、收入各一欄', () => {
    const [, w] = categoryWriteRequests(['餐飲', '交通', '日用'], ['薪資']) as { updateCells: { rows: { values: object[] }[] } }[];
    expect(w.updateCells.rows).toHaveLength(3);
    expect(w.updateCells.rows[0].values).toEqual([{ userEnteredValue: { stringValue: '餐飲' } }, { userEnteredValue: { stringValue: '薪資' } }]);
    expect(w.updateCells.rows[2].values).toEqual([{ userEnteredValue: { stringValue: '日用' } }, {}]);
  });
});

describe('年度總覽', () => {
  it('KPI：收入、支出、結餘；收入是 0 時儲蓄率空白', () => {
    expect(formulaAt(3, 1)).toBe('=SUM(B12:B23)');
    expect(formulaAt(5, 1)).toBe('=B4-B5');
    expect(formulaAt(6, 1)).toBe('=IF(B4=0,"",B6/B4)');
  });

  it('最高／最低支出月份：都沒有支出時寫「尚無資料」；最低只看有支出的月份', () => {
    expect(formulaAt(7, 1)).toContain('"尚無資料"');
    expect(formulaAt(8, 1)).toContain('MINIFS(C12:C23,C12:C23,">0")');
  });

  it('每月統計：從那個月的工作表加總，沒資料是 0', () => {
    expect(formulaAt(11, 1)).toBe(`=SUMIFS('01_一月'!$F:$F,'01_一月'!$C:$C,"收入")`);
    expect(formulaAt(22, 2)).toBe(`=SUMIFS('12_十二月'!$F:$F,'12_十二月'!$C:$C,"支出")`);
    expect(formulaAt(11, 4)).toBe('=IF(B12=0,"",D12/B12)');
  });

  it('分類分析：只算支出、12 個月加起來；排行自動排序', () => {
    expect(formulaAt(25, 0)).toBe(`=IF('99_分類設定'!A2="","",'99_分類設定'!A2)`);
    const amount = formulaAt(25, 1)!;
    expect(amount.match(/SUMIFS/g)).toHaveLength(12);
    expect(amount).toContain(`'03_三月'!$C:$C,"支出",'03_三月'!$D:$D,A26`);
    expect(formulaAt(25, 4)).toContain('SORT(FILTER(A26:B65');
  });

  it('沒有空洞（每列都是完整的陣列）', () => {
    for (const row of overviewCells(2026)) expect(row.every((c) => c !== undefined)).toBe(true);
  });

  it('四張圖都在年度總覽上', () => {
    const charts = chartRequests() as { addChart: { chart: { spec: { title: string }; position: { overlayPosition: { anchorCell: { sheetId: number } } } } } }[];
    expect(charts.map((c) => c.addChart.chart.spec.title)).toEqual(['每月收入與支出', '每月結餘', '支出分類占比', '支出分類排行']);
    expect(charts.every((c) => c.addChart.chart.position.overlayPosition.anchorCell.sheetId === SHEET_IDS[OVERVIEW])).toBe(true);
  });
});

describe('建立與修補', () => {
  it('新帳本：14 張工作表、拿掉預設那張、有圖', () => {
    const reqs = newWorkbookRequests(2026, 0) as Record<string, unknown>[];
    expect(reqs.filter((r) => r.addSheet)).toHaveLength(14);
    expect(reqs).toContainEqual({ deleteSheet: { sheetId: 0 } });
    expect(reqs.filter((r) => r.addChart)).toHaveLength(4);
    expect(reqs.filter((r) => r.addProtectedRange)).toHaveLength(13);
  });

  it('補回被刪的月份：公式重寫，圖不重畫；年度總覽被刪才重畫', () => {
    const month = repairRequests(2026, ['03_三月']) as Record<string, unknown>[];
    expect(month.filter((r) => r.addSheet)).toHaveLength(1);
    expect(month.filter((r) => r.addChart)).toHaveLength(0);
    expect(month.some((r) => JSON.stringify(r).includes('SUMIFS'))).toBe(true);
    expect((repairRequests(2026, [OVERVIEW, CATEGORY_SHEET]) as Record<string, unknown>[]).filter((r) => r.addChart)).toHaveLength(4);
  });
});
