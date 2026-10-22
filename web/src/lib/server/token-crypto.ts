// Google 的 refresh token 加密後才存進資料庫（只在伺服器用）：AES-256-GCM，金鑰是 GOOGLE_TOKEN_KEY（32 bytes 的 base64）。
// 加密時綁上使用者 id（AAD），密文搬到別人的那一列也解不開。格式：v1.<iv>.<tag>.<密文>
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export function tokenKey(raw = process.env.GOOGLE_TOKEN_KEY): Buffer {
  const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) throw new Error('GOOGLE_TOKEN_KEY 要是 32 bytes 的 base64（設定步驟在 README）');
  return key;
}

export function encryptToken(plain: string, userId: string, key = tokenKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(userId, 'utf8'));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

/** 金鑰換了、密文被改過、或不是這個人的，都會丟出錯誤 */
export function decryptToken(stored: string, userId: string, key = tokenKey()) {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('授權資料的格式不對');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(userId, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
