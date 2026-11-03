// 伺服器端：呼叫 Gemini（AI 記帳草稿、年度回顧小結語共用），和 AI 路由的登入檢查
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

// 依序嘗試；第一個忙碌或額度用完時換下一個。可用 GEMINI_MODEL（逗號分隔）覆寫
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest')
  .split(',').map((m) => m.trim()).filter(Boolean);
const ATTEMPT_TIMEOUT_MS = 12_000;

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// 示範模式沒有 Supabase 可以驗證登入，只在本機開發時放行
const skipAuth = process.env.NEXT_PUBLIC_MONEE_DEMO === '1' && process.env.NODE_ENV !== 'production';

export async function signedIn() {
  if (skipAuth) return true;
  if (!isSupabaseConfigured) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

/** 送出請求、解析回傳的 JSON；label 是記錄用的名字（ai/draft、ai/wrapped） */
export async function callGemini(key: string, body: object, label: string) {
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
      console.error(`[${label}] ${model} 連線失敗或逾時`, e instanceof Error ? e.name : e);
      lastStatus = 504;
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      const candidate = json.candidates?.[0];
      const text: string = (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      if (!text) {
        console.error(`[${label}] ${model} 沒有回傳內容`, candidate?.finishReason ?? json.promptFeedback?.blockReason);
        throw new HttpError(422, '這段內容 AI 無法處理，請改用手動輸入');
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        console.error(`[${label}] ${model} 回傳的不是 JSON`);
        lastStatus = 502;
        continue;
      }
    }
    lastStatus = res.status;
    console.error(`[${label}] ${model} 回應 ${res.status}`);
    // 忙碌、額度用完、伺服器錯誤才換下一個模型；其他錯誤（金鑰錯、格式錯）換模型也沒用
    if (![429, 500, 502, 503, 504].includes(res.status)) {
      throw new HttpError(502, res.status === 400 || res.status === 403 ? 'AI 服務設定有問題（請檢查 GEMINI_API_KEY）' : 'AI 辨識失敗，請再試一次');
    }
  }
  throw lastStatus === 429
    ? new HttpError(429, 'AI 的使用額度暫時用完了，請稍後再試，或先用手動輸入')
    : new HttpError(503, 'AI 服務暫時忙碌，請稍後再試，或先用手動輸入');
}
