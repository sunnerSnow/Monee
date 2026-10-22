import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_SHEETS } from '@/lib/annual-ledger';
import { runSync } from './google-sync';
import { encryptToken } from './token-crypto';

// 假的資料庫：只做 runSync 用到的查詢（select／filter／insert／update／delete／rpc／storage），資料都在記憶體
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;
const UPSERT_KEY: Record<string, string> = { drive_folders: 'path', drive_receipts: 'source_path', annual_workbooks: 'year' };

function fakeDb(tables: Record<string, Row[]>, opts: { locked?: boolean } = {}) {
  const calls: string[] = [];
  let lock = opts.locked ?? false;
  const query = (table: string) => {
    const filters: Filter[] = [];
    let op: 'select' | 'update' | 'delete' | 'upsert' = 'select';
    let payload: Row = {};
    let single = false;
    const run = () => {
      const all = (tables[table] ??= []);
      const hit = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'select') return { data: single ? hit[0] ?? null : hit.map((r) => ({ ...r })), error: null };
      if (op === 'update') hit.forEach((r) => Object.assign(r, payload));
      if (op === 'delete') tables[table] = all.filter((r) => !hit.includes(r));
      if (op === 'upsert') tables[table] = [...all.filter((r) => r[UPSERT_KEY[table]] !== payload[UPSERT_KEY[table]]), { ...payload }];
      calls.push(`${op} ${table}`);
      return { data: null, error: null };
    };
    const b = {
      select: () => b,
      order: () => b,
      update: (p: Row) => ((op = 'update'), (payload = p), b),
      delete: () => ((op = 'delete'), b),
      upsert: (p: Row) => ((op = 'upsert'), (payload = p), b),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      lt: (c: string, v: string | number) => (filters.push((r) => (r[c] as string | number) < v), b),
      gte: (c: string, v: string) => (filters.push((r) => (r[c] as string) >= v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
      not: (c: string) => (filters.push((r) => r[c] != null), b),
      like: (c: string, p: string) => (filters.push((r) => String(r[c]).startsWith(p.replace(/%$/, ''))), b),
      maybeSingle: () => ((single = true), b),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return b;
  };
  return {
    calls,
    tables,
    from: query,
    rpc: async (fn: string, args?: Row) => {
      calls.push(`rpc ${fn}`);
      if (fn === 'google_sync_begin') return { data: lock ? false : (lock = true), error: null };
      if (fn === 'google_sync_finish') {
        lock = false;
        Object.assign(tables.google_integrations[0], { last_error: args?.p_error ?? null });
      }
      return { data: null, error: null };
    },
    storage: { from: () => ({ download: async (path: string) => (tables.photos?.some((p) => p.path === path)
      ? { data: new Blob([new Uint8Array([1, 2, 3])]), error: null }
      : { data: null, error: { message: 'not found' } }) }) },
  };
}

// 假的 Google：Drive 的資料夾、檔案、試算表都記在 drive 裡（多次同步之間會留著）；calls 記下這次的每個動作
interface SheetsRequest { addSheet?: { properties: { sheetId: number; title: string } }; deleteSheet?: { sheetId: number }; updateCells?: unknown }
let drive: { books: Map<string, { sheetId: number; title: string }[]>; trashed: Set<string>; batches: { id: string; requests: SheetsRequest[] }[]; n: number };
beforeEach(() => {
  drive = { books: new Map(), trashed: new Set(), batches: [], n: 0 };
});

function fakeGoogle(fail: { upload?: number; token?: object } = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const res = (status: number, body: object) => new Response(JSON.stringify(body), { status });
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      calls.push('token');
      return fail.token ? res(400, fail.token) : res(200, { access_token: 'ya29' });
    }
    if (url.includes('/upload/')) {
      calls.push('upload');
      return fail.upload ? res(fail.upload, {}) : res(200, { id: `file${++drive.n}`, webViewLink: `https://drive/file${drive.n}` });
    }
    if (url.startsWith('https://sheets.googleapis.com')) {
      const id = decodeURIComponent(url.split('/spreadsheets/')[1].split(/[?:]/)[0]);
      const sheets = drive.books.get(id);
      if (!sheets) return res(404, {});
      if (method === 'GET') return res(200, { sheets: sheets.map((p) => ({ properties: { ...p, gridProperties: { rowCount: 1000 } } })) });
      calls.push('batch');
      drive.batches.push({ id, requests: body.requests });
      for (const r of body.requests as SheetsRequest[]) {
        if (r.addSheet) sheets.push(r.addSheet.properties);
        if (r.deleteSheet) sheets.splice(sheets.findIndex((s) => s.sheetId === r.deleteSheet!.sheetId), 1);
      }
      return res(200, {});
    }
    if (method === 'POST') {
      if (body.mimeType === 'application/vnd.google-apps.spreadsheet') {
        calls.push(`sheet ${body.name}`);
        const id = `book${++drive.n}`;
        drive.books.set(id, [{ sheetId: 0, title: '工作表1' }]);
        return res(200, { id });
      }
      calls.push(`folder ${body.name}`);
      return res(200, { id: `folder-${body.name}` });
    }
    if (method === 'PATCH') {
      calls.push(body.trashed ? 'trash' : `rename ${body.name}${url.includes('addParents') ? ' (move)' : ''}`);
      return res(200, { id: 'f' });
    }
    const fileId = decodeURIComponent(url.split('/files/')[1].split('?')[0]);
    if (fileId.startsWith('book') && !drive.books.has(fileId)) return res(404, {});
    return res(200, url.includes('fields=parents') ? { parents: ['folder-10'] } : { id: fileId, trashed: drive.trashed.has(fileId) });
  }));
  return calls;
}

