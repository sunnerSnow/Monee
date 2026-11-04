// 帳戶管理：記帳時可以選哪些帳戶、改期初餘額後的餘額、封存和刪除前要先處理什麼（純函式，有測試）。
// 封存的帳戶照樣讀進來，舊帳上的帳戶名稱才不會不見；只有要選帳戶的地方把它濾掉。
import { formatMoney } from './money';
import type { RecurringRule } from './recurring';
import type { Account } from './types';

export const MAX_ACCOUNT_NAME = 40;

/** 還在用的帳戶（淨資產、資產頁的清單） */
export const activeAccounts = (accounts: Account[]) => accounts.filter((a) => !a.archived);

/** 記帳、分帳、固定收支可以選的帳戶：封存的不列；keep 是正在編輯的那筆原本用的帳戶，封存了也照樣列出來 */
export const selectable = (accounts: Account[], keep: (string | null | undefined)[] = []) =>
  accounts.filter((a) => !a.archived || keep.includes(a.id));

/** 改期初餘額後的目前餘額：交易不變，差多少就跟著差多少 */
export const balanceAfter = (a: Pick<Account, 'currentBalance' | 'openingBalance'>, opening: number) =>
  a.currentBalance + opening - a.openingBalance;

/** 用到這個帳戶的固定收支（暫停的也算：恢復後還是會記到這個帳戶） */
export const rulesUsing = (rules: RecurringRule[], accountId: string) =>
  rules.filter((r) => r.sourceAccountId === accountId || r.targetAccountId === accountId);

/** 封存前要先處理的事；可以封存是 null。餘額不是 0 的帳戶收起來，淨資產就對不上了 */
export function archiveBlocker(a: Account, rules: RecurringRule[]): string | null {
  if (a.type === 'FRIENDS') return '朋友往來由分帳管理，不能封存';
  if (Math.round(a.currentBalance) !== 0) {
    return `${a.type === 'CREDIT_CARD' ? '還有待繳' : '餘額還有'} ${formatMoney(a.currentBalance)}，先轉到別的帳戶或校準成 0 再封存`;
  }
  const n = rulesUsing(rules, a.id).length;
  if (n) return `有 ${n} 筆固定收支用這個帳戶，先改成別的帳戶再封存`;
  return null;
}

export interface AccountUsage {
  /** 用到這個帳戶的交易（轉出或轉入） */
  transactions: number;
  /** 分帳的花費、還款記在這個帳戶 */
  splits: number;
}

/** 刪除前要先處理的事；可以刪是 null。有帳的帳戶刪掉帳會對不起來，資料庫本來也擋 */
export function deleteBlocker(a: Account, u: AccountUsage): string | null {
  if (a.type === 'FRIENDS') return '朋友往來由分帳管理，不能刪除';
  const n = u.transactions + u.splits;
  if (n) return `這個帳戶有 ${n} 筆紀錄，刪掉帳會對不起來；不用了可以封存`;
  return null;
}
