-- 資料備份：下載一份備份檔，資料出錯或換帳號時上傳還原
-- 前提：已執行 20261012000001_budget_scope.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 備份檔由 backup_export 產生：每張表的資料列照原樣（不含 user_id），加上個人設定（名字、收款方式、漲跌配色）。
--    Google Sheets 的試算表 id 不放進去，那是跟 Google 帳號綁在一起的。
-- 2. backup_restore 整個換掉：先留一份現在的資料（backup_snapshots），再清掉、照備份寫回去，全部在同一個交易裡，
--    中途有任何一筆寫不進去就整個不動。還原錯了可以拿留下的那一份再還原一次（換回來）。
-- 3. 函式都是 security invoker，照樣套用 RLS：備份檔被改過也只寫得進自己的資料，引用的帳戶、群組一定是自己的。
--    同一個帳號照原本的 id 寫回去，朋友手上的分享連結繼續有效；換帳號時前端會先換掉所有 id、拿掉分享連結。
-- 4. 之後幫這些表加 not null 的欄位時，要記得處理舊備份檔沒有那個欄位的情況（jsonb_populate_recordset 會填 null）。

-- ---------- 還原前留的那一份 ----------
create table if not exists public.backup_snapshots (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.backup_snapshots enable row level security;
drop policy if exists "backup_snapshots: 只能讀自己的" on public.backup_snapshots;
drop policy if exists "backup_snapshots: 只能新增自己的" on public.backup_snapshots;
drop policy if exists "backup_snapshots: 只能改自己的" on public.backup_snapshots;
drop policy if exists "backup_snapshots: 只能刪自己的" on public.backup_snapshots;
create policy "backup_snapshots: 只能讀自己的" on public.backup_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
create policy "backup_snapshots: 只能新增自己的" on public.backup_snapshots
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "backup_snapshots: 只能改自己的" on public.backup_snapshots
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "backup_snapshots: 只能刪自己的" on public.backup_snapshots
  for delete to authenticated using (user_id = (select auth.uid()));

-- 待確認原本只由朋友的分享頁（security definer 函式）新增；還原時要由你自己寫回去，群組一定要是你的
drop policy if exists "split_claims: 只能新增自己的" on public.split_claims;
create policy "split_claims: 只能新增自己的" on public.split_claims
  for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_split_group(group_id));
drop policy if exists "split_proposals: 只能新增自己的" on public.split_proposals;
create policy "split_proposals: 只能新增自己的" on public.split_proposals
  for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_split_group(group_id));

-- ---------- 函式 ----------

-- 你的全部資料
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
    'accounts', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' order by t.created_at, t.id), '[]'::jsonb)
                 from public.accounts t where t.user_id = (select auth.uid())),
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

-- 備份檔裡某張表的資料列，user_id 一律換成你自己
create or replace function public.backup_rows(p_data jsonb, p_table text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(r || jsonb_build_object('user_id', (select auth.uid()))), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_data -> p_table, '[]'::jsonb)) r;
$$;

-- 整個換成備份的內容；換之前先留一份現在的資料
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

  -- 刪群組會連同成員、花費、還款、待確認，以及分帳寫進個人帳的交易一起刪；交易要比帳戶先刪
  delete from public.split_groups where user_id = v_user;
  delete from public.transactions where user_id = v_user;
  delete from public.accounts where user_id = v_user;
  delete from public.budget_history where user_id = v_user;

  -- 被引用的先寫：帳戶 → 群組 → 成員 → 結清紀錄 → 花費、還款 → 待確認 → 交易
  insert into public.accounts
  select * from jsonb_populate_recordset(null::public.accounts, public.backup_rows(p_data, 'accounts'));
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

-- 只給登入的人呼叫
revoke execute on function public.backup_export() from public, anon;
revoke execute on function public.backup_rows(jsonb, text) from public, anon;
revoke execute on function public.backup_restore(jsonb) from public, anon;
grant execute on function public.backup_export() to authenticated;
grant execute on function public.backup_rows(jsonb, text) to authenticated;
grant execute on function public.backup_restore(jsonb) to authenticated;

-- 執行結果檢查：應該看到 snapshot_policies = 4、insert_policies = 2、functions = 3
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'backup_snapshots') as snapshot_policies,
  (select count(*) from pg_policies where schemaname = 'public' and tablename in ('split_claims', 'split_proposals') and cmd = 'INSERT') as insert_policies,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('backup_export', 'backup_rows', 'backup_restore')) as functions;
