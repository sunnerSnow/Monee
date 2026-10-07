// 示範模式：NEXT_PUBLIC_MONEE_DEMO=1 時改用記憶體裡的範例資料，不連 Supabase。
// 用途：還沒建 Supabase 專案時先試用、截圖檢查畫面。重新整理頁面就會回到初始資料。
import { reconcileDiff } from './budget';
import { RECONCILE_EXPENSE_CATEGORY, RECONCILE_INCOME_CATEGORY } from './categories';
import { monthKeyOf, shiftMonth, toISODate, toTime } from './dates';
import { balances, meOf, memberInvolved, openExpenses, splitAmounts } from './split';
import type {
  Account, BudgetEntry, NewAccount, NewSplitExpense, NewSplitSettlement, NewTransaction, Profile, SplitExpense, SplitGroup, SplitKind,
  SplitSettlement, Transaction,
} from './types';

export const isDemo = process.env.NEXT_PUBLIC_MONEE_DEMO === '1';

type DemoAccount = Omit<Account, 'currentBalance' | 'currency' | 'icon'>;

let seq = 0;
const id = (prefix: string) => `${prefix}-${++seq}`;

function seed() {
  const now = new Date();
  const day = (offset: number) => toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
  const accounts: DemoAccount[] = [
    { id: 'cash', name: '現金', type: 'CASH', openingBalance: 4596, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'esun', name: '玉山銀行', type: 'BANK', openingBalance: 148700, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'taishin', name: '台新銀行', type: 'BANK', openingBalance: 56000, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'cathay', name: '國泰信用卡', type: 'CREDIT_CARD', openingBalance: -6474, investmentSnapshot: null, lastReconciledAt: null },
    { id: 'flygo', name: '台新 FlyGo', type: 'CREDIT_CARD', openingBalance: -1997, investmentSnapshot: null, lastReconciledAt: null },
    {
      id: 'invest', name: '證券戶', type: 'INVESTMENT_MIRROR', openingBalance: 143000, lastReconciledAt: null,
      investmentSnapshot: { unrealizedPnl: 11800, pnlPercentage: 8.4, lastSyncedAt: now.toISOString(), deepLinkUrl: '#' },
    },
  ];
  const t = (offset: number, time: string, note: string, categoryId: string, source: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
    id: id('t'), date: day(offset), time, type: 'EXPENSE', amount, categoryId, sourceAccountId: source, targetAccountId: null, note,
    createdAt: new Date(now.getTime() - offset * 86_400_000).toISOString(), ...extra,
  });
  const txs: Transaction[] = [
    t(0, '12:30', '午餐・拉麵', 'food', 'cathay', 260),
    t(0, '08:50', '捷運', 'transit', 'flygo', 35),
    t(0, '08:20', '早餐・蛋餅豆漿', 'food', 'cash', 75),
    t(1, '19:40', '全聯・日用品', 'daily', 'flygo', 528),
    t(1, '09:30', '轉入證券戶', 'transfer', 'esun', 10000, { type: 'TRANSFER', targetAccountId: 'invest' }),
    t(1, '09:00', '薪資', 'salary', 'esun', 48000, { type: 'INCOME' }),
    t(2, '19:30', '電影', 'fun', 'cathay', 650),
    t(2, '17:10', '捷運', 'transit', 'flygo', 60),
    t(2, '11:00', '早午餐', 'food', 'cathay', 320),
    t(3, '19:00', '晚餐・火鍋', 'food', 'cathay', 580),
    t(3, '15:20', '洗衣精・衛生紙', 'daily', 'flygo', 600),
    t(4, '18:00', '診所掛號', 'health', 'cash', 250),
    t(4, '12:20', '午餐・便當', 'food', 'cash', 150),
    t(4, '08:40', '捷運', 'transit', 'flygo', 35),
    t(5, '12:30', '午餐・便當', 'food', 'cash', 150),
    t(5, '08:40', '捷運', 'transit', 'flygo', 35),
  ];
  // 前 5 個月的支出，讓報表的每月趨勢有資料。記在玉山銀行，並把同樣金額加回期初餘額，目前餘額才合理
  const current = monthKeyOf(now);
  const esun = accounts.find((a) => a.id === 'esun')!;
  [22800, 25600, 21300, 23900, 22100].forEach((total, i) => {
    const key = shiftMonth(current, i - 5);
    const parts: [string, number][] = [['food', 0.42], ['daily', 0.18], ['transit', 0.1], ['fun', 0.15], ['shopping', 0.15]];
    parts.forEach(([categoryId, share]) => {
      const amount = Math.round(total * share);
      esun.openingBalance += amount;
      txs.push({
        id: id('h'), date: `${key}-15`, time: '12:00', type: 'EXPENSE', amount, categoryId,
        sourceAccountId: 'esun', targetAccountId: null, note: null, createdAt: `${key}-15T04:00:00Z`,
      });
    });
  });
  // 前三個月預算 22,000、最近三個月 24,000，報表的預算線會跟著變
  const budgets: BudgetEntry[] = [
    { month: shiftMonth(current, -5), amount: 22000 },
    { month: shiftMonth(current, -2), amount: 24000 },
  ];
  return { accounts, txs, budgets, profile: { pnlColor: 'red_up' } as Profile, split: seedSplit(day) };
}

