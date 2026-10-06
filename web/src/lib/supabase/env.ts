export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** 還沒設定 .env.local 時，登入頁會顯示設定說明，而不是直接報錯 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
