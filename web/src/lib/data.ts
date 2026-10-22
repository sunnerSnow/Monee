'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { prepareRestore, type Backup } from './backup';
import type { Frequency, RecurringRule } from './recurring';
import type { SavingsDeposit, SavingsGoal } from './goals';
import type { SyncResult } from './server/google-sync';
import type { Activity } from './streak';
import { reconcileDiff } from './budget';
import { RECONCILE_EXPENSE_CATEGORY, RECONCILE_INCOME_CATEGORY, toRows, type Category, type CategoryRow, type ManagedType } from './categories';
import { monthKeyOf, monthStart, shiftMonth, toISODate, toTime } from './dates';
import { SAMPLE_RATES, type FxRates } from './currency';
import { demo, isDemo } from './demo';
import type { ExportData, ExportTransaction } from './sheets-export';
import { createClient } from './supabase/client';
import type {
  Account, BudgetEntry, NewAccount, NewFriendExpense, NewSplitExpense, NewSplitSettlement, NewTransaction, PnlColor, Profile, PublicSplit, SplitClaim,
  SplitExpense, SplitGroup, SplitGroupInput, SplitKind, SplitProposal, SplitSettlement, Transaction,
} from './types';

/** 首頁、明細與報表需要的歷史月數（含當月） */
export const HISTORY_MONTHS = 6;

const keys = {
  accounts: ['accounts'],
  transactions: ['transactions'],
  profile: ['profile'],
  budgets: ['budgets'],
  split: ['split'],
  user: ['user'],
  backupSnapshot: ['backupSnapshot'],
  categories: ['categories'],
  recurring: ['recurring'],
  // 放在 transactions 底下：記帳、改帳、刪帳讓交易重新讀時，這個也會跟著重新讀
  activity: ['transactions', 'activity'],
  google: ['google'],
  // 存入紀錄放在 goals 底下：存入、拿出來時目標和紀錄一起重新讀
  goals: ['goals'],
} satisfies Record<string, QueryKey>;

interface AccountRow {
  id: string;
  name: string;
  type: Account['type'];
  currency: string;
  opening_balance: number | string;
  current_balance: number | string;
  icon: string | null;
  investment_snapshot: Account['investmentSnapshot'];
  last_reconciled_at: string | null;
}

interface TransactionRow {
  id: string;
  date: string;
  time: string | null;
  type: Transaction['type'];
  amount: number | string;
  category_id: string;
  source_account_id: string;
  target_account_id: string | null;
  note: string | null;
  created_at: string;
  split_expense_id?: string | null;
  split_settlement_id?: string | null;
  currency?: string | null;
  original_amount?: number | string | null;
  exclude_from_budget?: boolean | null;
  receipt_image_url?: string | null;
  recurring_id?: string | null;
}

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  type: r.type,
  currency: r.currency,
  currentBalance: Number(r.current_balance),
  openingBalance: Number(r.opening_balance),
  icon: r.icon,
  investmentSnapshot: r.investment_snapshot,
  lastReconciledAt: r.last_reconciled_at,
});

const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  date: r.date,
  time: r.time ? r.time.slice(0, 5) : null,
  type: r.type,
  amount: Number(r.amount),
  categoryId: r.category_id,
  sourceAccountId: r.source_account_id,
  targetAccountId: r.target_account_id,
  note: r.note,
  createdAt: r.created_at,
  splitExpenseId: r.split_expense_id ?? null,
  splitSettlementId: r.split_settlement_id ?? null,
  currency: r.currency ?? null,
  originalAmount: r.original_amount != null ? Number(r.original_amount) : null,
  excludeFromBudget: Boolean(r.exclude_from_budget),
  receiptPath: r.receipt_image_url ?? null,
  recurringId: r.recurring_id ?? null,
});

/** Supabase 查詢回傳 { data, error }，有錯就丟出，讓 React Query 接手錯誤狀態 */
async function unwrap<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------- 讀取 ----------

