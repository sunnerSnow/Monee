import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeSpreadsheet } from './google-sheets';
import type { Tab } from './sheets-export';

interface Call { method: string; url: string; body: Record<string, unknown> | undefined }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** 假的 Google：依網址回應，記下每次呼叫 */
function fakeGoogle(routes: { drive?: () => Response; spreadsheet?: string[] }) {
  const calls: Call[] = [];
  let nextSheetId = 100;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init.method ?? 'GET', url, body });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/')) return routes.drive?.() ?? json(200, { trashed: false });
    if (url === 'https://sheets.googleapis.com/v4/spreadsheets') {
      return json(200, {
        spreadsheetId: 'new-sheet-id-0123456789',
        sheets: body.sheets.map((s: { properties: { title: string } }, i: number) => ({
          properties: { sheetId: i, title: s.properties.title, gridProperties: { rowCount: 1000, columnCount: 26 } },
        })),
      });
    }
    if (url.includes('?fields=')) {
      return json(200, {
        sheets: (routes.spreadsheet ?? []).map((title, i) => ({ properties: { sheetId: i, title, gridProperties: { rowCount: 1000, columnCount: 26 } } })),
      });
    }
    if (isSheetBatch(url) && body.requests[0]?.addSheet) {
      return json(200, { replies: body.requests.map((r: { addSheet: { properties: { title: string } } }) => ({ addSheet: { properties: { sheetId: nextSheetId++, title: r.addSheet.properties.title } } })) });
    }
    return json(200, {});
  }));
  return calls;
}

const tabs: Tab[] = [
  { title: '總覽', rows: [['Monee 記帳', null], ['淨資產', 1800]], freeze: false, formats: { 1: 'money' }, widths: [120, 140] },
  { title: '明細', rows: [['日期', '品項／備註', '金額'], [46309, '=IMAGE("https://evil.example")', 100]], freeze: true, formats: { 0: 'date', 2: 'money' } },
];

/** 試算表本身的 batchUpdate（格式、加工作表），不是寫值的 values:batchUpdate */
const isSheetBatch = (url: string) => url.endsWith(':batchUpdate') && !url.includes('/values:');
const path = (c: Call) => c.url.replace(/^https:\/\/[^/]+/, '').replace(/\?.*$/, '');

afterEach(() => vi.unstubAllGlobals());

