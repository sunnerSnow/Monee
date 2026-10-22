-- 存錢目標：目標名稱、金額、可以不填的日期；按「存入」記一筆（拿出來是負的），像把錢放進存錢罐
-- 前提：已執行 20261022000000_google_sync.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 存入只是記在目標底下（savings_deposits），不動帳戶餘額、不算支出，跟記帳完全分開。
-- 2. 存了多少由 savings_goal_totals（view，照呼叫的人的權限讀）加總，前端不用自己算。
-- 3. 首頁顯示的目標可以釘選；savings_pin 一次把其他的取消、把這個釘上（傳 null 就是都不釘）。
-- 4. 資料備份也帶上存錢目標和存入紀錄（backup_export、backup_restore 重新定義）；舊的備份檔沒有，還原後就是空的。

-- ---------- 資料表 ----------
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  target numeric(14, 2) not null check (target > 0 and target < 100000000),
  deadline date,
  icon text not null default 'piggy-bank' check (char_length(icon) between 1 and 30),
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

create table if not exists public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount numeric(14, 2) not null check (amount <> 0 and abs(amount) < 100000000),
  date date not null default current_date,
  note text check (note is null or char_length(note) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists savings_deposits_goal_idx on public.savings_deposits (goal_id, date);

alter table public.savings_goals enable row level security;
drop policy if exists "savings_goals: 只能讀自己的" on public.savings_goals;
drop policy if exists "savings_goals: 只能新增自己的" on public.savings_goals;
drop policy if exists "savings_goals: 只能改自己的" on public.savings_goals;
drop policy if exists "savings_goals: 只能刪自己的" on public.savings_goals;
create policy "savings_goals: 只能讀自己的" on public.savings_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "savings_goals: 只能新增自己的" on public.savings_goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "savings_goals: 只能改自己的" on public.savings_goals
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "savings_goals: 只能刪自己的" on public.savings_goals
  for delete to authenticated using (user_id = (select auth.uid()));

-- 存入紀錄只能記在自己的目標底下
alter table public.savings_deposits enable row level security;
drop policy if exists "savings_deposits: 只能讀自己的" on public.savings_deposits;
drop policy if exists "savings_deposits: 只能新增自己的" on public.savings_deposits;
drop policy if exists "savings_deposits: 只能改自己的" on public.savings_deposits;
drop policy if exists "savings_deposits: 只能刪自己的" on public.savings_deposits;
create policy "savings_deposits: 只能讀自己的" on public.savings_deposits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "savings_deposits: 只能新增自己的" on public.savings_deposits
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "savings_deposits: 只能改自己的" on public.savings_deposits
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "savings_deposits: 只能刪自己的" on public.savings_deposits
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 每個目標存了多少 ----------
create or replace view public.savings_goal_totals with (security_invoker = true) as
select g.id, g.name, g.target, g.deadline, g.icon, g.pinned, g.archived, g.created_at,
       coalesce((select sum(d.amount) from public.savings_deposits d where d.goal_id = g.id), 0) as saved
from public.savings_goals g;

-- ---------- 釘選在首頁：一次只有一個 ----------
create or replace function public.savings_pin(p_goal uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.savings_goals
  set pinned = (id is not distinct from p_goal)
  where user_id = (select auth.uid()) and (pinned or id is not distinct from p_goal);
$$;

-- ---------- 資料備份（多了 savings_goals、savings_deposits） ----------
create or replace function public.backup_export()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'format', 'monee-backup',
    'version', 1,
    'exportedAt', now(),
    'owner', (select auth.uid()),
    'profile', (
      select jsonb_build_object('pnl_color', p.pnl_color, 'display_name', p.display_name, 'pay_bank', p.pay_bank, 'pay_line', p.pay_line)
      from public.profiles p where p.user_id = (select auth.uid())
    ),
    'categories', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.type, t.sort_order, t.id), '[]'::jsonb)
                   from public.categories t where t.user_id = (select auth.uid())),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                 from public.accounts t where t.user_id = (select auth.uid())),
    'recurring_rules', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                        from public.recurring_rules t where t.user_id = (select auth.uid())),
    'budget_history', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.effective_month), '[]'::jsonb)
                       from public.budget_history t where t.user_id = (select auth.uid())),
    'no_spend_days', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.date), '[]'::jsonb)
                      from public.no_spend_days t where t.user_id = (select auth.uid())),
    'savings_goals', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                      from public.savings_goals t where t.user_id = (select auth.uid())),
    'savings_deposits', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.date, t.created_at, t.id), '[]'::jsonb)
                         from public.savings_deposits t where t.user_id = (select auth.uid())),
    'split_groups', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                     from public.split_groups t where t.user_id = (select auth.uid())),
    'split_members', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                      from public.split_members t where t.user_id = (select auth.uid())),
    'split_rounds', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                     from public.split_rounds t where t.user_id = (select auth.uid())),
    'split_expenses', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                       from public.split_expenses t where t.user_id = (select auth.uid())),
    'split_settlements', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                          from public.split_settlements t where t.user_id = (select auth.uid())),
    'split_claims', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                     from public.split_claims t where t.user_id = (select auth.uid())),
    'split_proposals', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                        from public.split_proposals t where t.user_id = (select auth.uid())),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.date, t.created_at, t.id), '[]'::jsonb)
                     from public.transactions t where t.user_id = (select auth.uid()))
  );
