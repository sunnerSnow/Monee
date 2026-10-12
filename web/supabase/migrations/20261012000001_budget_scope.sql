-- 改預算時選套用範圍（從這個月起／只有這個月／從下個月起），過去的月份不能改
-- 前提：已執行 20261007000000_budget_history.sql。這份可以重複執行。
--
-- 前端算好「本月起」的新紀錄（lib/budget.ts 的 planBudget），這個函式一次換掉：
-- 刪掉 p_from 以後的紀錄、寫入新的，兩步在同一個交易裡完成，不會只做一半。
-- p_from 早於台灣時間的本月就拒絕，過去月份的預算維持當時的設定，報表才準。

create or replace function public.budget_replace_from(p_from text, p_entries jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now text := to_char(now() at time zone 'Asia/Taipei', 'YYYY-MM');
  v_entry jsonb;
  v_month text;
begin
  if p_from is null or p_from !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '月份格式不對';
  end if;
  if p_from < v_now then
    raise exception '過去月份的預算不能改';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) > 36 then
    raise exception '預算資料格式不對';
  end if;

  delete from public.budget_history where user_id = (select auth.uid()) and effective_month >= p_from;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_month := v_entry->>'month';
    if v_month is null or v_month < p_from then
      raise exception '過去月份的預算不能改';
    end if;
    -- amount 為 null 代表從那個月起不設預算；月份格式、金額 > 0 由資料表的 check 把關
    insert into public.budget_history (effective_month, amount)
    values (v_month, (v_entry->>'amount')::numeric);
  end loop;
end;
$$;

revoke execute on function public.budget_replace_from(text, jsonb) from public, anon;
grant execute on function public.budget_replace_from(text, jsonb) to authenticated;

-- 執行結果檢查：應該看到 replace_function = 1
select count(*) as replace_function
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'budget_replace_from';