type Store = ReturnType<typeof seed>;
let store: Store | undefined;
const db = () => (store ??= withSplitTransactions(seed()));
const pause = () => new Promise((r) => setTimeout(r, 150));

function balanceOf(a: DemoAccount, txs: Transaction[]) {
  return txs.reduce((sum, t) => {
    if (t.sourceAccountId === a.id) return sum + (t.type === 'INCOME' ? t.amount : -t.amount);
    if (t.targetAccountId === a.id) return sum + t.amount;
    return sum;
  }, a.openingBalance);
}

const recent = (t: Transaction) => t.date >= `${shiftMonth(monthKeyOf(new Date()), -5)}-01`;

export const demo = {
  async accounts(): Promise<Account[]> {
    await pause();
    const { accounts, txs } = db();
    return accounts.map((a) => ({ ...a, currency: 'TWD', icon: null, currentBalance: balanceOf(a, txs) }));
  },
  async transactions(): Promise<Transaction[]> {
    await pause();
    return db().txs.filter(recent);
  },
  async profile(): Promise<Profile> {
    await pause();
    return { ...db().profile };
  },
  async addTransaction(t: NewTransaction) {
    await pause();
    const row: Transaction = { ...t, id: id('n'), createdAt: new Date().toISOString() };
    db().txs.push(row);
    return row.id;
  },
  async updateTransaction(id: string, t: NewTransaction) {
    await pause();
    const row = db().txs.find((x) => x.id === id);
    if (!row) throw new Error('找不到這筆交易，可能已經刪除');
    Object.assign(row, t, { targetAccountId: t.type === 'TRANSFER' ? t.targetAccountId : null });
    return id;
  },
  async deleteTransaction(id: string) {
    await pause();
    const index = db().txs.findIndex((x) => x.id === id);
    if (index < 0) throw new Error('找不到這筆交易，可能已經刪除');
    db().txs.splice(index, 1);
  },
  async addAccount(a: NewAccount) {
    await pause();
    const row: DemoAccount = { id: id('a'), name: a.name, type: a.type, openingBalance: a.openingBalance, investmentSnapshot: null, lastReconciledAt: null };
    db().accounts.push(row);
    return row.id;
  },
  async reconcile(account: Account, input: number) {
    await pause();
    const diff = reconcileDiff(account, input);
    const now = new Date();
    if (diff !== 0) {
      db().txs.push({
        id: id('n'), date: toISODate(now), time: toTime(now), type: diff < 0 ? 'EXPENSE' : 'INCOME', amount: Math.abs(diff),
        categoryId: diff < 0 ? RECONCILE_EXPENSE_CATEGORY : RECONCILE_INCOME_CATEGORY, sourceAccountId: account.id, targetAccountId: null,
        note: diff < 0 ? '未記錄雜項' : '未記錄收入', createdAt: now.toISOString(),
      });
    }
    const target = db().accounts.find((a) => a.id === account.id);
    if (target) target.lastReconciledAt = now.toISOString();
    return diff;
  },
  async budgets(): Promise<BudgetEntry[]> {
    await pause();
    return db().budgets.map((b) => ({ ...b }));
  },
  async setBudget(entry: BudgetEntry) {
    await pause();
    const list = db().budgets;
    const hit = list.find((b) => b.month === entry.month);
    if (hit) hit.amount = entry.amount;
    else list.push({ ...entry });
  },
  async updateProfile(patch: Partial<Profile>) {
    await pause();
    Object.assign(db().profile, patch);
  },

  // ---------- 分帳：跟 supabase 的 split_* 函式同樣的規則 ----------
  async splitGroups(): Promise<SplitGroup[]> {
    await pause();
    return structuredClone(db().split);
  },
  async createSplitGroup(name: string, kind: SplitKind, names: string[]) {
    await pause();
    const friends = [...new Set(names.map((n) => n.trim()).filter((n) => n && n !== '我'))];
    if (!friends.length) throw new Error('至少要有一位朋友');
    const gid = id('g');
    db().split.unshift({
      id: gid, name: name.trim(), kind, createdAt: new Date().toISOString(), expenses: [], settlements: [], rounds: [],
      members: [{ id: `${gid}-me`, name: '我', isMe: true }, ...friends.map((n) => ({ id: id('m'), name: n, isMe: false }))],
    });
    return gid;
  },
  async updateSplitGroup(v: { groupId: string; name: string; kind: SplitKind; members: { id: string | null; name: string }[] }) {
    await pause();
    const g = group(v.groupId);
    const keep = new Set(v.members.map((m) => m.id).filter(Boolean));
    if (g.members.some((m) => !m.isMe && !keep.has(m.id) && memberInvolved(g, m.id))) throw new Error('有花費或還款紀錄的成員不能移除，可以改名');
    const names = v.members.map((m) => m.name.trim());
    if (new Set(names).size !== names.length || names.includes('我')) throw new Error('成員名字重複了');
    if (!names.length) throw new Error('至少要有一位朋友');
    const me = meOf(g)!;
    g.name = v.name.trim();
    g.kind = v.kind;
    g.members = [me, ...v.members.map((m) => ({ id: m.id ?? id('m'), name: m.name.trim(), isMe: false }))];
  },
  async deleteSplitGroup(groupId: string) {
    await pause();
    if (group(groupId).expenses.length) throw new Error('有花費紀錄的群組不能刪除');
    db().split = db().split.filter((g) => g.id !== groupId);
  },
  async saveSplitExpense(e: NewSplitExpense) {
    await pause();
    const s = db();
    const g = group(e.groupId);
    const me = meOf(g)!;
    if (Object.values(e.amounts).reduce((a, b) => a + b, 0) !== e.amount) throw new Error('每個人分到的金額加起來要等於總金額');
    if (e.payerId === me.id && !e.accountId) throw new Error('請選擇付款帳戶');
    const fields = {
      date: e.date, time: e.time, title: e.title.trim(), categoryId: e.categoryId, amount: e.amount, payerId: e.payerId,
      accountId: e.payerId === me.id ? e.accountId : null, mode: e.mode, weights: e.weights, amounts: e.amounts,
    };
    let row: SplitExpense;
    if (e.id) {
      const hit = g.expenses.find((x) => x.id === e.id && !x.roundId);
      if (!hit) throw new Error('找不到這筆花費，或已經結清不能修改');
      row = Object.assign(hit, fields);
    } else {
      row = { id: id('se'), roundId: null, createdAt: new Date().toISOString(), ...fields };
      g.expenses.unshift(row);
    }
    writeExpenseTxs(s, g, row);
    return row.id;
  },
  async deleteSplitExpense(expenseId: string) {
    await pause();
    const s = db();
    const g = s.split.find((x) => x.expenses.some((e) => e.id === expenseId && !e.roundId));
    if (!g) throw new Error('找不到這筆花費，或已經結清不能刪除');
    g.expenses = g.expenses.filter((e) => e.id !== expenseId);
    s.txs = s.txs.filter((t) => t.splitExpenseId !== expenseId);
  },
  async settle(v: NewSplitSettlement) {
    await pause();
    const s = db();
    const g = group(v.groupId);
    const me = meOf(g)!;
    if (!v.amount || v.amount <= 0) throw new Error('請輸入金額');
    const mine = v.fromId === me.id || v.toId === me.id;
    if (mine && !v.accountId) throw new Error('請選擇帳戶');
    const row: SplitSettlement = {
      id: id('ss'), roundId: null, fromId: v.fromId, toId: v.toId, amount: v.amount, date: v.date, createdAt: new Date().toISOString(),
      accountId: mine ? v.accountId : null,
    };
    g.settlements.unshift(row);
    writeSettlementTx(s, g, row, v.time);
    return closeIfSettled(g, v.date);
  },
  async deleteSettlement(settlementId: string) {
    await pause();
    const s = db();
    const g = s.split.find((x) => x.settlements.some((st) => st.id === settlementId && !st.roundId));
    if (!g) throw new Error('找不到這筆還款，或已經結清不能刪除');
    g.settlements = g.settlements.filter((st) => st.id !== settlementId);
    s.txs = s.txs.filter((t) => t.splitSettlementId !== settlementId);
  },
  async reopenRound(roundId: string) {
    await pause();
    const g = db().split.find((x) => x.rounds.some((r) => r.id === roundId));
    if (!g) throw new Error('找不到這次結算');
    g.rounds = g.rounds.filter((r) => r.id !== roundId);
    g.expenses.forEach((e) => { if (e.roundId === roundId) e.roundId = null; });
    g.settlements.forEach((st) => { if (st.roundId === roundId) st.roundId = null; });
  },
};