/** 某次寫進帳本的某個月份工作表的列 */
function writtenRows(sheetId: number) {
  const write = drive.batches.flatMap((b) => b.requests).filter((r) => {
    const u = r.updateCells as { start?: { sheetId: number } } | undefined;
    return u?.start?.sheetId === sheetId;
  }).at(-1)?.updateCells as { rows: { values: { userEnteredValue?: Record<string, unknown>; userEnteredFormat?: { textFormat: { link: { uri: string } } } }[] }[] } | undefined;
  return write?.rows.map((r) => r.values.map((v) => (v.userEnteredFormat ? `${Object.values(v.userEnteredValue!)[0]} → ${v.userEnteredFormat.textFormat.link.uri}` : v.userEnteredValue ? Object.values(v.userEnteredValue)[0] : null)));
}

const USER = '11111111-1111-1111-1111-111111111111';
const KEY = randomBytes(32).toString('base64');
const OCT = 110;

function world(extra: Record<string, Row[]> = {}) {
  return {
    google_integrations: [{ user_id: USER, encrypted_refresh_token: encryptToken('1//r', USER, Buffer.from(KEY, 'base64')), needs_reconnect: false }],
    google_sync_months: [{ month: '2026-10-01', dirty_at: 't1', attempts: 0 }],
    categories: [],
    accounts: [{ id: 'cash', name: '現金' }, { id: 'friends', name: '朋友往來' }],
    transactions: [
      { id: 'tx1', date: '2026-10-22', time: '18:30:00', type: 'EXPENSE', amount: 830, note: '全聯', category_id: 'daily', source_account_id: 'cash', created_at: 'c1', receipt_image_url: 'u/a.jpg' },
      { id: 'tx2', date: '2026-10-05', time: null, type: 'EXPENSE', amount: 300, note: '一蘭拉麵', category_id: 'food', source_account_id: 'friends', created_at: 'c2', receipt_image_url: null,
        currency: 'JPY', original_amount: 1400, split_expense: { receipt_path: 'u/b.jpg', group: { name: '東京', kind: 'trip' } } },
      { id: 'tx3', date: '2026-10-10', time: null, type: 'TRANSFER', amount: 3000, note: '領錢', category_id: 'transfer', source_account_id: 'cash', created_at: 'c3', receipt_image_url: null },
    ],
    split_expenses: [{ date: '2026-10-05', title: '一蘭拉麵', amount: '900', receipt_path: 'u/b.jpg' }],
    photos: [{ path: 'u/a.jpg' }, { path: 'u/b.jpg' }],
    ...extra,
  };
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'cid');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
  vi.stubEnv('GOOGLE_TOKEN_KEY', KEY);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// runSync 只用到 Supabase client 的一小部分
