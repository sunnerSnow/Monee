-- 分帳 Phase ④：朋友從分享連結新增花費
-- 朋友在分享頁記一筆：跟你有關的（你先付，或有分到你）先放進「待確認」（split_proposals），你按「記入我的帳」才寫入花費與個人帳；
-- 跟你無關的（朋友之間）直接加進群組，不會動到你的帳。
-- 前提：已執行 20261010000000_trips.sql。這份可以重複執行。
--
-- 安全設計（延續 Phase ②）
-- 1. 每個群組可以關掉「朋友可以新增花費」（allow_friend_add），關掉後連結只能看帳、說已付款。
-- 2. 沒登入的人多了兩個函式：split_public_add_expense（新增）、split_public_remove（撤回自己記的、還沒確認或跟你無關的那筆）。
--    都是 security definer，只寫分帳的資料表，碰不到你的帳戶與交易。
-- 3. 待確認最多 30 筆、朋友直接記的未結清花費最多 200 筆，避免連結外流被灌爆。

-- ---------- 欄位與資料表 ----------
alter table public.split_groups add column if not exists allow_friend_add boolean not null default true;

-- 誰從分享連結記的；null 是你自己記的
alter table public.split_expenses add column if not exists added_by uuid references public.split_members (id) on delete set null;

-- 朋友新增、跟你有關的花費：等你確認
create table if not exists public.split_proposals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.split_groups (id) on delete cascade,
  -- 群組擁有者（朋友沒有帳號，由函式填入）
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid not null references public.split_members (id) on delete cascade,
  date date not null,
  title text not null check (char_length(title) between 1 and 40),
  category_id text not null check (char_length(category_id) between 1 and 30),
  amount numeric(14, 2) not null check (amount > 0 and amount < 100000000),
  payer_id uuid not null references public.split_members (id) on delete cascade,
  mode text not null check (mode in ('equal', 'exact', 'shares')),
  weights jsonb not null,
  amounts jsonb not null,
  currency text not null default 'TWD' check (currency ~ '^[A-Z]{3}$'),
  original_amount numeric(14, 2),
  fx_rate numeric(16, 8),
  original_shares jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'rejected')),
  expense_id uuid references public.split_expenses (id) on delete set null,
  created_at timestamptz not null default now(),
  check (currency = 'TWD' or (original_amount > 0 and fx_rate > 0))
);
create index if not exists split_proposals_group_idx on public.split_proposals (group_id, status);

alter table public.split_proposals enable row level security;
drop policy if exists "split_proposals: 只能讀自己的" on public.split_proposals;
drop policy if exists "split_proposals: 只能改自己的" on public.split_proposals;
drop policy if exists "split_proposals: 只能刪自己的" on public.split_proposals;
create policy "split_proposals: 只能讀自己的" on public.split_proposals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "split_proposals: 只能改自己的" on public.split_proposals
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "split_proposals: 只能刪自己的" on public.split_proposals
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- 你用的函式（套用 RLS） ----------