export function useAccounts() {
  return useQuery({
    queryKey: keys.accounts,
    queryFn: async () => {
      if (isDemo) return demo.accounts();
      const rows = await unwrap<AccountRow[]>(
        createClient().from('account_balances').select('*').eq('archived', false).order('sort_order').order('created_at'),
      );
      return rows.map(toAccount);
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: keys.transactions,
    queryFn: async () => {
      if (isDemo) return demo.transactions();
      const since = monthStart(shiftMonth(monthKeyOf(new Date()), -(HISTORY_MONTHS - 1)));
      const rows = await unwrap<TransactionRow[]>(
        createClient()
          .from('transactions')
          .select('*')
          .gte('date', since)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
      );
      return rows.map(toTransaction);
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async (): Promise<Profile> => {
      if (isDemo) return demo.profile();
      const row = await unwrap<{
        pnl_color: PnlColor; display_name: string | null; pay_bank: string | null; pay_line: string | null;
        sheets_id: string | null; sheets_exported_at: string | null;
      } | null>(
        createClient().from('profiles').select('pnl_color, display_name, pay_bank, pay_line, sheets_id, sheets_exported_at').maybeSingle(),
      );
      return {
        pnlColor: row?.pnl_color ?? 'red_up', displayName: row?.display_name ?? null, payBank: row?.pay_bank ?? null, payLine: row?.pay_line ?? null,
        sheetsId: row?.sheets_id ?? null, sheetsExportedAt: row?.sheets_exported_at ?? null,
      };
    },
  });
}

/** 預算紀錄（從某月起生效），用 lib/budget.ts 的 budgetFor 算出某個月的預算 */
export function useBudgets() {
  return useQuery({
    queryKey: keys.budgets,
    queryFn: async (): Promise<BudgetEntry[]> => {
      if (isDemo) return demo.budgets();
      const rows = await unwrap<{ effective_month: string; amount: number | string | null }[]>(
        createClient().from('budget_history').select('effective_month, amount').order('effective_month'),
      );
      return rows.map((r) => ({ month: r.effective_month, amount: r.amount != null ? Number(r.amount) : null }));
    },
  });
}

export function useUser() {
  return useQuery({
    queryKey: keys.user,
    queryFn: async () => {
      if (isDemo) return { email: 'demo@monee.app' };
      const { data } = await createClient().auth.getUser();
      return data.user;
    },
  });
}

// ---------- 匯出 ----------

type ExportTransactionRow = TransactionRow & {
  split_expense: { group: { name: string } | null } | null;
  split_settlement: { group: { name: string } | null } | null;
};

/** 匯出用：全部的交易（不只最近幾個月，附上分帳群組名稱）、全部帳戶（含封存）、預算 */
export async function fetchExportData(): Promise<ExportData> {
  if (isDemo) return demo.exportData();
  const supabase = createClient();
  const transactions: ExportTransaction[] = [];
  // Supabase 一次最多回傳 1000 筆（看專案設定），一頁一頁拿到沒有為止
  for (let from = 0; ; ) {
    const rows = await unwrap<ExportTransactionRow[]>(
      supabase
        .from('transactions')
        .select('*, split_expense:split_expenses(group:split_groups(name)), split_settlement:split_settlements(group:split_groups(name))')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + 999),
    );
    if (!rows.length) break;
    transactions.push(...rows.map((r) => ({
      ...toTransaction(r),
      groupName: r.split_expense?.group?.name ?? r.split_settlement?.group?.name ?? null,
    })));
    from += rows.length;
  }
  const [accounts, budgets] = await Promise.all([
    unwrap<(AccountRow & { archived: boolean })[]>(supabase.from('account_balances').select('*').order('sort_order').order('created_at')),
    unwrap<{ effective_month: string; amount: number | string | null }[]>(supabase.from('budget_history').select('effective_month, amount')),
  ]);
  return {
    transactions,
    accounts: accounts.map((r) => ({ ...toAccount(r), archived: r.archived })),
    budgets: budgets.map((r) => ({ month: r.effective_month, amount: r.amount != null ? Number(r.amount) : null })),
  };
}

// ---------- 備份 ----------

/** 全部資料的備份檔內容（資料庫函式 backup_export 產生） */
export async function fetchBackup(): Promise<Backup> {
  return unwrap<Backup>(createClient().rpc('backup_export'));
}

/** 上次還原時留下的「還原前的資料」，只拿時間 */
export function useBackupSnapshot() {
  return useQuery({
    queryKey: keys.backupSnapshot,
    queryFn: async () => {
      if (isDemo) return null;
      const row = await unwrap<{ created_at: string } | null>(createClient().from('backup_snapshots').select('created_at').maybeSingle());
      return row ? { createdAt: row.created_at } : null;
    },
  });
}

export async function fetchBackupSnapshot(): Promise<Backup | null> {
  const row = await unwrap<{ data: Backup } | null>(createClient().from('backup_snapshots').select('data').maybeSingle());
  return row?.data ?? null;
}

/** 整個換成備份的內容；資料庫會先留一份現在的資料（backup_snapshots） */
export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (backup: Backup) => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('登入已過期，請重新登入');
      await unwrap(supabase.rpc('backup_restore', { p_data: prepareRestore(backup, data.user.id) }));
    },
    // 帳戶、交易、預算、分帳、個人設定全都換了，全部重新讀
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// ---------- 分類 ----------
// 內建分類寫在 lib/categories.ts；表裡存使用者改過的內建分類和自己加的分類，合起來由 AppShell 放進 categories 的 store

interface CategoryDbRow { id: string; type: ManagedType; name: string; icon: string; sort_order: number; hidden: boolean }
const toCategoryRow = (r: CategoryDbRow): CategoryRow => ({ id: r.id, type: r.type, name: r.name, icon: r.icon, sortOrder: r.sort_order, hidden: r.hidden });

export function useCategoryRows(enabled = true) {
  return useQuery({
    queryKey: keys.categories,
    enabled,
    queryFn: async (): Promise<CategoryRow[]> => {
      if (isDemo) return demo.categoryRows();
      const rows = await unwrap<CategoryDbRow[]>(createClient().from('categories').select('id, type, name, icon, sort_order, hidden').order('sort_order'));
      return rows.map(toCategoryRow);
    },
  });
}

/**
 * 存一整類（支出或收入）的分類，連同順序：改名、換圖示、隱藏、排序、新增都走這裡。
 * 先把畫面換成新的（排序按一下就動），失敗再重新讀回資料庫的。
 */
export function useSaveCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, list }: { type: ManagedType; list: Category[] }) => {
      const rows = toRows(list, type);
      if (isDemo) return demo.saveCategoryRows(type, rows);
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('登入已過期，請重新登入');
      await unwrap(supabase.from('categories').upsert(rows.map((r) => ({
        user_id: data.user.id, id: r.id, type: r.type, name: r.name, icon: r.icon, sort_order: r.sortOrder, hidden: r.hidden,
      }))).select('id'));
    },
    onMutate: ({ type, list }) => {
      const before = queryClient.getQueryData<CategoryRow[]>(keys.categories) ?? [];
      queryClient.setQueryData<CategoryRow[]>(keys.categories, [...before.filter((r) => r.type !== type), ...toRows(list, type)]);
    },
    onError: () => queryClient.invalidateQueries({ queryKey: keys.categories }),
  });
}

/** 有幾筆交易、分帳花費用到這個分類（刪除前要問帳移到哪裡） */
export async function fetchCategoryUsage(id: string): Promise<{ transactions: number; splitExpenses: number }> {
  if (isDemo) return demo.categoryUsage(id);
  const supabase = createClient();
  const count = async (table: 'transactions' | 'split_expenses') => {
    const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('category_id', id);
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const [transactions, splitExpenses] = await Promise.all([count('transactions'), count('split_expenses')]);
  return { transactions, splitExpenses };
}

/** 刪掉自己加的分類：交易、分帳花費、朋友的待確認先移到 moveTo，再刪掉 */
export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, moveTo }: { id: string; moveTo: string }) => {
      if (isDemo) return demo.deleteCategory(id, moveTo);
      await rpc('category_delete', { p_id: id, p_move_to: moveTo });
    },
    onSuccess: () => invalidate(keys.categories, keys.transactions, keys.split),
  });
}

