-- Monee Phase 1 資料結構
-- 對應 monee_ux.md「04. 資料結構模型」。在 Supabase 後台 SQL Editor 整份貼上執行一次即可。
--
-- 設計重點
-- 1. 每張表都開 RLS，每個人只能讀寫自己的資料。
-- 2. 帳戶餘額不存欄位，由「期初餘額 + 交易」即時計算（account_balances view），不會跟流水對不上。
-- 3. 轉帳（TRANSFER）一定要有轉入帳戶，且不算進支出；校準差額用一般收支補記。

-- ---------- 列舉 ----------
create type public.account_type as enum ('CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT_MIRROR');
create type public.transaction_type as enum ('EXPENSE', 'INCOME', 'TRANSFER');

-- ---------- 使用者設定 ----------
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  monthly_budget numeric(14, 2) check (monthly_budget is null or monthly_budget > 0),
  pnl_color text not null default 'red_up' check (pnl_color in ('red_up', 'green_up')),
  created_at timestamptz not null default now()
);

-- 新使用者註冊時自動建立設定列
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 帳戶 ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  type public.account_type not null,
  currency text not null default 'TWD',
  -- 建立帳戶當下的餘額；信用卡為待繳金額的負數
  opening_balance numeric(14, 2) not null default 0,
  icon text,
  -- 外部投資帳戶的唯讀快照（Phase 3 由 Monee Invest 同步）
  investment_snapshot jsonb,
  last_reconciled_at timestamptz,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_user_idx on public.accounts (user_id, sort_order);

-- ---------- 交易 ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  time time,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id text not null,
  source_account_id uuid not null references public.accounts (id) on delete restrict,
  target_account_id uuid references public.accounts (id) on delete restrict,
  note text check (note is null or char_length(note) <= 100),
  receipt_image_url text,
  created_at timestamptz not null default now(),
  constraint transfer_needs_target check ((type = 'TRANSFER') = (target_account_id is not null)),
  constraint transfer_distinct_accounts check (target_account_id is null or target_account_id <> source_account_id)
);

create index transactions_user_date_idx on public.transactions (user_id, date desc, time desc);
create index transactions_source_idx on public.transactions (source_account_id);
create index transactions_target_idx on public.transactions (target_account_id);

-- ---------- 帳戶餘額（即時計算） ----------
-- security_invoker：查詢時套用呼叫者的 RLS，不會看到別人的帳戶
create view public.account_balances
with (security_invoker = true) as
select
  a.*,
  a.opening_balance + coalesce(sum(
    case
      when t.source_account_id = a.id and t.type = 'INCOME' then t.amount
      when t.source_account_id = a.id then -t.amount          -- 支出、轉出
      when t.target_account_id = a.id then t.amount           -- 轉入
      else 0
    end
  ), 0) as current_balance
from public.accounts a
left join public.transactions t
  on t.source_account_id = a.id or t.target_account_id = a.id
group by a.id;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "profiles: 只能讀自己的" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: 只能新增自己的" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profiles: 只能改自己的" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "accounts: 只能讀自己的" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "accounts: 只能新增自己的" on public.accounts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "accounts: 只能改自己的" on public.accounts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "accounts: 只能刪自己的" on public.accounts
  for delete to authenticated using (user_id = (select auth.uid()));

-- 交易引用的帳戶也必須是自己的，避免猜到別人的帳戶 id 寫進去
create function public.owns_account(account_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select account_id is null
    or exists (select 1 from public.accounts where id = account_id and user_id = (select auth.uid()));
$$;

create policy "transactions: 只能讀自己的" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions: 只能新增自己的" on public.transactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_account(source_account_id)
    and public.owns_account(target_account_id)
  );
create policy "transactions: 只能改自己的" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.owns_account(source_account_id)
    and public.owns_account(target_account_id)
  );
create policy "transactions: 只能刪自己的" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));
