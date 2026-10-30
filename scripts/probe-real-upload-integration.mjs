#!/usr/bin/env node
/**
 * scripts/probe-real-upload-integration.mjs
 *
 * Real-integration probe for the Phase 3 upload validation task (R2).
 * Node-only (NOT a Playwright test): it performs ONE real attempt per
 * integration and honestly reports VERIFIED / BLOCKED. It never retries in a
 * loop and never prints secret values — only key names, hosts, status codes
 * and error excerpts.
 *
 * Integrations probed:
 *   1. Supabase Storage upload to the `uploads` bucket (same call shape as
 *      src/lib/uploadService.js: storage.from('uploads').upload(path, file)).
 *   2. MuAPI direct upload POST https://api.muapi.ai/api/v1/upload_file with
 *      x-api-key + multipart `file` (same shape as src/lib/muapiUpload.js).
 *   3. Durable `saveAsset`-equivalent media row insert (public.media, same row
 *      shape as src/lib/assetLibrary.js saveAsset). Without a verified
 *      Clerk/Supabase JWT the app-level gates (ASSET_SIGN_IN_REQUIRED /
 *      SECURE_SESSION_UNAVAILABLE) fire BEFORE this insert; this probe shows
 *      what the raw insert does under the anon identity.
 *
 * Credentials come from .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 * VITE_MUAPI_KEY, VITE_MUAPI_URL). Run: node scripts/probe-real-upload-integration.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env.local');

// ── env parsing (names only are ever printed) ───────────────────────────────
function loadEnvLocal() {
  const env = {};
  if (!fs.existsSync(ENV_FILE)) return env;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

const env = { ...loadEnvLocal() };
const KEY_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_MUAPI_KEY', 'VITE_MUAPI_URL'];
const MISSING = KEY_NAMES.filter((k) => !env[k] || !String(env[k]).trim());

function hostOf(url) {
  try { return new URL(url).host; } catch { return '(unparsable)'; }
}

function excerpt(text, max = 160) {
  return String(text ?? '').replace(/\s+/g, ' ').slice(0, max);
}

// ── result table plumbing ───────────────────────────────────────────────────
const results = [];
function record(integration, result, evidence) {
  results.push({ integration, result, evidence });
}

// ── 1. Supabase Storage upload (uploadService.uploadFileToSupabase shape) ───
async function probeSupabaseStorage() {
  const name = '1. Supabase Storage upload → `uploads` bucket';
  if (MISSING.includes('VITE_SUPABASE_URL') || MISSING.includes('VITE_SUPABASE_ANON_KEY')) {
    record(name, 'BLOCKED', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env.local');
    return;
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'smartvideo-probe-r2' } },
    });
    // Anonymous caller path: uploadService.buildObjectPath uses the literal
    // 'anonymous' prefix when there is no verified user id. The payload is a
    // small VALID PNG (the bucket rejects text/plain; images are what the app
    // actually uploads through uploadService).
    const objectPath = `anonymous/probe_r2_${Date.now()}_integration-check.png`;
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
      'hex',
    );
    const file = new File([png], 'probe-r2.png', { type: 'image/png' });

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(objectPath, file, { contentType: 'image/png', upsert: false });

    if (error) {
      record(name, 'BLOCKED', `storage.${hostOf(env.VITE_SUPABASE_URL)} upload denied — status=${error.status ?? error.statusCode ?? 'n/a'} message="${excerpt(error.message)}"`);
      return;
    }
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(objectPath);
    // Clean up the probe object so the shared bucket is left as found.
    const { error: rmError } = await supabase.storage.from('uploads').remove([objectPath]);
    record(name, 'VERIFIED', `uploaded path=${data?.path || objectPath} → public URL host=${hostOf(urlData?.publicUrl || '')}; cleanup remove=${rmError ? `denied (${excerpt(rmError.message, 60)})` : 'ok'}`);
  } catch (err) {
    record(name, 'BLOCKED', `client threw: ${err?.name || 'Error'}: ${excerpt(err?.message)}`);
  }
}

// ── 2. MuAPI direct upload (muapiUpload.transportUpload direct path) ────────
async function probeMuapiUpload() {
  const name = '2. MuAPI POST /api/v1/upload_file (direct, x-api-key)';
  if (MISSING.includes('VITE_MUAPI_KEY')) {
    record(name, 'BLOCKED', 'VITE_MUAPI_KEY not set in .env.local');
    return;
  }
  const endpoint = 'https://api.muapi.ai/api/v1/upload_file';
  try {
    // Minimal valid PNG (1x1) so server-side magic-byte checks see an image.
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
      'hex',
    );
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), `probe-r2-${Date.now()}.png`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-api-key': env.VITE_MUAPI_KEY },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    const url = json?.url || json?.data?.url || null;

    if (!response.ok) {
      record(name, 'BLOCKED', `HTTP ${response.status} ${response.statusText} — body="${excerpt(text)}"`);
      return;
    }
    if (!url) {
      record(name, 'BLOCKED', `HTTP 200 but no presigned url in response — body="${excerpt(text)}"`);
      return;
    }
    record(name, 'VERIFIED', `HTTP 200 — presigned url host=${hostOf(url)} (temporary, 1h)`);
  } catch (err) {
    const cause = err?.cause ? ` cause="${excerpt(err.cause?.message || err.cause)}"` : '';
    record(name, 'BLOCKED', `request failed: ${err?.name || 'Error'}: ${excerpt(err?.message)}${cause}`);
  }
}

// ── 3. Durable saveAsset-equivalent media row insert (assetLibrary shape) ───
async function probeDurableMediaInsert() {
  const name = '3. Durable saveAsset media row insert (public.media)';
  if (MISSING.includes('VITE_SUPABASE_URL') || MISSING.includes('VITE_SUPABASE_ANON_KEY')) {
    record(name, 'BLOCKED', 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env.local');
    return;
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    // Same identity the app resolves for a signed-out caller: 'anonymous'
    // (supabase.js applyIdentity sends x-user-key; no verified JWT exists).
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'smartvideo-probe-r2', 'x-user-key': 'anonymous' } },
    });
    const row = {
      id: crypto.randomUUID(),
      app_id: 'smartvideo',
      user_id: 'anonymous',
      workspace_id: 'personal',
      project_id: '',
      name: 'probe-r2-integration-check',
      type: 'text/plain',
      size: 64,
      path: `smartvideo/anonymous/probe_r2_${Date.now()}.txt`,
      url: 'https://placeholder.supabase.co/storage/v1/object/public/uploads/probe-r2.txt',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('media').insert(row).select().single();
    if (error) {
      record(name, 'BLOCKED', `insert denied — code=${error.code ?? 'n/a'} status=${error.status ?? 'n/a'} message="${excerpt(error.message)}"`);
      return;
    }
    // Clean up the probe row so the shared table is left as found.
    const { error: delError } = await supabase.from('media').delete().eq('id', row.id);
    record(name, 'VERIFIED', `row inserted id=${data?.id ?? 'n/a'} user_id=${data?.user_id ?? 'n/a'} (anon insert allowed by current RLS); cleanup delete=${delError ? `denied (${excerpt(delError.message, 60)})` : 'ok'}`);
  } catch (err) {
    record(name, 'BLOCKED', `client threw: ${err?.name || 'Error'}: ${excerpt(err?.message)}`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────
console.log('probe-real-upload-integration — real network attempts, one each, no retries');
console.log(`env file: ${ENV_FILE} (${fs.existsSync(ENV_FILE) ? 'found' : 'MISSING'})`);
for (const k of KEY_NAMES) {
  console.log(`  ${k}: ${env[k] && String(env[k]).trim() ? 'set' : 'UNSET'}`);
}
if (MISSING.length > 0) {
  console.log(`note: missing credentials: ${MISSING.join(', ')} — affected probes report BLOCKED`);
}
console.log(`VITE_SUPABASE_URL host: ${env.VITE_SUPABASE_URL ? hostOf(env.VITE_SUPABASE_URL) : 'n/a'}`);
console.log(`VITE_MUAPI_URL: ${env.VITE_MUAPI_URL || 'n/a'} (MuAPI upload endpoint is fixed: https://api.muapi.ai/api/v1/upload_file)`);
console.log('');

await probeSupabaseStorage();
await probeMuapiUpload();
await probeDurableMediaInsert();

const width = Math.max(...results.map((r) => r.integration.length), 'integration'.length);
console.log('RESULT TABLE');
console.log(`${'integration'.padEnd(width)} | result   | evidence`);
console.log(`${'-'.repeat(width)} | -------- | --------`);
for (const r of results) {
  console.log(`${r.integration.padEnd(width)} | ${r.result.padEnd(8)} | ${r.evidence}`);
}
const verified = results.filter((r) => r.result === 'VERIFIED').length;
console.log(`\n${verified}/${results.length} integrations VERIFIED, ${results.length - verified} BLOCKED`);
