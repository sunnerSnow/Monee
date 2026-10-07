// 分帳的計算：分攤、淨額、建議還款。純函式，畫面、示範模式與測試共用。
// 資料庫的 split_balances 用同樣的規則算淨額（supabase/migrations/20261008000001_split.sql）。
import type { SplitExpense, SplitGroup, SplitMember, SplitMode, SplitSettlement } from './types';

const sumOf = (list: number[]) => list.reduce((s, v) => s + v, 0);

/**
 * 依權重分配整數金額；除不盡的零頭給小數最大的人（同分時排前面的人）。
 * weights 的順序就是「前面」的順序，請照群組成員的順序傳入。
 */
export function allocate(total: number, weights: Record<string, number>): Record<string, number> {
  const names = Object.keys(weights).filter((k) => weights[k] > 0);
  const W = sumOf(names.map((k) => weights[k]));
  if (!W || total <= 0) return Object.fromEntries(names.map((k) => [k, 0]));
  const raw = names.map((k) => (total * weights[k]) / W);
  const base = raw.map(Math.floor);
  const order = names.map((_, i) => i).sort((a, b) => raw[b] - base[b] - (raw[a] - base[a]) || a - b);
  // 零頭要先算好；在迴圈條件裡重算的話，加了第一個 $1 後零頭就變少，剩 $2 以上會少分
  const remainder = total - sumOf(base);
  for (let i = 0; i < remainder; i++) base[order[i % order.length]] += 1;
  return Object.fromEntries(names.map((k, i) => [k, base[i]]));
}

/** 每個人分到的金額：指定金額直接用輸入；平分、份數用 allocate */
export function splitAmounts(mode: SplitMode, total: number, weights: Record<string, number>): Record<string, number> {
  if (mode === 'exact') return Object.fromEntries(Object.entries(weights).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)]));
  return allocate(total, weights);
}

/** 表單檢查：沒問題回傳空字串 */
export function splitProblem(mode: SplitMode, total: number, weights: Record<string, number>): string {
  if (!total || total <= 0) return '請輸入金額';
  const people = Object.values(weights).filter((v) => v > 0).length;
  if (!people) return '至少選一個人分';
  if (mode === 'exact') {
    const diff = total - sumOf(Object.values(weights).filter((v) => v > 0));
    if (diff > 0) return `還有 $${diff.toLocaleString('en-US')} 沒分到`;
    if (diff < 0) return `多分了 $${(-diff).toLocaleString('en-US')}`;
  }
  return '';
}

export const openExpenses = (g: SplitGroup) => g.expenses.filter((e) => !e.roundId);
export const openSettlements = (g: SplitGroup) => g.settlements.filter((s) => !s.roundId);
export const meOf = (g: SplitGroup): SplitMember | undefined => g.members.find((m) => m.isMe);
export const memberName = (g: SplitGroup, id: string) => {
  const m = g.members.find((x) => x.id === id);
  return m ? (m.isMe ? '我' : m.name) : '已移除的成員';
};

/** 還沒結清的帳裡，每個成員的淨額：正數是別人欠他，負數是他欠別人 */
export function balances(g: SplitGroup): Record<string, number> {
  const net: Record<string, number> = Object.fromEntries(g.members.map((m) => [m.id, 0]));
  const add = (id: string, v: number) => { net[id] = (net[id] ?? 0) + v; };
  for (const e of openExpenses(g)) {
    add(e.payerId, e.amount);
    for (const [id, v] of Object.entries(e.amounts)) add(id, -v);
  }
  for (const s of openSettlements(g)) {
    add(s.fromId, s.amount);
    add(s.toId, -s.amount);
  }
  return net;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

/** 建議的還款方式：每次讓欠最多的人還給被欠最多的人，轉帳次數最少（最多 人數−1 筆） */
export function suggestTransfers(net: Record<string, number>): Transfer[] {
  const cred = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debt = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b.v - a.v);
    debt.sort((a, b) => b.v - a.v);
    const c = cred[0];
    const d = debt[0];
    const x = Math.min(c.v, d.v);
    out.push({ fromId: d.id, toId: c.id, amount: x });
    c.v -= x;
    d.v -= x;
    if (!c.v) cred.shift();
    if (!d.v) debt.shift();
  }
  return out;
}

/** 已結清：目前沒有未結清的花費，而且結算過（剛建好的空群組不算） */
export const isSettled = (g: SplitGroup) => !openExpenses(g).length && g.rounds.length > 0;

/** 剛建好、還沒記過任何花費的群組：不要顯示「已結清」 */
export const isEmptyGroup = (g: SplitGroup) => g.expenses.length === 0;

/** 你在這個群組的淨額 */
export const myNet = (g: SplitGroup) => {
  const me = meOf(g);
  return me ? balances(g)[me.id] ?? 0 : 0;
};

/** 所有群組加總：朋友欠你、你欠朋友 */
export function friendTotals(groups: SplitGroup[]) {
  let recv = 0;
  let pay = 0;
  for (const g of groups) {
    const v = myNet(g);
    if (v > 0) recv += v;
    else pay -= v;
  }
  return { recv, pay, net: recv - pay };
}

/** 你在這筆花費的部分 */
export const myShare = (g: SplitGroup, e: Pick<SplitExpense, 'amounts'>) => {
  const me = meOf(g);
  return me ? e.amounts[me.id] ?? 0 : 0;
};

/** 這個成員有沒有出現在任何花費或還款裡（包含已結清的）；有的話不能移除 */
export const memberInvolved = (g: SplitGroup, id: string) =>
  g.expenses.some((e) => e.payerId === id || (e.amounts[id] ?? 0) > 0)
  || g.settlements.some((s: SplitSettlement) => s.fromId === id || s.toId === id);

export const participantCount = (e: Pick<SplitExpense, 'amounts'>) => Object.values(e.amounts).filter((v) => v > 0).length;

export const modeText = (e: Pick<SplitExpense, 'amounts' | 'mode'>) => {
  const n = participantCount(e);
  return e.mode === 'exact' ? `${n} 人指定金額` : e.mode === 'shares' ? `${n} 人依份數分` : `${n} 人平分`;
};

/** 頭像字：中文名取最後一個字（小明→明、小華→華，比較分得出來），英文取第一個字母 */
export const initialOf = (name: string) => (/^[一-鿿]{2,}$/.test(name) ? name.slice(-1) : name.slice(0, 1).toUpperCase());

/** 記一筆「＋ 新群組」輸入的朋友名字：空白、逗號、頓號分開，去掉重複與「我」 */
export const parseMemberNames = (input: string) =>
  [...new Set(input.split(/[\s,，、]+/).map((n) => n.trim()).filter((n) => n && n !== '我'))].map((n) => n.slice(0, 12)).slice(0, 20);
