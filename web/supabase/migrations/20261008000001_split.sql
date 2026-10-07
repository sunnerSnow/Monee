-- 分帳 Phase ①：群組、成員、花費、還款、結清紀錄，以及寫進個人帳的交易
-- 前提：已執行 20261008000000_friends_account_type.sql。這份可以重複執行。
--
-- 設計重點（詳見 monee_ux.md「06. 分帳」）
-- 1. 朋友只有名字（split_members），不用帳號；每個群組有一位 is_me 的成員代表你自己。
-- 2. 每筆花費存「怎麼分」的輸入（weights）和算好的金額（amounts，key 是成員 id），金額由前端算、這裡檢查加總。
-- 3. 跟你有關的花費與還款，會同時寫進 transactions；朋友欠你的錢記在系統建立的「朋友往來」帳戶（FRIENDS）。
--    你先付：支出（你的部分）＋轉帳（代墊 → 朋友往來）；朋友先付：從朋友往來支出你的部分；還款：朋友往來 ↔ 你的帳戶。
-- 4. round_id 為 null 的是還沒結清的；全部還清時收進一筆 split_rounds（結清紀錄）。
-- 5. 寫入都走下面的函式（security invoker，照樣套用 RLS），一次寫完花費與交易，不會只寫一半。

-- ---------- 資料表 ----------
create table if not exists public.split_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  kind text not null default 'daily' check (kind in ('daily', 'event')),
  created_at timestamptz not null default now()
);

create table if not exists public.split_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.split_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 12),
  is_me boolean not null default false,
  created_at timestamptz not null default now(),
  -- 可延後檢查：兩個人互換名字時，中間短暫重複也沒關係
  constraint split_members_unique_name unique (group_id, name) deferrable initially deferred
);
create unique index if not exists split_members_one_me on public.split_members (group_id) where is_me;

create table if not exists public.split_rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.split_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  closed_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.split_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.split_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  round_id uuid references public.split_rounds (id) on delete set null,
  date date not null,
  time time,
  title text not null check (char_length(title) between 1 and 40),
  category_id text not null,
  amount numeric(14, 2) not null check (amount > 0),
  payer_id uuid not null references public.split_members (id),
  -- 你先付時從哪個帳戶付；朋友先付時為 null
  account_id uuid references public.accounts (id) on delete restrict,
  mode text not null check (mode in ('equal', 'exact', 'shares')),
  weights jsonb not null,
  amounts jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.split_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.split_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  round_id uuid references public.split_rounds (id) on delete set null,
  from_id uuid not null references public.split_members (id),
  to_id uuid not null references public.split_members (id),
  amount numeric(14, 2) not null check (amount > 0),
  -- 跟你有關的還款，錢進出哪個帳戶；朋友之間的為 null
  account_id uuid references public.accounts (id) on delete restrict,
  date date not null,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create index if not exists split_groups_user_idx on public.split_groups (user_id);
create index if not exists split_members_group_idx on public.split_members (group_id);
create index if not exists split_rounds_group_idx on public.split_rounds (group_id);
create index if not exists split_expenses_group_idx on public.split_expenses (group_id, round_id);
create index if not exists split_settlements_group_idx on public.split_settlements (group_id, round_id);

-- 分帳寫進個人帳的交易：刪掉花費或還款時一起刪
alter table public.transactions
  add column if not exists split_expense_id uuid references public.split_expenses (id) on delete cascade,
  add column if not exists split_settlement_id uuid references public.split_settlements (id) on delete cascade;
create index if not exists transactions_split_expense_idx on public.transactions (split_expense_id);
create index if not exists transactions_split_settlement_idx on public.transactions (split_settlement_id);

-- 每個人只有一個「朋友往來」帳戶
create unique index if not exists accounts_one_friends on public.accounts (user_id) where type = 'FRIENDS';

-- ---------- RLS ----------
alter table public.split_groups enable row level security;
alter table public.split_members enable row level security;
alter table public.split_rounds enable row level security;
alter table public.split_expenses enable row level security;
alter table public.split_settlements enable row level security;

