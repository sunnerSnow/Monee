import { describe, expect, it } from 'vitest';
import { NotATransactionError, draftInstruction, draftSchema, isISODate, parseDraftAccounts, sanitizeDraft, type DraftAccount } from './ai-draft';

const accounts: DraftAccount[] = [
  { id: 'cash', name: '現金', type: 'CASH' },
  { id: 'cathay', name: '國泰信用卡', type: 'CREDIT_CARD' },
  { id: 'esun', name: '玉山銀行', type: 'BANK' },
  { id: 'invest', name: '證券戶', type: 'INVESTMENT_MIRROR' },
];
const ctx = { accounts, today: '2026-10-07', source: 'voice' as const };
const base = {
  isTransaction: true, rawInput: '昨天晚餐火鍋 580 刷國泰', type: 'EXPENSE', amount: 580, categoryId: 'food',
  accountId: 'cathay', targetAccountId: 'none', date: '2026-10-06', note: '晚餐・火鍋', confidence: 0.92,
};

describe('sanitizeDraft', () => {
  it('合法的回傳原樣保留', () => {
    expect(sanitizeDraft(base, ctx)).toEqual({
      rawInput: '昨天晚餐火鍋 580 刷國泰', confidence: 0.92, suggestedType: 'EXPENSE', suggestedAmount: 580,
      suggestedCategoryId: 'food', suggestedAccountId: 'cathay', suggestedTargetAccountId: null,
      suggestedDate: '2026-10-06', suggestedNote: '晚餐・火鍋',
    });
  });

  it('不是記帳內容時丟出錯誤，訊息依來源不同', () => {
    expect(() => sanitizeDraft({ ...base, isTransaction: false }, ctx)).toThrow(NotATransactionError);
    expect(() => sanitizeDraft({ ...base, isTransaction: false }, { ...ctx, source: 'receipt' })).toThrow(/收據/);
  });

  it('金額取整數；沒有、負數或不是數字就是 0', () => {
    expect(sanitizeDraft({ ...base, amount: 259.6 }, ctx).suggestedAmount).toBe(260);
    expect(sanitizeDraft({ ...base, amount: -5 }, ctx).suggestedAmount).toBe(0);
    expect(sanitizeDraft({ ...base, amount: '260' }, ctx).suggestedAmount).toBe(0);
    expect(sanitizeDraft({ ...base, amount: 1e12 }, ctx).suggestedAmount).toBe(99_999_999);
  });

  it('分類要跟類型相符，不然用該類型的第一個分類', () => {
    expect(sanitizeDraft({ ...base, type: 'INCOME', categoryId: 'food' }, ctx).suggestedCategoryId).toBe('salary');
    expect(sanitizeDraft({ ...base, categoryId: 'made-up' }, ctx).suggestedCategoryId).toBe('food');
    expect(sanitizeDraft({ ...base, type: 'TRANSFER', categoryId: 'food' }, ctx).suggestedCategoryId).toBe('transfer');
    expect(sanitizeDraft({ ...base, type: 'WHATEVER' }, ctx).suggestedType).toBe('EXPENSE');
  });

  it('帳戶必須存在，投資帳戶不能當付款帳戶', () => {
    expect(sanitizeDraft({ ...base, accountId: 'none' }, ctx).suggestedAccountId).toBeNull();
    expect(sanitizeDraft({ ...base, accountId: 'ghost' }, ctx).suggestedAccountId).toBeNull();
    expect(sanitizeDraft({ ...base, accountId: 'invest' }, ctx).suggestedAccountId).toBeNull();
  });

  it('轉入帳戶只在轉帳時保留，且不能跟轉出帳戶相同', () => {
    const transfer = { ...base, type: 'TRANSFER', categoryId: 'transfer', accountId: 'esun' };
    expect(sanitizeDraft({ ...transfer, targetAccountId: 'invest' }, ctx).suggestedTargetAccountId).toBe('invest');
    expect(sanitizeDraft({ ...transfer, targetAccountId: 'esun' }, ctx).suggestedTargetAccountId).toBeNull();
    expect(sanitizeDraft({ ...base, targetAccountId: 'invest' }, ctx).suggestedTargetAccountId).toBeNull();
  });

  it('日期不合法或晚於今天就用今天', () => {
    expect(sanitizeDraft({ ...base, date: '2026-10-08' }, ctx).suggestedDate).toBe('2026-10-07');
    expect(sanitizeDraft({ ...base, date: '2026-02-30' }, ctx).suggestedDate).toBe('2026-10-07');
    expect(sanitizeDraft({ ...base, date: '115-10-06' }, ctx).suggestedDate).toBe('2026-10-07');
    expect(sanitizeDraft({ ...base, date: '2025-12-31' }, ctx).suggestedDate).toBe('2025-12-31');
  });

  it('信心值限制在 0～1，備註過長會截斷，壞掉的輸入也不會出錯', () => {
    expect(sanitizeDraft({ ...base, confidence: 3 }, ctx).confidence).toBe(1);
    expect(sanitizeDraft({ ...base, confidence: null }, ctx).confidence).toBe(0.5);
    expect(sanitizeDraft({ ...base, note: '很'.repeat(80) }, ctx).suggestedNote).toHaveLength(30);
    expect(sanitizeDraft(null, ctx)).toMatchObject({ suggestedAmount: 0, suggestedType: 'EXPENSE', suggestedDate: '2026-10-07' });
  });
});

describe('isISODate', () => {
  it('只接受真的存在的 YYYY-MM-DD', () => {
    expect(isISODate('2026-10-07')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2026-1-7')).toBe(false);
    expect(isISODate(20261007)).toBe(false);
  });
});

describe('parseDraftAccounts', () => {
  it('只留合法的帳戶與需要的欄位', () => {
    expect(parseDraftAccounts([
      { id: 'cash', name: ' 現金\n錢包 ', type: 'CASH', currentBalance: 999 },
      { id: 'x', name: '奇怪', type: 'CRYPTO' },
      null,
      'cash',
    ])).toEqual([{ id: 'cash', name: ' 現金 錢包 ', type: 'CASH' }]);
    expect(parseDraftAccounts({ id: 'cash' })).toEqual([]);
  });
});

describe('給 AI 的指示與格式', () => {
  it('列出帳戶與今天日期，帳戶 id 限定在 enum 裡', () => {
    const text = draftInstruction(accounts, '2026-10-07');
    expect(text).toContain('今天是 2026-10-07（週三');
    expect(text).toContain('cathay：國泰信用卡（信用卡）');
    const schema = draftSchema(accounts);
    expect(schema.properties.accountId.enum).toEqual(['cash', 'cathay', 'esun', 'invest', 'none']);
    expect(schema.properties.categoryId.enum).toContain('transfer');
  });

  it('還沒有帳戶時也能產生指示', () => {
    expect(draftInstruction([], '2026-10-07')).toContain('還沒有帳戶');
    expect(draftSchema([]).properties.accountId.enum).toEqual(['none']);
  });
});
