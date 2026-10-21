-- 收據照片存檔：拍收據記的、手動附上的照片存在 Supabase Storage（receipts，私人），資料庫只記路徑
-- 前提：已執行 20261021000000_backup.sql。這份可以重複執行。
--
-- 設計重點
-- 1. 路徑是「{user id}/{隨機 id}.jpg」，每個人只能讀寫自己資料夾裡的檔案；畫面上用一小時內有效的簽名網址顯示。
-- 2. 一般記帳存在 transactions.receipt_image_url（原本就有的欄位，存的是路徑不是網址）；
--    分帳與旅程的花費存在 split_expenses.receipt_path，分帳寫進個人帳的交易不另外存。
-- 3. 刪交易、刪花費、刪群組時由前端一起刪照片（資料庫刪不到 Storage 裡的檔案）。
-- 4. 照片不在備份檔裡，備份只記路徑；換帳號還原時前端會拿掉路徑（照片在原本帳號的資料夾）。

-- ---------- Storage ----------
-- 10MB 上限：照片在手機上先縮成約 300KB 的 JPEG，縮不了的格式（部分電腦上的 HEIC）才會原檔上傳
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts: 只能讀自己的" on storage.objects;
drop policy if exists "receipts: 只能上傳到自己的資料夾" on storage.objects;
drop policy if exists "receipts: 只能改自己的" on storage.objects;
drop policy if exists "receipts: 只能刪自己的" on storage.objects;
create policy "receipts: 只能讀自己的" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts: 只能上傳到自己的資料夾" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts: 只能改自己的" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts: 只能刪自己的" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- 欄位 ----------
alter table public.split_expenses add column if not exists receipt_path text;
comment on column public.transactions.receipt_image_url is '收據照片在 Storage（receipts）裡的路徑：{user id}/{檔名}';
comment on column public.split_expenses.receipt_path is '收據照片在 Storage（receipts）裡的路徑：{user id}/{檔名}';

-- 執行結果檢查：應該看到 bucket = 1、policies = 4、receipt_column = 1
select
  (select count(*) from storage.buckets where id = 'receipts' and not public) as bucket,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'receipts:%') as policies,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'split_expenses' and column_name = 'receipt_path') as receipt_column;
