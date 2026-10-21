import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight, Baby, Banknote, Bike, BookOpen, Briefcase, Building2, Bus, Cake, Car, Coffee, Coins, Droplets, Dumbbell, Ellipsis,
  Fuel, Gamepad2, Gem, Gift, GraduationCap, Hammer, HandHeart, HeartPulse, House, Music, Palette, PawPrint, PiggyBank, Pill, Plane,
  Popcorn, Receipt, Scissors, Shield, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Sparkles, Sprout, Ticket, TramFront, TrendingUp,
  Utensils, Wifi, Wine, Zap,
} from 'lucide-react';
import { create } from 'zustand';
import type { TransactionType } from './types';

/** 可以管理的分類類型；轉帳固定只有一個 */
export type ManagedType = 'EXPENSE' | 'INCOME';

/** 分類可以選的圖示，key 存進資料庫 */
export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, coffee: Coffee, wine: Wine, cake: Cake,
  'tram-front': TramFront, bus: Bus, car: Car, fuel: Fuel, bike: Bike, plane: Plane,
  'shopping-basket': ShoppingBasket, 'shopping-bag': ShoppingBag, shirt: Shirt, gem: Gem,
  house: House, zap: Zap, droplets: Droplets, wifi: Wifi, smartphone: Smartphone, hammer: Hammer,
  ticket: Ticket, popcorn: Popcorn, 'gamepad-2': Gamepad2, music: Music, dumbbell: Dumbbell, palette: Palette,
  'heart-pulse': HeartPulse, pill: Pill, shield: Shield, scissors: Scissors, sparkles: Sparkles,
  'paw-print': PawPrint, baby: Baby, 'graduation-cap': GraduationCap, 'book-open': BookOpen, 'hand-heart': HandHeart, sprout: Sprout,
  gift: Gift, receipt: Receipt, banknote: Banknote, coins: Coins, 'piggy-bank': PiggyBank, briefcase: Briefcase,
  'building-2': Building2, 'trending-up': TrendingUp, ellipsis: Ellipsis,
};

/** 選圖示時唸給螢幕閱讀器的名字 */
export const ICON_LABELS: Record<string, string> = {
  utensils: '餐具', coffee: '咖啡', wine: '酒杯', cake: '蛋糕',
  'tram-front': '電車', bus: '公車', car: '汽車', fuel: '加油', bike: '腳踏車', plane: '飛機',
  'shopping-basket': '購物籃', 'shopping-bag': '購物袋', shirt: '衣服', gem: '寶石',
  house: '房子', zap: '電', droplets: '水', wifi: '網路', smartphone: '手機', hammer: '修繕',
  ticket: '票券', popcorn: '爆米花', 'gamepad-2': '遊戲', music: '音樂', dumbbell: '運動', palette: '畫畫',
  'heart-pulse': '醫療', pill: '藥', shield: '保險', scissors: '美髮', sparkles: '閃亮',
  'paw-print': '寵物', baby: '小孩', 'graduation-cap': '學費', 'book-open': '書', 'hand-heart': '孝親', sprout: '植物',
  gift: '禮物', receipt: '收據', banknote: '鈔票', coins: '硬幣', 'piggy-bank': '存錢', briefcase: '工作',
  'building-2': '房租', 'trending-up': '投資', ellipsis: '其他',
};

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: LucideIcon;
  /** ICONS 的 key */
  iconKey: string;
  /** 記一筆時不出現；以前的帳照樣保留、照樣算進報表 */
  hidden: boolean;
  /** 內建的只能改名、換圖示、隱藏，不能刪 */
  builtIn: boolean;
}

/** 資料庫 categories 的一列：改過的內建分類，或自己加的分類 */
export interface CategoryRow {
  id: string;
  type: ManagedType;
  name: string;
  icon: string;
  sortOrder: number;
  hidden: boolean;
}

export const MAX_CATEGORY_NAME = 10;

const builtIn = (id: string, name: string, type: ManagedType, iconKey: string): Category =>
  ({ id, name, type, icon: ICONS[iconKey], iconKey, hidden: false, builtIn: true });