const sync = (db: ReturnType<typeof fakeDb>, force = false) => runSync(db as never, USER, { force });

describe('runSync：收據', () => {
  it('第一次：建 Monee/2026/10、照規格的檔名上傳、記下來，月份做完就清掉', async () => {
    const db = fakeDb(world());
    const google = fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'done', months: 1 });
    expect(google.slice(0, 6)).toEqual(['token', 'folder Monee', 'folder 2026', 'folder 10', 'upload', 'upload']);
    expect(db.tables.drive_receipts.map((r) => [r.source_path, r.file_name, r.folder_path])).toEqual([
      ['u/a.jpg', '2026-10-22_全聯_830.jpg', '2026/10'],
      ['u/b.jpg', '2026-10-05_一蘭拉麵_900.jpg', '2026/10'],
    ]);
    expect(db.tables.google_sync_months).toEqual([]);
    expect(db.calls.at(-1)).toBe('rpc google_sync_finish');
  });

  it('再同步一次不會重複上傳（資料夾確認還在就好）', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 });
    const google = fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'done', months: 1 });
    expect(google.filter((c) => c === 'upload')).toEqual([]);
    expect(db.tables.drive_receipts).toHaveLength(2);
  });

  it('改日期跨月：10 月不丟（11 月還用得到），11 月搬過去並改檔名', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    db.tables.transactions[0].date = '2026-11-02';
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 }, { month: '2026-11-01', dirty_at: 't2', attempts: 0 });
    const google = fakeGoogle();
    await sync(db);
    expect(google).not.toContain('trash');
    expect(google).toContain('rename 2026-11-02_全聯_830.jpg (move)');
    expect(db.tables.drive_receipts.find((r) => r.source_path === 'u/a.jpg')).toMatchObject({ folder_path: '2026/11', file_name: '2026-11-02_全聯_830.jpg' });
  });

  it('交易刪掉（照片也刪了）：Drive 的那張丟垃圾桶', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    db.tables.transactions = db.tables.transactions.filter((t) => t.id !== 'tx1');
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 });
    const google = fakeGoogle();
    await sync(db);
    expect(google.filter((c) => c === 'trash')).toHaveLength(1);
    expect(db.tables.drive_receipts.map((r) => r.source_path)).toEqual(['u/b.jpg']);
  });

  it('上傳失敗：月份留著、記下次數和原因，鎖照樣放開', async () => {
    const db = fakeDb(world());
    fakeGoogle({ upload: 503 });
    const r = await sync(db);
    expect(r).toMatchObject({ status: 'error', months: 0, message: '2026-10：Google 暫時忙碌，等一下會再試' });
    expect(db.tables.google_sync_months[0]).toMatchObject({ attempts: 1, last_error: 'Google 暫時忙碌，等一下會再試' });
    expect(db.tables.google_integrations[0].last_error).toBe(r.message);
    // 重試成功就清掉
    fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'done', months: 1 });
  });

  it('失敗 5 次以上：自動同步跳過，按「立即同步」才再試', async () => {
    const db = fakeDb(world({ google_sync_months: [{ month: '2026-10-01', dirty_at: 't1', attempts: 5 }] }));
    const google = fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'done', months: 0 });
    expect(google).toEqual([]);
    expect(await sync(db, true)).toEqual({ status: 'done', months: 1 });
  });

  it('沒有待同步的：不跟 Google 拿 token', async () => {
    const db = fakeDb(world({ google_sync_months: [] }));
    const google = fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'done', months: 0 });
    expect(google).toEqual([]);
  });

  it('另一個同步正在跑：不做', async () => {
    const db = fakeDb(world(), { locked: true });
    const google = fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'busy' });
    expect(google).toEqual([]);
  });

  it('授權失效：標成要重新連結，之後的同步直接停', async () => {
    const db = fakeDb(world());
    fakeGoogle({ token: { error: 'invalid_grant' } });
    expect(await sync(db)).toMatchObject({ status: 'reconnect' });
    expect(db.tables.google_integrations[0].needs_reconnect).toBe(true);
    expect(await sync(db)).toEqual({ status: 'reconnect' });
  });

  it('資料夾被刪了：重建，裡面的收據重新上傳', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 });
    drive.trashed.add('folder-10');
    const google = fakeGoogle();
    await sync(db);
    expect(google.filter((c) => c === 'folder 10' || c === 'upload')).toEqual(['folder 10', 'upload', 'upload']);
  });
});