-- 確認朋友新增的花費：照一般花費寫入（跟你有關的部分進個人帳）。可以順便改分類；你先付時要選付款帳戶
create or replace function public.split_confirm_proposal(p_proposal uuid, p_category text, p_account uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_p public.split_proposals;
  v_id uuid;
begin
  select * into v_p from public.split_proposals where id = p_proposal and status = 'waiting';
  if not found then
    raise exception '找不到這筆花費，可能已經處理過了';
  end if;
  v_id := public.split_save_expense(
    null, v_p.group_id, v_p.date, null, v_p.title, coalesce(nullif(trim(p_category), ''), v_p.category_id), v_p.amount, v_p.payer_id,
    p_account, v_p.mode, v_p.weights, v_p.amounts, v_p.currency, v_p.original_amount, v_p.fx_rate, v_p.original_shares
  );
  update public.split_expenses set added_by = v_p.added_by where id = v_id;
  update public.split_proposals set status = 'confirmed', expense_id = v_id where id = p_proposal;
  return v_id;
end;
$$;

-- 朋友新增的花費有問題：退回，朋友在分享頁會看到，可以撤回後重記
create or replace function public.split_reject_proposal(p_proposal uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.split_proposals set status = 'rejected' where id = p_proposal and status = 'waiting';
  if not found then
    raise exception '找不到這筆花費，可能已經處理過了';
  end if;
end;
$$;

-- ---------- 朋友用的函式（不用登入） ----------

-- 朋友新增一筆（一律平分，表單簡單）：跟你有關的放進待確認，跟你無關的直接記進群組。
-- 回傳 {"id": …, "pending": true 代表等你確認}；外幣時 p_amount、p_amounts 是換算後的台幣
create or replace function public.split_public_add_expense(
  p_token text,
  p_member uuid,
  p_date date,
  p_title text,
  p_category text,
  p_amount numeric,
  p_payer uuid,
  p_weights jsonb,
  p_amounts jsonb,
  p_currency text default 'TWD',
  p_original_amount numeric default null,
  p_fx_rate numeric default null,
  p_original_shares jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.split_groups;
  v_me uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_currency text := upper(coalesce(p_currency, 'TWD'));
  v_foreign boolean;
  v_id uuid;
begin
  if p_token is null or char_length(p_token) <> 24 then
    raise exception '分享連結已失效';
  end if;
  select * into v_group from public.split_groups where share_token = p_token;
  if not found then
    raise exception '分享連結已失效，請跟分享的人要新的連結';
  end if;
  if not v_group.allow_friend_add then
    raise exception '這個群組沒有開放朋友新增花費';
  end if;
  if not exists (select 1 from public.split_members where id = p_member and group_id = v_group.id and not is_me) then
    raise exception '成員不在這個群組';
  end if;
  if char_length(v_title) not between 1 and 40 then
    raise exception '品項要 1 到 40 個字';
  end if;
  if p_category is null or char_length(p_category) not between 1 and 30 then
    raise exception '分類不對';
  end if;
  -- 朋友可能在國外，日期放寬一天
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 400 then
    raise exception '日期不對';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000 then
    raise exception '金額不對';
  end if;
  v_foreign := v_currency <> 'TWD';
  if v_currency not in ('TWD', v_group.currency) then
    raise exception '幣別不對';
  end if;
  if v_foreign and (
    coalesce(p_original_amount, 0) <= 0 or coalesce(p_fx_rate, 0) <= 0 or abs(p_amount - round(p_original_amount * p_fx_rate)) > 1
  ) then
    raise exception '外幣金額或匯率不對';
  end if;
  if (select coalesce(sum(value::numeric), 0) from jsonb_each_text(p_amounts)) <> p_amount then
    raise exception '每個人分到的金額加起來要等於總金額';
  end if;
  if exists (select 1 from jsonb_each_text(p_amounts) where value::numeric < 0) then
    raise exception '分到的金額不能是負的';
  end if;
  if exists (
    select 1 from (select jsonb_object_keys(p_amounts) k union select jsonb_object_keys(p_weights)) keys
    where not exists (select 1 from public.split_members m where m.id::text = keys.k and m.group_id = v_group.id)
  ) or not exists (select 1 from public.split_members where id = p_payer and group_id = v_group.id) then
    raise exception '有成員不在這個群組';
  end if;

  select id into v_me from public.split_members where group_id = v_group.id and is_me;

  -- 跟你有關：等你確認才寫入
  if p_payer = v_me or coalesce((p_amounts ->> v_me::text)::numeric, 0) > 0 then
    if (select count(*) from public.split_proposals where group_id = v_group.id and status = 'waiting') >= 30 then
      raise exception '待確認的花費太多了，請先請分享的人處理';
    end if;
    insert into public.split_proposals (group_id, user_id, added_by, date, title, category_id, amount, payer_id, mode, weights, amounts,
                                        currency, original_amount, fx_rate, original_shares)
    values (v_group.id, v_group.user_id, p_member, p_date, v_title, p_category, p_amount, p_payer, 'equal', p_weights, p_amounts,
            v_currency, case when v_foreign then p_original_amount end, case when v_foreign then p_fx_rate end,
            case when v_foreign then p_original_shares end)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'pending', true);
  end if;

  -- 朋友之間：直接記進群組（沒有個人帳的交易）
  if (select count(*) from public.split_expenses where group_id = v_group.id and round_id is null and added_by is not null) >= 200 then
    raise exception '朋友新增的花費太多了，請先請分享的人結清';
  end if;
  insert into public.split_expenses (group_id, user_id, date, title, category_id, amount, payer_id, mode, weights, amounts,
                                     currency, original_amount, fx_rate, added_by)
  values (v_group.id, v_group.user_id, p_date, v_title, p_category, p_amount, p_payer, 'equal', p_weights, p_amounts,
          v_currency, case when v_foreign then p_original_amount end, case when v_foreign then p_fx_rate end, p_member)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'pending', false);
end;
$$;

-- 朋友撤回自己記的：還沒確認（或被退回）的待確認，或跟你無關、還沒結清的花費。已經進你帳的只能由你改
create or replace function public.split_public_remove(p_token text, p_member uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.split_groups;
  v_me uuid;
begin
  if p_token is null or char_length(p_token) <> 24 then
    raise exception '分享連結已失效';
  end if;
  select * into v_group from public.split_groups where share_token = p_token;
  if not found then
    raise exception '分享連結已失效，請跟分享的人要新的連結';
  end if;
  delete from public.split_proposals
  where id = p_id and group_id = v_group.id and added_by = p_member and status in ('waiting', 'rejected');
  if found then
    return;
  end if;
  select id into v_me from public.split_members where group_id = v_group.id and is_me;
  delete from public.split_expenses e
  where e.id = p_id and e.group_id = v_group.id and e.added_by = p_member and e.round_id is null
    and e.payer_id <> v_me and coalesce((e.amounts ->> v_me::text)::numeric, 0) = 0;
  if not found then
    raise exception '找不到這筆，可能已經確認或結清了';
  end if;
end;
$$;

-- 分享頁也帶上「朋友可以新增花費」、誰記的、待確認的花費
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
    'group', jsonb_build_object(
      'id', v_group.id, 'name', v_group.name, 'kind', v_group.kind,
      'startDate', v_group.start_date, 'endDate', v_group.end_date, 'currency', v_group.currency,
      'allowFriendAdd', v_group.allow_friend_add
    ),
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
        'amount', e.amount, 'payerId', e.payer_id, 'mode', e.mode, 'amounts', e.amounts, 'weights', e.weights,
        'currency', e.currency, 'originalAmount', e.original_amount, 'addedBy', e.added_by
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
    ),
    'proposals', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'addedBy', p.added_by, 'date', p.date, 'title', p.title, 'categoryId', p.category_id, 'amount', p.amount,
        'payerId', p.payer_id, 'amounts', p.amounts, 'weights', p.weights, 'currency', p.currency, 'originalAmount', p.original_amount,
        'status', p.status, 'createdAt', p.created_at
      ) order by p.created_at desc), '[]'::jsonb)
      from public.split_proposals p
      where p.group_id = v_group.id and (p.status = 'waiting' or (p.status = 'rejected' and p.created_at > now() - interval '7 days'))
    )
  );