// ---------- 分帳的示範資料與個人帳交易 ----------
function group(groupId: string) {
  const g = db().split.find((x) => x.id === groupId);
  if (!g) throw new Error('找不到這個群組');
  return g;
}

function friendsAccount(s: Store) {
  let a = s.accounts.find((x) => x.type === 'FRIENDS');
  if (!a) {
    a = { id: 'friends', name: '朋友往來', type: 'FRIENDS', openingBalance: 0, investmentSnapshot: null, lastReconciledAt: null };
    s.accounts.push(a);
  }
  return a.id;
}

/** 你先付：支出（你的部分）＋代墊轉到朋友往來；朋友先付：從朋友往來支出你的部分 */
function writeExpenseTxs(s: Store, g: SplitGroup, e: SplitExpense) {
  s.txs = s.txs.filter((t) => t.splitExpenseId !== e.id);
  const me = meOf(g)!;
  const mine = e.amounts[me.id] ?? 0;
  const base = { date: e.date, time: e.time, createdAt: e.createdAt, splitExpenseId: e.id, splitSettlementId: null, targetAccountId: null };
  if (e.payerId === me.id) {
    if (mine > 0) s.txs.push({ ...base, id: id('t'), type: 'EXPENSE', amount: mine, categoryId: e.categoryId, sourceAccountId: e.accountId!, note: e.title });
    if (e.amount > mine) {
      s.txs.push({
        ...base, id: id('t'), type: 'TRANSFER', amount: e.amount - mine, categoryId: 'transfer', sourceAccountId: e.accountId!,
        targetAccountId: friendsAccount(s), note: `代墊・${e.title}`,
      });
    }
  } else if (mine > 0) {
    s.txs.push({ ...base, id: id('t'), type: 'EXPENSE', amount: mine, categoryId: e.categoryId, sourceAccountId: friendsAccount(s), note: e.title });
  }
}

