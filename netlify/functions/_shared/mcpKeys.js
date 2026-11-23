// netlify/functions/_shared/mcpKeys.js
// SmartVid MCP keys: generation, hashing, encrypted storage of the user's own upstream keys, lookup.
// The store is injectable so tests (and a future non-Supabase backend) need no database.
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const KEY_PREFIX = 'sv_live_';
const KEY_RE = /^sv_live_[A-Za-z0-9_-]{32,64}$/;
const ENC_PREFIX = 'v1';
export const MAX_ACTIVE_KEYS = 10;

/** A fresh raw key. 32 random bytes → 43 url-safe chars. Shown to the user once. */
export const newRawKey = () => `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
export const isMcpKey = (s) => typeof s === 'string' && KEY_RE.test(s);
export const hashKey = (raw) => createHash('sha256').update(String(raw)).digest('hex');
export const displayPrefix = (raw) => `${raw.slice(0, KEY_PREFIX.length + 4)}…`;

// ── Encryption of the user's own upstream keys ─────────────────────────────
// AES-256-GCM; key derived with scrypt from MCP_KEY_SECRET and a per-value salt.
// No fallback secret: without MCP_KEY_SECRET nothing is stored or read (fail closed).
function derive(salt) {
  const secret = process.env.MCP_KEY_SECRET;
  if (!secret || secret.length < 32) throw new Error('MCP_KEY_SECRET (32+ chars) is not configured');
  return scryptSync(secret, salt, 32);
}

export function encryptSecret(plain) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derive(salt), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [ENC_PREFIX, salt.toString('base64'), iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

/** Decrypts, or returns null when empty / not our format / tampered / secret missing. Never throws. */
export function decryptSecret(stored) {
  try {
    const [v, salt, iv, tag, data] = String(stored || '').split(':');
    if (v !== ENC_PREFIX || !salt || !iv || !tag || !data) return null;
    const d = createDecipheriv('aes-256-gcm', derive(Buffer.from(salt, 'base64')), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── Store ───────────────────────────────────────────────────────────────────
export function createSupabaseStore(client) {
  const admin = client || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const T = 'mcp_keys';
  const unwrap = ({ data, error }) => { if (error) throw error; return data; };
  return {
    insert: async (row) => unwrap(await admin.from(T).insert(row).select('id, label, key_prefix, created_at, expires_at').single()),
    byHash: async (hash) => unwrap(await admin.from(T).select('*').eq('key_hash', hash).is('revoked_at', null).maybeSingle()),
    listForUser: async (userId) => unwrap(await admin.from(T).select('id, label, key_prefix, created_at, last_used_at, revoked_at, expires_at').eq('clerk_user_id', userId).is('revoked_at', null).order('created_at', { ascending: false })),
    countActive: async (userId) => unwrap(await admin.from(T).select('id').eq('clerk_user_id', userId).is('revoked_at', null)).length,
    revoke: async (userId, id) => unwrap(await admin.from(T).update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('clerk_user_id', userId).is('revoked_at', null).select('id')).length > 0,
    revokeAllForUser: async (userId) => unwrap(await admin.from(T).update({ revoked_at: new Date().toISOString() }).eq('clerk_user_id', userId).is('revoked_at', null).select('id')).length,
    touch: async (id) => { await admin.from(T).update({ last_used_at: new Date().toISOString() }).eq('id', id); },
  };
}

// ── Operations ──────────────────────────────────────────────────────────────
const MUAPI_RE = /^[A-Za-z0-9._-]{16,200}$/;
const OPENAI_RE = /^sk-[A-Za-z0-9_-]{20,}$/;

export async function createMcpKey(store, { userId, workspaceId = 'personal', label, muapiKey, openaiKey, expiresInDays, now = Date.now, maxActive = MAX_ACTIVE_KEYS }) {
  if (!MUAPI_RE.test(String(muapiKey || ''))) return { error: 'bad_key', message: 'Add your generation API key in Settings → API keys first.' };
  if (openaiKey && !OPENAI_RE.test(String(openaiKey))) return { error: 'bad_openai_key', message: 'That OpenAI key does not look valid.' };
  if ((await store.countActive(userId)) >= maxActive) return { error: 'too_many_keys', message: `You can have at most ${MAX_ACTIVE_KEYS} active MCP keys. Revoke one first.` };
  const raw = newRawKey();
  const row = await store.insert({
    clerk_user_id: userId,
    workspace_id: workspaceId,
    label: String(label || 'MCP key').slice(0, 60),
    key_hash: hashKey(raw),
    key_prefix: displayPrefix(raw),
    muapi_key_enc: encryptSecret(muapiKey),
    openai_key_enc: openaiKey ? encryptSecret(openaiKey) : null,
    ...(Number.isFinite(expiresInDays) && expiresInDays > 0 ? { expires_at: new Date(now() + expiresInDays * 86_400_000).toISOString() } : {}),
  });
  return { key: raw, id: row.id, label: row.label, prefix: row.key_prefix, created_at: row.created_at, expires_at: row.expires_at ?? null };
}

/**
 * Resolve a raw MCP key to the user it acts for. Returns null for anything invalid,
 * revoked, or whose stored secrets cannot be decrypted (fail closed).
 */
export async function resolveMcpKey(store, raw, { now = Date.now } = {}) {
  if (!isMcpKey(raw)) return null;
  const row = await store.byHash(hashKey(raw));
  if (!row || row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= now()) return null; // expired keys stop working like revoked ones
  // constant-time confirm of the hash match (defence in depth; lookup is already by hash)
  if (!timingSafeEqual(Buffer.from(row.key_hash), Buffer.from(hashKey(raw)))) return null;
  const muapi = decryptSecret(row.muapi_key_enc);
  if (!muapi) return null;
  void store.touch(row.id).catch?.(() => {});
  return { id: row.id, userId: row.clerk_user_id, workspaceId: row.workspace_id, keys: { muapi, openai: row.openai_key_enc ? decryptSecret(row.openai_key_enc) : null } };
}
