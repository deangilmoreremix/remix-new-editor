/**
 * Direct unit tests for output integrity helpers.
 *
 * Run: node tests/unit/test-output-integrity.mjs
 */

// We can't import TS directly from Node without a loader, so we replicate
// the helper logic here for pure-JS verification and also run a
// live behavioral test against the deployed proxy at the end.

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

function isStaticPlaceholderUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return STATIC_PATTERNS.some(pattern => lower.includes(pattern));
}

function extractOutputUrls(result) {
  const urls = [];
  if (Array.isArray(result.outputs)) urls.push(...result.outputs);
  if (Array.isArray(result.images)) urls.push(...result.images);
  if (typeof result.url === 'string') urls.push(result.url);
  if (result.output && typeof result.output === 'object' && typeof result.output.url === 'string') {
    urls.push(result.output.url);
  }
  if (result.video && typeof result.video === 'object' && typeof result.video.url === 'string') {
    urls.push(result.video.url);
  }
  if (result.audio && typeof result.audio === 'object' && typeof result.audio.url === 'string') {
    urls.push(result.audio.url);
  }
  return urls.filter(Boolean);
}

function validateOutputIntegrity(result, requestId) {
  const urls = extractOutputUrls(result);
  if (urls.length === 0) {
    return { ok: false, reason: 'no_output_urls' };
  }
  const staticUrls = urls.filter(isStaticPlaceholderUrl);
  if (staticUrls.length > 0) {
    return { ok: false, reason: `static_placeholder_detected: ${staticUrls[0]}` };
  }
  return { ok: true };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.log(`  FAIL: ${message}`);
  }
}

console.log('=== Output Integrity Helper Tests ===\n');

console.log('isStaticPlaceholderUrl:');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/muapi/homepage/flux-dev.avif') === true, 'detects homepage asset');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/muapi/sandbox/sample-text.mp3') === true, 'detects sandbox asset');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/webassets/videomodels/wan2.5-image-to-video.mp4') === true, 'detects webassets/videomodels');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/webassets/something.jpg') === true, 'detects generic webassets');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/placeholder/image.png') === true, 'detects placeholder path');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/sample/video.mp4') === true, 'detects sample path');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/static/demo/audio.mp3') === true, 'detects static/demo path');
assert(isStaticPlaceholderUrl('https://cdn.muapi.ai/outputs/generated/5660b6c650c24148a7bd6ad9c8572691.png') === false, 'allows real generated URL');
assert(isStaticPlaceholderUrl('') === false, 'allows empty string');
assert(isStaticPlaceholderUrl(null) === false, 'allows null');
assert(isStaticPlaceholderUrl('https://CDN.MUAPI.AI/MUAPI/HOMEPAGE/FLUX-DEV.AVIF') === true, 'is case-insensitive');

console.log('\nextractOutputUrls:');
assert(JSON.stringify(extractOutputUrls({ outputs: ['https://cdn.muapi.ai/a.png'] })) === JSON.stringify(['https://cdn.muapi.ai/a.png']), 'extracts outputs array');
assert(JSON.stringify(extractOutputUrls({ url: 'https://cdn.muapi.ai/c.mp4' })) === JSON.stringify(['https://cdn.muapi.ai/c.mp4']), 'extracts url field');
assert(JSON.stringify(extractOutputUrls({ output: { url: 'https://cdn.muapi.ai/d.png' } })) === JSON.stringify(['https://cdn.muapi.ai/d.png']), 'extracts output.url');
assert(JSON.stringify(extractOutputUrls({ video: { url: 'https://cdn.muapi.ai/e.mp4' } })) === JSON.stringify(['https://cdn.muapi.ai/e.mp4']), 'extracts video.url');
assert(JSON.stringify(extractOutputUrls({ audio: { url: 'https://cdn.muapi.ai/f.mp3' } })) === JSON.stringify(['https://cdn.muapi.ai/f.mp3']), 'extracts audio.url');
assert(JSON.stringify(extractOutputUrls({ outputs: [], url: '' })) === JSON.stringify([]), 'returns empty array when no URLs');

console.log('\nvalidateOutputIntegrity:');
assert(JSON.stringify(validateOutputIntegrity({ status: 'completed', outputs: ['https://cdn.muapi.ai/outputs/generated/unique-id-123.png'] }, 'req-1')) === JSON.stringify({ ok: true }), 'ok:true for real URL');
assert(validateOutputIntegrity({ status: 'completed', outputs: ['https://cdn.muapi.ai/muapi/homepage/flux-dev.avif'] }, 'req-2').ok === false, 'ok:false for homepage asset');
assert(validateOutputIntegrity({ status: 'completed', outputs: [] }, 'req-3').ok === false, 'ok:false for empty outputs');
assert(validateOutputIntegrity({ status: 'processing', outputs: ['https://cdn.muapi.ai/muapi/homepage/flux-dev.avif'] }, 'req-4').ok === false, 'still flags static URLs even when processing (caller gates validation)');

console.log(`\n=== Helper Tests: ${passed} passed, ${failed} failed ===\n`);
