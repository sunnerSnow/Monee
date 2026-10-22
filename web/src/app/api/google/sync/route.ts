// 同步到 Google：前端在記帳後、打開 App 時自動叫（不等結果），「立即同步」按鈕帶 force 會連失敗多次的月份一起再試
import { NextResponse } from 'next/server';
import { runSync } from '@/lib/server/google-sync';
import { currentUser } from '@/lib/server/session';

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await currentUser();
  if (!session) return NextResponse.json({ status: 'error', message: '登入已過期，請重新登入' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { force?: unknown };
  try {
    return NextResponse.json(await runSync(session.supabase, session.userId, { force: body.force === true }));
  } catch (e) {
    console.error('[google] 同步失敗', e instanceof Error ? e.message : e);
    return NextResponse.json({ status: 'error', message: '同步失敗，等一下再試' }, { status: 500 });
  }
}
