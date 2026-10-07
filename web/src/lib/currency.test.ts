import { describe, expect, it } from 'vitest';
import { SAMPLE_RATES, cleanAmountInput, formatForeign, getCurrency, isForeign, toMinor, toTwd, twdPerUnit } from './currency';

describe('幣別顯示與輸入', () => {
  it('原幣金額：整數不顯示小數，有小數的幣別顯示兩位', () => {
    expect(formatForeign(3000, 'JPY')).toBe('¥3,000');
    expect(formatForeign(12.5, 'USD')).toBe('US$12.50');
    expect(formatForeign(12, 'USD')).toBe('US$12');
    expect(formatForeign(90000, 'KRW')).toBe('₩90,000');
    expect(getCurrency('XYZ').name).toBe('XYZ');
    expect(isForeign('TWD')).toBe(false);
    expect(isForeign('JPY')).toBe(true);
  });
  it('輸入框：日圓只收整數，美元可以一個小數點兩位小數', () => {
    expect(cleanAmountInput('3,000円', 0)).toBe('3000');
    expect(cleanAmountInput('12.345', 2)).toBe('12.34');
    expect(cleanAmountInput('1.2.3', 2)).toBe('1.23');
    expect(cleanAmountInput('12.', 2)).toBe('12.');
  });
});

describe('匯率換算', () => {
  it('1 台幣換多少外幣 → 1 單位外幣多少台幣；換成台幣取整數', () => {
    const jpy = twdPerUnit(SAMPLE_RATES, 'JPY')!;
    expect(jpy).toBeCloseTo(0.201207, 6);
    expect(toTwd(3000, jpy)).toBe(604);
    expect(twdPerUnit(SAMPLE_RATES, 'TWD')).toBe(1);
    expect(twdPerUnit(undefined, 'JPY')).toBeNull();
    expect(twdPerUnit({ updatedAt: '', perTwd: {} }, 'EUR')).toBeNull();
  });
  it('最小單位：避免小數誤差', () => {
    expect(toMinor(12.34, 2)).toBe(1234);
    expect(toMinor(0.1 + 0.2, 2)).toBe(30);
    expect(toMinor(3000, 0)).toBe(3000);
  });
});
