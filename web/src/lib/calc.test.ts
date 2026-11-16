import { describe, expect, it } from 'vitest';
import { amountHint, amountOf, collapse, evaluate, formatExpression, hasOperator, isExpression, pressKey, type CalcKey } from './calc';

const type = (keys: CalcKey[], from = '') => keys.reduce(pressKey, from);

describe('金額算式：按鍵', () => {
  it('數字照順序接上去，刪除鍵一次刪一個字', () => {
    expect(type(['1', '2', '00'])).toBe('1200');
    expect(type(['1', '2', 'del'])).toBe('1');
    expect(type(['del'])).toBe('');
  });
  it('數字不能用 0 開頭，符號後面的數字也一樣', () => {
    expect(type(['0', '00', '5'])).toBe('5');
    expect(type(['5', '÷', '0', '00', '2'])).toBe('5÷2');
    expect(type(['7'], '0')).toBe('7');
  });
  it('一個數字最多 8 位，00 會超過就不接', () => {
    expect(type(['9'], '12345678')).toBe('12345678');
    expect(type(['00'], '1234567')).toBe('1234567');
    expect(type(['+', '1'], '12345678')).toBe('12345678+1');
  });
  it('還沒有數字不能按符號；連按兩個符號換成後面那個', () => {
    expect(type(['+'])).toBe('');
    expect(type(['5', '+', '×'])).toBe('5×');
  });
  it('小數點：一個數字一個、最多兩位小數，還沒打數字就按會補成 0.', () => {
    expect(type(['1', '.', '1', '.', '5'])).toBe('1.15');
    expect(type(['1', '.', '2', '5', '9'])).toBe('1.25');
    expect(type(['1', '.', '5', '00'])).toBe('1.5');
    expect(type(['.', '5'])).toBe('0.5');
    expect(type(['8', '×', '.', '0', '5'])).toBe('8×0.05');
    expect(type(['1', '.', '+', '2'])).toBe('1+2');
    expect(type(['.', '5'], '12345678')).toBe('12345678.5');
  });
  it('全部清除', () => {
    expect(type(['clear'], '1200+350')).toBe('');
  });
  it('算式太長就不再接', () => {
    const long = type(Array.from({ length: 30 }, (_, i): CalcKey => (i % 2 ? '+' : '1')), '12345678+1');
    expect(long.length).toBeLessThanOrEqual(40);
    expect(pressKey(long, '9').length).toBeLessThanOrEqual(40);
  });
});

describe('金額算式：計算', () => {
  it('先乘除後加減', () => {
    expect(evaluate('1200+350×2')).toBe(1900);
    expect(evaluate('100−20÷4')).toBe(95);
    expect(evaluate('2×3×4−4')).toBe(20);
  });
  it('小數可以算，結果四捨五入到整數（加一成服務費）', () => {
    expect(evaluate('1200×1.1')).toBe(1320);
    expect(evaluate('35×1.1')).toBe(39);
    expect(evaluate('880×1.1+0.5')).toBe(969);
    expect(evaluate('12.')).toBe(12);
    expect(evaluate('5÷0.')).toBeNull();
    expect(amountOf('0.4')).toBe(0);
  });
  it('除不盡四捨五入到整數', () => {
    expect(evaluate('1000÷3')).toBe(333);
    expect(evaluate('200÷3')).toBe(67);
  });
  it('最後多一個符號當作還沒打完', () => {
    expect(evaluate('120+')).toBe(120);
    expect(evaluate('120')).toBe(120);
  });
  it('空的、看不懂的、除以 0 回傳 null', () => {
    expect(evaluate('')).toBeNull();
    expect(evaluate('+5')).toBeNull();
    expect(evaluate('5÷0')).toBeNull();
    expect(evaluate('abc')).toBeNull();
  });
  it('可以記下的金額要大於 0、不超過 8 位數', () => {
    expect(amountOf('100−200')).toBe(0);
    expect(amountOf('100−100')).toBe(0);
    expect(amountOf('99999999×2')).toBe(0);
    expect(amountOf('')).toBe(0);
    expect(amountOf('12.5')).toBe(13);
    expect(amountOf('90+30')).toBe(120);
  });
});

describe('金額算式：提示與等於', () => {
  it('算出 0 或負數、金額太大時說明原因；可以記或還沒打完不提示', () => {
    expect(amountHint('100−200')).toBe('算出來要大於 0 才能記');
    expect(amountHint('100−100')).toBe('算出來要大於 0 才能記');
    expect(amountHint('99999999×2')).toBe('金額太大了，最多 8 位數');
    expect(amountHint('123456789012')).toBe('金額太大了，最多 8 位數');
    expect(amountHint('90+30')).toBe('');
    expect(amountHint('')).toBe('');
    expect(amountHint('0.4')).toBe('');
    expect(amountHint('5÷0.')).toBe('');
  });
  it('按 = 把可以記的算式收成結果，不能記的維持原樣', () => {
    expect(collapse('1200×1.1')).toBe('1320');
    expect(collapse('12.5')).toBe('13');
    expect(collapse('1200')).toBe('1200');
    expect(collapse('100−200')).toBe('100−200');
    expect(collapse('')).toBe('');
  });
});

describe('金額算式：顯示', () => {
  it('數字加千分位，符號前後留空隙', () => {
    expect(formatExpression('1200+350×2')).toBe('1,200 + 350 × 2');
    expect(formatExpression('1200+')).toBe('1,200 +');
    expect(formatExpression('')).toBe('');
    expect(formatExpression('1200×1.10')).toBe('1,200 × 1.10');
    expect(formatExpression('1200.')).toBe('1,200.');
  });
  it('有符號才算是算式', () => {
    expect(hasOperator('1200')).toBe(false);
    expect(hasOperator('1200+')).toBe(true);
    expect(isExpression('12.5')).toBe(true);
    expect(isExpression('1200')).toBe(false);
  });
});
