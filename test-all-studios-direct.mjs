#!/usr/bin/env node
/**
 * Direct upstream smoke-test for all muapi endpoints.
 * Bypasses the Supabase proxy and calls api.muapi.ai directly.
 *
 * Usage: MUAPI_KEY=... node test-all-studios-direct.mjs
 */

const MUAPI_KEY = process.env.MUAPI_KEY ||
  '6d7f657494f7c0f5bd35abf6d7214be9b6fa7b1430301e9428a1c393528db0f4';

const UPSTREAM = 'https://api.muapi.ai/api/v1';

// Studio → canonical endpoint + minimal payload
// Using correct payload formats based on upstream API schema
const STUDIO_ENDPOINTS = [
  // ── ImageStudio ──────────────────────────────────────────────────────────
  { studio: 'ImageStudio',   endpoint: 'flux-dev-image',        payload: { prompt: 'a red apple', model: 'flux-dev', width: 256, height: 256, num_outputs: 1 } },
  { studio: 'ImageStudio',   endpoint: 'flux-schnell-image',     payload: { prompt: 'a cat', model: 'flux-schnell', width: 256, height: 256, num_outputs: 1 } },
  { studio: 'ImageStudio',   endpoint: 'nano-banana',            payload: { prompt: 'sunset', model: 'nano-banana', width: 256, height: 256, num_outputs: 1 } },
  { studio: 'ImageStudio',   endpoint: 'seedream-5.0',           payload: { prompt: 'mountain', model: 'seedream-5.0', width: 256, height: 256, num_outputs: 1 } },
  // ── VideoStudio ──────────────────────────────────────────────────────────
  { studio: 'VideoStudio',   endpoint: 'wan2.5-image-to-video',  payload: { prompt: 'a wave', model: 'wan2.5-image-to-video', image_url: 'https://placehold.co/512x512/png', duration: 5 } },
  { studio: 'VideoStudio',   endpoint: 'wan2.1-image-to-video',  payload: { prompt: 'a wave', model: 'wan2.1-image-to-video', image_url: 'https://placehold.co/512x512/png', duration: 5 } },
  { studio: 'VideoStudio',   endpoint: 'minimax-hailuo-2.3-standard-i2v', payload: { prompt: 'a wave', model: 'minimax-hailuo-2.3-standard-i2v', image_url: 'https://placehold.co/512x512/png' } },
  { studio: 'VideoStudio',   endpoint: 'kling-v2.1-standard-i2v', payload: { prompt: 'a wave', model: 'kling-v2.1-standard-i2v', image_url: 'https://placehold.co/512x512/png' } },
  // ── AudioStudio ──────────────────────────────────────────────────────────
  { studio: 'AudioStudio',   endpoint: 'suno-create-music',      payload: { prompt: 'ambient piano', model: 'V5', style: 'ambient' } },
  { studio: 'AudioStudio',   endpoint: 'minimax-speech-2.6-hd',  payload: { prompt: 'hello world', model: 'minimax-speech-2.6-hd', voice_id: 'male-qn-qingse' } },
  // ── AvatarStudio ─────────────────────────────────────────────────────────
  { studio: 'AvatarStudio',  endpoint: 'kling-v2-avatar-standard', payload: { prompt: 'wave', model: 'kling-v2-avatar-standard', image_url: 'https://placehold.co/512x512/png', audio_url: 'https://placehold.co/512x512/png' } },
  { studio: 'AvatarStudio',  endpoint: 'kling-v2-avatar-pro',    payload: { prompt: 'wave', model: 'kling-v2-avatar-pro', image_url: 'https://placehold.co/512x512/png', audio_url: 'https://placehold.co/512x512/png' } },
  // ── CinemaStudio ─────────────────────────────────────────────────────────
  { studio: 'CinemaStudio',  endpoint: 'wan2.5-image-to-video',  payload: { prompt: 'cinematic sunset', model: 'wan2.5-image-to-video', image_url: 'https://placehold.co/512x512/png', duration: 5 } },
  // ── EditStudio ───────────────────────────────────────────────────────────
  { studio: 'EditStudio',    endpoint: 'flux-kontext-dev-i2i',   payload: { prompt: 'make it blue', model: 'flux-kontext-dev-i2i', image_url: 'https://placehold.co/512x512/png' } },
  { studio: 'EditStudio',    endpoint: 'gpt4o-image-to-image',   payload: { prompt: 'make it blue', model: 'gpt4o-image-to-image', images_list: ['https://placehold.co/512x512/png'] } },
  // ── EffectsStudio ────────────────────────────────────────────────────────
  { studio: 'EffectsStudio', endpoint: 'generate_wan_ai_effects', payload: { name: 'Cyberpunk 2077', prompt: 'cyberpunk', model: 'generate_wan_ai_effects', image_url: 'https://placehold.co/512x512/png' } },
  // ── UpscaleStudio ────────────────────────────────────────────────────────
  { studio: 'UpscaleStudio', endpoint: 'ai-image-upscale',       payload: { prompt: 'upscale', model: 'ai-image-upscale', image_url: 'https://placehold.co/512x512/png' } },
  { studio: 'UpscaleStudio', endpoint: 'topaz-image-upscale',    payload: { prompt: 'upscale', model: 'topaz-image-upscale', image_url: 'https://placehold.co/512x512/png' } },
  // ── CommercialStudio ─────────────────────────────────────────────────────
  { studio: 'CommercialStudio', endpoint: 'ai-product-shot',   payload: { prompt: 'product photo', model: 'ai-product-shot', width: 512, height: 512, image_url: 'https://placehold.co/512x512/png', scene_description: 'white background' } },
  // ── InfluencerStudio ─────────────────────────────────────────────────────
  { studio: 'InfluencerStudio', endpoint: 'ideogram-v3-reframe', payload: { prompt: 'influencer style', model: 'ideogram-v3-reframe', image_url: 'https://placehold.co/512x512/png' } },
  // ── LipSyncStudio ────────────────────────────────────────────────────────
  { studio: 'LipSyncStudio', endpoint: 'latentsync-video',      payload: { prompt: 'lip sync', model: 'latentsync-video', video_url: 'https://placehold.co/512x512/png', audio_url: 'https://placehold.co/512x512/png' } },
  { studio: 'LipSyncStudio', endpoint: 'ltx-2-19b-lipsync',    payload: { prompt: 'lip sync', model: 'ltx-2-19b-lipsync', video_url: 'https://placehold.co/512x512/png', audio_url: 'https://placehold.co/512x512/png' } },
  // ── CharacterStudio ──────────────────────────────────────────────────────
  { studio: 'CharacterStudio', endpoint: 'flux-dev-image',     payload: { prompt: 'character design', model: 'flux-dev', width: 512, height: 512, num_outputs: 1 } },
  // ── StoryboardStudio ─────────────────────────────────────────────────────
  { studio: 'StoryboardStudio', endpoint: 'flux-dev-image',    payload: { prompt: 'storyboard frame', model: 'flux-dev', width: 1280, height: 720, num_outputs: 1 } },
  // ── TrainingStudio ───────────────────────────────────────────────────────
  { studio: 'TrainingStudio', endpoint: 'flux-lora-trainer',   payload: { prompt: 'train', model: 'flux-lora-trainer', images_data_url: 'https://placehold.co/512x512/png' } },
  // ── VideoToolsStudio ─────────────────────────────────────────────────────
  { studio: 'VideoToolsStudio', endpoint: 'video-watermark-remover', payload: { prompt: 'remove watermark', model: 'video-watermark-remover', video_url: 'https://placehold.co/512x512/png' } },
  // ── ChatStudio ───────────────────────────────────────────────────────────
  { studio: 'ChatStudio',    endpoint: 'gpt-5-mini',           payload: { prompt: 'Say hello', model: 'gpt-5-mini' } },
];

