-- 連續記帳與無消費日
-- 前提：已執行 20261021000003_recurring.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 沒記帳的日子分不出是沒花錢還是忘了記，所以無消費日要使用者按「今天沒花錢」（或在月曆上補蓋）才算，存在 no_spend_days。
--    那天後來記了支出就不算無消費日（章留著，支出刪掉又會出現），由前端判斷（lib/streak.ts，有測試）。
-- 2. 連續天數、徽章要看全部的日子，但首頁只讀最近 6 個月的交易。activity_days 只回傳日期，
--    用一個 jsonb 回傳，不受 API 一次最多 1000 列的限制。
-- 3. 固定收支產生的交易（recurring_id 不是 null）不算自己記帳，也不算花錢：那天照樣可以按「今天沒花錢」。
-- 4. 資料備份也帶上無消費日（backup_export、backup_restore 重新定義）；舊的備份檔沒有，還原後就是空的。

-- ---------- 資料表 ----------
create table if not exists public.no_spend_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.no_spend_days enable row level security;
drop policy if exists "no_spend_days: 只能讀自己的" on public.no_spend_days;
drop policy if exists "no_spend_days: 只能新增自己的" on public.no_spend_days;
drop policy if exists "no_spend_days: 只能刪自己的" on public.no_spend_days;
create policy "no_spend_days: 只能讀自己的" on public.no_spend_days
  for select to authenticated using (user_id = (select auth.uid()));
-- 不能蓋未來的日子；手機的「今天」可能比伺服器早一天（時區），多留一天
create policy "no_spend_days: 只能新增自己的" on public.no_spend_days
  for insert to authenticated with check (user_id = (select auth.uid()) and date <= current_date + 1);
create policy "no_spend_days: 只能刪自己的" on public.no_spend_days
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 哪些日子有記帳、有支出、無消費 ----------
create or replace function public.activity_days()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'logged', (select coalesce(jsonb_agg(x.d order by x.d), '[]'::jsonb)
               from (select distinct t.date as d from public.transactions t
                     where t.user_id = (select auth.uid()) and t.recurring_id is null) x),
    'spent', (select coalesce(jsonb_agg(x.d order by x.d), '[]'::jsonb)
              from (select distinct t.date as d from public.transactions t
                    where t.user_id = (select auth.uid()) and t.recurring_id is null and t.type = 'EXPENSE') x),
    'no_spend', (select coalesce(jsonb_agg(n.date order by n.date), '[]'::jsonb)
                 from public.no_spend_days n where n.user_id = (select auth.uid()))
  );
$$;

-- ---------- 資料備份（多了 no_spend_days） ----------
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

  -- 刪群組會連同成員、花費、還款、待確認，以及分帳寫進個人帳的交易一起刪；交易要比帳戶先刪（固定收支跟著帳戶刪）
  delete from public.split_groups where user_id = v_user;
  delete from public.transactions where user_id = v_user;
  delete from public.recurring_rules where user_id = v_user;
  delete from public.accounts where user_id = v_user;
  delete from public.budget_history where user_id = v_user;
  delete from public.no_spend_days where user_id = v_user;
  delete from public.categories where user_id = v_user;

  -- 被引用的先寫：帳戶 → 固定收支 → 群組 → 成員 → 結清紀錄 → 花費、還款 → 待確認 → 交易
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
revoke execute on function public.activity_days() from public, anon;
grant execute on function public.activity_days() to authenticated;
revoke execute on function public.backup_export() from public, anon;
revoke execute on function public.backup_restore(jsonb) from public, anon;
grant execute on function public.backup_export() to authenticated;
grant execute on function public.backup_restore(jsonb) to authenticated;

-- 執行結果檢查（一定會回傳一列）：應該看到 has_table = true、policies = 3、has_activity = true、backup_has_no_spend = true
select
  to_regclass('public.no_spend_days') is not null as has_table,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'no_spend_days') as policies,
  exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'activity_days') as has_activity,
  coalesce((select prosrc like '%no_spend_days%' from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'backup_restore'), false) as backup_has_no_spend;
