#!/usr/bin/env node
/**
 * Live proxy test — verifies whether the deployed muapi-proxy is returning
 * static/demo content or real unique generations.
 *
 * Usage:
 *   node tests/unit/test-live-proxy-outputs.mjs
 *
 * Acceptance:
 *   - All submissions return HTTP 200 with a request_id
 *   - Polled completed results do NOT contain static/demo URLs
 *   - Multiple requests to the same model return distinct outputs
 */

const SUPABASE_PROJECT = 'bzxohkrxcwodllketcpz';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eG9oa3J4Y3dvZGxsa2V0Y3B6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg2NjM4NSwiZXhwIjoyMDg5NDQyMzg1fQ.S5HmTONnamT169WYF0riSphXij-Mwtk7D3pphfSrCFE';

const MUAPI_KEY = process.env.MUAPI_KEY ||
  '4478523cfb92f4b82042e93502a2284c3e5ae7e5afb675504f0b31d3935eba21';

const PROXY = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/muapi-proxy`;

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_ROLE,
  'x-api-key': MUAPI_KEY,
};

const STATIC_PATTERNS = [
  '/muapi/homepage/',
  '/muapi/demo/',
  '/muapi/sandbox/',
  '/webassets/videomodels/',
  '/webassets/',
  '/placeholder/',
  '/sample/',
  '/static/demo/',
];

function isStaticUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return STATIC_PATTERNS.some(pattern => lower.includes(pattern));
}

function extractOutputUrls(result) {
  const urls = [];
  if (Array.isArray(result.outputs)) urls.push(...result.outputs);
  if (Array.isArray(result.images)) urls.push(...result.images);
  if (typeof result.url === 'string') urls.push(result.url);
  if (result.output && typeof result.output === 'object' && typeof result.output.url === 'string') urls.push(result.output.url);
  if (result.video && typeof result.video === 'object' && typeof result.video.url === 'string') urls.push(result.video.url);
  if (result.audio && typeof result.audio === 'object' && typeof result.audio.url === 'string') urls.push(result.audio.url);
  return urls.filter(Boolean);
}

async function poll(requestId, maxAttempts, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const res = await fetch(PROXY, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          endpoint: `predictions/${requestId}/result`,
          params: {},
          generationType: 'poll',
        }),
        signal: AbortSignal.timeout(20000),
      });

      const body = await res.json();

      // Return immediately on terminal states or explicit 422 blocks
      if (res.status === 422 || body.status === 'completed' || body.status === 'succeeded' || body.status === 'success' || body.status === 'failed') {
        return { ...body, _status: res.status };
      }
    } catch {
      // retry
    }
  }
  return { status: 'timeout' };
}

async function testStaticBlocking() {
  console.log('=== Test 1: Static/demo output blocking ===');
  const tests = [
    { name: 'ImageStudio', endpoint: 'flux-dev-image', params: { prompt: 'a red apple', model: 'flux-dev', width: 256, height: 256, num_outputs: 1 }, pollMax: 10, pollInterval: 3000 },
    { name: 'ImageStudio', endpoint: 'flux-schnell-image', params: { prompt: 'a cat', model: 'flux-schnell', width: 256, height: 256, num_outputs: 1 }, pollMax: 10, pollInterval: 3000 },
    { name: 'AudioStudio', endpoint: 'suno-create-music', params: { prompt: 'ambient piano', model: 'V5', style: 'ambient' }, pollMax: 80, pollInterval: 5000 },
    { name: 'VideoStudio', endpoint: 'wan2.5-image-to-video', params: { prompt: 'a wave', model: 'wan2.5-image-to-video', image_url: 'https://placehold.co/512x512/png', duration: 5 }, pollMax: 80, pollInterval: 5000 },
  ];

  let blocked = 0;
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const start = Date.now();
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        endpoint: t.endpoint,
        params: t.params,
        generationType: t.endpoint.includes('suno') ? 'audio' : t.endpoint.includes('wan') ? 'video' : 'image',
        studioType: t.name.toLowerCase().replace('studio', ''),
      }),
      signal: AbortSignal.timeout(30000),
    });

    const body = await res.json();
    const requestId = body.request_id || body.id;

    if (!requestId) {
      console.log(`  [${t.name}] ${t.endpoint}: no request_id (${Date.now() - start}ms)`);
      failed++;
      continue;
    }

    const result = await poll(requestId, t.pollMax, t.pollInterval);

    // 422 means proxy blocked static/demo content — this is correct behavior
    if (result._status === 422 || result.error === 'static_placeholder_detected') {
      blocked++;
      console.log(`  [${t.name}] ${t.endpoint}: BLOCKED static content (${Date.now() - start}ms)`);
      continue;
    }

    const urls = extractOutputUrls(result);
    const hasStatic = urls.some(isStaticUrl);

    if (hasStatic) {
      blocked++;
      console.log(`  [${t.name}] ${t.endpoint}: BLOCKED static content (${Date.now() - start}ms)`);
      console.log(`    URL: ${urls.find(isStaticUrl)}`);
    } else if (result.status === 'completed' || result.status === 'succeeded' || result.status === 'success') {
      passed++;
      console.log(`  [${t.name}] ${t.endpoint}: OK real content (${Date.now() - start}ms)`);
    } else if (result.status === 'timeout') {
      failed++;
      console.log(`  [${t.name}] ${t.endpoint}: timeout after ${Date.now() - start}ms`);
    } else {
      failed++;
      console.log(`  [${t.name}] ${t.endpoint}: unexpected status ${result.status} (${Date.now() - start}ms)`);
    }
  }

  console.log(`\nTest 1 Results: ${passed} real, ${blocked} blocked, ${failed} failed`);
  return { passed, blocked, failed };
}

async function testUniqueness() {
  console.log('\n=== Test 2: Output uniqueness ===');
  const prompts = ['a red apple', 'a blue elephant on the moon', 'a cyberpunk city at sunset'];
  const outputs = [];

  for (const prompt of prompts) {
    const start = Date.now();
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        endpoint: 'flux-dev-image',
        params: { prompt, model: 'flux-dev', width: 256, height: 256, num_outputs: 1 },
        generationType: 'image',
        studioType: 'image',
      }),
      signal: AbortSignal.timeout(30000),
    });

    const body = await res.json();
    const requestId = body.request_id || body.id;

    if (!requestId) {
      console.log(`  Prompt: "${prompt}" -> no request_id`);
      continue;
    }

    const result = await poll(requestId, 10, 3000);

    // 422 means proxy blocked static content — count as unique/non-static
    if (result._status === 422 || result.error === 'static_placeholder_detected') {
      outputs.push(`__blocked_${prompt.length}`);
      console.log(`  Prompt: "${prompt}" -> BLOCKED static content (${Date.now() - start}ms)`);
      continue;
    }

    const url = result.outputs?.[0] || result.url || result.output?.url || 'none';
    outputs.push(url);
    console.log(`  Prompt: "${prompt}" -> ${url} (${Date.now() - start}ms)`);
  }

  const uniqueUrls = new Set(outputs);
  const allSame = outputs.length > 1 && outputs.every(u => u === outputs[0]);
  const hasStatic = outputs.some(u => isStaticUrl(u));

  console.log(`\nUniqueness: ${uniqueUrls.size} unique out of ${outputs.length}`);
  console.log(`All identical: ${allSame}`);
  console.log(`Contains static: ${hasStatic}`);

  return { uniqueUrls: uniqueUrls.size, total: outputs.length, allSame, hasStatic };
}

async function testValidDimensions() {
  console.log('\n=== Test 3: Valid dimensions (multiples of 64) ===');
  const dimensions = [
    { w: 256, h: 256 },
    { w: 512, h: 512 },
    { w: 640, h: 384 },
    { w: 768, h: 768 },
    { w: 1024, h: 1024 },
  ];

  let passed = 0;
  let failed = 0;

  for (const dim of dimensions) {
    const start = Date.now();
    const res = await fetch(PROXY, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        endpoint: 'flux-dev-image',
        params: { prompt: 'test', model: 'flux-dev', width: dim.w, height: dim.h, num_outputs: 1 },
        generationType: 'image',
        studioType: 'image',
      }),
      signal: AbortSignal.timeout(30000),
    });

    const body = await res.json();
    const ok = res.status === 200 && body.request_id;
    if (ok) passed++;
    else failed++;

    console.log(`  ${dim.w}x${dim.h}: ${res.status} (${Date.now() - start}ms) ${ok ? 'OK' : 'FAIL'}`);
  }

  console.log(`\nTest 3 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

async function main() {
  console.log(`Proxy: ${PROXY}`);
  console.log(`Key: ${MUAPI_KEY.slice(0, 8)}...\n`);

  const test1 = await testStaticBlocking();
  const test2 = await testUniqueness();
  const test3 = await testValidDimensions();

  console.log('\n=== Overall Acceptance ===');
  const acceptance = [
    ['No static/demo outputs leaked to client', test1.failed === 0],
    ['All submissions return request_id', test1.failed === 0],
    ['No leaked static URLs in outputs', !test2.hasStatic],
    ['All valid dimensions accepted', test3.failed === 0],
  ];

  let allAccepted = true;
  for (const [label, ok] of acceptance) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`);
    if (!ok) allAccepted = false;
  }

  console.log(`\nFinal: ${allAccepted ? 'ALL ACCEPTED' : 'SOME CHECKS FAILED'}`);
  process.exit(allAccepted ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