/** 分享頁：群組擁有者的支出分類 */
export function usePublicCategories(token: string) {
  return useQuery({
    queryKey: ['public-categories', token],
    queryFn: async (): Promise<CategoryRow[]> => {
      if (isDemo) return (await demo.categoryRows()).filter((r) => r.type === 'EXPENSE');
      return rpc<CategoryRow[]>('split_public_categories', { p_token: token });
    },
  });
}

// ---------- 固定收支 ----------
// 到期時呼叫 recurring_post：把日期寫成交易、推下次日期，同一個交易裡做完；帶著「以為的下次日期」，別的裝置處理過就不記

interface RecurringDbRow {
  id: string; type: RecurringRule['type']; amount: number | string; category_id: string; source_account_id: string;
  target_account_id: string | null; note: string | null; frequency: Frequency; day: number; month: number | null;
  auto: boolean; next_date: string; paused: boolean;
}
const toRule = (r: RecurringDbRow): RecurringRule => ({
  id: r.id, type: r.type, amount: Number(r.amount), categoryId: r.category_id, sourceAccountId: r.source_account_id,
  targetAccountId: r.target_account_id, note: r.note, frequency: r.frequency, day: r.day, month: r.month,
  auto: r.auto, nextDate: r.next_date, paused: r.paused,
});

export function useRecurringRules() {
  return useQuery({
    queryKey: keys.recurring,
    queryFn: async (): Promise<RecurringRule[]> => {
      if (isDemo) return demo.recurringRules();
      const rows = await unwrap<RecurringDbRow[]>(createClient().from('recurring_rules').select('*').order('next_date').order('created_at'));
      return rows.map(toRule);
    },
  });
}

export type RecurringInput = Omit<RecurringRule, 'id'> & { id?: string };

/** 新增或修改一筆固定收支；回傳 id */
export function useSaveRecurring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (r: RecurringInput): Promise<string> => {
      if (isDemo) return demo.saveRecurring(r);
      const row = {
        type: r.type, amount: r.amount, category_id: r.type === 'TRANSFER' ? 'transfer' : r.categoryId, source_account_id: r.sourceAccountId,
        target_account_id: r.type === 'TRANSFER' ? r.targetAccountId : null, note: r.note, frequency: r.frequency, day: r.day,
        month: r.frequency === 'yearly' ? r.month : null, auto: r.auto, next_date: r.nextDate, paused: r.paused,
      };
      const supabase = createClient();
      if (r.id) {
        const rows = await unwrap<{ id: string }[]>(supabase.from('recurring_rules').update(row).eq('id', r.id).select('id'));
        if (!rows.length) throw new Error('找不到這筆固定收支，可能已經刪除');
        return r.id;
      }
      return (await unwrap<{ id: string }>(supabase.from('recurring_rules').insert(row).select('id').single())).id;
    },
    onSuccess: () => invalidate(keys.recurring),
  });
}

/** 刪掉固定收支；已經記的帳不動（交易的 recurring_id 變成 null） */
export function useDeleteRecurring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return demo.deleteRecurring(id);
      const rows = await unwrap<{ id: string }[]>(createClient().from('recurring_rules').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('找不到這筆固定收支，可能已經刪除');
    },
    onSuccess: () => invalidate(keys.recurring, keys.transactions),
  });
}

/**
 * 記下到期的固定收支：dates 是要記的日期（略過就是空的），next 是記完之後的下次日期，amount 是這次的金額（先問我時可以改）。
 * 回傳 false 代表別的裝置已經處理過，這次什麼都沒記。
 */
export function usePostRecurring() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ rule, dates, next, amount }: { rule: RecurringRule; dates: string[]; next: string; amount?: number }): Promise<boolean> => {
      if (isDemo) return demo.postRecurring(rule.id, dates, next, rule.nextDate, amount);
      return rpc<boolean>('recurring_post', { p_rule: rule.id, p_dates: dates, p_next: next, p_expected: rule.nextDate, p_amount: amount ?? null });
    },
    onSuccess: () => invalidate(keys.recurring, keys.transactions, keys.accounts),
  });
}

// ---------- 連續記帳、無消費日 ----------
// activity_days 只回傳日期（有記帳、有支出、無消費），不受首頁只讀 6 個月的限制，365 天徽章也算得出來

export function useActivity() {
  return useQuery({
    queryKey: keys.activity,
    queryFn: async (): Promise<Activity> => {
      if (isDemo) return demo.activity();
      const r = await rpc<{ logged: string[]; spent: string[]; no_spend: string[] }>('activity_days', {});
      return { logged: r.logged, spent: r.spent, noSpend: r.no_spend };
    },
  });
}

/** 蓋上或拿掉無消費章。畫面先改，失敗再讀回來；連按時照順序送，最後的狀態才不會錯 */
export function useMarkNoSpend() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: 'no-spend' },
    mutationFn: async ({ date, on }: { date: string; on: boolean }) => {
      if (isDemo) return demo.markNoSpend(date, on);
      const table = createClient().from('no_spend_days');
      if (!on) return void (await unwrap(table.delete().eq('date', date)));
      // 已經蓋過了（別的裝置蓋的）也算成功
      const { error } = await table.insert({ date });
      if (error && error.code !== '23505') throw new Error(error.message);
    },
    onMutate: async ({ date, on }) => {
      await queryClient.cancelQueries({ queryKey: keys.activity });
      queryClient.setQueryData<Activity>(keys.activity, (a) => a && {
        ...a, noSpend: [...a.noSpend.filter((d) => d !== date), ...(on ? [date] : [])],
      });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: keys.activity }),
  });
}

