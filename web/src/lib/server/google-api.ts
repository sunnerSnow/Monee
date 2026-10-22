// Google Drive API（只在伺服器用）：資料夾、上傳、改名搬家、丟垃圾桶。
// 錯誤分成：找不到（GoogleNotFound）、其他（GoogleApiError，帶 HTTP 狀態；忙碌、暫時失敗下次再試）。token 不寫進 log。

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export class GoogleNotFound extends Error {
  constructor() {
    super('Google 上找不到這個檔案');
  }
}

export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number, readonly reason?: string) {
    super(message);
  }
  /** 後面的也一定會失敗（空間滿了、授權過期），不用再試下一個月 */
  get fatal() {
    return this.status === 401 || this.reason === 'storageQuotaExceeded';
  }
}

export async function googleFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.ok) return (res.status === 204 ? null : await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as { error?: { errors?: { reason?: string }[] } };
  const reason = body.error?.errors?.[0]?.reason;
  if (res.status === 404) throw new GoogleNotFound();
  if (reason === 'storageQuotaExceeded') throw new GoogleApiError('Google 雲端硬碟的空間滿了', res.status, reason);
  if (res.status === 401) throw new GoogleApiError('Google 的授權過期了，等一下會再試', 401, reason);
  if (res.status === 429 || res.status >= 500 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
    throw new GoogleApiError('Google 暫時忙碌，等一下會再試', res.status, reason);
  }
  console.error('[google] API 錯誤', res.status, reason);
  throw new GoogleApiError(`Google 回應錯誤（${res.status}${reason ? ` ${reason}` : ''}）`, res.status, reason);
}

const json = (body: object): RequestInit => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json; charset=UTF-8' } });

export interface DriveFile {
  id: string;
  name?: string;
  webViewLink?: string;
  trashed?: boolean;
  parents?: string[];
}

/** 檔案或資料夾還在（沒被刪、沒在垃圾桶，換了 Google 帳號也算不在） */
export async function driveAlive(token: string, id: string) {
  try {
    return !(await googleFetch<DriveFile>(token, `${DRIVE}/${encodeURIComponent(id)}?fields=id,trashed`)).trashed;
  } catch (e) {
    if (e instanceof GoogleNotFound) return false;
    throw e;
  }
}

/** 建一個空的 Google 檔案（資料夾、試算表）；沒給 parentId 就建在「我的雲端硬碟」最上層 */
async function createFile(token: string, name: string, mimeType: string, parentId?: string) {
  return googleFetch<DriveFile>(token, `${DRIVE}?fields=id`, {
    method: 'POST', ...json({ name, mimeType, ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

export const createFolder = (token: string, name: string, parentId?: string) => createFile(token, name, FOLDER_MIME, parentId);
export const createSpreadsheet = (token: string, name: string, parentId: string) =>
  createFile(token, name, 'application/vnd.google-apps.spreadsheet', parentId);

// ---------- Sheets ----------
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetProps {
  sheetId: number;
  title: string;
  gridProperties?: { rowCount?: number };
}

export async function sheetProps(token: string, spreadsheetId: string) {
  const res = await googleFetch<{ sheets?: { properties: SheetProps }[] }>(
    token, `${SHEETS}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(sheetId,title,gridProperties.rowCount)`,
  );
  return (res.sheets ?? []).map((s) => s.properties);
}

/** 一次送出很多個修改；Google 照順序做，中間有一個失敗就全部不做 */
export async function sheetsBatch(token: string, spreadsheetId: string, requests: object[]) {
  if (!requests.length) return;
  await googleFetch(token, `${SHEETS}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, { method: 'POST', ...json({ requests }) });
}

/** Drive 的 multipart 上傳：第一段是檔名等資料（JSON），第二段是檔案本身 */
export function multipartBody(metadata: object, bytes: Uint8Array, mime: string) {
  const boundary = `monee${crypto.randomUUID().replace(/-/g, '')}`;
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export async function uploadFile(token: string, f: { name: string; parentId: string; mime: string; bytes: Uint8Array }) {
  const { body, contentType } = multipartBody({ name: f.name, parents: [f.parentId] }, f.bytes, f.mime);
  return googleFetch<DriveFile>(token, `${UPLOAD}?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST', body: body as BodyInit, headers: { 'Content-Type': contentType },
  });
}

/** 改檔名；moveTo 有給就搬到那個資料夾（Drive 的檔案只能有一個上層資料夾，原本的要拿掉） */
export async function updateFile(token: string, id: string, f: { name: string; moveTo?: string }) {
  const params = new URLSearchParams({ fields: 'id,name,webViewLink' });
  if (f.moveTo) {
    const { parents = [] } = await googleFetch<DriveFile>(token, `${DRIVE}/${encodeURIComponent(id)}?fields=parents`);
    params.set('addParents', f.moveTo);
    if (parents.length) params.set('removeParents', parents.join(','));
  }
  return googleFetch<DriveFile>(token, `${DRIVE}/${encodeURIComponent(id)}?${params}`, { method: 'PATCH', ...json({ name: f.name }) });
}

/** 丟進垃圾桶（30 天內可以救回來）；已經不在了就算了 */
export async function trashFile(token: string, id: string) {
  try {
    await googleFetch(token, `${DRIVE}/${encodeURIComponent(id)}?fields=id`, { method: 'PATCH', ...json({ trashed: true }) });
  } catch (e) {
    if (!(e instanceof GoogleNotFound)) throw e;
  }
}