end;
$$;

-- ---------- 權限 ----------
revoke execute on function public.split_confirm_proposal(uuid, text, uuid) from public, anon;
revoke execute on function public.split_reject_proposal(uuid) from public, anon;
revoke execute on function public.split_public_add_expense(text, uuid, date, text, text, numeric, uuid, jsonb, jsonb, text, numeric, numeric, jsonb) from public;
revoke execute on function public.split_public_remove(text, uuid, uuid) from public;
revoke execute on function public.split_public_view(text) from public;
grant execute on function public.split_confirm_proposal(uuid, text, uuid) to authenticated;
grant execute on function public.split_reject_proposal(uuid) to authenticated;
-- 朋友沒有帳號：這幾個函式開放給未登入的人
grant execute on function public.split_public_add_expense(text, uuid, date, text, text, numeric, uuid, jsonb, jsonb, text, numeric, numeric, jsonb) to anon, authenticated;
grant execute on function public.split_public_remove(text, uuid, uuid) to anon, authenticated;
grant execute on function public.split_public_view(text) to anon, authenticated;

-- 執行結果檢查：應該看到 new_columns = 2、proposals_table = 1、functions = 4
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and ((table_name = 'split_groups' and column_name = 'allow_friend_add') or (table_name = 'split_expenses' and column_name = 'added_by'))) as new_columns,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'split_proposals') as proposals_table,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('split_confirm_proposal', 'split_reject_proposal', 'split_public_add_expense', 'split_public_remove')) as functions;
