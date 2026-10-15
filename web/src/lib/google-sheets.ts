'use client';

// 匯出到 Google Sheets：瀏覽器向 Google 拿授權，直接呼叫 Sheets API 寫進使用者自己的雲端硬碟。
// 授權範圍是 drive.file：只能建立、讀寫 Monee 自己建立的檔案，看不到使用者其他的檔案。
// 授權只放在記憶體（約一小時），不存進資料庫；資料庫只記住試算表 id。
import { SHEET_TITLE, type ColumnFormat, type Tab } from './sheets-export';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';

export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
export const isGoogleConfigured = Boolean(googleClientId);

export const sheetsUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

// ---------- 授權（Google Identity Services 的 token model） ----------

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }): { requestAccessToken(): void };
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let loading: Promise<void> | null = null;

/** 先載好 Google 登入的程式；按下按鈕時才載入的話，授權視窗會被瀏覽器當成廣告擋掉 */
export function preloadGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('連不上 Google，請檢查網路'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

let cached: { token: string; expiresAt: number } | null = null;

/** 登出時忘掉 Google 的授權，換別的帳號登入 Monee 才不會匯出到上一個人的雲端硬碟 */
export function forgetGoogleToken() {
  cached = null;
}

/**
 * 拿 Google 的授權。第一次會跳出 Google 的視窗讓使用者選帳號、同意；之後一小時內不用再問。
 * 要在按鈕的 click 裡直接呼叫（呼叫前不能先 await），授權視窗才不會被擋。
 */
export function requestGoogleToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return Promise.resolve(cached.token);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    preloadGoogle().catch(() => {});
    return Promise.reject(new Error('Google 登入還在載入，請再按一次'));
  }
  return new Promise((resolve, reject) => {
    oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPE,
      // 只有第一次要使用者同意，之後直接給
      prompt: '',
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new Error(r.error === 'access_denied' ? '沒有完成 Google 授權' : `Google 授權失敗（${r.error_description ?? r.error ?? '沒有拿到授權'}）`));
          return;
        }
        if (!oauth2.hasGrantedAllScopes(r, SCOPE)) {
          reject(new Error('要勾選允許 Monee 存取它建立的雲端硬碟檔案，才能匯出'));
          return;
        }
        cached = { token: r.access_token, expiresAt: Date.now() + Number(r.expires_in || 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => {
        reject(new Error(
          e.type === 'popup_failed_to_open'
            ? '瀏覽器擋住了 Google 的視窗。請允許彈出視窗；在 LINE 裡打開的話，請改用 Safari 或 Chrome'
            : '沒有完成 Google 授權',
        ));
      },
    }).requestAccessToken();
  });
}

// ---------- 呼叫 Google API ----------

class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface GoogleErrorBody {
  error?: {
    message?: string;
    errors?: { reason?: string }[];
    details?: { reason?: string; metadata?: { service?: string } }[];
  };
}

async function api<T>(token: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return (await res.json()) as T;

  const json = (await res.json().catch(() => null)) as GoogleErrorBody | null;
  const reasons = [...(json?.error?.details ?? []), ...(json?.error?.errors ?? [])].map((d) => d.reason);
  if (res.status === 401) {
    cached = null;
    throw new GoogleApiError(401, 'Google 授權過期了，請再按一次');
  }
  if (reasons.includes('SERVICE_DISABLED') || reasons.includes('accessNotConfigured')) {
    const name = url.startsWith(DRIVE) ? 'Google Drive API' : 'Google Sheets API';
    throw new GoogleApiError(res.status, `Google Cloud 專案還沒啟用 ${name}（設定步驟在 README）`);
  }
  if (res.status === 429 || res.status >= 500) throw new GoogleApiError(res.status, 'Google 暫時忙不過來，請稍後再試');
  throw new GoogleApiError(res.status, `匯出失敗（Google：${json?.error?.message ?? res.status}）`);
}

interface SheetProps {
  sheetId: number;
  title: string;
  gridProperties?: { rowCount?: number; columnCount?: number };
}

/** 工作表名稱放進範圍時要加單引號 */
const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;
const columnCount = (t: Tab) => t.rows.reduce((max, r) => Math.max(max, r.length), 0);

const NUMBER_FORMATS: Record<ColumnFormat, { type: string; pattern: string }> = {
  date: { type: 'DATE', pattern: 'yyyy-mm-dd' },
  money: { type: 'NUMBER', pattern: '#,##0' },
  percent: { type: 'PERCENT', pattern: '0%' },
};

/** 上次匯出的試算表還能用嗎：被刪掉、丟進垃圾桶、或換了 Google 帳號（看不到）就重建一份 */
async function stillThere(token: string, id: string) {
  try {
    const file = await api<{ trashed?: boolean }>(token, `${DRIVE}/${encodeURIComponent(id)}?fields=trashed`);
    return !file.trashed;
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 404) return false;
    throw e;
  }
}

