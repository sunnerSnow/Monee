import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from './env';

const PUBLIC_PATHS = ['/login', '/auth'];

/** 每次請求更新登入 cookie，並把未登入的人導到登入頁 */
export async function updateSession(request: NextRequest) {
  // 還沒設定 Supabase，或在示範模式，都不檢查登入
  if (!isSupabaseConfigured || process.env.NEXT_PUBLIC_MONEE_DEMO === '1') return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // 帶登入 cookie 的回應不可被 CDN 快取，否則可能把別人的登入狀態送給另一個人
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // 不要在 createServerClient 與 getClaims 之間插入其他邏輯，避免登入狀態被意外登出
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // API 是給前端 fetch 用的，未登入回 401，導到登入頁的話前端只會拿到一頁 HTML
  if (!signedIn && pathname.startsWith('/api/')) return NextResponse.json({ error: '登入已過期，請重新登入' }, { status: 401 });
  if (!signedIn && !isPublic) return redirectTo('/login');
  if (signedIn && pathname === '/login') return redirectTo('/');
  return response;
}