/** 內建分類（沒改過時的名字、圖示、順序） */
export const BUILT_IN: Category[] = [
  builtIn('food', '餐飲', 'EXPENSE', 'utensils'),
  builtIn('transit', '交通', 'EXPENSE', 'tram-front'),
  builtIn('daily', '日用', 'EXPENSE', 'shopping-basket'),
  builtIn('shopping', '購物', 'EXPENSE', 'shopping-bag'),
  builtIn('fun', '娛樂', 'EXPENSE', 'ticket'),
  builtIn('health', '醫療', 'EXPENSE', 'heart-pulse'),
  builtIn('other', '其他', 'EXPENSE', 'ellipsis'),
  builtIn('salary', '薪資', 'INCOME', 'banknote'),
  builtIn('bonus', '獎金', 'INCOME', 'gift'),
  builtIn('investment_income', '投資收益', 'INCOME', 'coins'),
  builtIn('income_other', '其他收入', 'INCOME', 'banknote'),
];
const TRANSFER: Category = { id: 'transfer', name: '轉帳', type: 'TRANSFER', icon: ArrowLeftRight, iconKey: 'arrow-left-right', hidden: false, builtIn: true };

/**
 * 內建分類加上使用者的設定：表裡有的照表裡的名字、圖示、順序；
 * 表裡沒有的內建分類（沒改過，或程式之後才新增的）接在那一類的最後面。轉帳固定放最後。
 */
export function mergeCategories(rows: CategoryRow[]): Category[] {
  const builtIns = new Map(BUILT_IN.map((c) => [c.id, c]));
  const out: Category[] = [];
  for (const type of ['EXPENSE', 'INCOME'] as const) {
    const seen = new Set<string>();
    const stored = rows
      // 內建分類的類型不能改，照內建的算
      .filter((r) => r.id !== TRANSFER.id && (builtIns.get(r.id)?.type ?? r.type) === type)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    for (const r of stored) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const base = builtIns.get(r.id);
      const iconKey = ICONS[r.icon] ? r.icon : base?.iconKey ?? 'ellipsis';
      out.push({ id: r.id, name: r.name.trim() || base?.name || '未命名', type, icon: ICONS[iconKey], iconKey, hidden: r.hidden, builtIn: Boolean(base) });
    }
    out.push(...BUILT_IN.filter((c) => c.type === type && !seen.has(c.id)));
  }
  out.push(TRANSFER);
  return out;
}

/** 某一類（支出或收入）的整份清單，照現在的順序存成資料列 */
export const toRows = (list: Category[], type: ManagedType): CategoryRow[] =>
  list.filter((c) => c.type === type).map((c, i) => ({ id: c.id, type, name: c.name, icon: c.iconKey, sortOrder: i, hidden: c.hidden }));

/** 自己加的分類的 id：c_ 加 10 個隨機字 */
export const newCategoryId = () => `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;

// ---------- 目前使用者的分類 ----------
// 登入後由 AppShell 讀資料庫放進來（分享頁放的是群組擁有者的）；元件用 useCategories() 訂閱，分類改了會重畫

const useCategoryStore = create<{ list: Category[] }>(() => ({ list: mergeCategories([]) }));

export const setCategoryRows = (rows: CategoryRow[]) => useCategoryStore.setState({ list: mergeCategories(rows) });

/** 目前的全部分類（含隱藏的、含轉帳），照使用者排的順序；元件裡用它，分類改了才會重畫 */
export const useCategories = () => useCategoryStore((s) => s.list);
export const allCategories = () => useCategoryStore.getState().list;

const indexes = new WeakMap<Category[], Map<string, Category>>();
function indexOf(list: Category[]) {
  let map = indexes.get(list);
  if (!map) {
    map = new Map(list.map((c) => [c.id, c]));
    indexes.set(list, map);
  }
  return map;
}

/** 找不到（例如在別的裝置刪掉的分類）就當成「其他」 */
export function getCategory(id: string): Category {
  const map = indexOf(allCategories());
  return map.get(id) ?? map.get('other') ?? BUILT_IN[6];
}

/** 記一筆可以選的分類：沒隱藏的，照使用者排的順序；keep 是目前選的分類，隱藏了也列出來（編輯舊的帳時） */
export const categoriesFor = (type: TransactionType, keep?: string) =>
  allCategories().filter((c) => c.type === type && (!c.hidden || c.id === keep));

/** 新的一筆預設選第一個沒隱藏的分類 */
export const defaultCategory = (type: ManagedType) => categoriesFor(type)[0]?.id ?? (type === 'INCOME' ? 'income_other' : 'other');

/** 校準差額補記用的分類 */
export const RECONCILE_EXPENSE_CATEGORY = 'other';
export const RECONCILE_INCOME_CATEGORY = 'income_other';