// ---------- 存錢目標 ----------
// 存入只記在目標底下，不動帳戶餘額、不算支出；存了多少由 savings_goal_totals 加總

interface GoalRow {
  id: string; name: string; target: number | string; deadline: string | null; icon: string; pinned: boolean; archived: boolean;
  created_at: string; saved: number | string;
}
const toGoal = (r: GoalRow): SavingsGoal => ({
  id: r.id, name: r.name, target: Number(r.target), deadline: r.deadline, icon: r.icon, pinned: r.pinned, archived: r.archived,
  createdAt: r.created_at, saved: Number(r.saved),
});

export function useGoals() {
  return useQuery({
    queryKey: keys.goals,
    queryFn: async (): Promise<SavingsGoal[]> => {
      if (isDemo) return demo.goals();
      const rows = await unwrap<GoalRow[]>(createClient().from('savings_goal_totals').select('*').order('created_at'));
      return rows.map(toGoal);
    },
  });
}

export type GoalInput = Pick<SavingsGoal, 'name' | 'target' | 'deadline' | 'icon' | 'archived'> & { id?: string };

/** 新增或修改目標；回傳 id */
export function useSaveGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (g: GoalInput): Promise<string> => {
      if (isDemo) return demo.saveGoal(g);
      const row = { name: g.name, target: g.target, deadline: g.deadline, icon: g.icon, archived: g.archived };
      const supabase = createClient();
      if (g.id) {
        const rows = await unwrap<{ id: string }[]>(supabase.from('savings_goals').update(row).eq('id', g.id).select('id'));
        if (!rows.length) throw new Error('找不到這個目標，可能已經刪除');
        return g.id;
      }
      return (await unwrap<{ id: string }>(supabase.from('savings_goals').insert(row).select('id').single())).id;
    },
    onSuccess: () => invalidate(keys.goals),
  });
}

/** 釘選在首頁（一次一個）；null 是都不釘 */
export function usePinGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string | null) => {
      if (isDemo) return demo.pinGoal(id);
      await rpc('savings_pin', { p_goal: id });
    },
    onSuccess: () => invalidate(keys.goals),
  });
}

/** 刪掉目標，存入紀錄一起刪 */
export function useDeleteGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return demo.deleteGoal(id);
      const rows = await unwrap<{ id: string }[]>(createClient().from('savings_goals').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('找不到這個目標，可能已經刪除');
    },
    onSuccess: () => invalidate(keys.goals),
  });
}

/** 一個目標的存入紀錄，新的在前 */
export function useGoalDeposits(goalId: string | null) {
  return useQuery({
    queryKey: [...keys.goals, 'deposits', goalId],
    enabled: Boolean(goalId),
    queryFn: async (): Promise<SavingsDeposit[]> => {
      if (isDemo) return demo.goalDeposits(goalId!);
      const rows = await unwrap<{ id: string; goal_id: string; amount: number | string; date: string; note: string | null; created_at: string }[]>(
        createClient().from('savings_deposits').select('id, goal_id, amount, date, note, created_at').eq('goal_id', goalId!)
          .order('date', { ascending: false }).order('created_at', { ascending: false }),
      );
      return rows.map((r) => ({ id: r.id, goalId: r.goal_id, amount: Number(r.amount), date: r.date, note: r.note, createdAt: r.created_at }));
    },
  });
}

/** 存入（amount 正的）或拿出來（負的） */
export function useAddDeposit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (d: Pick<SavingsDeposit, 'goalId' | 'amount' | 'date' | 'note'>) => {
      if (isDemo) return demo.addDeposit(d);
      await unwrap(createClient().from('savings_deposits').insert({ goal_id: d.goalId, amount: d.amount, date: d.date, note: d.note }));
    },
    onSuccess: () => invalidate(keys.goals),
  });
}

export function useDeleteDeposit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return demo.deleteDeposit(id);
      await unwrap(createClient().from('savings_deposits').delete().eq('id', id));
    },
    onSuccess: () => invalidate(keys.goals),
  });
}

// ---------- Google 雲端同步 ----------
// 連結、同步都在伺服器（/api/google/*），前端只讀狀態；授權（refresh token）的欄位前端不讀

export interface GoogleStatus {
  email: string | null;
  connectedAt: string;
  /** 授權失效，要重新連結 */
  needsReconnect: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** 待同步的月份數；failed 是其中失敗過、等著重試的 */
  pending: number;
  failed: number;
  /** Drive 上的 Monee 資料夾；還沒同步過是 null */
  rootFolderId: string | null;
  /** 建好的年度帳本，新的年份在前 */
  workbooks: { year: number; id: string }[];
}

/** 沒連結是 null */
export function useGoogleStatus() {
  return useQuery({
    queryKey: keys.google,
    queryFn: async (): Promise<GoogleStatus | null> => {
      if (isDemo) return null;
      const supabase = createClient();
      const row = await unwrap<{
        google_email: string | null; connected_at: string; needs_reconnect: boolean; last_synced_at: string | null; last_error: string | null;
      } | null>(supabase.from('google_integrations').select('google_email, connected_at, needs_reconnect, last_synced_at, last_error').maybeSingle());
      if (!row) return null;
      const [months, root, books] = await Promise.all([
        unwrap<{ attempts: number }[]>(supabase.from('google_sync_months').select('attempts')),
        unwrap<{ folder_id: string } | null>(supabase.from('drive_folders').select('folder_id').eq('path', '').maybeSingle()),
        unwrap<{ year: number; spreadsheet_id: string }[]>(supabase.from('annual_workbooks').select('year, spreadsheet_id').order('year', { ascending: false })),
      ]);
      return {
        email: row.google_email, connectedAt: row.connected_at, needsReconnect: row.needs_reconnect, lastSyncedAt: row.last_synced_at,
        lastError: row.last_error, pending: months.length, failed: months.filter((m) => m.attempts > 0).length, rootFolderId: root?.folder_id ?? null,
        workbooks: books.map((b) => ({ year: b.year, id: b.spreadsheet_id })),
      };
    },
  });
}

