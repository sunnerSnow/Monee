// Google 雲端同步（只在伺服器用）：把待同步的月份一個一個做完——收據放進 Drive 的 Monee/年/月，再把那個月整個重寫進年度帳本。
// 一次最多跑 BUDGET_MS，做不完的月份留著下次接著做（已經上傳的有記錄，不會重複）；某個月失敗就記下原因，其他月份照做。
// 自動同步不再碰失敗 5 次以上的月份，按「立即同步」（force）才再試。
import {
  ALL_SHEETS, categoryWriteRequests, monthRows, monthSheet, monthWriteRequests, newWorkbookRequests, repairRequests, SHEET_IDS, workbookName,
  type LedgerTx,
} from '@/lib/annual-ledger';
import { mergeCategories, type CategoryRow } from '@/lib/categories';
import { MIME, extensionOf, monthFolder, planMonthReceipts, receiptFileName, type DriveReceipt, type ReceiptRef } from '@/lib/drive-receipts';
import type { createClient } from '@/lib/supabase/server';
import {
  createFolder, createSpreadsheet, driveAlive, GoogleApiError, GoogleNotFound, sheetProps, sheetsBatch, trashFile, updateFile, uploadFile,
} from './google-api';
import { accessToken, googleConfig, GoogleReconnectError } from './google-oauth';
import { decryptToken } from './token-crypto';

type Db = Awaited<ReturnType<typeof createClient>>;

export type SyncStatus = 'done' | 'more' | 'busy' | 'reconnect' | 'not-connected' | 'error';
export interface SyncResult {
  status: SyncStatus;
  /** 這次做完幾個月 */
  months?: number;
  message?: string;
}

const BUDGET_MS = 40_000;
const AUTO_MAX_ATTEMPTS = 5;
const RECEIPTS_BUCKET = 'receipts';
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const errorText = (e: unknown) => (e instanceof Error ? e.message : '同步失敗');

/** Supabase 的查詢結果：有錯就丟出 */
async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

const nextMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

interface Workbook {
  id: string;
  /** 工作表 id → 目前有幾列（不夠時要先加列） */
  rowCounts: Map<number, number>;
}

class Run {
  /** 這次已經確認過還在的資料夾、年度帳本 */
  readonly folders = new Map<string, string>();
  readonly workbooks = new Map<number, Workbook>();
  accounts: Map<string, string> | null = null;
  readonly started = Date.now();
  /** 帳本「最後更新時間」欄：台灣時間 2026-10-22 11:05 */
  readonly syncedAt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  readonly names: Map<string, string>;
  readonly expenseNames: string[];
  readonly incomeNames: string[];
  constructor(readonly db: Db, readonly userId: string, readonly token: string, categories: ReturnType<typeof mergeCategories>) {
    this.names = new Map(categories.map((c) => [c.id, c.name]));
    this.expenseNames = categories.filter((c) => c.type === 'EXPENSE').map((c) => c.name);
    this.incomeNames = categories.filter((c) => c.type === 'INCOME').map((c) => c.name);
  }
  get overBudget() {
    return Date.now() - this.started > BUDGET_MS;
  }
}

export async function runSync(db: Db, userId: string, opts: { force?: boolean } = {}): Promise<SyncResult> {
  const cfg = googleConfig();
  if (!cfg) return { status: 'error', message: 'Google 同步還沒設定好（伺服器缺少環境變數）' };
  const integration = await rows<{ encrypted_refresh_token: string; needs_reconnect: boolean } | null>(
    db.from('google_integrations').select('encrypted_refresh_token, needs_reconnect').maybeSingle(),
  );
  if (!integration) return { status: 'not-connected' };
  if (integration.needs_reconnect) return { status: 'reconnect' };

  // 先看有沒有要做的，沒有就不用跟 Google 拿 token
  let pending = db.from('google_sync_months').select('month, dirty_at, attempts').order('month');
  if (!opts.force) pending = pending.lt('attempts', AUTO_MAX_ATTEMPTS);
  const months = await rows<{ month: string; dirty_at: string; attempts: number }[]>(pending);
  if (!months.length) return { status: 'done', months: 0 };
  if (!(await rows<boolean>(db.rpc('google_sync_begin')))) return { status: 'busy' };

  let failed: string | null = null;
  let done = 0;
  let more = false;
  try {
    let token: string;
    try {
      token = await accessToken(cfg, decryptToken(integration.encrypted_refresh_token, userId));
    } catch (e) {
      if (e instanceof GoogleReconnectError) await db.from('google_integrations').update({ needs_reconnect: true }).eq('user_id', userId);
      failed = errorText(e);
      return { status: e instanceof GoogleReconnectError ? 'reconnect' : 'error', message: failed };
    }
    const categories = (await rows<(Omit<CategoryRow, 'sortOrder'> & { sort_order: number })[]>(
      db.from('categories').select('id, type, name, icon, sort_order, hidden'),
    )).map(({ sort_order, ...c }) => ({ ...c, sortOrder: sort_order }));
    const run = new Run(db, userId, token, mergeCategories(categories));

    for (const m of months) {
      if (run.overBudget) {
        more = true;
        break;
      }
      const month = m.month.slice(0, 7);
      try {
        if (!(await syncMonth(run, month))) {
          more = true;
          break;
        }
        // 同步的時候又被改到（dirty_at 變了）就留著，下次再做一次
        await db.from('google_sync_months').delete().eq('month', m.month).eq('dirty_at', m.dirty_at);
        done++;
      } catch (e) {
        failed = `${month}：${errorText(e)}`;
        await db.from('google_sync_months').update({ attempts: m.attempts + 1, last_error: errorText(e).slice(0, 300) }).eq('month', m.month);
        if (e instanceof GoogleApiError && e.fatal) break;
      }
    }
  } finally {
    await db.rpc('google_sync_finish', { p_error: failed });
  }
  if (failed) return { status: 'error', months: done, message: failed };
  return { status: more ? 'more' : 'done', months: done };
}

