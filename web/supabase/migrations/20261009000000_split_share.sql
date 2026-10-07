-- 分帳 Phase ②：分享連結
-- 朋友不用註冊，點連結（/s/<token>）就能看這個群組的帳、按「我已付款」；你確認後才記帳。
-- 前提：已執行 20261008000001_split.sql。這份可以重複執行。
--
-- 安全設計
-- 1. 連結就是鑰匙：share_token 是 24 個隨機十六進位字元（96 bits），猜不到；外流可以重設或停止分享。
-- 2. 沒登入的人只能呼叫兩個函式：split_public_view（讀這個群組）、split_public_claim（說已付款）。
--    它們是 security definer，只回傳分帳需要的欄位：不含帳戶、交易、使用者 id 與 Email。
-- 3. 朋友說已付款只會建立一筆「待確認」（split_claims），不會動到你的帳；你按確認才會寫入還款與交易。

-- ---------- 欄位與資料表 ----------
alter table public.split_groups add column if not exists share_token text;
create unique index if not exists split_groups_share_token on public.split_groups (share_token) where share_token is not null;

-- 朋友頁上顯示的你的名字與收款方式（只有拿到連結的人看得到）
alter table public.profiles
  add column if not exists display_name text check (display_name is null or char_length(display_name) between 1 and 20),
  add column if not exists pay_bank text check (pay_bank is null or char_length(pay_bank) <= 60),
  add column if not exists pay_line text check (pay_line is null or char_length(pay_line) <= 40);

-- 朋友按「我已付款」：等你確認
create table if not exists public.split_claims (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.split_groups (id) on delete cascade,
  -- 群組擁有者（朋友沒有帳號，由函式填入）
  user_id uuid not null references auth.users (id) on delete cascade,
  from_id uuid not null references public.split_members (id) on delete cascade,
  to_id uuid not null references public.split_members (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0 and amount < 100000000),
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'rejected')),
  settlement_id uuid references public.split_settlements (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists split_claims_group_idx on public.split_claims (group_id, status);

alter table public.split_claims enable row level security;
drop policy if exists "split_claims: 只能讀自己的" on public.split_claims;
drop policy if exists "split_claims: 只能改自己的" on public.split_claims;
drop policy if exists "split_claims: 只能刪自己的" on public.split_claims;
create policy "split_claims: 只能讀自己的" on public.split_claims
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_claims: 只能改自己的" on public.split_claims
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "split_claims: 只能刪自己的" on public.split_claims
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 你用的函式（套用 RLS） ----------

-- 開始分享（或重設連結）：回傳 token
create or replace function public.split_share_group(p_group uuid, p_reset boolean)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token text;
begin
  select share_token into v_token from public.split_groups where id = p_group;
  if not found then
    raise exception '找不到這個群組';
  end if;
  if v_token is null or p_reset then
    v_token := left(replace(gen_random_uuid()::text, '-', ''), 12) || left(replace(gen_random_uuid()::text, '-', ''), 12);
    update public.split_groups set share_token = v_token where id = p_group;
  end if;
  return v_token;
end;
$$;

-- 停止分享：舊連結立刻失效
create or replace function public.split_stop_share(p_group uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.split_groups set share_token = null where id = p_group;
  if not found then
    raise exception '找不到這個群組';
  end if;
end;
$$;

-- 確認朋友說的付款：寫入還款（跟你有關的會進個人帳）；回傳這次是否剛好全部結清
create or replace function public.split_confirm_claim(p_claim uuid, p_account uuid, p_date date, p_time time)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.split_claims;
  v_closed boolean;
  v_settlement uuid;
begin
  select * into v_claim from public.split_claims where id = p_claim and status = 'waiting';
  if not found then
    raise exception '找不到這筆通知，可能已經處理過了';
  end if;
  v_closed := public.split_settle(v_claim.group_id, v_claim.from_id, v_claim.to_id, v_claim.amount, p_account, p_date, p_time);
  select id into v_settlement from public.split_settlements
  where group_id = v_claim.group_id and from_id = v_claim.from_id and to_id = v_claim.to_id
  order by created_at desc limit 1;
  update public.split_claims set status = 'confirmed', settlement_id = v_settlement where id = p_claim;
  return v_closed;
end;
$$;

-- 朋友說已付款，但你還沒收到
create or replace function public.split_reject_claim(p_claim uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.split_claims set status = 'rejected' where id = p_claim and status = 'waiting';
  if not found then
    raise exception '找不到這筆通知，可能已經處理過了';
  end if;
end;
$$;

-- ---------- 朋友用的函式（不用登入） ----------

-- 用分享連結讀一個群組：只回傳朋友頁需要的欄位
create or replace function public.split_public_view(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group public.split_groups;
begin
  if p_token is null or char_length(p_token) <> 24 then
    return null;
  end if;
  select * into v_group from public.split_groups where share_token = p_token;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'group', jsonb_build_object('id', v_group.id, 'name', v_group.name, 'kind', v_group.kind),
    'owner', (
      select jsonb_build_object('name', coalesce(p.display_name, '朋友'), 'bank', p.pay_bank, 'line', p.pay_line)
      from public.profiles p where p.user_id = v_group.user_id
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'isMe', m.is_me) order by m.is_me desc, m.created_at), '[]'::jsonb)
      from public.split_members m where m.group_id = v_group.id
    ),
    'expenses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'roundId', e.round_id, 'date', e.date, 'title', e.title, 'categoryId', e.category_id,
        'amount', e.amount, 'payerId', e.payer_id, 'mode', e.mode, 'amounts', e.amounts
      ) order by e.date desc, e.created_at desc), '[]'::jsonb)
      from public.split_expenses e where e.group_id = v_group.id
    ),
    'settlements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'roundId', s.round_id, 'fromId', s.from_id, 'toId', s.to_id, 'amount', s.amount, 'date', s.date
      ) order by s.created_at desc), '[]'::jsonb)
      from public.split_settlements s where s.group_id = v_group.id
    ),
    'rounds', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'closedAt', r.closed_at) order by r.closed_at desc, r.created_at desc), '[]'::jsonb)
      from public.split_rounds r where r.group_id = v_group.id
    ),
    'claims', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'fromId', c.from_id, 'toId', c.to_id, 'amount', c.amount, 'status', c.status, 'createdAt', c.created_at
      ) order by c.created_at desc), '[]'::jsonb)
      from public.split_claims c
      where c.group_id = v_group.id and (c.status = 'waiting' or c.created_at > now() - interval '7 days')
    )
  );