async function requestGoogleSync(force: boolean): Promise<SyncResult> {
  try {
    const res = await fetch('/api/google/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }), keepalive: !force,
    });
    return ((await res.json().catch(() => null)) as SyncResult | null) ?? { status: 'error', message: '同步失敗，等一下再試' };
  } catch {
    return { status: 'error', message: '連不上網路，等一下再試' };
  }
}

/** 一次做不完（more）就接著叫，最多幾輪；後面的留給下次 */
async function syncRounds(force: boolean, rounds: number) {
  let result = await requestGoogleSync(force);
  for (let i = 1; i < rounds && result.status === 'more'; i++) result = await requestGoogleSync(force);
  return result;
}

/** 「立即同步」：連失敗多次的月份一起再試 */
export function useSyncGoogle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => syncRounds(true, 5),
    onSettled: () => invalidate(keys.google),
  });
}

/**
 * 自動同步：打開 App、記帳改帳之後（交易重新讀到時）等 3 秒，有待同步的月份才叫伺服器同步，不等結果。
 * 沒連結、授權失效、示範模式都不做
 */
export function useGoogleAutoSync() {
  const { data: status, refetch } = useGoogleStatus();
  const { dataUpdatedAt } = useTransactions();
  const invalidate = useInvalidate();
  const connected = Boolean(status && !status.needsReconnect);
  useEffect(() => {
    if (!connected || !dataUpdatedAt) return;
    const timer = setTimeout(async () => {
      const { data } = await refetch();
      if (!data || data.needsReconnect || !data.pending) return;
      await syncRounds(false, 3);
      void invalidate(keys.google);
    }, 3000);
    return () => clearTimeout(timer);
    // invalidate 每次都是新的函式，不放進來
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, dataUpdatedAt, refetch]);
}

/** 解除連結：Drive 裡的收據和年度帳本都留著 */
export function useDisconnectGoogle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/google/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? '解除失敗，請再試一次');
    },
    onSuccess: () => invalidate(keys.google),
  });
}

// ---------- 收據照片 ----------
// 存在 Storage 的 receipts（私人），路徑是「{user id}/{隨機 id}.jpg」，每個人只能讀寫自己的資料夾

const RECEIPTS = 'receipts';
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

/** 上傳一張收據照片，回傳路徑；示範模式只放在記憶體 */
export async function uploadReceipt(photo: Blob): Promise<string> {
  if (isDemo) return URL.createObjectURL(photo);
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('登入已過期，請重新登入');
  const type = photo.type || 'image/jpeg';
  const path = `${data.user.id}/${crypto.randomUUID()}.${EXTENSIONS[type] ?? 'jpg'}`;
  const { error } = await supabase.storage.from(RECEIPTS).upload(path, photo, { contentType: type, upsert: false });
  if (error) throw new Error('照片上傳失敗，請檢查網路再試一次；或先拿掉照片再記');
  return path;
}

/** 刪掉不再用到的照片；刪不掉也不影響帳，只是多佔一點空間，所以不報錯 */
export async function removeReceipts(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (isDemo || !list.length) return;
  try {
    await createClient().storage.from(RECEIPTS).remove(list);
  } catch {
    // 忽略
  }
}

/** 照片是私人檔案，用一小時內有效的簽名網址顯示 */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['receipt', path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (isDemo) return path!;
      const { data, error } = await createClient().storage.from(RECEIPTS).createSignedUrl(path!, 60 * 60);
      if (error) throw new Error('照片已經不在了');
      return data.signedUrl;
    },
  });
}

/** 這張收據在 Google Drive 上的連結；沒連結 Google、還沒同步到是 null。同步完會跟著狀態重新讀 */
export function useDriveReceiptLink(path: string | null | undefined) {
  return useQuery({
    queryKey: [...keys.google, 'receipt', path],
    enabled: Boolean(path) && !isDemo,
    retry: false,
    queryFn: async () => {
      const row = await unwrap<{ drive_file_id: string; web_view_link: string | null } | null>(
        createClient().from('drive_receipts').select('drive_file_id, web_view_link').eq('source_path', path!).maybeSingle(),
      );
      return row ? row.web_view_link ?? `https://drive.google.com/file/d/${row.drive_file_id}/view` : null;
    },
  });
}

/** 分帳花費的照片另外存：花費由 split_save_expense 寫入，照片路徑接著補上 */
export function useSetSplitReceipt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, receiptPath }: { id: string; receiptPath: string | null }) => {
      if (isDemo) return demo.setSplitReceipt(id, receiptPath);
      const rows = await unwrap<{ id: string }[]>(createClient().from('split_expenses').update({ receipt_path: receiptPath }).eq('id', id).select('id'));
      if (!rows.length) throw new Error('找不到這筆花費');
    },
    onSuccess: () => invalidate(keys.split),
  });
}

// ---------- 寫入 ----------

