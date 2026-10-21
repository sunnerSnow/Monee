import type { AccountType } from './types';

/** 帳戶類型的圖示底色（tokens.css 的角色色），圖示一律墨色 */
export const ACCOUNT_COLORS: Record<AccountType, string> = {
  CASH: 'var(--green)',
  BANK: 'var(--blue)',
  CREDIT_CARD: 'var(--purple)',
  INVESTMENT_MIRROR: 'var(--orange)',
  FRIENDS: 'var(--pink)',
};
