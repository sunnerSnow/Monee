import { describe, expect, it } from 'vitest';
import { backupFileName, parseBackup, prepareRestore, summarizeBackup, type Backup } from './backup';

const OWNER = '11111111-1111-4111-8111-111111111111';
const CASH = 'aaaaaaaa-0000-4000-8000-000000000001';
const FRIENDS = 'aaaaaaaa-0000-4000-8000-000000000002';
const GROUP = 'bbbbbbbb-0000-4000-8000-000000000001';
const ME = 'cccccccc-0000-4000-8000-000000000001';
const MING = 'cccccccc-0000-4000-8000-000000000002';
const EXPENSE = 'dddddddd-0000-4000-8000-000000000001';

const backup = (): Backup => ({
  format: 'monee-backup',
  version: 1,
  exportedAt: '2026-10-20T21:30:00+08:00',
  owner: OWNER,
  profile: { pnl_color: 'red_up', display_name: '小雞', pay_bank: null, pay_line: null },
  categories: [{ id: 'c_pet', type: 'EXPENSE', name: '寵物', icon: 'paw-print', sort_order: 0, hidden: false }],
  accounts: [
    { id: CASH, name: '現金', type: 'CASH', opening_balance: 1000 },
    { id: FRIENDS, name: '朋友往來', type: 'FRIENDS', opening_balance: 0 },
  ],
  budget_history: [{ effective_month: '2026-10', amount: 24000 }],
  split_groups: [{ id: GROUP, name: '東京', kind: 'trip', share_token: '1520ca1d360661688f6fff7c' }],
  split_members: [
    { id: ME, group_id: GROUP, name: '我', is_me: true },
    { id: MING, group_id: GROUP, name: '小明', is_me: false },
  ],
  split_rounds: [],
  split_expenses: [{
    id: EXPENSE, group_id: GROUP, payer_id: ME, account_id: CASH, added_by: null, title: '拉麵',
    weights: { [ME]: 1, [MING]: 1 }, amounts: { [ME]: 450, [MING]: 450 }, original_shares: null, receipt_path: `${OWNER}/r1.jpg`,
  }],
  split_settlements: [],
  split_claims: [],
  split_proposals: [],
  transactions: [
    { id: 'eeeeeeee-0000-4000-8000-000000000002', date: '2026-10-05', note: '拉麵', source_account_id: CASH, split_expense_id: EXPENSE, receipt_image_url: `${OWNER}/r2.jpg` },
    { id: 'eeeeeeee-0000-4000-8000-000000000001', date: '2026-04-01', note: CASH.slice(0, 8), source_account_id: CASH, split_expense_id: null },
  ],
});

describe('parseBackup', () => {
  it('讀得回 backup_export 產生的檔案', () => {
    expect(parseBackup(JSON.stringify(backup()))).toEqual(backup());
  });

  it('不是 JSON、不是 Monee 的備份檔', () => {
    expect(() => parseBackup('哈囉')).toThrow('不是 Monee 的備份檔');
    expect(() => parseBackup('[]')).toThrow('不是 Monee 的備份檔');
    expect(() => parseBackup(JSON.stringify({ ...backup(), format: 'other' }))).toThrow('不是 Monee 的備份檔');
  });

  it('不認得的版本', () => {
    expect(() => parseBackup(JSON.stringify({ ...backup(), version: 2 }))).toThrow('不支援這個版本');
  });

  it('少了一張表、資料列不是物件、沒有 id，都算壞掉', () => {
    expect(() => parseBackup(JSON.stringify({ ...backup(), transactions: undefined }))).toThrow('不完整');
    expect(() => parseBackup(JSON.stringify({ ...backup(), accounts: [1] }))).toThrow('不完整');
    expect(() => parseBackup(JSON.stringify({ ...backup(), accounts: [{ name: '現金' }] }))).toThrow('不完整');
    expect(() => parseBackup(JSON.stringify({ ...backup(), profile: 'x' }))).toThrow('不完整');
  });

  it('預算紀錄沒有 id 也可以', () => {
    expect(parseBackup(JSON.stringify(backup())).budget_history).toHaveLength(1);
  });

  it('分類管理之前的備份檔沒有分類，當成沒改過分類', () => {
    expect(parseBackup(JSON.stringify({ ...backup(), categories: undefined })).categories).toEqual([]);
  });
});

describe('summarizeBackup', () => {
  it('帳戶不算朋友往來，交易附上日期範圍', () => {
    expect(summarizeBackup(backup())).toEqual({
      exportedAt: '2026-10-20T21:30:00+08:00', accounts: 1, transactions: 2, firstDate: '2026-04-01', lastDate: '2026-10-05', groups: 1,
    });
  });

  it('沒有交易', () => {
    const s = summarizeBackup({ ...backup(), transactions: [] });
    expect([s.transactions, s.firstDate, s.lastDate]).toEqual([0, null, null]);
  });
});

describe('prepareRestore', () => {
  let n = 0;
  const newId = () => `new-${++n}`;

  it('同一個帳號照原樣還原（分享連結繼續有效）', () => {
    const b = backup();
    expect(prepareRestore(b, OWNER, newId)).toBe(b);
  });

  it('別的帳號：每個 id 都換掉，引用也跟著換', () => {
    const out = prepareRestore(backup(), 'other-user', newId);
    const text = JSON.stringify(out);
    for (const id of [CASH, FRIENDS, GROUP, ME, MING, EXPENSE]) expect(text).not.toContain(id);

    const cash = out.accounts[0].id;
    const [me, ming] = out.split_members.map((m) => m.id as string);
    const expense = out.split_expenses[0];
    expect(out.split_members.every((m) => m.group_id === out.split_groups[0].id)).toBe(true);
    expect(expense).toMatchObject({ payer_id: me, account_id: cash, weights: { [me]: 1, [ming]: 1 }, amounts: { [me]: 450, [ming]: 450 } });
    expect(out.transactions[0]).toMatchObject({ source_account_id: cash, split_expense_id: expense.id });
    expect(out.owner).toBe('other-user');
  });

  it('別的帳號：分類 id 不換（每個人的分類各自獨立），交易照樣指到那個分類', () => {
    const out = prepareRestore({ ...backup(), transactions: [{ ...backup().transactions[0], category_id: 'c_pet' }] }, 'other-user', newId);
    expect(out.categories).toEqual(backup().categories);
    expect(out.transactions[0].category_id).toBe('c_pet');
  });

  it('別的帳號：分享連結、收據照片不帶過來，其他內容不變', () => {
    const out = prepareRestore(backup(), 'other-user', newId);
    expect(out.split_groups[0]).toMatchObject({ name: '東京', share_token: null });
    expect(out.split_expenses[0].receipt_path).toBeNull();
    expect(out.transactions[0].receipt_image_url).toBeNull();
    // 只有整個值等於 id 才換，備註裡剛好有一段像 id 的字不會被動到
    expect(out.transactions[1].note).toBe(CASH.slice(0, 8));
    expect(out.profile).toEqual(backup().profile);
    expect(out.budget_history).toEqual(backup().budget_history);
  });

  it('不改到傳進來的備份', () => {
    const b = backup();
    prepareRestore(b, 'other-user', newId);
    expect(b).toEqual(backup());
  });
});

describe('backupFileName', () => {
  it('檔名帶當地日期', () => {
    expect(backupFileName(new Date(2026, 9, 21, 9, 5))).toBe('monee-backup-2026-10-21.json');
  });
});
