-- Google Drive 同步：收據放進 Drive（Monee/年/月），每年一份 Google Sheets 年度帳本
-- 前提：已執行 20261021000004_no_spend_days.sql。這份可以重複執行。
--
-- 設計重點
-- 1. Monee 的資料庫是唯一的主要資料；Google 只是報表和收據的另一份。同步失敗也不影響記帳。
-- 2. Google 的授權（refresh token）由伺服器用 GOOGLE_TOKEN_KEY 加密後存在 google_integrations，
--    只有伺服器解得開；前端的程式不讀這個欄位。權限只有 drive.file：只碰得到 Monee 自己建立的檔案。
-- 3. 交易有任何變動（記一筆、改帳、刪帳、分帳、固定收支、資料還原），trigger 就把那筆的月份記進 google_sync_months；
--    分帳花費換收據、分類改名也會記。同步時把待同步的月份整個月照資料庫重寫，不會重複，跨月和刪除也自然處理。
--    還沒連結 Google 的人不記；連結時由伺服器呼叫 google_mark_all 把有帳的月份全部記上。
-- 4. 同一個人同時只跑一個同步（google_sync_begin 拿到鎖才跑，鎖 3 分鐘後自動失效）。
-- 5. 資料夾、年度帳本、收據的 Google 檔案 id 都存起來，不用每次去 Drive 找。收據用 Supabase 上的照片路徑對應，
--    同一張照片只上傳一次；交易刪掉或換照片，對不到的那張移到 Drive 的垃圾桶。
-- 6. 這些表都不放進資料備份：換帳號或還原後重新連結，會照資料重新同步。

-- ---------- 資料表 ----------
create table if not exists public.google_integrations (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  google_email text,
  encrypted_refresh_token text not null,
  connected_at timestamptz not null default now(),
  -- 授權失效（使用者到 Google 帳號移除了權限、或太久沒用）時為 true，要重新連結
  needs_reconnect boolean not null default false,
  last_synced_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  sync_lock_until timestamptz
);

-- Drive 的資料夾：'' 是根目錄的 Monee、'2026' 是年、'2026/10' 是月
create table if not exists public.drive_folders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null check (path ~ '^(\d{4}(/\d{2})?)?$'),
  folder_id text not null,
  primary key (user_id, path)
);

create table if not exists public.annual_workbooks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  spreadsheet_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, year)
);

-- 放進 Drive 的收據：source_path 是 Supabase Storage 裡的照片路徑
create table if not exists public.drive_receipts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_path text not null,
  drive_file_id text not null,
  file_name text not null,
  folder_path text not null,
  web_view_link text,
  created_at timestamptz not null default now(),
  primary key (user_id, source_path)
);

-- 待同步的月份（那個月的 1 號）。同步成功就刪掉；失敗記下次數和原因，下次再試
create table if not exists public.google_sync_months (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  dirty_at timestamptz not null default now(),
  attempts smallint not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  primary key (user_id, month)
);

-- ---------- 權限：每個人只碰得到自己的 ----------
do $$
declare
  t text;