describe('runSync：年度帳本', () => {
  it('第一次：在 Monee/2026 建「Monee_2026_年度帳本」，14 張工作表，記下來', async () => {
    const db = fakeDb(world());
    const google = fakeGoogle();
    await sync(db);
    expect(google).toContain('sheet Monee_2026_年度帳本');
    expect(drive.books.get('book3')!.map((s) => s.title)).toEqual(ALL_SHEETS);
    expect(db.tables.annual_workbooks).toEqual([{ user_id: USER, year: 2026, spreadsheet_id: 'book3' }]);
  });

  it('10 月寫進 10_十月：只有收入支出、照日期排、收據連到 Drive、旅程和外幣寫在備註', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    const rows = writtenRows(OCT)!;
    expect(rows.map((r) => r[0])).toEqual(['tx2', 'tx1']);
    expect(rows[0]).toEqual(['tx2', 46300, '支出', '餐飲', '一蘭拉麵', 300, '朋友往來', '旅程：東京・外幣 ¥1,400', '查看收據 → https://drive/file2', expect.any(String)]);
    expect(rows[1].slice(2, 9)).toEqual(['支出', '日用', '全聯', 830, '現金', null, '查看收據 → https://drive/file1']);
  });

  it('再同步只寫那個月，不再建帳本', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    db.tables.transactions[0].amount = 900;
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 });
    const google = fakeGoogle();
    await sync(db);
    expect(google.filter((c) => c.startsWith('sheet '))).toEqual([]);
    expect(google.filter((c) => c === 'batch')).toHaveLength(1);
    expect(writtenRows(OCT)![1][5]).toBe(900);
  });

  it('只有轉帳的月份、這年還沒有帳本：不建帳本', async () => {
    const db = fakeDb(world({
      google_sync_months: [{ month: '2026-09-01', dirty_at: 't1', attempts: 0 }],
      transactions: [{ id: 'x', date: '2026-09-03', type: 'TRANSFER', amount: 1, category_id: 'transfer', source_account_id: 'cash', receipt_image_url: null }],
      split_expenses: [],
    }));
    const google = fakeGoogle();
    expect(await sync(db)).toEqual({ status: 'done', months: 1 });
    expect(google.filter((c) => c.startsWith('sheet '))).toEqual([]);
  });

  it('帳本被刪了：建一份新的，全部重新同步', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    drive.books.delete('book3');
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 });
    const google = fakeGoogle();
    await sync(db);
    expect(google).toContain('sheet Monee_2026_年度帳本');
    expect(db.tables.annual_workbooks[0].spreadsheet_id).not.toBe('book3');
    expect(db.calls).toContain('rpc google_mark_all');
  });

  it('有月份工作表被刪：補回來，全部重新同步', async () => {
    const db = fakeDb(world());
    fakeGoogle();
    await sync(db);
    const sheets = drive.books.get('book3')!;
    sheets.splice(sheets.findIndex((s) => s.title === '03_三月'), 1);
    db.tables.google_sync_months.push({ month: '2026-10-01', dirty_at: 't2', attempts: 0 });
    fakeGoogle();
    await sync(db);
    expect(sheets.map((s) => s.title)).toContain('03_三月');
    expect(db.calls).toContain('rpc google_mark_all');
  });
});
