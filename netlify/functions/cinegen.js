// netlify/functions/cinegen.js
// Timeline Studio AI orchestration endpoint.
// Replaces the missing /.netlify/functions/cinegen route with a typed
// dispatcher that can delegate to provider adapters or local fallbacks.

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
  // Local fallbacks keep the editor usable when no provider is configured.
  // These do NOT call external AI providers.
  switch (tool) {
    case 'fill_gap':
    case 'gap_fill': {
      return {
        success: true,
        tool: 'fill_gap',
        message: 'Local fallback: gap identified. Configure a provider for real generation.',
        clip: {
          id: 'local-gap-' + Date.now(),
          name: 'Gap Fill (local)',
          type: 'video',
          start: params.beforeEnd || 0,
          end: (params.afterStart || 10),
          src: null,
        },
      };
    }
    case 'extend':
    case 'extend_clip': {
      const added = params.addedDuration || 5;
      return {
        success: true,
        tool: 'extend',
        message: 'Local fallback: extension planned.',
        addedDuration: added,
        clip: {
          id: 'local-extend-' + Date.now(),
          name: 'Extended (local)',
          type: 'video',
          start: params.start || 0,
          end: (params.end || 5) + added,
          src: null,
        },
      };
    }
    case 'music_generation': {
      return {
        success: true,
        tool: 'music_generation',
        message: 'Local fallback: music generation queued.',
        genre: params.genre || 'ambient',
        mood: params.mood || 'calm',
        tempo: params.tempo || 120,
        instrumental: params.instrumental !== false,
        duration: params.duration || 30,
        src: null,
      };
    }
    case 'mask_tool': {
      return {
        success: true,
        tool: 'mask_tool',
        message: 'Local fallback: mask metadata returned.',
        mask: params.mask || { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 },
      };
    }
    case 'element_create': {
      return {
        success: true,
        tool: 'element_create',
        message: 'Local fallback: element created.',
        element: params.element || { name: 'Element', text: 'Element' },
      };
    }
    case 'sam3_segment':
    case 'audio_sync':
    case 'layer_decompose':
    case 'shot_board':
    case 'proxy_playback':
    case 'composition_plan':
      return {
        success: true,
        tool,
        message: `Local fallback: ${tool} acknowledged. Configure a provider for real results.`,
      };
    default:
      return { success: false, error: 'Unknown tool: ' + tool };
  }
}

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
    // In production, route to provider adapters here.
    // For now, return a typed local fallback so Timeline Studio behavior
    // remains stable while the backend is completed incrementally.
    const result = localFallback(tool, params);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error('[cinegen] handler error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Timeline AI service error' }) };
  }
}
