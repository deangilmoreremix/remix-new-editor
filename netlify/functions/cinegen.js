// netlify/functions/cinegen.js
// Timeline Studio AI orchestration endpoint.
// Dispatches Timeline AI tool requests to real provider adapters when
// configured, otherwise falls back to local stub responses so the editor
// remains usable without provider keys.

import {
  providerFillGap,
  providerExtend,
  providerMusicGeneration,
  providerElementCreate,
  providerShotBoard,
  providerCompositionPlan,
  providerLLMChat,
  providerMaskTool,
  providerSAM3Segment,
  providerAudioSync,
  providerProxyPlayback,
  providerLayerDecompose,
} from './cinegenProviders.js';

const ALLOWED_TOOLS = new Set([
  'gap_fill',
  'fill_gap',
  'extend',
  'extend_clip',
  'music_generation',
  'mask_tool',
  'element_create',
  'llm_chat',
  'sam3_segment',
  'audio_sync',
  'layer_decompose',
  'shot_board',
  'proxy_playback',
  'composition_plan'
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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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

const PROVIDER_MAP = {
  fill_gap: providerFillGap,
  gap_fill: providerFillGap,
  extend: providerExtend,
  extend_clip: providerExtend,
  music_generation: providerMusicGeneration,
  mask_tool: providerMaskTool,
  element_create: providerElementCreate,
  llm_chat: providerLLMChat,
  sam3_segment: providerSAM3Segment,
  audio_sync: providerAudioSync,
  layer_decompose: providerLayerDecompose,
  shot_board: providerShotBoard,
  proxy_playback: providerProxyPlayback,
  composition_plan: providerCompositionPlan,
};

export async function handler(event) {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const body = parseBody(event);
  const tool = body.tool || body.params?.tool;
  const params = body.params || body;

  if (!tool || !ALLOWED_TOOLS.has(tool)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported tool', allowedTools: Array.from(ALLOWED_TOOLS) }) };
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
}