function writeSettlementTx(s: Store, g: SplitGroup, st: SplitSettlement, time: string | null) {
  const me = meOf(g)!;
  const name = (mid: string) => g.members.find((m) => m.id === mid)?.name ?? '';
  const base = {
    id: id('t'), date: st.date, time, type: 'TRANSFER' as const, amount: st.amount, categoryId: 'transfer', createdAt: st.createdAt,
    splitExpenseId: null, splitSettlementId: st.id,
  };
  if (st.toId === me.id) s.txs.push({ ...base, sourceAccountId: friendsAccount(s), targetAccountId: st.accountId!, note: `${name(st.fromId)} 還你` });
  else if (st.fromId === me.id) s.txs.push({ ...base, sourceAccountId: st.accountId!, targetAccountId: friendsAccount(s), note: `還給 ${name(st.toId)}` });
}

function closeIfSettled(g: SplitGroup, date: string) {
  if (!openExpenses(g).length || Object.values(balances(g)).some((v) => v !== 0)) return false;
  const roundId = id('r');
  g.rounds.unshift({ id: roundId, closedAt: date });
  g.expenses.forEach((e) => { if (!e.roundId) e.roundId = roundId; });
  g.settlements.forEach((st) => { if (!st.roundId) st.roundId = roundId; });
  return true;
}

