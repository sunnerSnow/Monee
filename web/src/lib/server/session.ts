// 伺服器端：目前登入的人（Supabase 的 client 照樣套用 RLS，只碰得到自己的資料）
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export async function currentUser() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return typeof userId === 'string' ? { supabase, userId } : null;
}