-- 子資料表引用的群組也必須是自己的
create or replace function public.owns_split_group(p_group uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.split_groups where id = p_group and user_id = (select auth.uid()));
$$;

drop policy if exists "split_groups: 只能讀自己的" on public.split_groups;
drop policy if exists "split_groups: 只能新增自己的" on public.split_groups;
drop policy if exists "split_groups: 只能改自己的" on public.split_groups;
drop policy if exists "split_groups: 只能刪自己的" on public.split_groups;
create policy "split_groups: 只能讀自己的" on public.split_groups
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_groups: 只能新增自己的" on public.split_groups
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "split_groups: 只能改自己的" on public.split_groups
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "split_groups: 只能刪自己的" on public.split_groups
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "split_members: 只能讀自己的" on public.split_members;
drop policy if exists "split_members: 只能新增自己的" on public.split_members;
drop policy if exists "split_members: 只能改自己的" on public.split_members;
drop policy if exists "split_members: 只能刪自己的" on public.split_members;
create policy "split_members: 只能讀自己的" on public.split_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_members: 只能新增自己的" on public.split_members
  for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_split_group(group_id));
create policy "split_members: 只能改自己的" on public.split_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_split_group(group_id));
create policy "split_members: 只能刪自己的" on public.split_members
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "split_rounds: 只能讀自己的" on public.split_rounds;
drop policy if exists "split_rounds: 只能新增自己的" on public.split_rounds;
drop policy if exists "split_rounds: 只能刪自己的" on public.split_rounds;
create policy "split_rounds: 只能讀自己的" on public.split_rounds
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_rounds: 只能新增自己的" on public.split_rounds
  for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_split_group(group_id));
create policy "split_rounds: 只能刪自己的" on public.split_rounds
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "split_expenses: 只能讀自己的" on public.split_expenses;
drop policy if exists "split_expenses: 只能新增自己的" on public.split_expenses;
drop policy if exists "split_expenses: 只能改自己的" on public.split_expenses;
drop policy if exists "split_expenses: 只能刪自己的" on public.split_expenses;
create policy "split_expenses: 只能讀自己的" on public.split_expenses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_expenses: 只能新增自己的" on public.split_expenses
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_split_group(group_id) and public.owns_account(account_id));
create policy "split_expenses: 只能改自己的" on public.split_expenses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_split_group(group_id) and public.owns_account(account_id));
create policy "split_expenses: 只能刪自己的" on public.split_expenses
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "split_settlements: 只能讀自己的" on public.split_settlements;
drop policy if exists "split_settlements: 只能新增自己的" on public.split_settlements;
drop policy if exists "split_settlements: 只能改自己的" on public.split_settlements;
drop policy if exists "split_settlements: 只能刪自己的" on public.split_settlements;
create policy "split_settlements: 只能讀自己的" on public.split_settlements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_settlements: 只能新增自己的" on public.split_settlements
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_split_group(group_id) and public.owns_account(account_id));
create policy "split_settlements: 只能改自己的" on public.split_settlements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_split_group(group_id) and public.owns_account(account_id));
create policy "split_settlements: 只能刪自己的" on public.split_settlements
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 函式 ----------

-- 你的「朋友往來」帳戶；第一次用到分帳時自動建立
create or replace function public.split_friends_account()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.accounts where user_id = (select auth.uid()) and type = 'FRIENDS';
  if v_id is null then
    insert into public.accounts (name, type, opening_balance, sort_order)
    values ('朋友往來', 'FRIENDS', 0, 9999)
    on conflict (user_id) where type = 'FRIENDS' do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.accounts where user_id = (select auth.uid()) and type = 'FRIENDS';
    end if;
  end if;
  return v_id;
end;
$$;

