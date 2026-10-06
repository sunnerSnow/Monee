import type { Transaction } from './types';

export const MASK = '$ ••••';

/** $1,234（取絕對值、四捨五入到整數） */
export const formatMoney = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** 隱藏模式下回傳 $ •••• */
export const money = (n: number, hidden: boolean) => (hidden ? MASK : formatMoney(n));

/** 負數加上 −（U+2212），用在信用卡、負債 */
export const signedBalance = (n: number, hidden: boolean) =>
  hidden ? MASK : `${n < 0 ? '−' : ''}${formatMoney(n)}`;

/** 交易金額：收入 +、支出 −、轉帳不加符號 */
export const transactionAmount = (t: Pick<Transaction, 'type' | 'amount'>, hidden: boolean) => {
  if (hidden) return MASK;
  const sign = t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '−' : '';
  return `${sign}${formatMoney(t.amount)}`;
};

/** 大金額拆成符號與數字，讓 $ 可以縮小成上標 */
export const splitMoney = (n: number, hidden: boolean) => ({
  sign: !hidden && n < 0 ? '−' : '',
  digits: hidden ? '••••' : Math.abs(Math.round(n)).toLocaleString('en-US'),
});

/** 只留數字，給鍵盤與輸入框使用 */
export const parseAmount = (input: string) => {
  const digits = input.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};
