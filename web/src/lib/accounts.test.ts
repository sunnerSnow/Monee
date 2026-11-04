import { describe, expect, it } from 'vitest';
import { activeAccounts, archiveBlocker, balanceAfter, deleteBlocker, rulesUsing, selectable } from './accounts';
import type { RecurringRule } from './recurring';
import type { Account } from './types';

const account = (p: Partial<Account>): Account => ({
  id: 'a', name: 'A', type: 'BANK', currency: 'TWD', currentBalance: 0, openingBalance: 0,
  icon: null, investmentSnapshot: null, lastReconciledAt: null, archived: false, ...p,
});

const rule = (p: Partial<RecurringRule>): RecurringRule => ({
  id: 'r', type: 'EXPENSE', amount: 100, categoryId: 'fun', sourceAccountId: 'x', targetAccountId: null, note: null,
  frequency: 'monthly', day: 1, month: null, auto: true, nextDate: '2026-12-01', paused: false, ...p,
});

describe('可以選的帳戶', () => {
  const list = [account({ id: 'a' }), account({ id: 'b', archived: true }), account({ id: 'c' })];

  it('封存的不列', () => {
    expect(activeAccounts(list).map((a) => a.id)).toEqual(['a', 'c']);
    expect(selectable(list).map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('正在編輯的那筆原本用的帳戶，封存了也照樣列出來', () => {
    expect(selectable(list, ['b', null, undefined]).map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('balanceAfter', () => {
  it('期初餘額差多少，目前餘額就差多少', () => {
    expect(balanceAfter({ currentBalance: 12000, openingBalance: 10000 }, 15000)).toBe(17000);
    // 信用卡是負的：建立時的待繳從 3,000 改成 5,000
    expect(balanceAfter({ currentBalance: -4200, openingBalance: -3000 }, -5000)).toBe(-6200);
  });
});

describe('archiveBlocker', () => {
  it('餘額是 0、沒有固定收支用它才能封存', () => {
    expect(archiveBlocker(account({}), [])).toBeNull();
    expect(archiveBlocker(account({ currentBalance: 0.2 }), [])).toBeNull();
  });

  it('還有餘額或待繳', () => {
    expect(archiveBlocker(account({ currentBalance: 1500 }), [])).toBe('餘額還有 $1,500，先轉到別的帳戶或校準成 0 再封存');
    expect(archiveBlocker(account({ type: 'CREDIT_CARD', currentBalance: -320 }), [])).toBe('還有待繳 $320，先轉到別的帳戶或校準成 0 再封存');
  });

  it('有固定收支用它（轉出、轉入、暫停的都算）', () => {
    const rules = [rule({ sourceAccountId: 'a' }), rule({ targetAccountId: 'a', sourceAccountId: 'z' }), rule({ sourceAccountId: 'a', paused: true }), rule({})];
    expect(rulesUsing(rules, 'a')).toHaveLength(3);
    expect(archiveBlocker(account({}), rules)).toBe('有 3 筆固定收支用這個帳戶，先改成別的帳戶再封存');
  });

  it('朋友往來不能封存', () => {
    expect(archiveBlocker(account({ type: 'FRIENDS' }), [])).toBe('朋友往來由分帳管理，不能封存');
  });
});

describe('deleteBlocker', () => {
  it('沒有任何紀錄才能刪', () => {
    expect(deleteBlocker(account({}), { transactions: 0, splits: 0 })).toBeNull();
    expect(deleteBlocker(account({}), { transactions: 3, splits: 1 })).toBe('這個帳戶有 4 筆紀錄，刪掉帳會對不起來；不用了可以封存');
    expect(deleteBlocker(account({ type: 'FRIENDS' }), { transactions: 0, splits: 0 })).toBe('朋友往來由分帳管理，不能刪除');
  });
});
