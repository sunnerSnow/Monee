// Google 授權完導回這裡：比對 state、授權碼換 refresh token、加密存起來，再把有帳的月份標成待同步
import { NextResponse, type NextRequest } from 'next/server';
import { callbackUrl, exchangeCode, GoogleConnectError, googleConfig, STATE_COOKIE } from '@/lib/server/google-oauth';
import { currentUser } from '@/lib/server/session';
import { encryptToken } from '@/lib/server/token-crypto';

/** 資料庫還沒執行 migration：表不存在 */
const missingTable = (e: { code?: string; message: string }) => e.code === '42P01' || e.code === 'PGRST205' || e.message.includes('google_integrations');

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`/settings/google?${query}`, origin));
    res.cookies.set(STATE_COOKIE, '', { path: '/api/google', maxAge: 0 });
    return res;
  };
  const cfg = googleConfig();
  if (!cfg) return done('error=config');
  // 使用者在 Google 的畫面按了取消
  if (searchParams.get('error')) return done('error=denied');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return done('error=state');

  const session = await currentUser();
  if (!session) return NextResponse.redirect(new URL('/login', origin));
  try {
    const { refreshToken, email } = await exchangeCode(cfg, code, callbackUrl(origin));
    const { error } = await session.supabase.from('google_integrations').upsert({
      user_id: session.userId,
      google_email: email,
      encrypted_refresh_token: encryptToken(refreshToken, session.userId),
      connected_at: new Date().toISOString(),
      needs_reconnect: false,
      last_error: null,
      sync_lock_until: null,
    }, { onConflict: 'user_id' });
    if (error) return done(missingTable(error) ? 'error=db' : 'error=failed');
    await session.supabase.rpc('google_mark_all');
    return done('connected=1');
  } catch (e) {
    if (e instanceof GoogleConnectError) return done(`error=${e.code}`);
    console.error('[google] 連結失敗', e instanceof Error ? e.message : e);
    return done('error=failed');
  }
}
