'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { reconcileDiff } from './budget';
import { RECONCILE_EXPENSE_CATEGORY, RECONCILE_INCOME_CATEGORY } from './categories';
import { monthKeyOf, monthStart, shiftMonth, toISODate, toTime } from './dates';
import { demo, isDemo } from './demo';
import { createClient } from './supabase/client';
import type { Account, BudgetEntry, NewAccount, NewTransaction, PnlColor, Profile, Transaction } from './types';

/** 首頁、明細與報表需要的歷史月數（含當月） */
export const HISTORY_MONTHS = 6;

const keys = {
  accounts: ['accounts'],
  transactions: ['transactions'],
  profile: ['profile'],
  budgets: ['budgets'],
  user: ['user'],
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
      const row = await unwrap<{ pnl_color: PnlColor } | null>(
        createClient().from('profiles').select('pnl_color').maybeSingle(),
      );
      return { pnlColor: row?.pnl_color ?? 'red_up' };
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
      const rows = await unwrap<{ id: string }[]>(createClient().from('transactions').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('找不到這筆交易，可能已經刪除');
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
      await unwrap(supabase.from('profiles').upsert(values).select('user_id'));
    },
    onSuccess: () => invalidate(keys.profile),
  });
}

/** 設定某月起的預算（amount 為 null 代表從那個月起不設預算）；同一個月重設會覆蓋 */
export function useSetBudget() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (entry: BudgetEntry) => {
      if (isDemo) return demo.setBudget(entry);
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('登入已過期，請重新登入');
      await unwrap(
        supabase
          .from('budget_history')
          .upsert({ user_id: data.user.id, effective_month: entry.month, amount: entry.amount }, { onConflict: 'user_id,effective_month' })
          .select('effective_month'),
      );
    },
    onSuccess: () => invalidate(keys.budgets),
  });
}
