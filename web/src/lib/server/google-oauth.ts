// Google 授權（只在伺服器用）：OAuth 授權碼流程拿長期授權（refresh token），之後由伺服器換短期的 access token 呼叫 Drive、Sheets。
// 權限只有 drive.file（只碰得到 Monee 自己建立的檔案，屬於不用 Google 審核的權限），加上 openid、email 用來顯示連的是哪個帳號。
// token 一律不寫進 log。

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_SCOPES = ['openid', 'email', DRIVE_FILE_SCOPE];
/** 連結時的 state 放在這個 cookie，Google 導回來時比對，避免被別人塞授權碼 */
export const STATE_COOKIE = 'monee-google-state';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/** 長期授權失效（使用者到 Google 帳號移除了權限、改了密碼，或太久沒用），要重新連結 */
export class GoogleReconnectError extends Error {
  constructor() {
    super('Google 的授權失效了，請重新連結');
  }
}

/** 給使用者看的錯誤，對應設定頁的提示 */
export class GoogleConnectError extends Error {
  constructor(readonly code: 'scope' | 'no-refresh' | 'failed', message: string) {
    super(message);
  }
}

/** 三個都要有：Client ID（跟 Sheets 匯出共用）、Client secret、加密 token 的金鑰 */
export function googleConfig(env = process.env): GoogleConfig | null {
  const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !env.GOOGLE_TOKEN_KEY) return null;
  return { clientId, clientSecret };
}

/** Google 導回來的網址；要加進 Google Cloud 的「已授權的重新導向 URI」 */
export const callbackUrl = (origin: string) => `${origin}/api/google/callback`;

/** prompt=consent 加 access_type=offline：每次連結都拿得到 refresh token */
export function authUrl(cfg: GoogleConfig, state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

/** id_token 是 Google 的 token 端點直接給的（走 HTTPS），只拿 email 顯示，不另外驗簽 */
export function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: unknown };
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

/** 授權碼換 refresh token；使用者在 Google 的畫面取消勾選 Drive 權限時丟 scope 錯誤 */
export async function exchangeCode(cfg: GoogleConfig, code: string, redirectUri: string) {
  const { ok, status, json } = await postForm(TOKEN_URL, {
    code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
  });
  if (!ok) {
    console.error('[google] 授權碼換 token 失敗', status, json.error);
    throw new GoogleConnectError('failed', '跟 Google 連結失敗，請再試一次');
  }
  const scopes = String(json.scope ?? '').split(' ');
  if (!scopes.includes(DRIVE_FILE_SCOPE)) {
    throw new GoogleConnectError('scope', '要勾選「查看、編輯、建立及刪除 Monee 使用的 Google 雲端硬碟檔案」才能同步');
  }
  if (typeof json.refresh_token !== 'string') {
    throw new GoogleConnectError('no-refresh', 'Google 沒有給長期授權，請再連結一次');
  }
  return { refreshToken: json.refresh_token, email: emailFromIdToken(json.id_token) };
}

/** refresh token 換 access token（約一小時有效） */
export async function accessToken(cfg: GoogleConfig, refreshToken: string): Promise<string> {
  const { ok, status, json } = await postForm(TOKEN_URL, {
    refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token',
  });
  if (ok && typeof json.access_token === 'string') return json.access_token;
  if (json.error === 'invalid_grant') throw new GoogleReconnectError();
  console.error('[google] 換 access token 失敗', status, json.error);
  throw new Error('暫時連不上 Google，等一下會再試');
}

/** 解除連結時撤銷授權；失敗也沒關係（使用者可能已經在 Google 帳號那邊移除了） */
export async function revokeToken(token: string) {
  try {
    await postForm(REVOKE_URL, { token });
  } catch {
    // 不影響解除連結
  }
}