end;
$$;

-- 朋友按「我已付款」：建立一筆待確認
create or replace function public.split_public_claim(p_token text, p_from uuid, p_to uuid, p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.split_groups;
  v_id uuid;
begin
  if p_token is null or char_length(p_token) <> 24 then
    raise exception '分享連結已失效';
  end if;
  select * into v_group from public.split_groups where share_token = p_token;
  if not found then
    raise exception '分享連結已失效，請跟分享的人要新的連結';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000 then
    raise exception '金額不對';
  end if;
  if p_from = p_to
    or not exists (select 1 from public.split_members where id = p_from and group_id = v_group.id and not is_me)
    or not exists (select 1 from public.split_members where id = p_to and group_id = v_group.id) then
    raise exception '成員不在這個群組';
  end if;
  -- 同一個人對同一個人只留一筆待確認，重按就更新金額；整個群組最多 30 筆待確認，避免被灌爆
  update public.split_claims set amount = p_amount, created_at = now()
  where group_id = v_group.id and from_id = p_from and to_id = p_to and status = 'waiting'
  returning id into v_id;
  if v_id is not null then
    return v_id;
  end if;
  if (select count(*) from public.split_claims where group_id = v_group.id and status = 'waiting') >= 30 then
    raise exception '待確認的通知太多了，請先請分享的人處理';
  end if;
  insert into public.split_claims (group_id, user_id, from_id, to_id, amount)
  values (v_group.id, v_group.user_id, p_from, p_to, p_amount)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- 權限 ----------
revoke execute on function public.split_share_group(uuid, boolean) from public, anon;
revoke execute on function public.split_stop_share(uuid) from public, anon;
revoke execute on function public.split_confirm_claim(uuid, uuid, date, time) from public, anon;
revoke execute on function public.split_reject_claim(uuid) from public, anon;
revoke execute on function public.split_public_view(text) from public;
revoke execute on function public.split_public_claim(text, uuid, uuid, numeric) from public;
grant execute on function public.split_share_group(uuid, boolean) to authenticated;
grant execute on function public.split_stop_share(uuid) to authenticated;
grant execute on function public.split_confirm_claim(uuid, uuid, date, time) to authenticated;
grant execute on function public.split_reject_claim(uuid) to authenticated;
-- 朋友沒有帳號：這兩個函式開放給未登入的人
grant execute on function public.split_public_view(text) to anon, authenticated;
grant execute on function public.split_public_claim(text, uuid, uuid, numeric) to anon, authenticated;

-- 執行結果檢查：應該看到 claims_table = 1、functions = 6
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'split_claims') as claims_table,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('split_share_group', 'split_stop_share', 'split_confirm_claim', 'split_reject_claim', 'split_public_view', 'split_public_claim')) as functions;