-- 建立群組：你自己（is_me）加上朋友的名字
create or replace function public.split_create_group(p_name text, p_kind text, p_members text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  insert into public.split_groups (name, kind) values (trim(p_name), coalesce(p_kind, 'daily')) returning id into v_id;
  insert into public.split_members (group_id, name, is_me) values (v_id, '我', true);
  foreach v_name in array coalesce(p_members, '{}') loop
    v_name := trim(v_name);
    if v_name <> '' and not exists (select 1 from public.split_members where group_id = v_id and name = v_name) then
      insert into public.split_members (group_id, name) values (v_id, v_name);
    end if;
  end loop;
  if (select count(*) from public.split_members where group_id = v_id) < 2 then
    raise exception '至少要有一位朋友';
  end if;
  return v_id;
end;
$$;

-- 修改群組：p_members 是朋友清單 [{"id": 舊成員 id 或 null, "name": "小明"}]；不在清單裡的朋友會被移除
create or replace function public.split_update_group(p_group uuid, p_name text, p_kind text, p_members jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_keep uuid[] := '{}';
begin
  update public.split_groups set name = trim(p_name), kind = p_kind where id = p_group;
  if not found then
    raise exception '找不到這個群組';
  end if;

  for v_item in select value from jsonb_array_elements(p_members) loop
    if v_item ->> 'id' is not null then
      v_keep := v_keep || (v_item ->> 'id')::uuid;
    end if;
  end loop;

  -- 有花費或還款紀錄的人移除後帳會對不起來，只能改名
  if exists (
    select 1 from public.split_members m
    where m.group_id = p_group and not m.is_me and not (m.id = any (v_keep))
      and (
        exists (select 1 from public.split_expenses e where e.group_id = p_group and (e.payer_id = m.id or e.amounts ? m.id::text))
        or exists (select 1 from public.split_settlements s where s.group_id = p_group and m.id in (s.from_id, s.to_id))
      )
  ) then
    raise exception '有花費或還款紀錄的成員不能移除，可以改名';
  end if;
  delete from public.split_members where group_id = p_group and not is_me and not (id = any (v_keep));

  for v_item in select value from jsonb_array_elements(p_members) loop
    if v_item ->> 'id' is not null then
      update public.split_members set name = trim(v_item ->> 'name')
      where id = (v_item ->> 'id')::uuid and group_id = p_group and not is_me;
    else
      insert into public.split_members (group_id, name) values (p_group, trim(v_item ->> 'name'));
    end if;
  end loop;

  if (select count(*) from public.split_members where group_id = p_group) < 2 then
    raise exception '至少要有一位朋友';
  end if;
end;
$$;

-- 刪除群組：只能刪還沒有任何花費的群組
create or replace function public.split_delete_group(p_group uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.split_expenses where group_id = p_group) then
    raise exception '有花費紀錄的群組不能刪除';
  end if;
  delete from public.split_groups where id = p_group;
  if not found then
    raise exception '找不到這個群組';
  end if;
end;
$$;

-- 每個成員在還沒結清的帳裡的淨額：正數是別人欠他，負數是他欠別人
create or replace function public.split_balances(p_group uuid)
returns table (member_id uuid, net numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    coalesce((select sum(e.amount) from public.split_expenses e
              where e.group_id = p_group and e.round_id is null and e.payer_id = m.id), 0)
    - coalesce((select sum((e.amounts ->> m.id::text)::numeric) from public.split_expenses e
                where e.group_id = p_group and e.round_id is null and e.amounts ? m.id::text), 0)
    + coalesce((select sum(s.amount) from public.split_settlements s
                where s.group_id = p_group and s.round_id is null and s.from_id = m.id), 0)
    - coalesce((select sum(s.amount) from public.split_settlements s
                where s.group_id = p_group and s.round_id is null and s.to_id = m.id), 0)
  from public.split_members m
  where m.group_id = p_group;
$$;

-- 全部還清就收起這一輪；回傳有沒有收起
create or replace function public.split_close_if_settled(p_group uuid, p_date date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_round uuid;
begin
  if not exists (select 1 from public.split_expenses where group_id = p_group and round_id is null) then
    return false;
  end if;
  if exists (select 1 from public.split_balances(p_group) where net <> 0) then
    return false;
  end if;
  insert into public.split_rounds (group_id, closed_at) values (p_group, p_date) returning id into v_round;
  update public.split_expenses set round_id = v_round where group_id = p_group and round_id is null;
  update public.split_settlements set round_id = v_round where group_id = p_group and round_id is null;
  return true;
end;
$$;

-- 新增或修改一筆花費，並重寫它在你個人帳的交易
create or replace function public.split_save_expense(
  p_id uuid,
  p_group uuid,
  p_date date,
  p_time time,
  p_title text,
  p_category text,
  p_amount numeric,
  p_payer uuid,
  p_account uuid,
  p_mode text,
  p_weights jsonb,
  p_amounts jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_me uuid;
  v_mine numeric;
  v_friends uuid;
  v_title text := trim(p_title);
begin
  if not public.owns_split_group(p_group) then
    raise exception '找不到這個群組';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception '請輸入金額';
  end if;
  if (select coalesce(sum(value::numeric), 0) from jsonb_each_text(p_amounts)) <> p_amount then
    raise exception '每個人分到的金額加起來要等於總金額';
  end if;
  if exists (select 1 from jsonb_each_text(p_amounts) where value::numeric < 0) then
    raise exception '分到的金額不能是負的';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_amounts) k
    where not exists (select 1 from public.split_members m where m.id::text = k and m.group_id = p_group)
  ) or not exists (select 1 from public.split_members where id = p_payer and group_id = p_group) then
    raise exception '有成員不在這個群組';
  end if;

  select id into v_me from public.split_members where group_id = p_group and is_me;
  if p_payer = v_me and p_account is null then
    raise exception '請選擇付款帳戶';
  end if;

  if p_id is null then
    insert into public.split_expenses (group_id, date, time, title, category_id, amount, payer_id, account_id, mode, weights, amounts)
    values (p_group, p_date, p_time, v_title, p_category, p_amount, p_payer,
            case when p_payer = v_me then p_account end, p_mode, p_weights, p_amounts)
    returning id into v_id;
  else
    update public.split_expenses
    set date = p_date, time = p_time, title = v_title, category_id = p_category, amount = p_amount, payer_id = p_payer,
        account_id = case when p_payer = v_me then p_account end, mode = p_mode, weights = p_weights, amounts = p_amounts
    where id = p_id and group_id = p_group and round_id is null
    returning id into v_id;
    if v_id is null then
      raise exception '找不到這筆花費，或已經結清不能修改';
    end if;
    delete from public.transactions where split_expense_id = v_id;
  end if;

  v_mine := coalesce((p_amounts ->> v_me::text)::numeric, 0);
  if p_payer = v_me then
    if v_mine > 0 then
      insert into public.transactions (date, time, type, amount, category_id, source_account_id, note, split_expense_id)
      values (p_date, p_time, 'EXPENSE', v_mine, p_category, p_account, v_title, v_id);
    end if;
    if p_amount > v_mine then
      v_friends := public.split_friends_account();
      insert into public.transactions (date, time, type, amount, category_id, source_account_id, target_account_id, note, split_expense_id)
      values (p_date, p_time, 'TRANSFER', p_amount - v_mine, 'transfer', p_account, v_friends, '代墊・' || v_title, v_id);
    end if;
  elsif v_mine > 0 then
    v_friends := public.split_friends_account();
    insert into public.transactions (date, time, type, amount, category_id, source_account_id, note, split_expense_id)
    values (p_date, p_time, 'EXPENSE', v_mine, p_category, v_friends, v_title, v_id);
  end if;
  return v_id;
end;
$$;

-- 刪除還沒結清的花費（個人帳的交易會一起刪）
create or replace function public.split_delete_expense(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.split_expenses where id = p_id and round_id is null;
  if not found then
    raise exception '找不到這筆花費，或已經結清不能刪除';
  end if;
end;
$$;

-- 記一筆還款；跟你有關的會寫進個人帳。回傳這次是否剛好全部結清
create or replace function public.split_settle(
  p_group uuid,
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_account uuid,
  p_date date,
  p_time time
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_me uuid;
  v_id uuid;
  v_friends uuid;
  v_from text;
  v_to text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception '請輸入金額';
  end if;
  if p_from = p_to then
    raise exception '付款和收款不能是同一個人';
  end if;
  select name into v_from from public.split_members where id = p_from and group_id = p_group;
  select name into v_to from public.split_members where id = p_to and group_id = p_group;
  if v_from is null or v_to is null then
    raise exception '有成員不在這個群組';
  end if;
  select id into v_me from public.split_members where group_id = p_group and is_me;
  if v_me in (p_from, p_to) and p_account is null then
    raise exception '請選擇帳戶';
  end if;

  insert into public.split_settlements (group_id, from_id, to_id, amount, account_id, date)
  values (p_group, p_from, p_to, p_amount, case when v_me in (p_from, p_to) then p_account end, p_date)
  returning id into v_id;

  if p_to = v_me then
    v_friends := public.split_friends_account();
    insert into public.transactions (date, time, type, amount, category_id, source_account_id, target_account_id, note, split_settlement_id)
    values (p_date, p_time, 'TRANSFER', p_amount, 'transfer', v_friends, p_account, v_from || ' 還你', v_id);
  elsif p_from = v_me then
    v_friends := public.split_friends_account();
    insert into public.transactions (date, time, type, amount, category_id, source_account_id, target_account_id, note, split_settlement_id)
    values (p_date, p_time, 'TRANSFER', p_amount, 'transfer', p_account, v_friends, '還給 ' || v_to, v_id);
  end if;

  return public.split_close_if_settled(p_group, p_date);
end;
$$;

-- 刪除還沒結清的還款（記錯時用）
create or replace function public.split_delete_settlement(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.split_settlements where id = p_id and round_id is null;
  if not found then
    raise exception '找不到這筆還款，或已經結清不能刪除';
  end if;
end;
$$;

-- 重新打開一次結算：那一輪的花費和還款回到還沒結清（round_id 會因外鍵設定自動清空）
create or replace function public.split_reopen_round(p_round uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.split_rounds where id = p_round;
  if not found then
    raise exception '找不到這次結算';
  end if;
end;
$$;

-- 只給登入的人呼叫
revoke execute on function public.owns_split_group(uuid) from public, anon;
revoke execute on function public.split_friends_account() from public, anon;
revoke execute on function public.split_create_group(text, text, text[]) from public, anon;
revoke execute on function public.split_update_group(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.split_delete_group(uuid) from public, anon;
revoke execute on function public.split_balances(uuid) from public, anon;
revoke execute on function public.split_close_if_settled(uuid, date) from public, anon;
revoke execute on function public.split_save_expense(uuid, uuid, date, time, text, text, numeric, uuid, uuid, text, jsonb, jsonb) from public, anon;
revoke execute on function public.split_delete_expense(uuid) from public, anon;
revoke execute on function public.split_settle(uuid, uuid, uuid, numeric, uuid, date, time) from public, anon;
revoke execute on function public.split_delete_settlement(uuid) from public, anon;
revoke execute on function public.split_reopen_round(uuid) from public, anon;
grant execute on function public.owns_split_group(uuid) to authenticated;
grant execute on function public.split_friends_account() to authenticated;
grant execute on function public.split_create_group(text, text, text[]) to authenticated;
grant execute on function public.split_update_group(uuid, text, text, jsonb) to authenticated;
grant execute on function public.split_delete_group(uuid) to authenticated;
grant execute on function public.split_balances(uuid) to authenticated;
grant execute on function public.split_close_if_settled(uuid, date) to authenticated;
grant execute on function public.split_save_expense(uuid, uuid, date, time, text, text, numeric, uuid, uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.split_delete_expense(uuid) to authenticated;
grant execute on function public.split_settle(uuid, uuid, uuid, numeric, uuid, date, time) to authenticated;
grant execute on function public.split_delete_settlement(uuid) to authenticated;
grant execute on function public.split_reopen_round(uuid) to authenticated;

-- 執行結果檢查：應該看到 tables = 5、functions = 12
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name like 'split\_%') as tables,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'split\_%' or proname = 'owns_split_group')) as functions;
