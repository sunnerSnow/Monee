// AI 記帳草稿：收語音、收據照片或一句文字，請 Gemini 整理成交易草稿回傳。不寫資料庫，使用者確認後才由前端寫入。
import { NextResponse } from 'next/server';
import {
  NotATransactionError, SOURCE_PROMPT, draftInstruction, draftSchema, isISODate, parseDraftAccounts, parseDraftContext, sanitizeDraft, type DraftSource,
} from '@/lib/ai-draft';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

// 依序嘗試；第一個忙碌或額度用完時換下一個。可用 GEMINI_MODEL（逗號分隔）覆寫
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest')
  .split(',').map((m) => m.trim()).filter(Boolean);
const ATTEMPT_TIMEOUT_MS = 12_000;
// Vercel 函式的請求上限約 4.5MB；前端會先把照片縮小，正常不會碰到
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 300;
const MIME: Record<Exclude<DraftSource, 'text'>, string[]> = {
  voice: ['audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav'],
  receipt: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

// 示範模式沒有 Supabase 可以驗證登入，只在本機開發時放行
const skipAuth = process.env.NEXT_PUBLIC_MONEE_DEMO === '1' && process.env.NODE_ENV !== 'production';

async function signedIn() {
  if (skipAuth) return true;
  if (!isSupabaseConfigured) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

const taipeiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function callGemini(key: string, body: object) {
  let lastStatus = 0;
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch (e) {
      console.error(`[ai/draft] ${model} 連線失敗或逾時`, e instanceof Error ? e.name : e);
      lastStatus = 504;
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      const candidate = json.candidates?.[0];
      const text: string = (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      if (!text) {
        console.error(`[ai/draft] ${model} 沒有回傳內容`, candidate?.finishReason ?? json.promptFeedback?.blockReason);
        throw new HttpError(422, '這段內容 AI 無法處理，請改用手動輸入');
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        console.error(`[ai/draft] ${model} 回傳的不是 JSON`);
        lastStatus = 502;
        continue;
      }
    }
    lastStatus = res.status;
    console.error(`[ai/draft] ${model} 回應 ${res.status}`);
    // 忙碌、額度用完、伺服器錯誤才換下一個模型；其他錯誤（金鑰錯、格式錯）換模型也沒用
    if (![429, 500, 502, 503, 504].includes(res.status)) {
      throw new HttpError(502, res.status === 400 || res.status === 403 ? 'AI 服務設定有問題（請檢查 GEMINI_API_KEY）' : 'AI 辨識失敗，請再試一次');
    }
  }
  throw lastStatus === 429
    ? new HttpError(429, 'AI 的使用額度暫時用完了，請稍後再試，或先用手動輸入')
    : new HttpError(503, 'AI 服務暫時忙碌，請稍後再試，或先用手動輸入');
}

export async function POST(request: Request) {
  if (!(await signedIn())) return fail(401, '登入已過期，請重新登入');
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(503, 'AI 記帳還沒設定好（伺服器缺少 GEMINI_API_KEY）');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, '上傳的資料格式不對');
  }

  const source = form.get('source');
  if (source !== 'voice' && source !== 'receipt' && source !== 'text') return fail(400, '不支援的輸入方式');
  const todayInput = form.get('today');
  const today = isISODate(todayInput) ? todayInput : taipeiToday();
  let accounts;
  try {
    accounts = parseDraftAccounts(JSON.parse(String(form.get('accounts') ?? '[]')));
  } catch {
    accounts = parseDraftAccounts([]);
  }
  // 分帳／旅程才會帶：成員名字與群組幣別
  let context;
  try {
    context = form.has('context') ? parseDraftContext(JSON.parse(String(form.get('context')))) : undefined;
  } catch {
    context = undefined;
  }

  const parts: Part[] = [{ text: SOURCE_PROMPT[source] }];
  if (source === 'text') {
    const text = String(form.get('text') ?? '').trim();
    if (!text) return fail(400, '請輸入要記的內容');
    parts.push({ text: text.slice(0, MAX_TEXT) });
  } else {
    const file = form.get('file');
    if (!(file instanceof Blob) || file.size === 0) return fail(400, source === 'voice' ? '沒有收到錄音' : '沒有收到照片');
    if (file.size > MAX_FILE_BYTES) return fail(413, source === 'voice' ? '錄音太長了，請說短一點' : '照片太大了，請重新拍一張');
    // 瀏覽器給的類型可能帶參數（audio/webm;codecs=opus），Gemini 只要主類型
    const mimeType = file.type.split(';')[0].trim().toLowerCase();
    if (!MIME[source].includes(mimeType)) return fail(415, source === 'voice' ? '這個瀏覽器的錄音格式不支援' : '請上傳 JPG、PNG 或 HEIC 照片');
    parts.push({ inlineData: { mimeType, data: Buffer.from(await file.arrayBuffer()).toString('base64') } });
  }

  try {
    const raw = await callGemini(key, {
      systemInstruction: { parts: [{ text: draftInstruction(accounts, today, context) }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: draftSchema(accounts, context),
        temperature: 0.2,
        // 記帳整理不需要長考，最低思考等級最快（實測約 2 秒）
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    });
    return NextResponse.json({ draft: sanitizeDraft(raw, { accounts, today, source, context }) });
  } catch (e) {
    if (e instanceof NotATransactionError) return fail(422, e.message);
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error('[ai/draft] 未預期的錯誤', e);
    return fail(500, 'AI 辨識失敗，請再試一次');
  }
}
