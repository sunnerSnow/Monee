// 年度回顧的小結語：收前端算好的統計數字（不含明細），請 Gemini 寫年度稱號、小結和明年的小提醒。不讀也不寫資料庫。
import { NextResponse } from 'next/server';
import { HttpError, callGemini, signedIn } from '@/lib/server/gemini';
import { WRAPPED_INSTRUCTION, parseWrappedStats, sanitizeWrappedSummary, wrappedSchema } from '@/lib/wrapped-ai';

export const maxDuration = 30;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  if (!(await signedIn())) return fail(401, '登入已過期，請重新登入');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(503, 'AI 還沒設定好（伺服器缺少 GEMINI_API_KEY）');

  let stats;
  try {
    stats = parseWrappedStats(await request.json());
  } catch {
    return fail(400, '統計資料格式不對');
  }

  try {
    const raw = await callGemini(key, {
      systemInstruction: { parts: [{ text: WRAPPED_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(stats) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: wrappedSchema,
        // 小結語要有點變化，比記帳整理活潑一點
        temperature: 0.9,
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    }, 'ai/wrapped');
    const summary = sanitizeWrappedSummary(raw);
    if (!summary) return fail(502, 'AI 這次沒寫好，請再試一次');
    return NextResponse.json({ summary });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error('[ai/wrapped] 未預期的錯誤', e);
    return fail(500, 'AI 暫時寫不出來，請再試一次');
  }
}
