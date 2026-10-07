import { describe, expect, it } from 'vitest';
import {
  NotATransactionError, draftInstruction, draftSchema, isISODate, parseDraftAccounts, parseDraftContext, sanitizeDraft, type DraftAccount,
} from './ai-draft';

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
      rawInput: '昨天晚餐火鍋 580 刷國泰', confidence: 0.92, suggestedType: 'EXPENSE', suggestedAmount: 580, suggestedCurrency: 'TWD',
      suggestedCategoryId: 'food', suggestedAccountId: 'cathay', suggestedTargetAccountId: null,
      suggestedDate: '2026-10-06', suggestedNote: '晚餐・火鍋', suggestedPayer: null,
    });
  });

  it('幣別：認得的就用，金額照幣別保留小數；沒有或亂填用群組幣別，一般記帳用台幣', () => {
    expect(sanitizeDraft({ ...base, currency: 'JPY', amount: 3000.4 }, ctx)).toMatchObject({ suggestedCurrency: 'JPY', suggestedAmount: 3000 });
    expect(sanitizeDraft({ ...base, currency: 'USD', amount: 12.506 }, ctx)).toMatchObject({ suggestedCurrency: 'USD', suggestedAmount: 12.51 });
    expect(sanitizeDraft({ ...base, currency: 'XYZ' }, ctx).suggestedCurrency).toBe('TWD');
    expect(sanitizeDraft({ ...base, currency: undefined }, { ...ctx, context: { members: [], currency: 'KRW' } }).suggestedCurrency).toBe('KRW');
  });

  it('分帳：一律是支出，付款人只能是「我」或群組成員', () => {
    const split = { ...ctx, context: { members: ['小明', '阿凱'], currency: 'JPY' } };
    expect(sanitizeDraft({ ...base, payer: '小明' }, split)).toMatchObject({ suggestedPayer: '小明', suggestedType: 'EXPENSE' });
    expect(sanitizeDraft({ ...base, payer: '我' }, split).suggestedPayer).toBe('我');
    expect(sanitizeDraft({ ...base, payer: '胖虎' }, split).suggestedPayer).toBeNull();
    expect(sanitizeDraft({ ...base, payer: 'none' }, split).suggestedPayer).toBeNull();
    expect(sanitizeDraft({ ...base, type: 'INCOME', categoryId: 'salary' }, split)).toMatchObject({ suggestedType: 'EXPENSE', suggestedCategoryId: 'food' });
    // 一般記帳不看付款人
    expect(sanitizeDraft({ ...base, payer: '小明' }, ctx).suggestedPayer).toBeNull();
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

  it('一般記帳：沒提到幣別是台幣，沒有付款人欄位', () => {
    expect(draftInstruction(accounts, '2026-10-07')).toContain('沒提到幣別時，金額是新台幣（TWD）');
    const schema = draftSchema(accounts);
    expect(schema.properties.currency.enum).toContain('JPY');
    expect(schema.properties).not.toHaveProperty('payer');
    expect(schema.required).not.toContain('payer');
  });

  it('旅程分帳：沒提到幣別用當地貨幣，付款人限定成員', () => {
    const context = { members: ['小明', '阿凱'], currency: 'JPY' };
    const text = draftInstruction(accounts, '2026-10-07', context);
    expect(text).toContain('沒提到幣別時，金額是日圓（JPY）');
    expect(text).toContain('旅程（當地貨幣是 日圓 JPY）跟朋友分帳的花費');
    expect(text).toContain('成員：我、小明、阿凱');
    const schema = draftSchema(accounts, context);
    expect(schema.properties).toHaveProperty('payer.enum', ['我', '小明', '阿凱', 'none']);
    expect(schema.required).toContain('payer');
    // 一個人的旅程不用問誰付的
    expect(draftInstruction(accounts, '2026-10-07', { members: [], currency: 'JPY' })).not.toContain('payer');
    expect(draftSchema(accounts, { members: [], currency: 'JPY' }).properties).not.toHaveProperty('payer');
  });
});

describe('parseDraftContext', () => {
  it('成員名字去重、去掉「我」，幣別不支援就用台幣', () => {
    expect(parseDraftContext({ members: [' 小明 ', '小明', '我', 'none', 3, ''], currency: 'JPY' })).toEqual({ members: ['小明'], currency: 'JPY' });
    expect(parseDraftContext({ members: 'x', currency: 'BTC' })).toEqual({ members: [], currency: 'TWD' });
    expect(parseDraftContext(null)).toBeUndefined();
    expect(parseDraftContext(['小明'])).toBeUndefined();
  });
});