begin
  foreach t in array array['google_integrations', 'drive_folders', 'annual_workbooks', 'drive_receipts', 'google_sync_months'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: 只能讀自己的" on public.%I', t, t);
    execute format('drop policy if exists "%s: 只能新增自己的" on public.%I', t, t);
    execute format('drop policy if exists "%s: 只能改自己的" on public.%I', t, t);
    execute format('drop policy if exists "%s: 只能刪自己的" on public.%I', t, t);
    execute format('create policy "%s: 只能讀自己的" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s: 只能新增自己的" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s: 只能改自己的" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s: 只能刪自己的" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end $$;

-- ---------- 標記待同步的月份 ----------
-- 交易：一次寫很多筆（資料還原、刪群組）也只觸發一次。只記有連結 Google 的人
create or replace function public.google_mark_tx_months()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.google_sync_months (user_id, month)
    select distinct r.user_id, date_trunc('month', r.date)::date
    from old_rows r join public.google_integrations g on g.user_id = r.user_id
    on conflict (user_id, month) do update set dirty_at = now(), attempts = 0, last_error = null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.google_sync_months (user_id, month)
    select distinct r.user_id, date_trunc('month', r.date)::date
    from new_rows r join public.google_integrations g on g.user_id = r.user_id
    on conflict (user_id, month) do update set dirty_at = now(), attempts = 0, last_error = null;
  end if;
  return null;
end;
$$;

drop trigger if exists transactions_google_insert on public.transactions;
drop trigger if exists transactions_google_update on public.transactions;
drop trigger if exists transactions_google_delete on public.transactions;
create trigger transactions_google_insert after insert on public.transactions
  referencing new table as new_rows for each statement execute function public.google_mark_tx_months();
create trigger transactions_google_update after update on public.transactions
  referencing old table as old_rows new table as new_rows for each statement execute function public.google_mark_tx_months();
create trigger transactions_google_delete after delete on public.transactions
  referencing old table as old_rows for each statement execute function public.google_mark_tx_months();

-- 分帳花費換收據（收據記在花費上，花費寫好後才補上）：那天的月份要重新同步
create or replace function public.google_mark_expense_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.google_integrations g where g.user_id = new.user_id) then
    insert into public.google_sync_months (user_id, month)
    values (new.user_id, date_trunc('month', new.date)::date)
    on conflict (user_id, month) do update set dirty_at = now(), attempts = 0, last_error = null;
  end if;
  return null;
end;
$$;

drop trigger if exists split_expenses_google_receipt on public.split_expenses;
create trigger split_expenses_google_receipt after update of receipt_path on public.split_expenses
  for each row when (old.receipt_path is distinct from new.receipt_path) execute function public.google_mark_expense_receipt();

-- 分類新增、改名、隱藏：帳本上的分類名稱和分類設定要重寫，有帳的月份全部重新同步（一次存整份清單也只觸發一次）
create or replace function public.google_mark_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.google_sync_months (user_id, month)
  select distinct t.user_id, date_trunc('month', t.date)::date
  from public.transactions t join public.google_integrations g on g.user_id = t.user_id
  where t.user_id in (select r.user_id from new_rows r)
  on conflict (user_id, month) do update set dirty_at = now(), attempts = 0, last_error = null;
  return null;
end;
$$;

drop trigger if exists categories_google_insert on public.categories;
drop trigger if exists categories_google_update on public.categories;
create trigger categories_google_insert after insert on public.categories
  referencing new table as new_rows for each statement execute function public.google_mark_categories();
create trigger categories_google_update after update on public.categories
  referencing new table as new_rows for each statement execute function public.google_mark_categories();

-- 剛連結（或按「全部重新同步」）：有帳的月份全部記上
create or replace function public.google_mark_all()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with marked as (
    insert into public.google_sync_months (user_id, month)
    select distinct (select auth.uid()), date_trunc('month', t.date)::date
    from public.transactions t
    where t.user_id = (select auth.uid()) and t.type <> 'TRANSFER'
    on conflict (user_id, month) do update set dirty_at = now(), attempts = 0, last_error = null
    returning 1
  )
  select count(*)::integer from marked;
$$;

-- ---------- 同步的鎖：同一個人同時只跑一個 ----------
create or replace function public.google_sync_begin()
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with locked as (
    update public.google_integrations
    set sync_lock_until = now() + interval '3 minutes'
    where user_id = (select auth.uid()) and not needs_reconnect
      and (sync_lock_until is null or sync_lock_until < now())
    returning 1
  )
  select exists (select 1 from locked);
$$;

-- p_error 是 null 代表這次全部成功
create or replace function public.google_sync_finish(p_error text default null)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.google_integrations
  set sync_lock_until = null,
      last_synced_at = case when p_error is null then now() else last_synced_at end,
      last_error = left(p_error, 300)
  where user_id = (select auth.uid());
$$;

revoke execute on function public.google_mark_all() from public, anon;
revoke execute on function public.google_sync_begin() from public, anon;
revoke execute on function public.google_sync_finish(text) from public, anon;
grant execute on function public.google_mark_all() to authenticated;
grant execute on function public.google_sync_begin() to authenticated;
grant execute on function public.google_sync_finish(text) to authenticated;
-- trigger 用的函式不給直接呼叫
revoke execute on function public.google_mark_tx_months() from public, anon, authenticated;
revoke execute on function public.google_mark_expense_receipt() from public, anon, authenticated;
revoke execute on function public.google_mark_categories() from public, anon, authenticated;

-- 執行結果檢查（一定會回傳一列）：應該看到 tables = 5、policies = 20、triggers = 6、functions = 3
select
  (select count(*) from pg_tables where schemaname = 'public'
    and tablename in ('google_integrations', 'drive_folders', 'annual_workbooks', 'drive_receipts', 'google_sync_months')) as tables,
  (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('google_integrations', 'drive_folders', 'annual_workbooks', 'drive_receipts', 'google_sync_months')) as policies,
  (select count(*) from pg_trigger where not tgisinternal and tgname like '%\_google\_%') as triggers,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('google_mark_all', 'google_sync_begin', 'google_sync_finish')) as functions;