function useInvalidate() {
  const queryClient = useQueryClient();
  return (...list: QueryKey[]) => Promise.all(list.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

const toTransactionRow = (t: NewTransaction) => ({
  date: t.date,
  time: t.time,
  type: t.type,
  amount: t.amount,
  category_id: t.categoryId,
  source_account_id: t.sourceAccountId,
  target_account_id: t.type === 'TRANSFER' ? t.targetAccountId : null,
  note: t.note,
  // 沒帶照片欄位就不動原本的照片
  ...(t.receiptPath !== undefined ? { receipt_image_url: t.receiptPath } : {}),
  ...(t.recurringId !== undefined ? { recurring_id: t.recurringId } : {}),
});

export function useAddTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (t: NewTransaction) => {
      if (isDemo) return demo.addTransaction(t);
      const row = await unwrap<{ id: string }>(
        createClient().from('transactions').insert(toTransactionRow(t)).select('id').single(),
      );
      return row.id;
    },
    onSuccess: () => invalidate(keys.transactions, keys.accounts),
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...t }: NewTransaction & { id: string }) => {
      if (isDemo) return demo.updateTransaction(id, t);
      const rows = await unwrap<{ id: string }[]>(createClient().from('transactions').update(toTransactionRow(t)).eq('id', id).select('id'));
      if (!rows.length) throw new Error('找不到這筆交易，可能已經刪除');
      return id;
    },
    onSuccess: () => invalidate(keys.transactions, keys.accounts),
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return demo.deleteTransaction(id);
      // 用 select 確認真的刪到一筆；RLS 擋下時 Supabase 不會報錯，只會回傳空陣列
      const rows = await unwrap<{ id: string; receipt_image_url: string | null }[]>(
        createClient().from('transactions').delete().eq('id', id).select('id, receipt_image_url'),
      );
      if (!rows.length) throw new Error('找不到這筆交易，可能已經刪除');
      await removeReceipts(rows.map((r) => r.receipt_image_url));
    },
    onSuccess: () => invalidate(keys.transactions, keys.accounts),
  });
}

export function useAddAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (a: NewAccount) => {
      if (isDemo) return demo.addAccount(a);
      const row = await unwrap<{ id: string }>(
        createClient()
          .from('accounts')
          .insert({ name: a.name, type: a.type, opening_balance: a.openingBalance })
          .select('id')
          .single(),
      );
      return row.id;
    },
    onSuccess: () => invalidate(keys.accounts),
  });
}

/** 校準：有差額就補一筆「未記錄雜項／收入」，並記下校準時間 */
export function useReconcile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ account, input }: { account: Account; input: number }) => {
      if (isDemo) return demo.reconcile(account, input);
      const supabase = createClient();
      const diff = reconcileDiff(account, input);
      const now = new Date();
      if (diff !== 0) {
        const expense = diff < 0;
        await unwrap(
          supabase
            .from('transactions')
            .insert({
              date: toISODate(now),
              time: toTime(now),
              type: expense ? 'EXPENSE' : 'INCOME',
              amount: Math.abs(diff),
              category_id: expense ? RECONCILE_EXPENSE_CATEGORY : RECONCILE_INCOME_CATEGORY,
              source_account_id: account.id,
              note: expense ? '未記錄雜項' : '未記錄收入',
            })
            .select('id')
            .single(),
        );
      }
      await unwrap(supabase.from('accounts').update({ last_reconciled_at: now.toISOString() }).eq('id', account.id).select('id'));
      return diff;
    },
    onSuccess: () => invalidate(keys.transactions, keys.accounts),
  });
}

export function useUpdateProfile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (isDemo) return demo.updateProfile(patch);
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('登入已過期，請重新登入');
      const values: Record<string, unknown> = { user_id: data.user.id };
      if (patch.pnlColor) values.pnl_color = patch.pnlColor;
      if ('displayName' in patch) values.display_name = patch.displayName || null;
      if ('payBank' in patch) values.pay_bank = patch.payBank || null;
      if ('payLine' in patch) values.pay_line = patch.payLine || null;
      if ('sheetsId' in patch) values.sheets_id = patch.sheetsId || null;
      if ('sheetsExportedAt' in patch) values.sheets_exported_at = patch.sheetsExportedAt || null;
      await unwrap(supabase.from('profiles').upsert(values).select('user_id'));
    },
    onSuccess: () => invalidate(keys.profile),
  });
}

/**
 * 改預算：from（本月）起的紀錄整個換成 entries，之前的月份不動。
 * entries 用 lib/budget.ts 的 planBudget 算；amount 為 null 代表從那個月起不設預算。
 */
export function useSetBudget() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ from, entries }: { from: string; entries: BudgetEntry[] }) => {
      if (isDemo) return demo.replaceBudgets(from, entries);
      await rpc('budget_replace_from', { p_from: from, p_entries: entries });
    },
    onSuccess: () => invalidate(keys.budgets),
  });
}

// ---------- 分帳 ----------
// 讀取一次抓整包（群組、成員、花費、還款、結清紀錄），資料量小；寫入都走資料庫函式，花費和個人帳的交易一次寫完

interface SplitGroupRow {
  id: string;
  name: string;
  kind: SplitKind;
  created_at: string;
  share_token: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  budget: number | string | null;
  exclude_from_budget: boolean | null;
  allow_friend_add: boolean | null;
  archived_at: string | null;
  members: { id: string; name: string; is_me: boolean; created_at: string }[];
  claims: { id: string; from_id: string; to_id: string; amount: number | string; status: SplitClaim['status']; created_at: string }[];
  proposals: {
    id: string; added_by: string; date: string; title: string; category_id: string; amount: number | string; payer_id: string;
    weights: Record<string, number | string>; amounts: Record<string, number | string>; currency: string;
    original_amount: number | string | null; status: SplitProposal['status']; created_at: string;
  }[] | null;
  expenses: {
    id: string; round_id: string | null; date: string; time: string | null; title: string; category_id: string;
    amount: number | string; payer_id: string; account_id: string | null; mode: SplitExpense['mode'];
    weights: Record<string, number | string>; amounts: Record<string, number | string>; created_at: string;
    currency: string | null; original_amount: number | string | null; fx_rate: number | string | null; added_by?: string | null;
    receipt_path?: string | null;
  }[];
  settlements: {
    id: string; round_id: string | null; from_id: string; to_id: string; amount: number | string;
    account_id: string | null; date: string; created_at: string;
  }[];
  rounds: { id: string; closed_at: string; created_at: string }[];
}

const numbers = (o: Record<string, number | string> | null) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, Number(v)]));

