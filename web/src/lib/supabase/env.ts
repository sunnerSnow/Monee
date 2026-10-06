export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// 新專案叫 Publishable key；Supabase 的 Vercel 整合等舊設定會用 ANON_KEY 這個名稱，兩個都認得
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** 還沒設定 .env.local 時，登入頁會顯示設定說明，而不是直接報錯 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
