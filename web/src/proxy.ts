import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 靜態檔、圖片、App 設定檔不用檢查登入（手機讀 manifest 時不帶 cookie，被導到登入頁就會壞掉）
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)'],
};
