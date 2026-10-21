-- 固定收支：房租、訂閱、薪水這類每月、每週、每年記一次的帳
-- 前提：已執行 20261021000002_categories.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 每一筆固定收支記著週期與「下次日期」（next_date）。日期怎麼算在前端（lib/recurring.ts，有測試）：
--    每月 29–31 號遇到小月記在最後一天，2 月 29 日遇到平年記在 28 日。
-- 2. 到期時（「自動記下」的在打開 App 時、「先問我」的在使用者按記下或略過時）呼叫 recurring_post：
--    把要記的日期一次寫成交易，再把 next_date 往後推，同一個交易裡做完。
--    呼叫時要帶「我以為的下次日期」（p_expected），跟資料庫裡的不一樣就什麼都不做：
--    兩支手機同時打開 App 也只會記一次。
-- 3. 固定收支產生的交易記著 recurring_id，明細裡可以標示；刪掉固定收支不會刪掉已經記的帳。
-- 4. 資料備份也帶上固定收支（backup_export、backup_restore 重新定義）；舊的備份檔沒有，還原後就是空的。

-- ---------- 資料表 ----------
create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0 and amount < 100000000),
  category_id text not null check (char_length(category_id) between 1 and 40),
  source_account_id uuid not null references public.accounts (id) on delete cascade,
  target_account_id uuid references public.accounts (id) on delete cascade,
  note text check (note is null or char_length(note) <= 100),
  frequency text not null check (frequency in ('monthly', 'weekly', 'yearly')),
  day smallint not null,
  month smallint,
  auto boolean not null default false,
  next_date date not null,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  constraint recurring_day_check check (
    (frequency = 'weekly' and day between 0 and 6 and month is null)
    or (frequency = 'monthly' and day between 1 and 31 and month is null)
    or (frequency = 'yearly' and day between 1 and 31 and month between 1 and 12)
  ),
  constraint recurring_transfer_check check (
    (type = 'TRANSFER') = (target_account_id is not null) and (target_account_id is null or target_account_id <> source_account_id)
  )
);
create index if not exists recurring_rules_user_idx on public.recurring_rules (user_id, next_date);

alter table public.transactions add column if not exists recurring_id uuid references public.recurring_rules (id) on delete set null;
create index if not exists transactions_recurring_idx on public.transactions (recurring_id);

alter table public.recurring_rules enable row level security;
drop policy if exists "recurring_rules: 只能讀自己的" on public.recurring_rules;
drop policy if exists "recurring_rules: 只能新增自己的" on public.recurring_rules;
drop policy if exists "recurring_rules: 只能改自己的" on public.recurring_rules;
drop policy if exists "recurring_rules: 只能刪自己的" on public.recurring_rules;
create policy "recurring_rules: 只能讀自己的" on public.recurring_rules
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recurring_rules: 只能新增自己的" on public.recurring_rules
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_account(source_account_id) and public.owns_account(target_account_id));
create policy "recurring_rules: 只能改自己的" on public.recurring_rules
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_account(source_account_id) and public.owns_account(target_account_id));
create policy "recurring_rules: 只能刪自己的" on public.recurring_rules
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 記下到期的固定收支 ----------
-- p_dates：要記的日期（略過就傳空陣列）；p_next：記完之後的下次日期；p_expected：呼叫的人以為的下次日期；
-- p_amount：這次的金額（先問我的時候可以改），沒給就用固定收支的金額。回傳 false 代表別的裝置已經處理過。
create or replace function public.recurring_post(p_rule uuid, p_dates date[], p_next date, p_expected date, p_amount numeric default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.recurring_rules;
  d date;
begin
  select * into r from public.recurring_rules where id = p_rule for update;
  if not found then
    raise exception '找不到這筆固定收支';
  end if;
  if r.next_date is distinct from p_expected then
    return false;
  end if;
  if coalesce(array_length(p_dates, 1), 0) > 24 then
    raise exception '一次最多補記 24 筆';
  end if;
  if p_next is null or p_next <= p_expected then
    raise exception '下次日期不對';
  end if;
  if p_amount is not null and (p_amount <= 0 or p_amount >= 100000000) then
    raise exception '請輸入金額';
  end if;

  foreach d in array coalesce(p_dates, '{}') loop
    -- 手機的「今天」可能比伺服器早一天（時區），多留一天
    if d < p_expected or d > current_date + 1 then
      raise exception '日期不對';
    end if;
    insert into public.transactions (date, type, amount, category_id, source_account_id, target_account_id, note, recurring_id)
    values (d, r.type, coalesce(p_amount, r.amount), r.category_id, r.source_account_id, r.target_account_id, r.note, r.id);
  end loop;

  update public.recurring_rules set next_date = p_next where id = r.id;
  return true;
end;
$$;

-- ---------- 資料備份（多了 recurring_rules） ----------
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
revoke execute on function public.recurring_post(uuid, date[], date, date, numeric) from public, anon;
grant execute on function public.recurring_post(uuid, date[], date, date, numeric) to authenticated;
revoke execute on function public.backup_export() from public, anon;
revoke execute on function public.backup_restore(jsonb) from public, anon;
grant execute on function public.backup_export() to authenticated;
grant execute on function public.backup_restore(jsonb) to authenticated;

-- 執行結果檢查：應該看到 policies = 4、has_column = 1、backup_has_recurring = true
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'recurring_rules') as policies,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'transactions' and column_name = 'recurring_id') as has_column,
  (select prosrc like '%recurring_rules%' from pg_proc where pronamespace = 'public'::regnamespace and proname = 'backup_restore') as backup_has_recurring;
