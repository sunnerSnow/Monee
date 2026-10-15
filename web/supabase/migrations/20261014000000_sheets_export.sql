-- 匯出到 Google Sheets：記住匯出到哪一份試算表，之後每次都更新同一份（換手機登入也一樣）
-- 前提：已執行 20261006000000_init.sql。這份可以重複執行。
--
-- 試算表建在使用者自己的 Google 雲端硬碟，由瀏覽器直接呼叫 Google API 寫入；
-- 這裡只存試算表 id 和上次匯出時間，不存 Google 的授權。

alter table public.profiles
  add column if not exists sheets_id text check (sheets_id is null or sheets_id ~ '^[A-Za-z0-9_-]{20,100}$'),
  add column if not exists sheets_exported_at timestamptz;

-- 執行結果檢查：應該看到 sheets_columns = 2
select count(*) as sheets_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name in ('sheets_id', 'sheets_exported_at');