async function smokeTest() {
  console.log(`Upstream: ${UPSTREAM}`);
  console.log(`Key:     ${MUAPI_KEY.slice(0, 8)}...`);
  console.log(`Total:   ${STUDIO_ENDPOINTS.length} endpoint checks across 18 studios\n`);
  console.log('─'.repeat(90));
  console.log(`${'Studio'.padEnd(22)} ${'Endpoint'.padEnd(38)} ${'Status'.padEnd(8)} ${'Latency'.padEnd(10)} Notes`);
  console.log('─'.repeat(90));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const { studio, endpoint, payload } of STUDIO_ENDPOINTS) {
    const start = Date.now();
    let status, latency, body, note = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(`${UPSTREAM}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': MUAPI_KEY,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      latency = `${Date.now() - start}ms`;
      body = await res.text();
      status = res.status;

      if (status === 200 || status === 202) {
        passed++;
        note = 'OK';
      } else if (status === 401) {
        failed++;
        note = 'AUTH_FAIL';
        failures.push({ studio, endpoint, status, body: body.slice(0, 120) });
      } else if (status === 403) {
        failed++;
        note = 'FORBIDDEN';
        failures.push({ studio, endpoint, status, body: body.slice(0, 120) });
      } else if (status === 404) {
        failed++;
        note = 'NOT_FOUND';
        failures.push({ studio, endpoint, status, body: body.slice(0, 120) });
      } else if (status === 422) {
        failed++;
        note = 'BAD_PARAMS';
        failures.push({ studio, endpoint, status, body: body.slice(0, 120) });
      } else if (status === 429) {
        failed++;
        note = 'RATE_LIMITED';
        failures.push({ studio, endpoint, status, body: body.slice(0, 120) });
      } else {
        failed++;
        note = `ERR_${status}`;
        failures.push({ studio, endpoint, status, body: body.slice(0, 120) });
      }
    } catch (err) {
      latency = `${Date.now() - start}ms`;
      status = 'NET_ERR';
      failed++;
      note = err.message.slice(0, 20);
      failures.push({ studio, endpoint, status, body: err.message });
    }

    console.log(
      `${studio.padEnd(22)} ${endpoint.padEnd(38)} ${String(status).padEnd(8)} ${latency.padEnd(10)} ${note}`
    );

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('─'.repeat(90));
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${STUDIO_ENDPOINTS.length} checks\n`);

  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) {
      console.log(`  [${f.studio}] ${f.endpoint} → ${f.status}: ${f.body}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

smokeTest().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
