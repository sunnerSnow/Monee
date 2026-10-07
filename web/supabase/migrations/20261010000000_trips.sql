-- 分帳 Phase ③a：旅程（日期、外幣、旅程預算、不算進每月預算）
-- 前提：已執行 20261009000000_split_share.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 旅程是 kind = 'trip' 的群組，可以只有你自己（一個人旅行也能記），也可以跟朋友分帳。
-- 2. 外幣花費存原幣金額（original_amount）與當下匯率（fx_rate：1 單位外幣 = 多少台幣）；
--    amount、amounts 一律是台幣，結算、個人帳、報表都用台幣，跟原本的規則一樣。
-- 3. 旅程設定「不算進每月預算」時，寫進個人帳的支出會標 exclude_from_budget，首頁的今日額度與預算進度就不算它。

-- ---------- 欄位 ----------
alter table public.split_groups drop constraint if exists split_groups_kind_check;
alter table public.split_groups add constraint split_groups_kind_check check (kind in ('daily', 'event', 'trip'));
alter table public.split_groups
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists currency text not null default 'TWD',
  add column if not exists budget numeric(14, 2),
  add column if not exists exclude_from_budget boolean not null default false;
alter table public.split_groups drop constraint if exists split_groups_trip_check;
alter table public.split_groups add constraint split_groups_trip_check check (
  currency ~ '^[A-Z]{3}$'
  and (budget is null or budget > 0)
  and (start_date is null or end_date is null or end_date >= start_date)
);

alter table public.split_expenses
  add column if not exists currency text not null default 'TWD',
  add column if not exists original_amount numeric(14, 2),
  add column if not exists fx_rate numeric(16, 8);
alter table public.split_expenses drop constraint if exists split_expenses_fx_check;
alter table public.split_expenses add constraint split_expenses_fx_check check (
  currency ~ '^[A-Z]{3}$' and (currency = 'TWD' or (original_amount > 0 and fx_rate > 0))
);

alter table public.transactions
  add column if not exists currency text,
  add column if not exists original_amount numeric(14, 2),
  add column if not exists exclude_from_budget boolean not null default false;

-- ---------- 函式（參數變多，先刪掉舊的版本，避免同名函式並存） ----------
drop function if exists public.split_create_group(text, text, text[]);
drop function if exists public.split_update_group(uuid, text, text, jsonb);
drop function if exists public.split_save_expense(uuid, uuid, date, time, text, text, numeric, uuid, uuid, text, jsonb, jsonb);
drop function if exists public.split_save_expense(uuid, uuid, date, time, text, text, numeric, uuid, uuid, text, jsonb, jsonb, text, numeric, numeric);

