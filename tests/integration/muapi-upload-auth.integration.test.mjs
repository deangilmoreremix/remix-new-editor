#!/usr/bin/env node
/**
 * MuAPI upload auth integration checks (REAL, env-gated).
 *
 * Exercises the workspace-isolation RLS policies from
 * supabase/migrations/20261013000000_muapi_upload_workspace_isolation.sql
 * against a live Supabase instance via PostgREST, using the same anon-key
 * client + `x-user-key` request-header idiom the app uses.
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 * Optional env:
 *   (a second Clerk-issued user token is NOT required — the RLS contract is
 *   the x-user-key header identity, which is what the policies enforce.)
 *
 * Behavior:
 *   - Env absent  -> prints a loud SKIP notice and exits 0 (never fakes a pass).
 *   - Env present -> runs real checks, prints evidence per check, exits
 *     non-zero on any real failure.
 */

import crypto from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

function skip(notice) {
  console.log(`\n================ SKIP: MuAPI upload auth integration ================`);
  console.log(notice);
  console.log('Set SUPABASE_URL and SUPABASE_ANON_KEY to run these checks.');
  console.log('========================================================================\n');
  process.exit(0);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  skip('SUPABASE_URL / SUPABASE_ANON_KEY are not set in this environment.');
}

// A decoy MuAPI key. It must never appear in any response body or header —
// the app resolves BYOK keys client-side and never sends them upstream.
const SENTINEL_MUAPI_KEY = `muapi-sentinel-${crypto.randomBytes(12).toString('hex')}`;

const USER_A = `itest-user-a-${crypto.randomBytes(6).toString('hex')}`;
const USER_B = `itest-user-b-${crypto.randomBytes(6).toString('hex')}`;
const WORKSPACE = 'personal';
const ASSET_ID = `asset-${crypto.randomBytes(6).toString('hex')}`;

const responses = []; // every response captured for the sentinel scan (check d)

let failures = 0;

function recordResponse(res, bodyText) {
  const headerSnapshot = {};
  res.headers.forEach((value, key) => { headerSnapshot[key] = value; });
  responses.push({ status: res.status, headers: headerSnapshot, body: bodyText });
}

async function rest(path, { method = 'GET', body, userKey, extraHeaders = {} } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    // The decoy key travels on EVERY request; our server never echoes it.
    'X-Muapi-Key': SENTINEL_MUAPI_KEY,
    ...extraHeaders,
  };
  if (userKey) headers['X-User-Key'] = userKey;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  recordResponse(res, text);

  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

