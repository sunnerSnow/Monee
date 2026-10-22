import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accessToken, authUrl, DRIVE_FILE_SCOPE, emailFromIdToken, exchangeCode, GoogleConnectError, googleConfig, GoogleReconnectError,
} from './google-oauth';
import { decryptToken, encryptToken, tokenKey } from './token-crypto';

const KEY = randomBytes(32);
const USER = '11111111-1111-1111-1111-111111111111';
const CFG = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret' };

describe('token-crypto', () => {
  it('加密後解得回來，每次密文都不一樣', () => {
    const a = encryptToken('1//refresh-token', USER, KEY);
    const b = encryptToken('1//refresh-token', USER, KEY);
    expect(a).not.toBe(b);
    expect(a).not.toContain('refresh-token');
    expect(decryptToken(a, USER, KEY)).toBe('1//refresh-token');
  });

  it('別人的、被改過的、換了金鑰的都解不開', () => {
    const c = encryptToken('1//refresh-token', USER, KEY);
    expect(() => decryptToken(c, '22222222-2222-2222-2222-222222222222', KEY)).toThrow();
    const [v, iv, tag, data] = c.split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() => decryptToken([v, iv, tag, flipped.toString('base64')].join('.'), USER, KEY)).toThrow();
    expect(() => decryptToken(c, USER, randomBytes(32))).toThrow();
    expect(() => decryptToken('not-a-token', USER, KEY)).toThrow('格式不對');
  });

  it('金鑰要剛好 32 bytes', () => {
    expect(tokenKey(KEY.toString('base64'))).toHaveLength(32);
    expect(() => tokenKey(randomBytes(16).toString('base64'))).toThrow('GOOGLE_TOKEN_KEY');
    expect(() => tokenKey(undefined)).toThrow('GOOGLE_TOKEN_KEY');
  });
});

describe('google-oauth', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('三個環境變數都有才算設定好', () => {
    expect(googleConfig({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', GOOGLE_TOKEN_KEY: 'c' } as never)).toEqual({ clientId: 'a', clientSecret: 'b' });
    expect(googleConfig({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' } as never)).toBeNull();
  });

  it('授權網址：只要 drive.file、要長期授權、帶 state', () => {
    const url = new URL(authUrl(CFG, 'st4te', 'https://monee.app/api/google/callback'));
    expect(url.searchParams.get('scope')).toBe(`openid email ${DRIVE_FILE_SCOPE}`);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('st4te');
    expect(url.searchParams.get('redirect_uri')).toBe('https://monee.app/api/google/callback');
  });

  it('從 id_token 拿 email；壞掉的就是 null', () => {
    const payload = Buffer.from(JSON.stringify({ email: 'a@gmail.com' })).toString('base64url');
    expect(emailFromIdToken(`h.${payload}.s`)).toBe('a@gmail.com');
    expect(emailFromIdToken('broken')).toBeNull();
    expect(emailFromIdToken(undefined)).toBeNull();
  });

  const reply = (status: number, body: object) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it('換授權碼：拿到 refresh token 和 email', async () => {
    const idToken = `h.${Buffer.from(JSON.stringify({ email: 'a@gmail.com' })).toString('base64url')}.s`;
    reply(200, { refresh_token: '1//r', access_token: 'ya29', scope: `openid ${DRIVE_FILE_SCOPE} email`, id_token: idToken });
    await expect(exchangeCode(CFG, 'code', 'https://x/cb')).resolves.toEqual({ refreshToken: '1//r', email: 'a@gmail.com' });
  });

  it('換授權碼：沒勾 Drive 權限、沒給 refresh token、Google 回錯誤', async () => {
    reply(200, { refresh_token: '1//r', scope: 'openid email' });
    await expect(exchangeCode(CFG, 'code', 'https://x/cb')).rejects.toMatchObject({ code: 'scope' });
    reply(200, { access_token: 'ya29', scope: DRIVE_FILE_SCOPE });
    await expect(exchangeCode(CFG, 'code', 'https://x/cb')).rejects.toMatchObject({ code: 'no-refresh' });
    reply(400, { error: 'invalid_grant' });
    await expect(exchangeCode(CFG, 'code', 'https://x/cb')).rejects.toBeInstanceOf(GoogleConnectError);
  });

  it('換 access token：授權失效要重新連結，其他錯誤下次再試', async () => {
    reply(200, { access_token: 'ya29' });
    await expect(accessToken(CFG, '1//r')).resolves.toBe('ya29');
    reply(400, { error: 'invalid_grant' });
    await expect(accessToken(CFG, '1//r')).rejects.toBeInstanceOf(GoogleReconnectError);
    reply(503, { error: 'backendError' });
    await expect(accessToken(CFG, '1//r')).rejects.toThrow('暫時連不上');
  });
});
