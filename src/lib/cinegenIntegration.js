/**
 * Timeline AI Integration Layer
 *
 * Provides typed access to Timeline AI tools through the Netlify function
 * endpoint. Replaces the previous CineGen-branded integration with a
 * production-ready client that preserves existing editor behavior.
 */

export const TIMELINE_AI_TOOLS = {
  FILL_GAP: 'fill_gap',
  EXTEND: 'extend',
  MUSIC_GENERATION: 'music_generation',
  MASK_TOOL: 'mask_tool',
  ELEMENT_CREATE: 'element_create',
  LLM_CHAT: 'llm_chat',
  SAM3_SEGMENT: 'sam3_segment',
  AUDIO_SYNC: 'audio_sync',
  LAYER_DECOMPOSE: 'layer_decompose',
  SHOT_BOARD: 'shot_board',
  PROXY_PLAYBACK: 'proxy_playback',
  COMPOSITION_PLAN: 'composition_plan'
};

const ENDPOINT = '/.netlify/functions/cinegen';

export async function runTimelineAITool(tool, params = {}) {
  if (!tool || typeof tool !== 'string') {
    return { success: false, error: 'Tool name is required' };
  }

  const payload = {
    tool,
    params: {
      ...params,
      tool
    }
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text().catch(() => '');
    let data = {};
    try { data = JSON.parse(text); } catch { /* keep raw text for error reporting */ }

    if (!res.ok) {
      const error = new Error(`Timeline AI error ${res.status}: ${data.error || text || 'Request failed'}`);
      return { success: false, error: error.message, status: res.status };
    }

    return { success: true, ...data };
  } catch (error) {
    console.error(`[TimelineAI] Error in ${tool}:`, error);
    return { success: false, error: error.message || 'Tool execution failed' };
  }
}

export function getTimelineAITools() {
  return Object.values(TIMELINE_AI_TOOLS);
}

export function getTimelineAIFeatureSummary() {
  return {
    version: '1.0.0',
    availableTools: Object.values(TIMELINE_AI_TOOLS),
    description: 'SmartVideo Timeline Studio AI tools',
    tools: {
      fill_gap: 'AI-powered gap filling between clips',
      extend: 'Extend clips forward or backward with AI',
      music_generation: 'Generate background music from scene context',
      mask_tool: 'AI object masking and removal',
      element_create: 'Create reusable elements from clips',
      llm_chat: 'Context-aware AI assistant',
      sam3_segment: 'SAM3 object segmentation',
      audio_sync: 'Auto-sync audio to video',
      layer_decompose: 'Separate foreground/background layers',
      shot_board: 'Generate story shot board',
      proxy_playback: 'Toggle proxy/low-res playback',
      composition_plan: 'Create AI composition plan'
    }
  };
}

// Backwards compatibility aliases used by existing TimelineEditorPage.jsx code.
export { runTimelineAITool as runCineGenTool };
export { TIMELINE_AI_TOOLS as CINEGEN_TOOLS };
