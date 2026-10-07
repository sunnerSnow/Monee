// 匯率：從 open.er-api.com（免費、免金鑰）抓「1 台幣換多少外幣」，快取 6 小時。
// 只是記帳時的參考，實際以信用卡帳單為準，使用者可以在每筆花費改匯率。
import { NextResponse } from 'next/server';
import { CURRENCIES } from '@/lib/currency';

const SOURCE = 'https://open.er-api.com/v6/latest/TWD';

export async function GET() {
  try {
    const res = await fetch(SOURCE, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: string; time_last_update_utc?: string; rates?: Record<string, number> };
    if (json.result !== 'success' || !json.rates) throw new Error('bad payload');
    const perTwd = Object.fromEntries(CURRENCIES.filter((c) => c.code !== 'TWD' && json.rates![c.code]).map((c) => [c.code, json.rates![c.code]]));
    return NextResponse.json({ updatedAt: json.time_last_update_utc ?? '', perTwd });
  } catch (e) {
    console.error('[fx] 匯率抓取失敗', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: '匯率暫時拿不到，可以自己輸入匯率' }, { status: 502 });
  }
}
