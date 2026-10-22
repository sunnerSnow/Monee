import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveAlive, GoogleApiError, googleFetch, GoogleNotFound, multipartBody, trashFile, updateFile } from './google-api';

afterEach(() => vi.unstubAllGlobals());

/** 依序回應；記下每次呼叫的網址和方法 */
function replies(...list: [number, object][]) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : undefined });
    const [status, body] = list.shift() ?? [500, {}];
    return new Response(JSON.stringify(body), { status });
  }));
  return calls;
}
const gError = (reason: string) => ({ error: { errors: [{ reason }] } });

describe('multipartBody', () => {
  it('第一段是檔名資料、第二段是檔案，邊界前後對得上', () => {
    const { body, contentType } = multipartBody({ name: '2026-10-22_全聯_830.jpg', parents: ['p'] }, new Uint8Array([1, 2, 3]), 'image/jpeg');
    const boundary = contentType.split('boundary=')[1];
    const text = new TextDecoder().decode(body);
    expect(text.startsWith(`--${boundary}\r\nContent-Type: application/json`)).toBe(true);
    expect(text).toContain('"name":"2026-10-22_全聯_830.jpg"');
    expect(text).toContain(`--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n\u0001\u0002\u0003\r\n--${boundary}--`);
  });
});

describe('googleFetch 錯誤分類', () => {
  it('404 是找不到；空間滿了、授權過期之後的也會失敗；忙碌下次再試', async () => {
    replies([404, {}]);
    await expect(googleFetch('t', 'https://x')).rejects.toBeInstanceOf(GoogleNotFound);
    replies([403, gError('storageQuotaExceeded')]);
    await expect(googleFetch('t', 'https://x')).rejects.toMatchObject({ fatal: true, message: 'Google 雲端硬碟的空間滿了' });
    replies([401, {}]);
    await expect(googleFetch('t', 'https://x')).rejects.toMatchObject({ fatal: true });
    replies([403, gError('userRateLimitExceeded')]);
    await expect(googleFetch('t', 'https://x')).rejects.toMatchObject({ fatal: false, message: 'Google 暫時忙碌，等一下會再試' });
    replies([503, {}]);
    await expect(googleFetch('t', 'https://x')).rejects.toBeInstanceOf(GoogleApiError);
  });
});

describe('Drive 檔案', () => {
  it('還在：在垃圾桶或找不到都算不在', async () => {
    replies([200, { id: 'f', trashed: false }], [200, { id: 'f', trashed: true }], [404, {}]);
    expect(await driveAlive('t', 'f')).toBe(true);
    expect(await driveAlive('t', 'f')).toBe(false);
    expect(await driveAlive('t', 'f')).toBe(false);
  });

  it('搬資料夾：拿掉原本的上層資料夾、加上新的，順便改名', async () => {
    const calls = replies([200, { parents: ['oldFolder'] }], [200, { id: 'f', name: 'n' }]);
    await updateFile('t', 'f', { name: '2026-11-02_全聯_830.jpg', moveTo: 'newFolder' });
    const patch = new URL(calls[1].url);
    expect(calls[1].method).toBe('PATCH');
    expect(patch.searchParams.get('addParents')).toBe('newFolder');
    expect(patch.searchParams.get('removeParents')).toBe('oldFolder');
    expect(JSON.parse(calls[1].body!)).toEqual({ name: '2026-11-02_全聯_830.jpg' });
  });

  it('只改名不搬：不查上層資料夾', async () => {
    const calls = replies([200, { id: 'f' }]);
    await updateFile('t', 'f', { name: 'x.jpg' });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).searchParams.has('addParents')).toBe(false);
  });

  it('丟垃圾桶：已經不在了不算錯', async () => {
    const calls = replies([200, { id: 'f' }], [404, {}]);
    await trashFile('t', 'f');
    expect(JSON.parse(calls[0].body!)).toEqual({ trashed: true });
    await expect(trashFile('t', 'f')).resolves.toBeUndefined();
  });
});