type SeedOpts = { mode?: 'equal' | 'exact' | 'shares'; weights?: number[]; account?: string; roundId?: string };

/** 範例群組：一天 6 筆的出遊、每月結清的室友與午餐團、整個結清的烤肉 */
function seedSplit(day: (offset: number) => string): SplitGroup[] {
  const mk = (gid: string, name: string, kind: SplitKind, friends: string[], created: number): SplitGroup => ({
    id: gid, name, kind, createdAt: `${day(created)}T00:00:00Z`, expenses: [], settlements: [], rounds: [],
    members: [{ id: `${gid}-me`, name: '我', isMe: true }, ...friends.map((n, i) => ({ id: `${gid}-${i}`, name: n, isMe: false }))],
  });
  const mid = (g: SplitGroup, n: string) => g.members.find((m) => m.name === n)!.id;
  const ex = (g: SplitGroup, offset: number, time: string, title: string, categoryId: string, amount: number, payer: string, who: string[], opts: SeedOpts = {}) => {
    const mode = opts.mode ?? 'equal';
    const weights = Object.fromEntries(who.map((n, i) => [mid(g, n), opts.weights?.[i] ?? 1]));
    g.expenses.push({
      id: id('se'), roundId: opts.roundId ?? null, date: day(offset), time, title, categoryId, amount, payerId: mid(g, payer),
      accountId: payer === '我' ? opts.account ?? 'cathay' : null, mode, weights, amounts: splitAmounts(mode, amount, weights),
      createdAt: `${day(offset)}T${time}:00Z`,
    });
  };
  const st = (g: SplitGroup, from: string, to: string, amount: number, offset: number, roundId: string, account: string | null = null) => {
    g.settlements.push({
      id: id('ss'), roundId, fromId: mid(g, from), toId: mid(g, to), amount, accountId: account, date: day(offset), createdAt: `${day(offset)}T12:00:00Z`,
    });
  };

  const all = ['我', '小明', '小華', '阿美'];
  const trip = mk('g-trip', '週六陽明山', 'event', ['小明', '小華', '阿美'], 4);
  ex(trip, 4, '08:30', '早餐・永和豆漿', 'food', 360, '小明', all);
  ex(trip, 4, '09:40', '停車費', 'transit', 200, '我', all, { account: 'cash' });
  ex(trip, 4, '12:20', '午餐・野菜鍋', 'food', 1840, '我', all, { mode: 'exact', weights: [520, 480, 410, 430] });
  ex(trip, 4, '15:10', '擎天崗・咖啡', 'food', 480, '阿美', ['我', '小華', '阿美']);
  ex(trip, 4, '18:30', '晚餐・士林夜市', 'food', 1200, '小華', all);
  ex(trip, 4, '20:50', '計程車回家', 'transit', 380, '小明', ['我', '小明'], { mode: 'shares' });

  const room = mk('g-room', '室友', 'daily', ['阿凱'], 60);
  room.rounds.push({ id: 'r-room', closedAt: day(7) });
  ex(room, 35, '20:00', '上月電費', 'other', 1720, '我', ['我', '阿凱'], { account: 'esun', roundId: 'r-room' });
  ex(room, 23, '18:40', '衛生紙・垃圾袋', 'daily', 420, '阿凱', ['我', '阿凱'], { roundId: 'r-room' });
  st(room, '阿凱', '我', 650, 7, 'r-room', 'esun');
  ex(room, 6, '20:10', '這個月電費', 'other', 1860, '我', ['我', '阿凱'], { account: 'esun' });
  ex(room, 4, '19:30', '衛生紙・洗碗精', 'daily', 389, '阿凱', ['我', '阿凱']);
  ex(room, 2, '10:00', '網路費', 'other', 599, '我', ['我', '阿凱']);

  const team = ['我', 'Joy', 'Ken', 'Mia'];
  const lunch = mk('g-lunch', '公司午餐團', 'daily', ['Joy', 'Ken', 'Mia'], 40);
  lunch.rounds.push({ id: 'r-lunch', closedAt: day(7) });
  ex(lunch, 14, '12:10', '午餐・牛肉麵', 'food', 720, '我', team, { roundId: 'r-lunch' });
  ex(lunch, 11, '15:20', '下午茶・蛋糕', 'food', 400, 'Mia', team, { roundId: 'r-lunch' });
  st(lunch, 'Joy', '我', 280, 8, 'r-lunch', 'esun');
  st(lunch, 'Ken', '我', 160, 7, 'r-lunch', 'cash');
  st(lunch, 'Ken', 'Mia', 120, 7, 'r-lunch');
  ex(lunch, 1, '12:15', '午餐・便當', 'food', 480, 'Joy', team);
  ex(lunch, 0, '15:00', '下午茶・飲料', 'food', 200, 'Ken', team);

  const crew = ['我', '阿凱', '小美', 'Joy'];
  const bbq = mk('g-bbq', '中秋烤肉', 'event', ['阿凱', '小美', 'Joy'], 12);
  bbq.rounds.push({ id: 'r-bbq', closedAt: day(9) });
  ex(bbq, 11, '16:00', '烤肉食材', 'food', 2400, '我', crew, { roundId: 'r-bbq' });
  ex(bbq, 11, '17:30', '飲料・冰塊', 'food', 360, '小美', crew, { roundId: 'r-bbq' });
  st(bbq, '阿凱', '我', 690, 10, 'r-bbq', 'esun');
  st(bbq, 'Joy', '我', 690, 9, 'r-bbq', 'esun');
  st(bbq, '小美', '我', 330, 9, 'r-bbq', 'cash');

  return [trip, room, lunch, bbq];
}

/** 範例群組的花費與還款，也照正式版的規則寫進個人帳 */
function withSplitTransactions(s: Store): Store {
  for (const g of s.split) {
    for (const e of g.expenses) writeExpenseTxs(s, g, e);
    for (const st of g.settlements) writeSettlementTx(s, g, st, '12:00');
  }
  return s;
}