/** 一次寫入的列數上限，資料多時分幾次寫，每次的資料量才不會太大 */
const ROWS_PER_WRITE = 4000;

/**
 * 把工作表寫進試算表：existingId 還在就整份更新（只動這幾張工作表，使用者自己加的工作表不會動），
 * 不在就建一份新的，建好馬上呼叫 onCreated 記下 id（後面寫到一半失敗，下次也會更新這份，不會再多建一份）。
 * 回傳試算表 id。
 */
export async function writeSpreadsheet(
  token: string, existingId: string | null, tabs: Tab[], onCreated: (id: string) => Promise<unknown>,
): Promise<string> {
  let id = existingId && (await stillThere(token, existingId)) ? existingId : null;
  let sheets: SheetProps[];

  if (!id) {
    const created = await api<{ spreadsheetId: string; sheets: { properties: SheetProps }[] }>(token, SHEETS, {
      properties: { title: SHEET_TITLE, locale: 'zh_TW', timeZone: 'Asia/Taipei' },
      sheets: tabs.map((t) => ({ properties: { title: t.title } })),
    });
    id = created.spreadsheetId;
    sheets = created.sheets.map((s) => s.properties);
    await onCreated(id);
  } else {
    const got = await api<{ sheets: { properties: SheetProps }[] }>(
      token, `${SHEETS}/${id}?fields=${encodeURIComponent('sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))')}`,
    );
    sheets = got.sheets.map((s) => s.properties);
    // 使用者刪掉或改名的工作表補回來
    const missing = tabs.filter((t) => !sheets.some((s) => s.title === t.title));
    if (missing.length) {
      const added = await api<{ replies: { addSheet: { properties: SheetProps } }[] }>(token, `${SHEETS}/${id}:batchUpdate`, {
        requests: missing.map((t) => ({ addSheet: { properties: { title: t.title } } })),
      });
      sheets.push(...added.replies.map((r) => r.addSheet.properties));
    }
    await api(token, `${SHEETS}/${id}/values:batchClear`, { ranges: tabs.map((t) => quote(t.title)) });
  }

  const sheetOf = (t: Tab) => sheets.find((s) => s.title === t.title)!;

  // 先把格子撐夠大、設好格式，再寫值
  await api(token, `${SHEETS}/${id}:batchUpdate`, {
    requests: tabs.flatMap((t) => {
      const { sheetId, gridProperties: grid = {} } = sheetOf(t);
      const columns = columnCount(t);
      return [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                rowCount: Math.max(grid.rowCount ?? 0, t.rows.length),
                columnCount: Math.max(grid.columnCount ?? 0, columns),
                frozenRowCount: t.freeze ? 1 : 0,
              },
            },
            fields: 'gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        ...Object.entries(t.formats).map(([col, format]) => ({
          repeatCell: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: Number(col), endColumnIndex: Number(col) + 1 },
            cell: { userEnteredFormat: { numberFormat: NUMBER_FORMATS[format!] } },
            fields: 'userEnteredFormat.numberFormat',
          },
        })),
        ...(t.widths ?? []).map((pixelSize, i) => ({
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
            properties: { pixelSize },
            fields: 'pixelSize',
          },
        })),
      ];
    }),
  });

  // RAW：文字照原樣存，不會被當成公式（朋友從分享連結記的品項也會寫進來）
  const pieces = tabs.flatMap((t) =>
    Array.from({ length: Math.ceil(t.rows.length / ROWS_PER_WRITE) }, (_, i) => ({
      range: `${quote(t.title)}!A${i * ROWS_PER_WRITE + 1}`,
      values: t.rows.slice(i * ROWS_PER_WRITE, (i + 1) * ROWS_PER_WRITE).map((r) => r.map((c) => c ?? '')),
    })));
  let batch: typeof pieces = [];
  let rows = 0;
  for (const piece of pieces) {
    if (batch.length && rows + piece.values.length > ROWS_PER_WRITE) {
      await api(token, `${SHEETS}/${id}/values:batchUpdate`, { valueInputOption: 'RAW', data: batch });
      batch = [];
      rows = 0;
    }
    batch.push(piece);
    rows += piece.values.length;
  }
  if (batch.length) await api(token, `${SHEETS}/${id}/values:batchUpdate`, { valueInputOption: 'RAW', data: batch });

  // 有值之後才能依內容調整欄寬
  const autoFit = tabs.filter((t) => !t.widths);
  if (autoFit.length) {
    await api(token, `${SHEETS}/${id}:batchUpdate`, {
      requests: autoFit.map((t) => ({
        autoResizeDimensions: {
          dimensions: { sheetId: sheetOf(t).sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: columnCount(t) },
        },
      })),
    });
  }

  return id;
}
