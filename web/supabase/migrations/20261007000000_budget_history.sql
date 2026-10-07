-- 每月預算改成「從某月起生效」
-- 某個月的預算 = 生效月份 ≤ 該月的最後一筆紀錄；amount 為 null 代表從那個月起不設預算。
-- 改預算只影響當月以後，過去月份保留當時的預算，報表的「與預算差」才準確。
-- 這份可以重複執行：已經存在的部分會略過或覆蓋成一樣的設定。

create table if not exists public.budget_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_month text not null check (effective_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric(14, 2) check (amount is null or amount > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, effective_month)
);

alter table public.budget_history enable row level security;

drop policy if exists "budget_history: 只能讀自己的" on public.budget_history;
drop policy if exists "budget_history: 只能新增自己的" on public.budget_history;
drop policy if exists "budget_history: 只能改自己的" on public.budget_history;
drop policy if exists "budget_history: 只能刪自己的" on public.budget_history;

create policy "budget_history: 只能讀自己的" on public.budget_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy "budget_history: 只能新增自己的" on public.budget_history
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "budget_history: 只能改自己的" on public.budget_history
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "budget_history: 只能刪自己的" on public.budget_history
  for delete to authenticated using (user_id = (select auth.uid()));

-- 把原本的單一預算搬過來：從最早有交易的月份開始生效（沒有交易就從本月），過去月份才不會變成「沒有預算」
insert into public.budget_history (user_id, effective_month, amount)
select
  p.user_id,
  coalesce(
    (select to_char(min(t.date), 'YYYY-MM') from public.transactions t where t.user_id = p.user_id),
    to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM')
  ),
  p.monthly_budget
from public.profiles p
where p.monthly_budget is not null
on conflict do nothing;

-- profiles.monthly_budget 不再使用，先保留欄位以免舊版畫面出錯
comment on column public.profiles.monthly_budget is '已停用：改用 budget_history';

-- 執行結果檢查：應該看到 policies = 4、rls_enabled = true；有設過預算的話 rows ≥ 1
select
  (select count(*) from public.budget_history) as rows,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'budget_history') as policies,
  (select relrowsecurity from pg_class where oid = 'public.budget_history'::regclass) as rls_enabled;
