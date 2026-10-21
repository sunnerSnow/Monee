import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILT_IN, categoriesFor, defaultCategory, getCategory, mergeCategories, setCategoryRows, toRows, type CategoryRow,
} from './categories';

const row = (p: Partial<CategoryRow> & Pick<CategoryRow, 'id'>): CategoryRow => ({ type: 'EXPENSE', name: '名字', icon: 'utensils', sortOrder: 0, hidden: false, ...p });
const ids = (type: string, rows: CategoryRow[]) => mergeCategories(rows).filter((c) => c.type === type).map((c) => c.id);

afterEach(() => setCategoryRows([]));

describe('mergeCategories', () => {
  it('沒改過就是內建分類，轉帳放最後', () => {
    const list = mergeCategories([]);
    expect(list.map((c) => c.id)).toEqual([...BUILT_IN.map((c) => c.id), 'transfer']);
    expect(list.every((c) => c.builtIn && !c.hidden)).toBe(true);
  });

  it('表裡的照表裡的順序，沒存過的內建分類接在後面', () => {
    const rows = [row({ id: 'c_pet', name: '寵物', icon: 'paw-print', sortOrder: 0 }), row({ id: 'transit', name: '交通', icon: 'tram-front', sortOrder: 1 })];
    expect(ids('EXPENSE', rows)).toEqual(['c_pet', 'transit', 'food', 'daily', 'shopping', 'fun', 'health', 'other']);
  });

  it('改名、換圖示、隱藏；自己加的不是內建', () => {
    const list = mergeCategories([
      row({ id: 'daily', name: '生活用品', icon: 'house', hidden: true }),
      row({ id: 'c_pet', name: '寵物', icon: 'paw-print', sortOrder: 1 }),
    ]);
    expect(list.find((c) => c.id === 'daily')).toMatchObject({ name: '生活用品', iconKey: 'house', hidden: true, builtIn: true });
    expect(list.find((c) => c.id === 'c_pet')).toMatchObject({ name: '寵物', iconKey: 'paw-print', builtIn: false, type: 'EXPENSE' });
  });

  it('收入分類分開排', () => {
    expect(ids('INCOME', [row({ id: 'c_job', type: 'INCOME', sortOrder: 0 })])).toEqual(['c_job', 'salary', 'bonus', 'investment_income', 'income_other']);
  });

  it('不認得的圖示用原本的；內建分類的類型不能改；轉帳、重複的列不理', () => {
    const list = mergeCategories([
      row({ id: 'food', icon: 'no-such-icon' }),
      row({ id: 'salary', type: 'EXPENSE', name: '月薪' }),
      row({ id: 'transfer', name: '亂改' }),
      row({ id: 'c_a', name: '第一個', sortOrder: 1 }),
      row({ id: 'c_a', name: '重複', sortOrder: 2 }),
    ]);
    expect(list.find((c) => c.id === 'food')?.iconKey).toBe('utensils');
    expect(list.find((c) => c.id === 'salary')).toMatchObject({ type: 'INCOME', name: '月薪' });
    expect(list.filter((c) => c.id === 'transfer')).toEqual([expect.objectContaining({ name: '轉帳', type: 'TRANSFER' })]);
    expect(list.filter((c) => c.id === 'c_a').map((c) => c.name)).toEqual(['第一個']);
  });
});

describe('toRows', () => {
  it('照現在的順序存成資料列，只存那一類', () => {
    const rows = toRows(mergeCategories([row({ id: 'c_pet', name: '寵物', icon: 'paw-print', sortOrder: 0 })]), 'EXPENSE');
    expect(rows.map((r) => [r.id, r.sortOrder])).toEqual([['c_pet', 0], ['food', 1], ['transit', 2], ['daily', 3], ['shopping', 4], ['fun', 5], ['health', 6], ['other', 7]]);
    expect(rows[0]).toEqual({ id: 'c_pet', type: 'EXPENSE', name: '寵物', icon: 'paw-print', sortOrder: 0, hidden: false });
  });
});

describe('目前使用者的分類', () => {
  it('getCategory 用使用者改過的名字；找不到的當成「其他」', () => {
    setCategoryRows([row({ id: 'other', name: '雜支', icon: 'ellipsis' })]);
    expect(getCategory('food').name).toBe('餐飲');
    expect(getCategory('c_deleted').name).toBe('雜支');
  });

  it('categoriesFor 不列隱藏的，但目前選的那個要留著', () => {
    setCategoryRows([row({ id: 'food', name: '餐飲', hidden: true })]);
    expect(categoriesFor('EXPENSE').map((c) => c.id)).not.toContain('food');
    expect(categoriesFor('EXPENSE', 'food').map((c) => c.id)).toContain('food');
  });

  it('defaultCategory 是第一個沒隱藏的', () => {
    expect(defaultCategory('EXPENSE')).toBe('food');
    setCategoryRows([row({ id: 'food', hidden: true, sortOrder: 0 }), row({ id: 'c_pet', sortOrder: 1 })]);
    expect(defaultCategory('EXPENSE')).toBe('c_pet');
    expect(defaultCategory('INCOME')).toBe('salary');
  });
});
