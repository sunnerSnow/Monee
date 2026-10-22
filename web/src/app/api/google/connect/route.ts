// 我的 → Google 雲端同步 →「連結 Google 帳號」：帶著 state 導到 Google 的授權畫面
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { authUrl, callbackUrl, googleConfig, STATE_COOKIE } from '@/lib/server/google-oauth';
import { currentUser } from '@/lib/server/session';

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const back = (error: string) => NextResponse.redirect(new URL(`/settings/google?error=${error}`, origin));
  if (process.env.NEXT_PUBLIC_MONEE_DEMO === '1') return back('demo');
  const cfg = googleConfig();
  if (!cfg) return back('config');
  if (!(await currentUser())) return NextResponse.redirect(new URL('/login', origin));

  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(authUrl(cfg, state, callbackUrl(origin)));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: '/api/google', maxAge: 600 });
  return res;
}
