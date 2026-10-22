// 解除 Google 連結：撤銷授權、刪掉存著的授權和待同步的月份。Drive 裡的收據和年度帳本都留著，不會刪
import { NextResponse } from 'next/server';
import { revokeToken } from '@/lib/server/google-oauth';
import { currentUser } from '@/lib/server/session';
import { decryptToken } from '@/lib/server/token-crypto';

export async function POST() {
  const session = await currentUser();
  if (!session) return NextResponse.json({ error: '登入已過期，請重新登入' }, { status: 401 });
  const { supabase, userId } = session;

  const { data } = await supabase.from('google_integrations').select('encrypted_refresh_token').maybeSingle();
  if (data) {
    try {
      await revokeToken(decryptToken(data.encrypted_refresh_token, userId));
    } catch {
      // 金鑰換過就解不開；照樣解除，使用者可以到 Google 帳號的「第三方存取權」自己移除
    }
  }
  const { error } = await supabase.from('google_integrations').delete().eq('user_id', userId);
  if (error) return NextResponse.json({ error: '解除失敗，請再試一次' }, { status: 500 });
  await supabase.from('google_sync_months').delete().eq('user_id', userId);
  return NextResponse.json({ ok: true });
}