/** 一個月：收據放進 Drive，再重寫年度帳本裡的這個月。時間不夠做完就回傳 false（下次接著做） */
async function syncMonth(run: Run, month: string): Promise<boolean> {
  const from = `${month}-01`;
  const to = `${nextMonth(month)}-01`;
  const [txs, expenses] = await Promise.all([
    rows<{ date: string; amount: number | string; note: string | null; category_id: string; receipt_image_url: string }[]>(
      run.db.from('transactions').select('date, amount, note, category_id, receipt_image_url').gte('date', from).lt('date', to).not('receipt_image_url', 'is', null),
    ),
    rows<{ date: string; title: string; amount: number | string; receipt_path: string }[]>(
      run.db.from('split_expenses').select('date, title, amount, receipt_path').gte('date', from).lt('date', to).not('receipt_path', 'is', null),
    ),
  ]);
  const seen = new Set<string>();
  const current: ReceiptRef[] = [
    ...txs.map((t) => ({ sourcePath: t.receipt_image_url, date: t.date, title: t.note || run.names.get(t.category_id) || '收據', amount: Number(t.amount) })),
    ...expenses.map((e) => ({ sourcePath: e.receipt_path, date: e.date, title: e.title, amount: Number(e.amount) })),
  ].filter((r) => !seen.has(r.sourcePath) && seen.add(r.sourcePath));

  const folder = monthFolder(from);
  // 資料夾先確認好：原本的被刪掉的話，裡面收據的紀錄也會清掉，下面才會重新上傳
  const folderId = current.length ? await ensureFolder(run, folder) : null;
  const plan = planMonthReceipts(month, current, await mappingsFor(run, folder, current.map((r) => r.sourcePath)));

  for (const ref of plan.upload) {
    if (run.overBudget) return false;
    await uploadReceipt(run, ref, folder, folderId!);
  }
  for (const { ref, mapping, name } of plan.update) {
    if (run.overBudget) return false;
    try {
      const file = await updateFile(run.token, mapping.driveFileId, { name, moveTo: mapping.folderPath === folder ? undefined : folderId! });
      await run.db.from('drive_receipts').update({ file_name: name, folder_path: folder, web_view_link: file.webViewLink ?? null })
        .eq('source_path', mapping.sourcePath);
    } catch (e) {
      if (!(e instanceof GoogleNotFound)) throw e;
      // Drive 上被刪掉了：重新放一張
      await run.db.from('drive_receipts').delete().eq('source_path', mapping.sourcePath);
      await uploadReceipt(run, ref, folder, folderId!);
    }
  }
  if (plan.orphans.length) {
    const paths = plan.orphans.map((o) => o.sourcePath);
    const [usedTx, usedExp] = await Promise.all([
      rows<{ receipt_image_url: string }[]>(run.db.from('transactions').select('receipt_image_url').in('receipt_image_url', paths)),
      rows<{ receipt_path: string }[]>(run.db.from('split_expenses').select('receipt_path').in('receipt_path', paths)),
    ]);
    // 改到別的月份的照樣用得到，等那個月同步時搬過去；真的沒用到的才丟垃圾桶
    const used = new Set([...usedTx.map((r) => r.receipt_image_url), ...usedExp.map((r) => r.receipt_path)]);
    for (const orphan of plan.orphans.filter((o) => !used.has(o.sourcePath))) {
      await trashFile(run.token, orphan.driveFileId);
      await run.db.from('drive_receipts').delete().eq('source_path', orphan.sourcePath);
    }
  }
  if (run.overBudget) return false;
  await writeLedgerMonth(run, month, from, to);
  return true;
}

