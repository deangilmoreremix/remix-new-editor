// netlify/functions/cinegen.js
// Timeline Studio AI orchestration endpoint.
// Dispatches Timeline AI tool requests to real provider adapters when
// configured, otherwise falls back to local stub responses so the editor
// remains usable without provider keys.

import {
  providerFillGap,
  providerExtend,
  providerMusicGeneration,
  providerMaskTool,
  providerSAM3Segment,
  providerAudioSync,
  providerProxyPlayback,
  providerLayerDecompose,
} from './cinegenProviders.js';
import { userMuapiKey, NEED_MUAPI_KEY } from './_shared/byok.js';
import { withClerkAuth } from './_shared/clerkAuth.js';

const ALLOWED_TOOLS = new Set([
  'gap_fill',
  'fill_gap',
  'extend',
  'extend_clip',
  'music_generation',
  'mask_tool',
  'sam3_segment',
  'audio_sync',
  'layer_decompose',
  'proxy_playback',
]);

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-MuAPI-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function localFallback(tool, params) {
  // When no provider is configured, return a structured failure instead of
  // fake success so the UI can explain the missing provider to the user.
  return {
    success: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    message: 'This operation requires a configured provider.',
    tool
  };
}

// Tools that call MuAPI: these need the user's own key (no platform-key fallback).
const MUAPI_TOOLS = new Set(['fill_gap', 'gap_fill', 'extend', 'extend_clip', 'music_generation', 'layer_decompose']);

const PROVIDER_MAP = {
  fill_gap: providerFillGap,
  gap_fill: providerFillGap,
  extend: providerExtend,
  extend_clip: providerExtend,
  music_generation: providerMusicGeneration,
  mask_tool: providerMaskTool,
  sam3_segment: providerSAM3Segment,
  audio_sync: providerAudioSync,
  layer_decompose: providerLayerDecompose,
  proxy_playback: providerProxyPlayback,
};

// Signed-in users only, on their own MuAPI key (BYOK) — never the site's key.
export const handler = withClerkAuth(async (event) => {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const body = parseBody(event);
  const tool = body.tool || body.params?.tool;
  // The caller's own MuAPI key (BYOK, X-MuAPI-Key); never read from the body. No platform-key fallback.
  const { userKey: _ignored, ...rawParams } = body.params || body;
  const params = { ...rawParams, userKey: userMuapiKey(event.headers) || undefined };

  if (!tool || !ALLOWED_TOOLS.has(tool)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported tool', allowedTools: Array.from(ALLOWED_TOOLS) }) };
  }

  if (MUAPI_TOOLS.has(tool) && !params.userKey) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, code: 'need_key', error: NEED_MUAPI_KEY }) };
  }

  try {
    const provider = PROVIDER_MAP[tool];
    if (provider) {
      try {
        const result = await provider(params);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      } catch (providerError) {
        console.error(`[cinegen] provider error for ${tool}:`, providerError);
        // Fall through to local fallback on provider failure.
      }
    }

    const result = localFallback(tool, params);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error('[cinegen] handler error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Timeline AI service error' }) };
  }
});