-- 建立群組：你自己（is_me）加上朋友的名字；旅程可以只有你自己
create or replace function public.split_create_group(
  p_name text,
  p_kind text,
  p_members text[],
  p_start date default null,
  p_end date default null,
  p_currency text default 'TWD',
  p_budget numeric default null,
  p_exclude boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_trip boolean := coalesce(p_kind, 'daily') = 'trip';
begin
  insert into public.split_groups (name, kind, start_date, end_date, currency, budget, exclude_from_budget)
  values (
    trim(p_name), coalesce(p_kind, 'daily'),
    case when v_trip then p_start end, case when v_trip then p_end end,
    case when v_trip then coalesce(upper(p_currency), 'TWD') else 'TWD' end,
    case when v_trip then p_budget end, v_trip and coalesce(p_exclude, false)
  )
  returning id into v_id;
  insert into public.split_members (group_id, name, is_me) values (v_id, '我', true);
  foreach v_name in array coalesce(p_members, '{}') loop
    v_name := trim(v_name);
    if v_name <> '' and not exists (select 1 from public.split_members where group_id = v_id and name = v_name) then
      insert into public.split_members (group_id, name) values (v_id, v_name);
    end if;
  end loop;
  if not v_trip and (select count(*) from public.split_members where group_id = v_id) < 2 then
    raise exception '至少要有一位朋友';
  end if;
  return v_id;
end;
$$;

-- 修改群組：p_members 是朋友清單 [{"id": 舊成員 id 或 null, "name": "小明"}]；不在清單裡的朋友會被移除
create or replace function public.split_update_group(
  p_group uuid,
  p_name text,
  p_kind text,
  p_members jsonb,
  p_start date default null,
  p_end date default null,
  p_currency text default 'TWD',
  p_budget numeric default null,
  p_exclude boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_keep uuid[] := '{}';
  v_trip boolean := p_kind = 'trip';
begin
  update public.split_groups
  set name = trim(p_name), kind = p_kind,
      start_date = case when v_trip then p_start end, end_date = case when v_trip then p_end end,
      currency = case when v_trip then coalesce(upper(p_currency), 'TWD') else 'TWD' end,
      budget = case when v_trip then p_budget end, exclude_from_budget = v_trip and coalesce(p_exclude, false)
  where id = p_group;
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

  if not v_trip and (select count(*) from public.split_members where group_id = p_group) < 2 then
    raise exception '至少要有一位朋友';
  end if;

  -- 改了「不算進每月預算」，已經記的支出也一起改
  update public.transactions t set exclude_from_budget = v_trip and coalesce(p_exclude, false)
  where t.type = 'EXPENSE' and t.split_expense_id in (select id from public.split_expenses where group_id = p_group);
end;
$$;

-- 新增或修改一筆花費，並重寫它在你個人帳的交易；外幣時 p_amount、p_amounts 是換算後的台幣
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
  p_amounts jsonb,
  p_currency text default 'TWD',
  p_original_amount numeric default null,
  p_fx_rate numeric default null,
  -- 外幣時每個人分到的原幣金額（前端照同樣的權重分好）；沒給就照台幣比例推算
  p_original_shares jsonb default null
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
  v_currency text := upper(coalesce(p_currency, 'TWD'));
  v_foreign boolean;
  v_exclude boolean;
  v_mine_original numeric;
begin
  if not public.owns_split_group(p_group) then
    raise exception '找不到這個群組';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception '請輸入金額';
  end if;
  v_foreign := v_currency <> 'TWD';
  if v_foreign and (coalesce(p_original_amount, 0) <= 0 or coalesce(p_fx_rate, 0) <= 0) then
    raise exception '外幣花費要有原幣金額和匯率';
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
  select kind = 'trip' and exclude_from_budget into v_exclude from public.split_groups where id = p_group;

  if p_id is null then
    insert into public.split_expenses (group_id, date, time, title, category_id, amount, payer_id, account_id, mode, weights, amounts,
                                       currency, original_amount, fx_rate)
    values (p_group, p_date, p_time, v_title, p_category, p_amount, p_payer,
            case when p_payer = v_me then p_account end, p_mode, p_weights, p_amounts,
            v_currency, case when v_foreign then p_original_amount end, case when v_foreign then p_fx_rate end)
    returning id into v_id;
  else
    update public.split_expenses
    set date = p_date, time = p_time, title = v_title, category_id = p_category, amount = p_amount, payer_id = p_payer,
        account_id = case when p_payer = v_me then p_account end, mode = p_mode, weights = p_weights, amounts = p_amounts,
        currency = v_currency, original_amount = case when v_foreign then p_original_amount end, fx_rate = case when v_foreign then p_fx_rate end
    where id = p_id and group_id = p_group and round_id is null
    returning id into v_id;
    if v_id is null then
      raise exception '找不到這筆花費，或已經結清不能修改';
    end if;
    delete from public.transactions where split_expense_id = v_id;
  end if;

  -- 個人帳的交易也記下原幣金額，明細才能顯示「¥3,000（≈ $603）」
  v_mine := coalesce((p_amounts ->> v_me::text)::numeric, 0);
  if v_foreign then
    v_mine_original := coalesce((p_original_shares ->> v_me::text)::numeric, round(p_original_amount * v_mine / p_amount, 2));
  end if;
  if p_payer = v_me then
    if v_mine > 0 then
      insert into public.transactions (date, time, type, amount, category_id, source_account_id, note, split_expense_id,
                                       currency, original_amount, exclude_from_budget)
      values (p_date, p_time, 'EXPENSE', v_mine, p_category, p_account, v_title, v_id,
              case when v_foreign then v_currency end, v_mine_original, v_exclude);
    end if;
    if p_amount > v_mine then
      v_friends := public.split_friends_account();
      insert into public.transactions (date, time, type, amount, category_id, source_account_id, target_account_id, note, split_expense_id,
                                       currency, original_amount)
      values (p_date, p_time, 'TRANSFER', p_amount - v_mine, 'transfer', p_account, v_friends, '代墊・' || v_title, v_id,
              case when v_foreign then v_currency end, case when v_foreign then p_original_amount - v_mine_original end);
    end if;
  elsif v_mine > 0 then
    v_friends := public.split_friends_account();
    insert into public.transactions (date, time, type, amount, category_id, source_account_id, note, split_expense_id,
                                     currency, original_amount, exclude_from_budget)
    values (p_date, p_time, 'EXPENSE', v_mine, p_category, v_friends, v_title, v_id,
            case when v_foreign then v_currency end, v_mine_original, v_exclude);
  end if;
  return v_id;
end;
$$;

-- 分享頁也帶上旅程與外幣資訊
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
      'startDate', v_group.start_date, 'endDate', v_group.end_date, 'currency', v_group.currency
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
        'currency', e.currency, 'originalAmount', e.original_amount
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

-- ---------- 權限 ----------
revoke execute on function public.split_create_group(text, text, text[], date, date, text, numeric, boolean) from public, anon;
revoke execute on function public.split_update_group(uuid, text, text, jsonb, date, date, text, numeric, boolean) from public, anon;
revoke execute on function public.split_save_expense(uuid, uuid, date, time, text, text, numeric, uuid, uuid, text, jsonb, jsonb, text, numeric, numeric, jsonb) from public, anon;
revoke execute on function public.split_public_view(text) from public;
grant execute on function public.split_create_group(text, text, text[], date, date, text, numeric, boolean) to authenticated;
grant execute on function public.split_update_group(uuid, text, text, jsonb, date, date, text, numeric, boolean) to authenticated;
grant execute on function public.split_save_expense(uuid, uuid, date, time, text, text, numeric, uuid, uuid, text, jsonb, jsonb, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.split_public_view(text) to anon, authenticated;

-- 執行結果檢查：應該看到 trip_columns = 5、old_functions = 0
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'split_groups'
     and column_name in ('start_date', 'end_date', 'currency', 'budget', 'exclude_from_budget')) as trip_columns,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('split_create_group', 'split_update_group', 'split_save_expense') and pronargs in (3, 4, 12, 15)) as old_functions;