const toSplitGroup = (r: SplitGroupRow): SplitGroup => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  createdAt: r.created_at,
  shareToken: r.share_token,
  startDate: r.start_date,
  endDate: r.end_date,
  currency: r.currency ?? 'TWD',
  budget: r.budget != null ? Number(r.budget) : null,
  excludeFromBudget: Boolean(r.exclude_from_budget),
  allowFriendAdd: Boolean(r.allow_friend_add),
  archivedAt: r.archived_at,
  claims: (r.claims ?? [])
    .map((c): SplitClaim => ({ id: c.id, fromId: c.from_id, toId: c.to_id, amount: Number(c.amount), status: c.status, createdAt: c.created_at }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  proposals: (r.proposals ?? [])
    .map((p): SplitProposal => ({
      id: p.id, addedBy: p.added_by, date: p.date, title: p.title, categoryId: p.category_id, amount: Number(p.amount), payerId: p.payer_id,
      weights: numbers(p.weights), amounts: numbers(p.amounts), currency: p.currency,
      originalAmount: p.original_amount != null ? Number(p.original_amount) : null, status: p.status, createdAt: p.created_at,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  // 你排第一，朋友照加入順序（平分的零頭也照這個順序給）
  members: [...r.members]
    .sort((a, b) => Number(b.is_me) - Number(a.is_me) || a.created_at.localeCompare(b.created_at))
    .map((m) => ({ id: m.id, name: m.name, isMe: m.is_me })),
  expenses: r.expenses
    .map((e): SplitExpense => ({
      id: e.id, roundId: e.round_id, date: e.date, time: e.time ? e.time.slice(0, 5) : null, title: e.title, categoryId: e.category_id,
      amount: Number(e.amount), payerId: e.payer_id, accountId: e.account_id, mode: e.mode,
      weights: numbers(e.weights), amounts: numbers(e.amounts), createdAt: e.created_at,
      currency: e.currency ?? 'TWD', originalAmount: e.original_amount != null ? Number(e.original_amount) : null,
      fxRate: e.fx_rate != null ? Number(e.fx_rate) : null, addedBy: e.added_by ?? null, receiptPath: e.receipt_path ?? null,
    }))
    .sort((a, b) => `${b.date} ${b.time ?? ''} ${b.createdAt}`.localeCompare(`${a.date} ${a.time ?? ''} ${a.createdAt}`)),
  settlements: r.settlements
    .map((s): SplitSettlement => ({
      id: s.id, roundId: s.round_id, fromId: s.from_id, toId: s.to_id, amount: Number(s.amount), accountId: s.account_id,
      date: s.date, createdAt: s.created_at,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  rounds: [...r.rounds]
    .sort((a, b) => b.closed_at.localeCompare(a.closed_at) || b.created_at.localeCompare(a.created_at))
    .map((x) => ({ id: x.id, closedAt: x.closed_at })),
});

export function useSplitGroups() {
  return useQuery({
    queryKey: keys.split,
    queryFn: async () => {
      if (isDemo) return demo.splitGroups();
      const rows = await unwrap<SplitGroupRow[]>(
        createClient()
          .from('split_groups')
          .select('id, name, kind, created_at, share_token, start_date, end_date, currency, budget, exclude_from_budget, allow_friend_add, archived_at, members:split_members(id, name, is_me, created_at), expenses:split_expenses(*), settlements:split_settlements(*), rounds:split_rounds(id, closed_at, created_at), claims:split_claims(id, from_id, to_id, amount, status, created_at), proposals:split_proposals(id, added_by, date, title, category_id, amount, payer_id, weights, amounts, currency, original_amount, status, created_at)')
          .order('created_at', { ascending: false }),
      );
      return rows.map(toSplitGroup);
    },
  });
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** 分帳會動到群組、個人交易與帳戶餘額（朋友往來），三個都要重新讀 */
const SPLIT_TOUCHES = [keys.split, keys.transactions, keys.accounts];

export function useCreateSplitGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ members, ...g }: SplitGroupInput & { members: string[] }) => {
      if (isDemo) return demo.createSplitGroup(g, members);
      return rpc<string>('split_create_group', {
        p_name: g.name, p_kind: g.kind, p_members: members, p_start: g.startDate, p_end: g.endDate, p_currency: g.currency,
        p_budget: g.budget, p_exclude: g.excludeFromBudget,
      });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

export function useUpdateSplitGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: SplitGroupInput & { groupId: string; members: { id: string | null; name: string }[] }) => {
      if (isDemo) return demo.updateSplitGroup(v);
      await rpc('split_update_group', {
        p_group: v.groupId, p_name: v.name, p_kind: v.kind, p_members: v.members, p_start: v.startDate, p_end: v.endDate,
        p_currency: v.currency, p_budget: v.budget, p_exclude: v.excludeFromBudget,
      });
    },
    // 改「不算進每月預算」會一起改已記的支出
    onSuccess: () => invalidate(keys.split, keys.transactions),
  });
}

/** 刪除群組；有花費時要 force，連同花費、還款和你帳上的對應交易一起刪，花費的收據照片也刪掉 */
export function useDeleteSplitGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ groupId, force, receipts }: { groupId: string; force: boolean; receipts: (string | null | undefined)[] }) => {
      if (isDemo) return demo.deleteSplitGroup(groupId, force);
      await rpc('split_delete_group', { p_group: groupId, p_force: force });
      await removeReceipts(receipts);
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

/** 封存或取消封存：帳和明細都保留，只是從列表收起來 */
export function useArchiveSplitGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ groupId, archived }: { groupId: string; archived: boolean }) => {
      if (isDemo) return demo.archiveSplitGroup(groupId, archived);
      const rows = await unwrap<{ id: string }[]>(
        createClient().from('split_groups').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', groupId).select('id'),
      );
      if (!rows.length) throw new Error('找不到這個群組，可能已經刪除');
    },
    onSuccess: () => invalidate(keys.split),
  });
}

