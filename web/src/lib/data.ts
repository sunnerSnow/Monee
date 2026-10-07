'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { reconcileDiff } from './budget';
import { RECONCILE_EXPENSE_CATEGORY, RECONCILE_INCOME_CATEGORY } from './categories';
import { monthKeyOf, monthStart, shiftMonth, toISODate, toTime } from './dates';
import { demo, isDemo } from './demo';
import { createClient } from './supabase/client';
import type {
  Account, BudgetEntry, NewAccount, NewSplitExpense, NewSplitSettlement, NewTransaction, PnlColor, Profile, PublicSplit, SplitClaim,
  SplitExpense, SplitGroup, SplitKind, SplitSettlement, Transaction,
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
      const row = await unwrap<{ pnl_color: PnlColor; display_name: string | null; pay_bank: string | null; pay_line: string | null } | null>(
        createClient().from('profiles').select('pnl_color, display_name, pay_bank, pay_line').maybeSingle(),
      );
      return { pnlColor: row?.pnl_color ?? 'red_up', displayName: row?.display_name ?? null, payBank: row?.pay_bank ?? null, payLine: row?.pay_line ?? null };
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
      if ('displayName' in patch) values.display_name = patch.displayName || null;
      if ('payBank' in patch) values.pay_bank = patch.payBank || null;
      if ('payLine' in patch) values.pay_line = patch.payLine || null;
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

// ---------- 分帳 ----------
// 讀取一次抓整包（群組、成員、花費、還款、結清紀錄），資料量小；寫入都走資料庫函式，花費和個人帳的交易一次寫完

interface SplitGroupRow {
  id: string;
  name: string;
  kind: SplitKind;
  created_at: string;
  share_token: string | null;
  members: { id: string; name: string; is_me: boolean; created_at: string }[];
  claims: { id: string; from_id: string; to_id: string; amount: number | string; status: SplitClaim['status']; created_at: string }[];
  expenses: {
    id: string; round_id: string | null; date: string; time: string | null; title: string; category_id: string;
    amount: number | string; payer_id: string; account_id: string | null; mode: SplitExpense['mode'];
    weights: Record<string, number | string>; amounts: Record<string, number | string>; created_at: string;
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
  claims: (r.claims ?? [])
    .map((c): SplitClaim => ({ id: c.id, fromId: c.from_id, toId: c.to_id, amount: Number(c.amount), status: c.status, createdAt: c.created_at }))
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
          .select('id, name, kind, created_at, share_token, members:split_members(id, name, is_me, created_at), expenses:split_expenses(*), settlements:split_settlements(*), rounds:split_rounds(id, closed_at, created_at), claims:split_claims(id, from_id, to_id, amount, status, created_at)')
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
    mutationFn: async ({ name, kind, members }: { name: string; kind: SplitKind; members: string[] }) => {
      if (isDemo) return demo.createSplitGroup(name, kind, members);
      return rpc<string>('split_create_group', { p_name: name, p_kind: kind, p_members: members });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

export function useUpdateSplitGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { groupId: string; name: string; kind: SplitKind; members: { id: string | null; name: string }[] }) => {
      if (isDemo) return demo.updateSplitGroup(v);
      await rpc('split_update_group', { p_group: v.groupId, p_name: v.name, p_kind: v.kind, p_members: v.members });
    },
    onSuccess: () => invalidate(keys.split),
  });
}

export function useDeleteSplitGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (groupId: string) => {
      if (isDemo) return demo.deleteSplitGroup(groupId);
      await rpc('split_delete_group', { p_group: groupId });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
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
      });
    },
    onSuccess: () => invalidate(...SPLIT_TOUCHES),
  });
}

export function useDeleteSplitExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return demo.deleteSplitExpense(id);
      await rpc('split_delete_expense', { p_id: id });
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
