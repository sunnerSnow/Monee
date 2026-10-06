import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight, Banknote, Coins, Ellipsis, Gift, HeartPulse, ShoppingBag, ShoppingBasket, Ticket, TramFront, Utensils,
} from 'lucide-react';
import type { TransactionType } from './types';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: LucideIcon;
}

// Phase 1 先用固定分類；分類管理之後再做
export const CATEGORIES: Category[] = [
  { id: 'food', name: '餐飲', type: 'EXPENSE', icon: Utensils },
  { id: 'transit', name: '交通', type: 'EXPENSE', icon: TramFront },
  { id: 'daily', name: '日用', type: 'EXPENSE', icon: ShoppingBasket },
  { id: 'shopping', name: '購物', type: 'EXPENSE', icon: ShoppingBag },
  { id: 'fun', name: '娛樂', type: 'EXPENSE', icon: Ticket },
  { id: 'health', name: '醫療', type: 'EXPENSE', icon: HeartPulse },
  { id: 'other', name: '其他', type: 'EXPENSE', icon: Ellipsis },
  { id: 'salary', name: '薪資', type: 'INCOME', icon: Banknote },
  { id: 'bonus', name: '獎金', type: 'INCOME', icon: Gift },
  { id: 'investment_income', name: '投資收益', type: 'INCOME', icon: Coins },
  { id: 'income_other', name: '其他收入', type: 'INCOME', icon: Banknote },
  { id: 'transfer', name: '轉帳', type: 'TRANSFER', icon: ArrowLeftRight },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));
const fallback: Category = { id: 'other', name: '其他', type: 'EXPENSE', icon: Ellipsis };

export const getCategory = (id: string): Category => byId.get(id) ?? fallback;
export const categoriesFor = (type: TransactionType) => CATEGORIES.filter((c) => c.type === type);

/** 校準差額補記用的分類 */
export const RECONCILE_EXPENSE_CATEGORY = 'other';
export const RECONCILE_INCOME_CATEGORY = 'income_other';