export function useSaveSplitExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (e: NewSplitExpense) => {
      if (isDemo) return demo.saveSplitExpense(e);
      return rpc<string>('split_save_expense', {
        p_id: e.id ?? null, p_group: e.groupId, p_date: e.date, p_time: e.time, p_title: e.title, p_category: e.categoryId,
        p_amount: e.amount, p_payer: e.payerId, p_account: e.accountId, p_mode: e.mode, p_weights: e.weights, p_amounts: e.amounts,
        p_currency: e.currency, p_original_amount: e.originalAmount, p_fx_rate: e.fxRate, p_original_shares: e.originalShares ?? null,
      });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

export function useDeleteSplitExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, receiptPath }: Pick<SplitExpense, 'id' | 'receiptPath'>) => {
      if (isDemo) return demo.deleteSplitExpense(id);
      await rpc('split_delete_expense', { p_id: id });
      await removeReceipts([receiptPath]);
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

/** 記一筆還款；回傳這次是否剛好全部結清（結清的花費會自動收進結清紀錄） */
export function useSettle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (s: NewSplitSettlement) => {
      if (isDemo) return demo.settle(s);
      return rpc<boolean>('split_settle', {
        p_group: s.groupId, p_from: s.fromId, p_to: s.toId, p_amount: s.amount, p_account: s.accountId, p_date: s.date, p_time: s.time,
      });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

export function useDeleteSettlement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return demo.deleteSettlement(id);
      await rpc('split_delete_settlement', { p_id: id });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

export function useReopenRound() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (roundId: string) => {
      if (isDemo) return demo.reopenRound(roundId);
      await rpc('split_reopen_round', { p_round: roundId });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

// ---------- 分帳：分享連結 ----------

/** 開始分享（reset 為 true 時換一條新連結，舊的立刻失效）；回傳 token */
export function useShareGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ groupId, reset }: { groupId: string; reset: boolean }) => {
      if (isDemo) return demo.shareGroup(groupId, reset);
      return rpc<string>('split_share_group', { p_group: groupId, p_reset: reset });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

export function useStopShare() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (groupId: string) => {
      if (isDemo) return demo.stopShare(groupId);
      await rpc('split_stop_share', { p_group: groupId });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

/** 確認朋友說的付款：寫入還款；回傳這次是否剛好全部結清 */
export function useConfirmClaim() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { claimId: string; accountId: string | null; date: string; time: string | null }) => {
      if (isDemo) return demo.confirmClaim(v);
      return rpc<boolean>('split_confirm_claim', { p_claim: v.claimId, p_account: v.accountId, p_date: v.date, p_time: v.time });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

export function useRejectClaim() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (claimId: string) => {
      if (isDemo) return demo.rejectClaim(claimId);
      await rpc('split_reject_claim', { p_claim: claimId });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

/** 朋友可以從分享連結新增花費（開關） */
export function useSetFriendAdd() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ groupId, allow }: { groupId: string; allow: boolean }) => {
      if (isDemo) return demo.setFriendAdd(groupId, allow);
      const rows = await unwrap<{ id: string }[]>(createClient().from('split_groups').update({ allow_friend_add: allow }).eq('id', groupId).select('id'));
      if (!rows.length) throw new Error('找不到這個群組');
    },
    onSuccess: () => invalidate(keys.split),
  });
}

/** 確認朋友新增的花費：寫進群組與個人帳（可以改分類；你先付時要選付款帳戶） */
export function useConfirmProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { proposalId: string; categoryId: string; accountId: string | null }) => {
      if (isDemo) return demo.confirmProposal(v);
      return rpc<string>('split_confirm_proposal', { p_proposal: v.proposalId, p_category: v.categoryId, p_account: v.accountId });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

export function useRejectProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      if (isDemo) return demo.rejectProposal(proposalId);
      await rpc('split_reject_proposal', { p_proposal: proposalId });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

/** 朋友點分享連結：不用登入就能讀；連結失效時回傳 null */
export function usePublicSplit(token: string) {
  return useQuery({
    queryKey: ['public-split', token],
    queryFn: async (): Promise<PublicSplit | null> => {
      if (isDemo) return demo.publicView(token);
      return rpc<PublicSplit | null>('split_public_view', { p_token: token });
    },
  });
}

export function usePublicClaim(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { fromId: string; toId: string; amount: number }) => {
      if (isDemo) return demo.publicClaim(token, v);
      await rpc('split_public_claim', { p_token: token, p_from: v.fromId, p_to: v.toId, p_amount: v.amount });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-split', token] }),
  });
}

/** 朋友新增一筆；回傳 pending 為 true 代表跟分享的人有關，要等對方確認 */
export function usePublicAddExpense(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (e: NewFriendExpense): Promise<{ id: string; pending: boolean }> => {
      if (isDemo) return demo.publicAddExpense(token, e);
      return rpc('split_public_add_expense', {
        p_token: token, p_member: e.memberId, p_date: e.date, p_title: e.title, p_category: e.categoryId, p_amount: e.amount,
        p_payer: e.payerId, p_weights: e.weights, p_amounts: e.amounts, p_currency: e.currency, p_original_amount: e.originalAmount,
        p_fx_rate: e.fxRate, p_original_shares: e.originalShares,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-split', token] }),
  });
}

/** 朋友撤回自己記的：還沒確認的、被退回的，或跟分享的人無關的花費 */
export function usePublicRemove(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { memberId: string; id: string }) => {
      if (isDemo) return demo.publicRemove(token, v);
      await rpc('split_public_remove', { p_token: token, p_member: v.memberId, p_id: v.id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-split', token] }),
  });
}

// ---------- 匯率 ----------

/** 1 台幣換多少外幣；6 小時內不重抓。抓不到時讓使用者自己輸入匯率 */
export function useFxRates() {
  return useQuery({
    queryKey: ['fx'],
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<FxRates> => {
      if (isDemo) return SAMPLE_RATES;
      const res = await fetch('/api/fx');
      const json = (await res.json().catch(() => null)) as (FxRates & { error?: string }) | null;
      if (!res.ok || !json?.perTwd) throw new Error(json?.error ?? '匯率暫時拿不到');
      return json;
    },
  });
}
