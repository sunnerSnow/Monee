// 資料備份：備份檔的格式、上傳時的檢查、換帳號還原時換掉 id（純函式，有測試）。
// 備份檔由資料庫函式 backup_export 產生，每張表的資料列照原樣（不含 user_id）；還原由 backup_restore 一次換掉。
import { toISODate } from './dates';

export const BACKUP_FORMAT = 'monee-backup';
export const BACKUP_VERSION = 1;

/** 備份檔裡的資料表 */
export const BACKUP_TABLES = [
  'categories', 'accounts', 'recurring_rules', 'budget_history', 'no_spend_days', 'savings_goals', 'savings_deposits', 'split_groups', 'split_members', 'split_rounds',
  'split_expenses', 'split_settlements', 'split_claims', 'split_proposals', 'transactions',
] as const;
/** 舊版的備份檔沒有這些表（分類管理、固定收支、無消費日、存錢目標之前備份的） */
const OPTIONAL_TABLES = new Set<string>(['categories', 'recurring_rules', 'no_spend_days', 'savings_goals', 'savings_deposits']);
/** id 是每個人自己的（分類 id 像 food、c_xxx，預算紀錄用月份，無消費日用日期），換帳號還原時不用換 */
const OWN_KEY_TABLES = new Set<string>(['categories', 'budget_history', 'no_spend_days']);
/** 沒有 id 欄位的表 */
const NO_ID_TABLES = new Set<string>(['budget_history', 'no_spend_days']);
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, unknown>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** 備份的是哪個帳號（user id） */
  owner: string;
  profile: BackupRow | null;
} & Record<BackupTable, BackupRow[]>;

/** 太大的檔案不讀，手機記憶體才不會爆掉；一般人記十年帳也才幾 MB */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

const NOT_BACKUP = '這個檔案不是 Monee 的備份檔';
const BROKEN = '備份檔不完整或被改壞了，沒有還原';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 讀上傳的備份檔；格式不對就丟出給使用者看的錯誤 */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(NOT_BACKUP);
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) throw new Error(NOT_BACKUP);
  if (data.version !== BACKUP_VERSION) throw new Error('不支援這個版本的備份檔');
  if (typeof data.exportedAt !== 'string' || typeof data.owner !== 'string') throw new Error(BROKEN);
  if (data.profile != null && !isObject(data.profile)) throw new Error(BROKEN);
  for (const table of BACKUP_TABLES) {
    if (data[table] === undefined && OPTIONAL_TABLES.has(table)) data[table] = [];
    const rows = data[table];
    if (!Array.isArray(rows) || !rows.every(isObject)) throw new Error(BROKEN);
    // 預算紀錄用月份、無消費日用日期當 key，其他表都要有 id，換帳號時才換得掉
    if (!NO_ID_TABLES.has(table) && !rows.every((r) => typeof r.id === 'string')) throw new Error(BROKEN);
  }
  return data as Backup;
}

export interface BackupSummary {
  exportedAt: string;
  /** 不含系統建立的「朋友往來」 */
  accounts: number;
  transactions: number;
  firstDate: string | null;
  lastDate: string | null;
  /** 分帳群組與旅程 */
  groups: number;
}

/** 還原前給使用者確認的內容 */
export function summarizeBackup(b: Backup): BackupSummary {
  const dates = b.transactions.map((t) => String(t.date)).sort();
  return {
    exportedAt: b.exportedAt,
    accounts: b.accounts.filter((a) => a.type !== 'FRIENDS').length,
    transactions: b.transactions.length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    groups: b.split_groups.length,
  };
}

/** 是不是別的帳號的備份 */
export const isOtherAccount = (b: Backup, userId: string) => b.owner !== userId;

/**
 * 還原前的準備。同一個帳號照原樣還原，朋友手上的分享連結繼續有效。
 * 別的帳號的備份要換掉所有 id（原本的帳號可能還在用這些 id），分享連結和收據照片也不帶過來（都還是原本帳號的）。
 * id 都是隨機的 UUID，所以只要值或 key 剛好等於某個 id 就換掉，花費分攤（amounts 等）裡用成員 id 當 key 的也一起換。
 */
export function prepareRestore(b: Backup, userId: string, newId: () => string = () => crypto.randomUUID()): Backup {
  if (!isOtherAccount(b, userId)) return b;
  const ids = new Map<string, string>();
  for (const table of BACKUP_TABLES.filter((t) => !OWN_KEY_TABLES.has(t))) {
    for (const row of b[table]) {
      if (typeof row.id === 'string') ids.set(row.id, newId());
    }
  }
  const swap = (v: unknown): unknown => {
    if (typeof v === 'string') return ids.get(v) ?? v;
    if (Array.isArray(v)) return v.map(swap);
    if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [ids.get(k) ?? k, swap(x)]));
    return v;
  };
  const out = { ...b, owner: userId };
  for (const table of BACKUP_TABLES) out[table] = b[table].map((row) => swap(row) as BackupRow);
  out.split_groups = out.split_groups.map((g) => ({ ...g, share_token: null }));
  out.split_expenses = out.split_expenses.map((e) => ({ ...e, receipt_path: null }));
  out.transactions = out.transactions.map((t) => ({ ...t, receipt_image_url: null }));
  return out;
}

export const backupFileName = (now: Date) => `monee-backup-${toISODate(now)}.json`;