// ---------- 年度帳本 ----------

interface LedgerDbRow {
  id: string; date: string; time: string | null; type: 'EXPENSE' | 'INCOME'; amount: number | string; category_id: string;
  source_account_id: string; note: string | null; created_at: string; currency: string | null; original_amount: number | string | null;
  receipt_image_url: string | null;
  split_expense: { receipt_path: string | null; group: { name: string; kind: string } | null } | null;
}

/** 把這個月的收入、支出整個寫進帳本（轉帳不寫）；收據欄連到 Drive 上的那張 */
async function writeLedgerMonth(run: Run, month: string, from: string, to: string) {
  const year = Number(month.slice(0, 4));
  const txs = await rows<LedgerDbRow[]>(run.db.from('transactions')
    .select('id, date, time, type, amount, category_id, source_account_id, note, created_at, currency, original_amount, receipt_image_url, split_expense:split_expenses(receipt_path, group:split_groups(name, kind))')
    .gte('date', from).lt('date', to).in('type', ['EXPENSE', 'INCOME']));
  // 這一年還沒有帳本、這個月也沒有收支（例如只有轉帳）：不用為了它建帳本
  if (!txs.length && !(await savedWorkbook(run, year))) return;
  const book = await ensureWorkbook(run, year);

  run.accounts ??= new Map((await rows<{ id: string; name: string }[]>(run.db.from('accounts').select('id, name'))).map((a) => [a.id, a.name]));
  const receiptOf = (t: LedgerDbRow) => t.receipt_image_url ?? t.split_expense?.receipt_path ?? null;
  const paths = txs.map(receiptOf).filter((p): p is string => Boolean(p));
  const links = new Map((paths.length
    ? await rows<{ source_path: string; drive_file_id: string; web_view_link: string | null }[]>(
      run.db.from('drive_receipts').select('source_path, drive_file_id, web_view_link').in('source_path', paths),
    )
    : []).map((r) => [r.source_path, r.web_view_link ?? `https://drive.google.com/file/d/${r.drive_file_id}/view`]));

  const ledger: LedgerTx[] = txs.map((t) => {
    const group = t.split_expense?.group ?? null;
    const receipt = receiptOf(t);
    return {
      id: t.id, date: t.date, time: t.time ? t.time.slice(0, 5) : null, type: t.type, amount: Number(t.amount),
      categoryName: run.names.get(t.category_id) ?? t.category_id, accountName: run.accounts!.get(t.source_account_id) ?? null, note: t.note,
      groupName: group?.name ?? null, groupKind: group ? (group.kind === 'trip' ? 'trip' : 'split') : null,
      currency: t.currency, originalAmount: t.original_amount != null ? Number(t.original_amount) : null,
      receiptLink: receipt ? links.get(receipt) ?? null : null, createdAt: t.created_at,
    };
  });
  const sheetId = SHEET_IDS[monthSheet(Number(month.slice(5, 7)))];
  const out = monthRows(ledger, run.syncedAt);
  const rowCount = book.rowCounts.get(sheetId) ?? 1000;
  await sheetsBatch(run.token, book.id, [
    ...monthWriteRequests(sheetId, out, rowCount),
    ...categoryWriteRequests(run.expenseNames, run.incomeNames),
  ]);
  if (out.length + 1 > rowCount) book.rowCounts.set(sheetId, out.length + 101);
}

async function savedWorkbook(run: Run, year: number) {
  return rows<{ spreadsheet_id: string } | null>(run.db.from('annual_workbooks').select('spreadsheet_id').eq('year', year).maybeSingle());
}

/**
 * 找到或建立這一年的帳本（放在 Monee/2026 資料夾）。每次同步只確認一次：
 * - 整份不見了（被刪、丟垃圾桶、換了 Google 帳號）：建一份新的，全部重新同步
 * - 有工作表被刪：補回來（被改名的改回來），全部重新同步，補回來的月份才有資料
 */
