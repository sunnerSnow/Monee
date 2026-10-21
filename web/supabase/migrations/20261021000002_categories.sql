-- 分類管理：新增自己的分類、改名換圖示、隱藏、排序；自己加的分類可以刪，刪之前把帳移到別的分類
-- 前提：已執行 20261021000001_receipts.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 內建分類（餐飲、交通…、薪資…、轉帳）寫在程式裡（lib/categories.ts）。沒改過的話這張表是空的，畫面用內建的。
-- 2. 改過任何一個分類時，前端把那一類（支出或收入）的整份清單連同順序寫進來；內建的用原本的 id，自己加的是 c_ 開頭。
--    程式之後新增的內建分類，表裡沒有的話接在最後面。轉帳固定不能改。
-- 3. 隱藏只是記一筆時不出現，以前記的帳照樣保留、照樣算進報表。內建的只能隱藏，不能刪。
-- 4. 刪掉自己加的分類（category_delete）：交易、分帳花費、朋友的待確認先移到指定的分類，再刪掉，同一個交易裡做完。
-- 5. 朋友的分享頁沒有登入，用 split_public_categories 讀這個群組擁有者的支出分類（只有名字、圖示、順序）。
-- 6. 資料備份也帶上分類（backup_export、backup_restore 重新定義，多了 categories）；舊的備份檔沒有分類，還原後就是內建分類。

-- ---------- 資料表 ----------
create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[a-z0-9_]{1,40}$'),
  type text not null check (type in ('EXPENSE', 'INCOME')),
  name text not null check (char_length(name) between 1 and 10),
  icon text not null check (icon ~ '^[a-z0-9-]{1,30}$'),
  sort_order integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.categories enable row level security;
drop policy if exists "categories: 只能讀自己的" on public.categories;
drop policy if exists "categories: 只能新增自己的" on public.categories;
drop policy if exists "categories: 只能改自己的" on public.categories;
drop policy if exists "categories: 只能刪自己的" on public.categories;
create policy "categories: 只能讀自己的" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "categories: 只能新增自己的" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categories: 只能改自己的" on public.categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories: 只能刪自己的" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 刪除自己加的分類 ----------
create or replace function public.category_delete(p_id text, p_move_to text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_id in ('food', 'transit', 'daily', 'shopping', 'fun', 'health', 'other', 'salary', 'bonus', 'investment_income', 'income_other', 'transfer') then
    raise exception '內建的分類不能刪除，可以隱藏';
  end if;
  if p_move_to is null or p_move_to = p_id or p_move_to = 'transfer' then
    raise exception '請選要把帳移到哪個分類';
  end if;

  update public.transactions set category_id = p_move_to where user_id = (select auth.uid()) and category_id = p_id;
  update public.split_expenses set category_id = p_move_to where user_id = (select auth.uid()) and category_id = p_id;
  update public.split_proposals set category_id = p_move_to where user_id = (select auth.uid()) and category_id = p_id;
  delete from public.categories where user_id = (select auth.uid()) and id = p_id;
  if not found then
    raise exception '找不到這個分類';
  end if;
end;
$$;

-- ---------- 朋友的分享頁 ----------
-- 拿到連結的人看得到這個群組擁有者的支出分類（名字、圖示、順序），收入分類不給
create or replace function public.split_public_categories(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('id', c.id, 'type', c.type, 'name', c.name, 'icon', c.icon, 'sortOrder', c.sort_order, 'hidden', c.hidden)
    order by c.sort_order, c.id
  ), '[]'::jsonb)
  from public.split_groups g
  join public.categories c on c.user_id = g.user_id and c.type = 'EXPENSE'
  where char_length(p_token) = 24 and g.share_token = p_token;
$$;

-- ---------- 資料備份（多了 categories） ----------
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

  -- 刪群組會連同成員、花費、還款、待確認，以及分帳寫進個人帳的交易一起刪；交易要比帳戶先刪
  delete from public.split_groups where user_id = v_user;
  delete from public.transactions where user_id = v_user;
  delete from public.accounts where user_id = v_user;
  delete from public.budget_history where user_id = v_user;
  delete from public.categories where user_id = v_user;

  -- 被引用的先寫：帳戶 → 群組 → 成員 → 結清紀錄 → 花費、還款 → 待確認 → 交易
  insert into public.categories
  select * from jsonb_populate_recordset(null::public.categories, public.backup_rows(p_data, 'categories'));
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

-- ---------- 權限 ----------
revoke execute on function public.category_delete(text, text) from public, anon;
grant execute on function public.category_delete(text, text) to authenticated;
revoke execute on function public.split_public_categories(text) from public;
grant execute on function public.split_public_categories(text) to anon, authenticated;
revoke execute on function public.backup_export() from public, anon;
revoke execute on function public.backup_restore(jsonb) from public, anon;
grant execute on function public.backup_export() to authenticated;
grant execute on function public.backup_restore(jsonb) to authenticated;

-- 執行結果檢查：應該看到 policies = 4、functions = 2、backup_has_categories = true
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'categories') as policies,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('category_delete', 'split_public_categories')) as functions,
  (select prosrc like '%categories%' from pg_proc where pronamespace = 'public'::regnamespace and proname = 'backup_restore') as backup_has_categories;
