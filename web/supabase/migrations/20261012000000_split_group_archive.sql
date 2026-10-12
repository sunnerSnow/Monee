-- 分帳群組：封存，以及有花費的群組也能刪除
-- 前提：已執行 20261011000000_split_friend_expense.sql。這份可以重複執行。
--
-- 1. 封存（archived_at）：群組從分帳列表收起來、記一筆不會再選到它，帳和明細都保留，之後可以取消封存。
-- 2. 刪除：原本只能刪還沒有花費的群組；現在加上 p_force，確認後連同花費、還款、待確認，
--    以及寫進你個人帳的交易一起刪掉（transactions 的 split_expense_id／split_settlement_id 是 on delete cascade）。
--    朋友往來帳戶的餘額由交易即時計算，會跟著更新。

alter table public.split_groups add column if not exists archived_at timestamptz;

drop function if exists public.split_delete_group(uuid);

-- 刪除群組：有花費時要 p_force = true 才會刪（前端會先寫清楚會刪掉哪些東西）
create or replace function public.split_delete_group(p_group uuid, p_force boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not coalesce(p_force, false) and exists (select 1 from public.split_expenses where group_id = p_group) then
    raise exception '有花費紀錄的群組，要確認後才能刪除';
  end if;
  delete from public.split_groups where id = p_group;
  if not found then
    raise exception '找不到這個群組';
  end if;
end;
$$;

revoke execute on function public.split_delete_group(uuid, boolean) from public, anon;
grant execute on function public.split_delete_group(uuid, boolean) to authenticated;

-- 執行結果檢查：應該看到 archived_column = 1、delete_function_args = 2
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'split_groups' and column_name = 'archived_at') as archived_column,
  (select max(pronargs) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'split_delete_group') as delete_function_args;