$$;

create or replace function public.backup_restore(p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile jsonb := p_data -> 'profile';
begin
  if v_user is null then
    raise exception '登入已過期，請重新登入';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object' or p_data ->> 'format' is distinct from 'monee-backup' then
    raise exception '這個檔案不是 Monee 的備份檔';
  end if;
  if p_data -> 'version' is distinct from '1'::jsonb then
    raise exception '不支援這個版本的備份檔';
  end if;

  insert into public.backup_snapshots (user_id, data) values (v_user, public.backup_export())
  on conflict (user_id) do update set data = excluded.data, created_at = now();

  -- 刪群組會連同成員、花費、還款、待確認，以及分帳寫進個人帳的交易一起刪；交易要比帳戶先刪（固定收支跟著帳戶刪）；
  -- 存錢目標刪掉時存入紀錄跟著刪
  delete from public.split_groups where user_id = v_user;
  delete from public.transactions where user_id = v_user;
  delete from public.recurring_rules where user_id = v_user;
  delete from public.accounts where user_id = v_user;
  delete from public.budget_history where user_id = v_user;
  delete from public.no_spend_days where user_id = v_user;
  delete from public.savings_goals where user_id = v_user;
  delete from public.categories where user_id = v_user;

  -- 被引用的先寫：帳戶 → 固定收支 → 存錢目標 → 存入紀錄 → 群組 → 成員 → 結清紀錄 → 花費、還款 → 待確認 → 交易
  insert into public.categories
  select * from jsonb_populate_recordset(null::public.categories, public.backup_rows(p_data, 'categories'));
  insert into public.accounts
  select * from jsonb_populate_recordset(null::public.accounts, public.backup_rows(p_data, 'accounts'));
  insert into public.recurring_rules
  select * from jsonb_populate_recordset(null::public.recurring_rules, public.backup_rows(p_data, 'recurring_rules'));
  insert into public.budget_history
  select * from jsonb_populate_recordset(null::public.budget_history, public.backup_rows(p_data, 'budget_history'));
  insert into public.no_spend_days
  select * from jsonb_populate_recordset(null::public.no_spend_days, public.backup_rows(p_data, 'no_spend_days'));
  insert into public.savings_goals
  select * from jsonb_populate_recordset(null::public.savings_goals, public.backup_rows(p_data, 'savings_goals'));
  insert into public.savings_deposits
  select * from jsonb_populate_recordset(null::public.savings_deposits, public.backup_rows(p_data, 'savings_deposits'));
  insert into public.split_groups
  select * from jsonb_populate_recordset(null::public.split_groups, public.backup_rows(p_data, 'split_groups'));
  insert into public.split_members
  select * from jsonb_populate_recordset(null::public.split_members, public.backup_rows(p_data, 'split_members'));
  insert into public.split_rounds
  select * from jsonb_populate_recordset(null::public.split_rounds, public.backup_rows(p_data, 'split_rounds'));
  insert into public.split_expenses
  select * from jsonb_populate_recordset(null::public.split_expenses, public.backup_rows(p_data, 'split_expenses'));
  insert into public.split_settlements
  select * from jsonb_populate_recordset(null::public.split_settlements, public.backup_rows(p_data, 'split_settlements'));
  insert into public.split_claims
  select * from jsonb_populate_recordset(null::public.split_claims, public.backup_rows(p_data, 'split_claims'));
  insert into public.split_proposals
  select * from jsonb_populate_recordset(null::public.split_proposals, public.backup_rows(p_data, 'split_proposals'));
  insert into public.transactions
  select * from jsonb_populate_recordset(null::public.transactions, public.backup_rows(p_data, 'transactions'));

  if jsonb_typeof(v_profile) = 'object' then
    update public.profiles
    set pnl_color = coalesce(v_profile ->> 'pnl_color', pnl_color),
        display_name = v_profile ->> 'display_name',
        pay_bank = v_profile ->> 'pay_bank',
        pay_line = v_profile ->> 'pay_line'
    where user_id = v_user;
  end if;
end;
$$;

-- ---------- 權限 ----------
revoke all on public.savings_goal_totals from public, anon;
grant select on public.savings_goal_totals to authenticated;
revoke execute on function public.savings_pin(uuid) from public, anon;
grant execute on function public.savings_pin(uuid) to authenticated;
revoke execute on function public.backup_export() from public, anon;
revoke execute on function public.backup_restore(jsonb) from public, anon;
grant execute on function public.backup_export() to authenticated;
grant execute on function public.backup_restore(jsonb) to authenticated;

-- 執行結果檢查（一定會回傳一列）：應該看到 tables = 2、policies = 8、has_view = true、backup_has_goals = true
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('savings_goals', 'savings_deposits')) as tables,
  (select count(*) from pg_policies where schemaname = 'public' and tablename in ('savings_goals', 'savings_deposits')) as policies,
  to_regclass('public.savings_goal_totals') is not null as has_view,
  coalesce((select prosrc like '%savings_goals%' from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'backup_restore'), false) as backup_has_goals;
