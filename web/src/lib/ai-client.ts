'use client';

import type { AiDraftTransaction, DraftAccount, DraftSource } from './ai-draft';
import { toISODate } from './dates';

/** 把語音、收據照片或文字送到 /api/ai/draft，拿回整理好的交易草稿 */
export async function requestDraft(input: {
  source: DraftSource;
  file?: Blob;
  text?: string;
  accounts: DraftAccount[];
  signal?: AbortSignal;
}): Promise<AiDraftTransaction> {
  const form = new FormData();
  form.set('source', input.source);
  // 「今天」以使用者手機的日期為準，「昨天晚餐」才不會因為伺服器時區算錯
  form.set('today', toISODate(new Date()));
  form.set('accounts', JSON.stringify(input.accounts.map(({ id, name, type }) => ({ id, name, type }))));
  if (input.file) form.set('file', input.file, input.source === 'voice' ? 'voice' : 'receipt.jpg');
  if (input.text) form.set('text', input.text);

  let res: Response;
  try {
    res = await fetch('/api/ai/draft', { method: 'POST', body: form, signal: input.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new Error('網路連線失敗，請檢查網路後再試');
  }
  const json = (await res.json().catch(() => null)) as { draft?: AiDraftTransaction; error?: string } | null;
  if (!res.ok || !json?.draft) throw new Error(json?.error ?? 'AI 辨識失敗，請再試一次');
  return json.draft;
}

/**
 * 手機照片動輒 3～5MB，先縮到長邊 2000px 的 JPEG（約 300KB）再上傳：
 * 上傳快、不會超過伺服器上限，收據上的小字也還看得清楚。
 */
export async function shrinkImage(file: File, maxSide = 2000, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob) return blob;
  } catch {
    // 瀏覽器解不開這種格式（例如部分電腦上的 HEIC）就原檔上傳，由伺服器檢查格式與大小
  }
  return file;
}
