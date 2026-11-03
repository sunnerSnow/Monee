// AI 記帳草稿：收語音、收據照片或一句文字，請 Gemini 整理成交易草稿回傳。不寫資料庫，使用者確認後才由前端寫入。
import { NextResponse } from 'next/server';
import {
  NotATransactionError, SOURCE_PROMPT, draftInstruction, draftSchema, isISODate, parseDraftAccounts, parseDraftCategories, parseDraftContext,
  sanitizeDraft, type DraftSource,
} from '@/lib/ai-draft';
import { HttpError, callGemini, signedIn } from '@/lib/server/gemini';

export const maxDuration = 30;

// Vercel 函式的請求上限約 4.5MB；前端會先把照片縮小，正常不會碰到
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 300;
const MIME: Record<Exclude<DraftSource, 'text'>, string[]> = {
  // 前端自己存成 WAV（use-voice.ts），Gemini 官方支援
  voice: ['audio/wav', 'audio/x-wav'],
  receipt: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

const taipeiToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

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
  // 使用者自己的分類（沒隱藏的）；沒帶或格式不對就用內建的
  let categories;
  try {
    categories = parseDraftCategories(JSON.parse(String(form.get('categories') ?? '[]')));
  } catch {
    categories = parseDraftCategories([]);
  }
  // 分帳／旅程才會帶：成員名字與群組幣別
  let context;
  try {
    context = form.has('context') ? parseDraftContext(JSON.parse(String(form.get('context')))) : undefined;
  } catch {
    context = undefined;
  }

  const parts: Part[] = [];
  if (source === 'text') {
    const text = String(form.get('text') ?? '').trim();
    if (!text) return fail(400, '請輸入要記的內容');
    parts.push({ text: SOURCE_PROMPT.text }, { text: text.slice(0, MAX_TEXT) });
  } else {
    parts.push({ text: SOURCE_PROMPT[source] });
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
      systemInstruction: { parts: [{ text: draftInstruction(accounts, today, context, categories) }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: draftSchema(accounts, context, categories),
        temperature: 0.2,
        // 記帳整理不需要長考，最低思考等級最快（實測約 2 秒）
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    }, 'ai/draft');
    return NextResponse.json({ draft: sanitizeDraft(raw, { accounts, categories, today, source, context }) });
  } catch (e) {
    if (e instanceof NotATransactionError) return fail(422, e.message);
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error('[ai/draft] 未預期的錯誤', e);
    return fail(500, 'AI 辨識失敗，請再試一次');
  }
}
