-- 分帳的「朋友往來」帳戶類型
-- 這份要先單獨執行，再執行 20261008000001_split.sql：Postgres 規定新加的類型值要先生效，下一份才能用到它。
alter type public.account_type add value if not exists 'FRIENDS';
