// A Supabase client that acts as one signed-in user, for the MCP gateway.
// It mints the same kind of short-lived identity token as netlify/functions/supabase-token.js (sub = the user, role = authenticated), so the
// database's own row-level security decides what the key's owner can see and change. The user id comes from the verified MCP key, never from a request.
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const bytes = (s) => { const e = new TextEncoder().encode(s); return new Uint8Array(e.buffer, e.byteOffset, e.byteLength); };

export async function mintOwnerToken({ userId, workspaceId = 'personal', secret, ttlSeconds = 300, now = Date.now }) {
  if (!userId || userId === 'byok') throw Object.assign(new Error('This needs a signed-in SmartVid MCP key.'), { status: 401 });
  if (!secret) throw Object.assign(new Error('Account data is not configured on this deployment.'), { status: 503 });
  const iat = Math.floor(now() / 1000);
  return new SignJWT({ workspace_id: workspaceId, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId).setAudience('authenticated').setIssuedAt(iat).setExpirationTime(iat + ttlSeconds)
    .sign(bytes(secret));
}

export async function ownerSupabase(who, env = process.env, factory = createClient) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw Object.assign(new Error('Account data is not configured on this deployment.'), { status: 503 });
  const token = await mintOwnerToken({ userId: who?.userId, workspaceId: who?.workspaceId, secret: env.SUPABASE_JWT_SECRET });
  return factory(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}