async function ensureWorkbook(run: Run, year: number): Promise<Workbook> {
  const cached = run.workbooks.get(year);
  if (cached) return cached;
  const saved = await savedWorkbook(run, year);
  let book: Workbook;
  if (saved && (await driveAlive(run.token, saved.spreadsheet_id))) {
    const props = await sheetProps(run.token, saved.spreadsheet_id);
    const titles = new Set(props.map((p) => p.title));
    const ids = new Set(props.map((p) => p.sheetId));
    const gone = ALL_SHEETS.filter((t) => !titles.has(t));
    if (gone.length) {
      const renamed = gone.filter((t) => ids.has(SHEET_IDS[t]));
      await sheetsBatch(run.token, saved.spreadsheet_id, [
        ...renamed.map((title) => ({ updateSheetProperties: { properties: { sheetId: SHEET_IDS[title], title }, fields: 'title' } })),
        ...repairRequests(year, gone.filter((t) => !renamed.includes(t))),
      ]);
      await run.db.rpc('google_mark_all');
    }
    book = { id: saved.spreadsheet_id, rowCounts: new Map(props.map((p) => [p.sheetId, p.gridProperties?.rowCount ?? 1000])) };
  } else {
    const { id } = await createSpreadsheet(run.token, workbookName(year), await ensureFolder(run, String(year)));
    const [first] = await sheetProps(run.token, id);
    await sheetsBatch(run.token, id, newWorkbookRequests(year, first.sheetId));
    await rows(run.db.from('annual_workbooks').upsert({ user_id: run.userId, year, spreadsheet_id: id }, { onConflict: 'user_id,year' }));
    // 原本那份不見了：今年其他月份也要寫進新的這份
    if (saved) await run.db.rpc('google_mark_all');
    book = { id, rowCounts: new Map() };
  }
  run.workbooks.set(year, book);
  return book;
}

async function mappingsFor(run: Run, folder: string, paths: string[]): Promise<DriveReceipt[]> {
  type Row = { source_path: string; drive_file_id: string; file_name: string; folder_path: string };
  const cols = 'source_path, drive_file_id, file_name, folder_path';
  const [inFolder, byPath] = await Promise.all([
    rows<Row[]>(run.db.from('drive_receipts').select(cols).eq('folder_path', folder)),
    paths.length ? rows<Row[]>(run.db.from('drive_receipts').select(cols).in('source_path', paths)) : Promise.resolve([] as Row[]),
  ]);
  const all = new Map([...inFolder, ...byPath].map((r) => [r.source_path, r]));
  return [...all.values()].map((r) => ({ sourcePath: r.source_path, driveFileId: r.drive_file_id, fileName: r.file_name, folderPath: r.folder_path }));
}

/** Supabase 上的照片下載下來、放進 Drive；照片已經不在（交易剛好被刪）就略過 */
async function uploadReceipt(run: Run, ref: ReceiptRef, folder: string, folderId: string) {
  const { data: blob, error } = await run.db.storage.from(RECEIPTS_BUCKET).download(ref.sourcePath);
  if (error || !blob) return;
  if (blob.size > MAX_RECEIPT_BYTES) throw new Error('收據檔案太大，沒有放進 Drive');
  const name = receiptFileName(ref);
  const file = await uploadFile(run.token, { name, parentId: folderId, mime: MIME[extensionOf(ref.sourcePath)], bytes: new Uint8Array(await blob.arrayBuffer()) });
  await rows(run.db.from('drive_receipts').upsert({
    user_id: run.userId, source_path: ref.sourcePath, drive_file_id: file.id, file_name: name, folder_path: folder, web_view_link: file.webViewLink ?? null,
  }, { onConflict: 'user_id,source_path' }));
}

/**
 * 找到或建立資料夾：''（根目錄的 Monee）→ '2026' → '2026/10'。存過的先確認還在（每次同步只確認一次）；
 * 不在了（被刪、丟垃圾桶、換了 Google 帳號）就重建，裡面收據的紀錄清掉讓它們重新上傳；根目錄重建時全部重新同步。
 */
async function ensureFolder(run: Run, path: string): Promise<string> {
  const cached = run.folders.get(path);
  if (cached) return cached;
  const parentId = path === '' ? undefined : await ensureFolder(run, path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
  const saved = await rows<{ folder_id: string } | null>(run.db.from('drive_folders').select('folder_id').eq('path', path).maybeSingle());
  if (saved && (await driveAlive(run.token, saved.folder_id))) {
    run.folders.set(path, saved.folder_id);
    return saved.folder_id;
  }
  const { id } = await createFolder(run.token, path === '' ? 'Monee' : path.split('/').pop()!, parentId);
  await rows(run.db.from('drive_folders').upsert({ user_id: run.userId, path, folder_id: id }, { onConflict: 'user_id,path' }));
  if (saved) {
    await run.db.from('drive_receipts').delete().like('folder_path', path === '' ? '%' : `${path}%`);
    if (path === '') await run.db.rpc('google_mark_all');
  }
  run.folders.set(path, id);
  return id;
}
