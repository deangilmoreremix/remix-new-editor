/**
 * AES-256-GCM for the opt-in "publish while I'm away" MuAPI key. The ciphertext is bound to the owner
 * (AAD = clerk user id) so a row copied to another account does not decrypt. The secret lives only in the
 * Netlify environment (SCHEDULER_KEY_SECRET: 32 random bytes, base64). Keys are never logged.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

export function secretKey(env = process.env) {
  const raw = String(env.SCHEDULER_KEY_SECRET || '');
  if (raw.length < 32) return null;
  const buf = Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : createHash('sha256').update(raw).digest();
}

export function encryptKey(plain, ownerId, env = process.env) {
  const key = secretKey(env);
  if (!key) throw Object.assign(new Error('scheduler_secret_missing'), { code: 'scheduler_secret_missing' });
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(String(ownerId)));
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [VERSION, iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

/** Returns the key, or null if it cannot be decrypted (wrong owner, wrong secret, tampering). */
export function decryptKey(blob, ownerId, env = process.env) {
  try {
    const key = secretKey(env);
    const [v, iv, tag, enc] = String(blob).split(':');
    if (!key || v !== VERSION) return null;
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    d.setAAD(Buffer.from(String(ownerId)));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}