function check(name, ok, evidence) {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}`);
  if (evidence !== undefined) console.log(`       evidence: ${evidence}`);
  if (!ok) failures += 1;
}

async function main() {
  console.log('\n================ MuAPI upload auth integration ================');
  console.log(`target: ${SUPABASE_URL}`);
  console.log(`identities: userA=${USER_A}  userB=${USER_B}  workspace=${WORKSPACE}`);
  console.log(`sentinel MuAPI key: ${SENTINEL_MUAPI_KEY} (must never appear in responses)`);

  // ---- seed column check: the migration ran? -------------------------------
  const colProbe = await rest('media?select=workspace_id&limit=1');
  check(
    '0. migration applied (media.workspace_id exists)',
    colProbe.status === 200,
    `GET media?select=workspace_id -> HTTP ${colProbe.status} ${colProbe.text.slice(0, 160)}`,
  );
  if (colProbe.status !== 200) {
    console.error('\nAborting: the workspace-isolation migration has not been applied to this database.');
    process.exit(1);
  }

  // ---- (a) user A can read their own media row -----------------------------
  const insert = await rest('media?select=*', {
    method: 'POST',
    userKey: USER_A,
    extraHeaders: { Prefer: 'return=representation' },
    body: {
      user_id: USER_A,
      workspace_id: WORKSPACE,
      project_id: `itest-project-${crypto.randomBytes(4).toString('hex')}`,
      name: 'itest-upload.png',
      type: 'image/png',
      size: 1024,
      path: `${USER_A}/itest-upload.png`,
      url: 'https://example.invalid/itest-upload.png',
    },
  });
  const insertedRow = Array.isArray(insert.json) ? insert.json[0] : insert.json;
  const insertedId = insertedRow?.id;

  const ownRead = await rest(`media?select=*&id=eq.${insertedId}`, { userKey: USER_A });
  const ownRows = Array.isArray(ownRead.json) ? ownRead.json : [];
  check(
    'a. user A can read their own media row',
    insertedId && ownRead.status === 200 && ownRows.length === 1 && ownRows[0].id === insertedId,
    `POST /media (X-User-Key=A) -> ${insert.status} id=${insertedId}; GET by id (X-User-Key=A) -> ${ownRead.status}, ${ownRows.length} row(s)`,
  );

  // ---- (a2) legacy anonymous/no-header flow still works --------------------
  const legacyRead = await rest('media?select=id&limit=1');
  check(
    'a2. legacy anonymous flow (no x-user-key header) still reads media',
    legacyRead.status === 200,
    `GET /media (no header) -> ${legacyRead.status}`,
  );

  // ---- (b) cross-user access is denied -------------------------------------
  const crossRead = await rest(`media?select=*&id=eq.${insertedId}`, { userKey: USER_B });
  const crossRows = Array.isArray(crossRead.json) ? crossRead.json : [];
  check(
    'b. cross-USER access denied (user B cannot read user A’s media row)',
    crossRead.status === 200 && crossRows.length === 0,
    `GET /media?id=eq.${insertedId} (X-User-Key=B) -> ${crossRead.status}, ${crossRows.length} row(s)`,
  );

  const crossWrite = await rest('media?select=*', {
    method: 'POST',
    userKey: USER_B,
    extraHeaders: { Prefer: 'return=representation' },
    body: {
      user_id: USER_A, // user B trying to plant a row under user A's identity
      name: 'itest-cross-write.png',
      type: 'image/png',
      size: 1,
      path: `${USER_A}/itest-cross-write.png`,
      url: 'https://example.invalid/itest-cross-write.png',
    },
  });
  check(
    'b2. cross-USER write denied (user B cannot insert rows owned by user A)',
    crossWrite.status >= 400,
    `POST /media user_id=A (X-User-Key=B) -> HTTP ${crossWrite.status} ${crossWrite.text.slice(0, 160)}`,
  );

  // ---- (c) muapi_upload_cache RLS denies cross-user reads ------------------
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const cacheInsert = await rest('muapi_upload_cache?select=*', {
    method: 'POST',
    userKey: USER_A,
    extraHeaders: { Prefer: 'return=representation' },
    body: {
      user_id: USER_A,
      workspace_id: WORKSPACE,
      asset_id: ASSET_ID,
      category: 'image',
      url: 'https://example.invalid/itest-cache.png',
      expires_at: expiresAt,
    },
  });

  const cacheOwn = await rest(
    `muapi_upload_cache?select=*&asset_id=eq.${ASSET_ID}`, { userKey: USER_A });
  const cacheOwnRows = Array.isArray(cacheOwn.json) ? cacheOwn.json : [];
  check(
    'c1. user A can read their own muapi_upload_cache row',
    cacheInsert.status >= 200 && cacheInsert.status < 300
      && cacheOwn.status === 200 && cacheOwnRows.length === 1,
    `POST /muapi_upload_cache (A) -> ${cacheInsert.status}; GET by asset_id (A) -> ${cacheOwn.status}, ${cacheOwnRows.length} row(s)`,
  );

  const cacheCross = await rest(
    `muapi_upload_cache?select=*&asset_id=eq.${ASSET_ID}`, { userKey: USER_B });
  const cacheCrossRows = Array.isArray(cacheCross.json) ? cacheCross.json : [];
  check(
    'c2. muapi_upload_cache RLS denies cross-USER reads',
    cacheCross.status === 200 && cacheCrossRows.length === 0,
    `GET /muapi_upload_cache?asset_id=eq.${ASSET_ID} (X-User-Key=B) -> ${cacheCross.status}, ${cacheCrossRows.length} row(s)`,
  );

  const cacheCrossWrite = await rest('muapi_upload_cache?select=*', {
    method: 'POST',
    userKey: USER_B,
    extraHeaders: { Prefer: 'return=representation' },
    body: {
      user_id: USER_A,
      asset_id: `${ASSET_ID}-cross`,
      category: 'image',
      url: 'https://example.invalid/itest-cache-cross.png',
      expires_at: expiresAt,
    },
  });
  check(
    'c3. muapi_upload_cache RLS denies cross-USER writes',
    cacheCrossWrite.status >= 400,
    `POST /muapi_upload_cache user_id=A (X-User-Key=B) -> HTTP ${cacheCrossWrite.status} ${cacheCrossWrite.text.slice(0, 160)}`,
  );

  // ---- (d) no response body or header contains the sentinel key ------------
  const leaks = responses.filter((r) => {
    const inBody = r.body.includes(SENTINEL_MUAPI_KEY);
    const inHeaders = Object.values(r.headers).some((v) => v.includes(SENTINEL_MUAPI_KEY));
    return inBody || inHeaders;
  });
  check(
    'd. sentinel MuAPI key never appears in any response body or header',
    leaks.length === 0,
    `${responses.length} responses scanned, ${leaks.length} leak(s)`,
  );

  // ---- cleanup (best-effort, runs under user A's identity) -----------------
  await rest(`media?user_id=eq.${USER_A}`, { method: 'DELETE', userKey: USER_A });
  await rest(`muapi_upload_cache?user_id=eq.${USER_A}`, { method: 'DELETE', userKey: USER_A });
  // Sweep anything the denied cross-user write may have planted under A... 
  // (RLS blocks those, but delete under A anyway in case policies change.)
  await rest(`media?user_id=eq.${USER_A}&name=eq.itest-cross-write.png`, { method: 'DELETE', userKey: USER_A });
  console.log('cleanup: deleted itest rows for user A (best-effort)');

  if (failures > 0) {
    console.error(`\nRESULT: ${failures} check(s) FAILED\n`);
    process.exit(1);
  }
  console.log('\nRESULT: all checks passed\n');
}

main().catch((err) => {
  console.error('\nIntegration run crashed:', err);
  process.exit(1);
});
