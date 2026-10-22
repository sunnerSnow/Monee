import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSync } from './google-sync';
import { encryptToken } from './token-crypto';

// 假的資料庫：只做 runSync 用到的查詢（select／filter／insert／update／delete／rpc／storage），資料都在記憶體
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

function fakeDb(tables: Record<string, Row[]>, opts: { locked?: boolean } = {}) {
  const calls: string[] = [];
  let lock = opts.locked ?? false;
  const query = (table: string) => {
    const filters: Filter[] = [];
    let op: 'select' | 'update' | 'delete' | 'upsert' = 'select';
    let payload: Row = {};
    let single = false;
    const rowsOf = () => (tables[table] ??= []);
    const run = () => {
      const all = rowsOf();
      const hit = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'select') return { data: single ? hit[0] ?? null : hit.map((r) => ({ ...r })), error: null };
      if (op === 'update') hit.forEach((r) => Object.assign(r, payload));
      if (op === 'delete') tables[table] = all.filter((r) => !hit.includes(r));
      if (op === 'upsert') {
        const key = table === 'drive_folders' ? 'path' : 'source_path';
        tables[table] = [...all.filter((r) => r[key] !== payload[key]), { ...payload }];
      }
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

// 假的 Google：記下每次呼叫；fail 可以讓某種呼叫失敗
function fakeGoogle(fail: { upload?: number; token?: object } = {}) {
  const calls: string[] = [];
  let n = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const res = (status: number, body: object) => new Response(JSON.stringify(body), { status });
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      calls.push('token');
      return fail.token ? res(400, fail.token) : res(200, { access_token: 'ya29' });
    }
    if (url.includes('/upload/')) {
      calls.push('upload');
      return fail.upload ? res(fail.upload, {}) : res(200, { id: `file${++n}`, webViewLink: `https://drive/file${n}` });
    }
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    if (method === 'POST') {
      calls.push(`folder ${body.name}`);
      return res(200, { id: `folder-${body.name}` });
    }
    if (method === 'PATCH') {
      calls.push(body.trashed ? 'trash' : `rename ${body.name}${url.includes('addParents') ? ' (move)' : ''}`);
      return res(200, { id: 'f' });
    }
    calls.push('get');
    return res(200, url.includes('fields=parents') ? { parents: ['folder-10'] } : { id: 'x', trashed: false });
  }));
  return calls;
}

const USER = '11111111-1111-1111-1111-111111111111';
const KEY = randomBytes(32).toString('base64');

function world(extra: Record<string, Row[]> = {}) {
  return {
    google_integrations: [{ user_id: USER, encrypted_refresh_token: encryptToken('1//r', USER, Buffer.from(KEY, 'base64')), needs_reconnect: false }],
    google_sync_months: [{ month: '2026-10-01', dirty_at: 't1', attempts: 0 }],
    categories: [],
    transactions: [{ date: '2026-10-22', amount: 830, note: '全聯', category_id: 'daily', receipt_image_url: 'u/a.jpg', type: 'EXPENSE' }],
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
    expect(google).toEqual(['token', 'folder Monee', 'folder 2026', 'folder 10', 'upload', 'upload']);
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
    db.tables.transactions = [];
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
    // 月份資料夾在垃圾桶
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.startsWith('https://oauth2')) return new Response(JSON.stringify({ access_token: 'ya29' }));
      if ((init.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ id: 'x', trashed: url.includes('folder-10') }));
      if (url.includes('/upload/')) return new Response(JSON.stringify({ id: 'new' }));
      return new Response(JSON.stringify({ id: 'folder-10b' }));
    }));
    await sync(db);
    expect(db.tables.drive_folders.find((f) => f.path === '2026/10')?.folder_id).toBe('folder-10b');
    expect(db.tables.drive_receipts.every((r) => r.drive_file_id === 'new')).toBe(true);
  });
});