describe('writeSpreadsheet', () => {
  it('第一次匯出：建一份新的、馬上記下 id，再設格式、寫值、調欄寬', async () => {
    const calls = fakeGoogle({});
    const onCreated = vi.fn(async () => {});
    const id = await writeSpreadsheet('token', null, tabs, onCreated);

    expect(id).toBe('new-sheet-id-0123456789');
    expect(onCreated).toHaveBeenCalledWith('new-sheet-id-0123456789');
    expect(calls.map(path)).toEqual([
      '/v4/spreadsheets',
      '/v4/spreadsheets/new-sheet-id-0123456789:batchUpdate',
      '/v4/spreadsheets/new-sheet-id-0123456789/values:batchUpdate',
      '/v4/spreadsheets/new-sheet-id-0123456789:batchUpdate',
    ]);
    expect(calls[0].body).toMatchObject({
      properties: { title: 'Monee 記帳', locale: 'zh_TW' },
      sheets: [{ properties: { title: '總覽' } }, { properties: { title: '明細' } }],
    });
    expect(calls[0].method).toBe('POST');
    // 所有請求都帶授權
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token' });
  });

  it('寫值用 RAW：文字不會被當成公式，空格寫空字串', async () => {
    const calls = fakeGoogle({});
    await writeSpreadsheet('token', null, tabs, async () => {});
    const write = calls.find((c) => c.url.endsWith('/values:batchUpdate'))!;
    expect(write.body).toEqual({
      valueInputOption: 'RAW',
      data: [
        { range: "'總覽'!A1", values: [['Monee 記帳', ''], ['淨資產', 1800]] },
        { range: "'明細'!A1", values: [['日期', '品項／備註', '金額'], [46309, '=IMAGE("https://evil.example")', 100]] },
      ],
    });
  });

  it('格式：表頭固定與粗體、欄位格式從第二列起、總覽用固定欄寬，其他自動調整', async () => {
    const calls = fakeGoogle({});
    await writeSpreadsheet('token', null, tabs, async () => {});
    const [format, resize] = calls.filter((c) => isSheetBatch(c.url)).map((c) => c.body!.requests as Record<string, never>[]);
    expect(format).toContainEqual({
      updateSheetProperties: {
        properties: { sheetId: 1, gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 1 } },
        fields: 'gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount',
      },
    });
    expect(format).toContainEqual({
      repeatCell: {
        range: { sheetId: 1, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
    expect(format).toContainEqual({
      updateDimensionProperties: { range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 140 }, fields: 'pixelSize' },
    });
    expect(resize).toEqual([{ autoResizeDimensions: { dimensions: { sheetId: 1, dimension: 'COLUMNS', startIndex: 0, endIndex: 3 } } }]);
  });

  it('列數超過格子時先把工作表撐大', async () => {
    const calls = fakeGoogle({});
    const big: Tab = { title: '明細', rows: Array.from({ length: 1500 }, (_, i) => [i]), freeze: true, formats: {} };
    await writeSpreadsheet('token', null, [big], async () => {});
    const format = calls.find((c) => isSheetBatch(c.url))!.body!.requests as { updateSheetProperties?: { properties: { gridProperties: { rowCount: number } } } }[];
    expect(format[0].updateSheetProperties!.properties.gridProperties.rowCount).toBe(1500);
  });

  it('資料多時分幾次寫，每次不超過 4000 列', async () => {
    const calls = fakeGoogle({});
    const big: Tab = { title: '明細', rows: Array.from({ length: 9001 }, (_, i) => [i]), freeze: true, formats: {} };
    await writeSpreadsheet('token', null, [tabs[0], big], async () => {});
    const writes = calls.filter((c) => c.url.endsWith('/values:batchUpdate')).map((c) => c.body!.data as { range: string; values: unknown[][] }[]);
    expect(writes.map((w) => w.map((d) => [d.range, d.values.length]))).toEqual([
      [["'總覽'!A1", 2]],
      [["'明細'!A1", 4000]],
      [["'明細'!A4001", 4000]],
      [["'明細'!A8001", 1001]],
    ]);
  });

  it('更新同一份：清掉這幾張工作表的值再寫，被刪掉的工作表補回來', async () => {
    const calls = fakeGoogle({ spreadsheet: ['總覽', '我的樞紐分析'] });
    const onCreated = vi.fn(async () => {});
    const id = await writeSpreadsheet('token', 'old-sheet-id-0123456789', tabs, onCreated);

    expect(id).toBe('old-sheet-id-0123456789');
    expect(onCreated).not.toHaveBeenCalled();
    expect(calls.map(path)).toEqual([
      '/drive/v3/files/old-sheet-id-0123456789',
      '/v4/spreadsheets/old-sheet-id-0123456789',
      '/v4/spreadsheets/old-sheet-id-0123456789:batchUpdate',
      '/v4/spreadsheets/old-sheet-id-0123456789/values:batchClear',
      '/v4/spreadsheets/old-sheet-id-0123456789:batchUpdate',
      '/v4/spreadsheets/old-sheet-id-0123456789/values:batchUpdate',
      '/v4/spreadsheets/old-sheet-id-0123456789:batchUpdate',
    ]);
    expect(calls[2].body).toEqual({ requests: [{ addSheet: { properties: { title: '明細' } } }] });
    // 只清自己的工作表，使用者自己加的不動
    expect(calls[3].body).toEqual({ ranges: ["'總覽'", "'明細'"] });
  });

  it('上次的試算表被丟進垃圾桶或刪掉（或換了 Google 帳號看不到），就建一份新的', async () => {
    for (const drive of [() => json(200, { trashed: true }), () => json(404, { error: { code: 404, message: 'File not found' } })]) {
      const calls = fakeGoogle({ drive });
      const onCreated = vi.fn(async () => {});
      expect(await writeSpreadsheet('token', 'old-sheet-id-0123456789', tabs, onCreated)).toBe('new-sheet-id-0123456789');
      expect(onCreated).toHaveBeenCalledOnce();
      expect(calls.filter((c) => c.url.endsWith('/values:batchClear'))).toHaveLength(0);
      vi.unstubAllGlobals();
    }
  });

  it('Google Cloud 沒啟用 API 時說清楚是哪一個', async () => {
    fakeGoogle({
      drive: () => json(403, {
        error: { code: 403, message: 'Google Drive API has not been used', errors: [{ reason: 'accessNotConfigured' }], details: [{ reason: 'SERVICE_DISABLED' }] },
      }),
    });
    await expect(writeSpreadsheet('token', 'old-sheet-id-0123456789', tabs, async () => {})).rejects.toThrow('還沒啟用 Google Drive API');
  });

  it('授權過期、Google 忙碌時的訊息', async () => {
    fakeGoogle({ drive: () => json(401, { error: { code: 401, message: 'Invalid Credentials' } }) });
    await expect(writeSpreadsheet('token', 'old-sheet-id-0123456789', tabs, async () => {})).rejects.toThrow('Google 授權過期了，請再按一次');
    vi.unstubAllGlobals();
    fakeGoogle({ drive: () => json(503, { error: { code: 503, message: 'Backend Error' } }) });
    await expect(writeSpreadsheet('token', 'old-sheet-id-0123456789', tabs, async () => {})).rejects.toThrow('Google 暫時忙不過來');
  });
});
