import { describe, expect, it } from 'vitest';
import {
  allocate, balances, friendTotals, initialOf, isSettled, memberInvolved, myNet, myShare, parseMemberNames, splitAmounts,
  splitProblem, suggestTransfers,
} from './split';
import type { SplitExpense, SplitGroup } from './types';

const members = [
  { id: 'me', name: '我', isMe: true },
  { id: 'ming', name: '小明', isMe: false },
  { id: 'hua', name: '小華', isMe: false },
  { id: 'mei', name: '阿美', isMe: false },
];
let n = 0;
const ex = (payerId: string, amount: number, amounts: Record<string, number>, roundId: string | null = null): SplitExpense => ({
  id: `e${++n}`, roundId, date: '2026-10-03', time: null, title: 't', categoryId: 'food', amount, payerId,
  accountId: payerId === 'me' ? 'cathay' : null, mode: 'exact', weights: amounts, amounts, createdAt: '',
});
const all = (v: number) => ({ me: v, ming: v, hua: v, mei: v });
// 原型的週六陽明山：6 筆、4 個人輪流先付
const trip = (): SplitGroup => ({
  id: 'g', name: '週六陽明山', kind: 'event', createdAt: '', members, settlements: [], rounds: [],
  expenses: [
    ex('ming', 360, all(90)),
    ex('me', 200, all(50)),
    ex('me', 1840, { me: 520, ming: 480, hua: 410, mei: 430 }),
    ex('mei', 480, { me: 160, hua: 160, mei: 160 }),
    ex('hua', 1200, all(300)),
    ex('ming', 380, { me: 190, ming: 190 }),
  ],
});

describe('allocate / splitAmounts', () => {
  it('平分除不盡時，零頭給前面的人', () => {
    expect(allocate(389, { me: 1, kai: 1 })).toEqual({ me: 195, kai: 194 });
    expect(allocate(100, { a: 1, b: 1, c: 1 })).toEqual({ a: 34, b: 33, c: 33 });
  });
  it('零頭超過 $1 時，前面幾個人各多付 $1，加總剛好等於總額', () => {
    expect(allocate(2000, { a: 1, b: 1, c: 1 })).toEqual({ a: 667, b: 667, c: 666 });
    expect(allocate(10, { a: 1, b: 1, c: 1, d: 1 })).toEqual({ a: 3, b: 3, c: 2, d: 2 });
    for (const total of [1, 7, 99, 1001, 2000, 12345]) {
      for (let n = 1; n <= 7; n++) {
        const r = allocate(total, Object.fromEntries(Array.from({ length: n }, (_, i) => [`m${i}`, 1 + (i % 3)])));
        expect(Object.values(r).reduce((s, v) => s + v, 0)).toBe(total);
      }
    }
  });
  it('份數：點兩杯的人付兩份，加總一定等於總額', () => {
    const r = allocate(600, { me: 1, ming: 1, hua: 2, mei: 1 });
    expect(r).toEqual({ me: 120, ming: 120, hua: 240, mei: 120 });
    const odd = allocate(1001, { a: 3, b: 2, c: 2 });
    expect(Object.values(odd).reduce((s, v) => s + v, 0)).toBe(1001);
  });
  it('權重 0 的人不分；指定金額直接照輸入', () => {
    expect(allocate(300, { a: 1, b: 0, c: 1 })).toEqual({ a: 150, c: 150 });
    expect(splitAmounts('exact', 1000, { a: 600, b: 0, c: 400 })).toEqual({ a: 600, c: 400 });
  });
});

describe('splitProblem', () => {
  it('檢查金額、人數與指定金額的加總', () => {
    expect(splitProblem('equal', 0, { a: 1 })).toBe('請輸入金額');
    expect(splitProblem('equal', 100, { a: 0 })).toBe('至少選一個人分');
    expect(splitProblem('exact', 1000, { a: 400, b: 450 })).toBe('還有 $150 沒分到');
    expect(splitProblem('exact', 1000, { a: 600, b: 450 })).toBe('多分了 $50');
    expect(splitProblem('exact', 1000, { a: 600, b: 400 })).toBe('');
  });
});

describe('balances / suggestTransfers', () => {
  it('一天 6 筆輪流付，算出每個人的淨額', () => {
    expect(balances(trip())).toEqual({ me: 730, ming: -370, hua: 190, mei: -550 });
  });
  it('最少 3 筆轉帳就能結清', () => {
    expect(suggestTransfers(balances(trip()))).toEqual([
      { fromId: 'mei', toId: 'me', amount: 550 },
      { fromId: 'ming', toId: 'hua', amount: 190 },
      { fromId: 'ming', toId: 'me', amount: 180 },
    ]);
  });
  it('還款會抵掉欠款；已結清的花費與還款不算', () => {
    const g = trip();
    g.settlements = [{ id: 's1', roundId: null, fromId: 'mei', toId: 'me', amount: 550, accountId: 'esun', date: '2026-10-07', createdAt: '' }];
    g.expenses.push(ex('me', 9999, { ming: 9999 }, 'r-old'));
    expect(balances(g)).toEqual({ me: 180, ming: -370, hua: 190, mei: 0 });
    expect(myNet(g)).toBe(180);
  });
});

describe('群組狀態', () => {
  it('沒有未結清的花費且結算過才算已結清；剛建好的空群組不算', () => {
    const g = trip();
    expect(isSettled(g)).toBe(false);
    g.expenses = g.expenses.map((e) => ({ ...e, roundId: 'r1' }));
    g.rounds = [{ id: 'r1', closedAt: '2026-10-07' }];
    expect(isSettled(g)).toBe(true);
    expect(isSettled({ ...g, expenses: [], rounds: [] })).toBe(false);
  });
  it('朋友往來加總、你的部分、成員是否有紀錄', () => {
    const owe = { ...trip(), id: 'g2', expenses: [ex('ming', 400, { me: 200, ming: 200 })] };
    expect(friendTotals([trip(), owe])).toEqual({ recv: 730, pay: 200, net: 530 });
    expect(myShare(trip(), trip().expenses[2])).toBe(520);
    expect(memberInvolved(trip(), 'mei')).toBe(true);
    expect(memberInvolved({ ...trip(), members: [...members, { id: 'new', name: '胖虎', isMe: false }] }, 'new')).toBe(false);
  });
});

describe('小工具', () => {
  it('頭像字與朋友名字解析', () => {
    expect(initialOf('小明')).toBe('明');
    expect(initialOf('joy')).toBe('J');
    expect(initialOf('我')).toBe('我');
    expect(parseMemberNames('阿凱, 小美 阿凱、我，Joy')).toEqual(['阿凱', '小美', 'Joy']);
  });
});
