import { navigate } from '../lib/router.js';
import { showToast } from '../lib/loading.js';
import { mountStudioChrome } from '../lib/studioChrome.js';
import { supabase } from '../lib/supabase.js';
import { createIcons, icons } from 'lucide';

// ─────────────────────────────────────────────────────────────────────────────
//  DIRECTOR AGENTS — 45 production-ready agents wired to the real backend.
//
//  Each agent maps to a real API endpoint:
//    • VideoDB-backed agents go through `/api/videodb/proxy`
//    • Video Agent agents (VideoDB + OpenAI) go through `/videoagent/process`
//    • FFmpeg-based tools go through `/api/agents/agent/:action`
//
//  Every agent returns real, usable output — not a fake canned response.
// ─────────────────────────────────────────────────────────────────────────────

export const DIRECTOR_AGENTS = [
    { id: 'summarizer',  name: 'Video Summarizer',  icon: '📝', description: 'Summarize video content',          category: 'analysis',     tool: 'highlights' },
    { id: 'search',      name: 'Video Search',      icon: '🔍', description: 'Search and index media library',   category: 'search',       tool: 'visual-search' },
    { id: 'clipper',     name: 'Clip Creator',      icon: '✂️', description: 'Extract and create clips',         category: 'extract',      tool: 'clip-segmentation' },
    { id: 'dubbing',     name: 'Video Dubbing',     icon: '🎤', description: 'Translate and dub audio/video',    category: 'translate',    tool: 'dubbing' },
    { id: 'subtitler',   name: 'Subtitle Generator',icon: '💬', description: 'Add subtitles in any language',    category: 'accessibility',tool: 'subtitle' },
    { id: 'highlighter', name: 'Highlight Extractor',icon: '⚡', description: 'Find key moments automatically',  category: 'extract',      tool: 'highlight-detection' },
    { id: 'scenes',      name: 'Scene Detector',    icon: '🎬', description: 'Identify scene boundaries',        category: 'analysis',     tool: 'scene-detection' },
    { id: 'broll',       name: 'B-Roll Adder',      icon: '🎞️', description: 'Add overlay footage',             category: 'enhance',      tool: 'add-broll' },
    { id: 'voiceover',   name: 'Voiceover',         icon: '🎙️', description: 'Add AI voiceover',                category: 'audio',        tool: 'cosyvoice' },
    { id: 'editor',      name: 'Video Editor',      icon: '✏️', description: 'Edit and enhance video',          category: 'edit',         tool: 'text-to-movie' },
    { id: 'enhancer',    name: 'Video Enhancer',    icon: '✨', description: 'Quality enhancement',             category: 'enhance',      tool: 'upscale' },
    { id: 'compiler',    name: 'Content Compiler',  icon: '📚', description: 'Compile multiple videos',         category: 'create',       tool: 'compile-timeline' },
    { id: 'meme',        name: 'Meme Generator',    icon: '😂', description: 'Create meme videos',              category: 'create',       tool: 'meme' },
    { id: 'musicvideo',  name: 'Music Video Maker', icon: '🎵', description: 'Generate music videos',           category: 'create',       tool: 'audio-overlay' },
    { id: 'trailer',     name: 'Trailer Creator',   icon: '🎥', description: 'Make video trailers',             category: 'create',       tool: 'trailer-narration' },
    { id: 'compilation', name: 'Compilation Builder',icon:'📋', description: 'Build compilations',              category: 'create',       tool: 'compile-timeline' },
    { id: 'social',      name: 'Social Media Clip', icon: '📱', description: 'Create social media clips',        category: 'social',       tool: 'create-shorts' },
    { id: 'preview',     name: 'Preview Generator', icon: '👁️', description: 'Generate video previews',         category: 'create',       tool: 'thumbnail' },
    { id: 'montage',     name: 'Montage Builder',   icon: '🎞️', description: 'Create video montages',          category: 'create',       tool: 'compile-timeline' },
    { id: 'story',       name: 'Story Builder',     icon: '📖', description: 'Build narratives from clips',     category: 'create',       tool: 'storyboarding' },
    { id: 'color',       name: 'Color Correction',  icon: '🎨', description: 'Adjust colors and tones',         category: 'enhance',      tool: 'color-correct' },
    { id: 'stabilize',   name: 'Video Stabilize',   icon: '🪄', description: 'Stabilize shaky footage',         category: 'enhance',      tool: 'stabilize' },
    { id: 'speed',       name: 'Speed Control',     icon: '⏱️', description: 'Adjust video speed',             category: 'edit',         tool: 'speed' },
    { id: 'reverse',     name: 'Reverse Video',     icon: '🔄', description: 'Play video backwards',            category: 'edit',         tool: 'reverse' },
    { id: 'voice_cloning',name: 'Voice Cloning',     icon: '🧬', description: 'Clone a voice from audio',         category: 'audio',        tool: 'voice-cloning' },
    { id: 'comparison',  name: 'Comparison Agent',  icon: '⚖️', description: 'Compare two videos or scripts',  category: 'analysis',     tool: 'comparison' },
    { id: 'audio_overlays',name:'Gen AI Audio Overlays',icon:'🎶',description:'Add AI-generated music/SFX',     category: 'audio',        tool: 'gen-audio-overlays' },
    { id: 'keyword_search',name:'Keyword Search & Compilation',icon:'🔎',description:'Search spoken words and compile',category:'search',       tool: 'keyword-search' },
    { id: 'output_formatting',name:'Intelligent Output Formatting',icon:'📐',description:'Format video for any platform', category: 'create',       tool: 'output-formatting' },
    { id: 'auto_highlights',name:'Automated Video Highlights',icon:'🌟',description:'AI-ranked highlight reel',       category: 'extract',      tool: 'highlights' },
    { id: 'thumbnail',   name: 'Thumbnail Agent',   icon: '🖼️', description: 'Pick the best thumbnail frame',  category: 'create',       tool: 'thumbnail' },
    { id: 'subtitle_agent',name:'Subtitle Agent',    icon: '📝', description: 'Generate & embed subtitles',      category: 'accessibility',tool: 'subtitle' },
    { id: 'visual_search',name:'Visual Search',     icon: '👁️', description: 'Find by visual query',           category: 'search',       tool: 'visual-search' },
    { id: 'slack_agent', name: 'Slack Agent',       icon: '💼', description: 'Post summaries to Slack',         category: 'social',       tool: 'slack' },
    { id: 'text_to_movie',name:'Text to Movie',     icon: '🎞️', description: 'Turn a script into a movie',     category: 'create',       tool: 'text-to-movie' },
    { id: 'storyboarding',name:'Storyboarding Agent',icon: '🎬', description: 'Shot-by-shot storyboard',         category: 'create',       tool: 'storyboarding' },
    { id: 'faceless_video_creator',name:'Faceless Video Creator',icon:'👻',description:'No-face narration video',       category: 'create',       tool: 'faceless-video' },
    { id: 'ai_ad_films', name: 'AI Ad Films',       icon: '📢', description: 'Generate product ad videos',      category: 'create',       tool: 'ai-ad-films' },
    { id: 'tiktok_lyric_video',name:'TikTok Lyric Video',icon:'🎤',description:'Lyric-synced TikTok clip',     category: 'social',       tool: 'tiktok-lyric' },
    { id: 'ai_voiceovers',name:'AI Voiceovers',     icon: '🗣️', description: 'AI narration from script',       category: 'audio',        tool: 'audio-overlay' },
    { id: 'trailer_narration',name:'Trailer Narration',icon:'🎙️',description:'Dramatic trailer narration',    category: 'create',       tool: 'trailer-narration' },
    { id: 'kids_storyteller',name:'Kids Storyteller',icon: '🧒', description: 'Children storytelling video',     category: 'create',       tool: 'kids-storyteller' },
    { id: 'year_in_frames',name:'Year in Frames',   icon: '📅', description: 'Yearly recap montage',            category: 'create',       tool: 'year-in-frames' },
    { id: 'profanity_remover',name:'Profanity Remover',icon:'🔇',description:'Clean profanity from audio',    category: 'enhance',      tool: 'profanity' },
    { id: 'sales_assistant',name:'Sales Assistant', icon: '💰', description: 'Extract CRM follow-up from pitch',category: 'analysis',     tool: 'sales-assistant' },
    { id: 'dynamic_ads', name: 'Dynamic Ads Generator', icon: '🎯', description: 'Generate dynamic ad variations', category: 'create', tool: 'dynamic-ads' },
    { id: 'intro_outro', name: 'Intro/Outro Maker', icon: '🎬', description: 'Create intro and outro sequences', category: 'create', tool: 'intro-outro' },
    { id: 'brand_elements', name: 'Brand Elements', icon: '🏷️', description: 'Add brand elements and watermarks', category: 'enhance', tool: 'brand-elements' },
];

const AGENT_CATEGORIES = {
    analysis:      { name: 'Analysis',      color: 'blue' },
    search:        { name: 'Search',        color: 'cyan' },
    extract:       { name: 'Extract',       color: 'purple' },
    translate:     { name: 'Translate',     color: 'pink' },
    accessibility: { name: 'Accessibility', color: 'orange' },
    enhance:       { name: 'Enhance',       color: 'green' },
    audio:         { name: 'Audio',         color: 'red' },
    edit:          { name: 'Edit',          color: 'yellow' },
    create:        { name: 'Create',        color: 'teal' },
    social:        { name: 'Social',        color: 'indigo' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Backend wiring
// ─────────────────────────────────────────────────────────────────────────────

function getBackendBase() {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
        return window.__BACKEND_URL__.replace(/\/$/, '');
    }
    return '';
}

function getUserKeys() {
    return {
        openai:   apiKeyManager.getOpenAIKey?.()   || apiKeyManager.getKey?.('openai')   || '',
        videoDb:  apiKeyManager.getVideoDBKey?.()  || apiKeyManager.getKey?.('videoDb')  || '',
        muapi:    apiKeyManager.getMuapiKey?.()    || apiKeyManager.getKey?.('muapi')    || '',
    };
}

/**
 * Retry helper: baseDelay=500ms, maxDelay=8000ms, factor=2, jitter=true.
 * Only retries on network errors, 429, and 5xx.
 * Does NOT retry on 4xx (except 429), auth errors, or validation errors.
 */
async function withRetry(fn, { maxAttempts = 3, baseDelay = 500, maxDelay = 8000 } = {}, onProgress) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const isNetwork = !err?.response && !err?.status;
      const retryable = isNetwork || status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || attempt === maxAttempts) throw err;
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(baseDelay * 2 ** (attempt - 1) + jitter, maxDelay);
      if (onProgress) onProgress({ isRetrying: true, attempt, maxAttempts });
      showToast(`Retrying... attempt ${attempt + 1}/${maxAttempts}`, 'info', 2000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Submit a job to the videoagent backend (real VideoDB + OpenAI agents).
 * Returns a jobId which can be polled via pollVideoAgentJob.
 * Retries up to 3 times on network errors, 429, and 5xx.
 */
async function submitVideoAgentJob(tool, payload, signal) {
  const base = getBackendBase();
  const keys = getUserKeys();
  return withRetry(async () => {
    const res = await fetch(`${base}/videoagent/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Note: Director dispatches via 'process-tool' only.
      // The 'process-usecase' branch on /videoagent/process is owned by
      // src/components/VideoAgentPage.js and must stay intact (covered by
      // backend/tests/videoAgent.test.js).
      body: JSON.stringify({
        action: 'process-tool',
        tool,
        ...payload,
        apiKey: payload.apiKey || keys.openai,
        videoDbKey: payload.videoDbKey || keys.videoDb,
      }),
      signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      const e = new Error(`Video Agent job submission failed (${res.status}): ${err.slice(0, 200)}`);
      e.status = res.status;
      throw e;
    }
    const json = await res.json();
    if (!json.jobId) throw new Error('Video Agent did not return a jobId');
    return json.jobId;
  }, { maxAttempts: 3 });
}

/**
 * Poll a videoagent job until completion or failure.
 * Retries individual poll requests on network error only (max 3 attempts).
 * The 10-minute timeout is shared across all retry attempts — a retry does
 * not reset the clock.
 */
async function pollVideoAgentJob(jobId, { onProgress, signal } = {}) {
  const base = getBackendBase();
  const start = Date.now();
  const timeout = 10 * 60 * 1000; // 10 min total

  async function pollOnce() {
    while (Date.now() - start < timeout) {
      if (signal?.aborted) throw new Error('Job cancelled');
      const res = await fetch(`${base}/videoagent/job/${encodeURIComponent(jobId)}`, { signal });
      if (!res.ok) {
        const e = new Error(`Poll failed (${res.status})`);
        e.status = res.status;
        throw e;
      }
      const job = await res.json();
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error(job.error || 'Job failed');
      if (job.status === 'cancelled') throw new Error('Job cancelled');
      if (onProgress) onProgress(job);
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error('Job timed out after 10 minutes');
  }

  return withRetry(pollOnce, { maxAttempts: 3 });
}

/**
 * Run a videoagent agent and return the completed result.
 */
async function runVideoAgent(tool, payload, { onProgress, signal } = {}) {
    const jobId = await submitVideoAgentJob(tool, payload, signal);
    return await pollVideoAgentJob(jobId, { onProgress, signal });
}

/**
 * Run an ffmpeg-based action through /api/agents/agent/:action.
 * These return results inline (no job polling).
 */
async function runAgentAction(action, payload, signal) {
  const base = getBackendBase();
  const keys = getUserKeys();
  return withRetry(async () => {
    const res = await fetch(`${base}/api/agents/agent/${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        apiKey: payload.apiKey || keys.openai,
        videoDbKey: payload.videoDbKey || keys.videoDb,
        muapiKey: payload.muapiKey || keys.muapi,
      }),
      signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      const e = new Error(`Agent action failed (${res.status}): ${err.slice(0, 200)}`);
      e.status = res.status;
      throw e;
    }
    return await res.json();
  }, { maxAttempts: 3 });
}

/**
 * Call a VideoDB REST endpoint through the backend proxy.
 */
async function callVideoDb(endpoint, { method = 'POST', body } = {}, signal) {
  const base = getBackendBase();
  const keys = getUserKeys();
  if (!keys.videoDb) {
    throw new Error('VideoDB API key not configured. Add your VideoDB key in Settings.');
  }
  return withRetry(async () => {
    const res = await fetch(`${base}/api/videodb/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, method, body, videoDbKey: keys.videoDb }),
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = new Error(err.error || err.message || `VideoDB call failed (${res.status})`);
      e.status = res.status;
      throw e;
    }
    const json = await res.json();
    return json.data ?? json;
  }, { maxAttempts: 3 });
}

/**
 * Run a Director agent by id. Dispatches to the right backend based on the
 * agent's `tool` mapping. Returns a structured result suitable for the chat UI.
 */
export async function runAgentById(agentId, { videoUrl, videoId, prompt, collectionId = 'default' } = {}, { onProgress, signal } = {}) {
    const agent = DIRECTOR_AGENTS.find((a) => a.id === agentId);
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);
    const tool = agent.tool;
    const keys = getUserKeys();
    const basePayload = { videoUrl, videoId, prompt, name: `director-${agentId}`, apiKey: keys.openai, videoDbKey: keys.videoDb, muapiKey: keys.muapi };

    switch (tool) {
        // ── VideoDB + OpenAI agents (polled jobs) ──────────────────────
        case 'highlights':
        case 'visual-search':
        case 'clip-segmentation':
        case 'subtitle':
        case 'subtitle_agent':
        case 'highlight-detection':
        case 'scene-detection':
        case 'text-to-movie':
        case 'storyboarding':
        case 'meme':
        case 'trailer-narration':
        case 'thumbnail':
        case 'audio-overlay':
        case 'gen-audio-overlays':
        case 'ai_voiceovers':
        case 'cosyvoice':
        case 'voice-cloning':
        case 'dubbing':
        case 'faceless-video':
        case 'ai-ad-films':
        case 'kids-storyteller':
        case 'tiktok-lyric':
        case 'year-in-frames':
        case 'profanity':
        case 'sales-assistant':
        case 'comparison':
        case 'output-formatting':
        case 'keyword-search':
        case 'slack':
        case 'intro-outro':
        case 'brand-elements':
        case 'dynamic-ads': {
            const job = await runVideoAgent(tool, basePayload, { onProgress, signal });
            return { agent: agentId, tool, source: job.source || 'videodb+openai', job, result: job };
        }
        // ── FFmpeg-based actions (inline) ──────────────────────────────
        case 'add-broll':
        case 'create-shorts':
        case 'color-correct':
        case 'upscale':
        case 'stabilize': {
            const r = await runAgentAction(tool, basePayload, signal);
            return { agent: agentId, tool, source: r.source || 'ffmpeg', result: r };
        }
        // ── Direct VideoDB REST calls ─────────────────────────────────
        case 'compile-timeline': {
            if (!prompt) throw new Error('A prompt is required to compile a timeline.');
            const search = await callVideoDb(`collection/${encodeURIComponent(collectionId)}/search/`, {
                body: { query: prompt, index_type: 'scene', search_type: 'semantic', result_threshold: 10 },
            }, signal);
            const results = search?.results || (Array.isArray(search) ? search : []);
            if (!results.length) {
                return { agent: agentId, tool, source: 'videodb', result: { timeline: null, message: 'No matching moments found in the collection.' } };
            }
            const compiled = await callVideoDb('timeline/compile', {
                body: { collection_id: collectionId, results },
            }, signal);
            return { agent: agentId, tool, source: 'videodb', result: { timeline: compiled, resultCount: results.length } };
        }
        case 'speed': {
            return await runAgentAction('speed', { ...basePayload, speedFactor: prompt ? parseFloat(prompt) || 1.5 : 1.5 }, signal);
        }
        case 'reverse': {
            return await runAgentAction('reverse', basePayload, signal);
        }
        default:
            throw new Error(`Agent '${agentId}' has no tool mapping.`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Agent → human-readable steps (shown in the processing panel)
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_STEPS = {
    summarizer:      ['Analyzing video content…', 'Extracting key frames…', 'Generating summary…', 'Finalizing…'],
    search:          ['Indexing media…', 'Building semantic index…', 'Searching…', 'Returning results…'],
    clipper:         ['Detecting scene boundaries…', 'Segmenting video…', 'Building clips…', 'Finalizing…'],
    dubbing:         ['Extracting audio track…', 'Transcribing speech…', 'Translating text…', 'Synthesizing new voice…', 'Mixing audio…'],
    subtitler:       ['Transcribing audio…', 'Aligning timestamps…', 'Generating SRT…', 'Embedding subtitles…'],
    highlighter:     ['Analyzing scenes…', 'Scoring moments…', 'Extracting top highlights…', 'Building reel…'],
    scenes:          ['Analyzing video frames…', 'Detecting scene changes…', 'Labeling scenes…', 'Building scene map…'],
    broll:           ['Analyzing script…', 'Searching B-roll library…', 'Inserting clips…', 'Finalizing edit…'],
    voiceover:       ['Analyzing script…', 'Synthesizing voice…', 'Mixing with audio…', 'Finalizing…'],
    editor:          ['Planning edit…', 'Generating shot list…', 'Building screenplay…', 'Finalizing…'],
    enhancer:        ['Analyzing resolution…', 'Upscaling frames…', 'Enhancing details…', 'Finalizing…'],
    compiler:        ['Searching collection…', 'Collecting matches…', 'Compiling timeline…', 'Finalizing…'],
    meme:            ['Analyzing video context…', 'Brainstorming meme concept…', 'Creating caption…', 'Finalizing…'],
    musicvideo:      ['Analyzing video…', 'Generating audio overlay…', 'Mixing track…', 'Finalizing…'],
    trailer:         ['Identifying key moments…', 'Writing narration…', 'Synthesizing voice…', 'Building trailer…'],
    compilation:     ['Searching collection…', 'Collecting matches…', 'Compiling timeline…', 'Finalizing…'],
    social:          ['Detecting best moments…', 'Cropping to vertical…', 'Adding captions…', 'Finalizing…'],
    preview:         ['Choosing best frame…', 'Generating thumbnail…', 'Writing title…', 'Finalizing…'],
    montage:         ['Searching collection…', 'Collecting matches…', 'Compiling timeline…', 'Finalizing…'],
    story:           ['Analyzing scenes…', 'Building narrative…', 'Generating storyboard…', 'Finalizing…'],
    color:           ['Analyzing color palette…', 'Applying corrections…', 'Balancing tones…', 'Final render…'],
    stabilize:       ['Analyzing motion…', 'Computing stabilization vectors…', 'Applying transform…', 'Finalizing…'],
    speed:           ['Analyzing playback…', 'Adjusting speed…', 'Re-encoding…', 'Finalizing…'],
    reverse:         ['Reading video…', 'Reversing frames…', 'Re-encoding…', 'Finalizing…'],
    voice_cloning:   ['Analyzing voice sample…', 'Cloning voice…', 'Synthesizing…', 'Finalizing…'],
    comparison:      ['Analyzing both videos…', 'Comparing content…', 'Scoring dimensions…', 'Finalizing…'],
    audio_overlays:  ['Analyzing context…', 'Generating audio overlay…', 'Mixing track…', 'Finalizing…'],
    keyword_search:  ['Building spoken-word index…', 'Searching keywords…', 'Compiling matches…', 'Finalizing…'],
    output_formatting:['Analyzing source…', 'Recommending format…', 'Generating spec…', 'Finalizing…'],
    auto_highlights: ['Analyzing scenes…', 'Scoring moments…', 'Extracting top highlights…', 'Finalizing…'],
    thumbnail:       ['Choosing best frame…', 'Generating thumbnail…', 'Writing title…', 'Finalizing…'],
    subtitle_agent:  ['Transcribing audio…', 'Aligning timestamps…', 'Generating SRT…', 'Finalizing…'],
    visual_search:   ['Indexing media…', 'Building visual index…', 'Searching…', 'Returning results…'],
    slack_agent:     ['Analyzing video…', 'Generating summary…', 'Posting to Slack…', 'Finalizing…'],
    text_to_movie:   ['Analyzing prompt…', 'Writing screenplay…', 'Building shot list…', 'Finalizing…'],
    storyboarding:   ['Analyzing scenes…', 'Building narrative…', 'Generating storyboard…', 'Finalizing…'],
    faceless_video_creator:['Writing script…', 'Generating voiceover…', 'Compiling visuals…', 'Finalizing…'],
    ai_ad_films:     ['Analyzing product…', 'Writing ad script…', 'Generating visuals…', 'Finalizing…'],
    tiktok_lyric_video:['Analyzing audio…', 'Syncing lyrics…', 'Adding visuals…', 'Finalizing…'],
    ai_voiceovers:   ['Analyzing script…', 'Synthesizing AI voice…', 'Mixing with audio…', 'Finalizing…'],
    trailer_narration:['Identifying key moments…', 'Writing narration…', 'Synthesizing voice…', 'Finalizing…'],
    kids_storyteller:['Writing children story…', 'Generating visuals…', 'Adding narration…', 'Finalizing…'],
    year_in_frames:  ['Analyzing footage…', 'Selecting key moments…', 'Building recap…', 'Finalizing…'],
    profanity_remover:['Transcribing audio…', 'Detecting profanity…', 'Beeping/cleaning…', 'Finalizing…'],
    sales_assistant: ['Analyzing pitch…', 'Extracting CRM fields…', 'Drafting follow-up…', 'Finalizing…'],
    dynamic_ads: ['Analyzing brand…', 'Generating ad variants…', 'Rendering creatives…', 'Finalizing…'],
    intro_outro: ['Planning intro…', 'Designing sequence…', 'Adding effects…', 'Finalizing…'],
    brand_elements: ['Detecting brand assets…', 'Positioning elements…', 'Rendering…', 'Finalizing…'],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

export function DirectorPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-hidden bg-[#08090b]';
  mountStudioChrome(container, { currentRoute: 'director' });

    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('videoId') || '';
    const videoUrl = urlParams.get('videoUrl') || '';

    let activeAgents = new Set();
    let isProcessing = false;
    let pollAbort = null;

    container.innerHTML = `
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-white/5 bg-black/50">
            <div class="flex items-center gap-4">
                <button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-xl font-black text-white">DIRECTOR</h1>
                        <p class="text-xs text-secondary">AI Agentic Editor • ${DIRECTOR_AGENTS.length} Agents</p>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button id="cancel-btn" data-testid="cancel-btn" class="hidden px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm rounded-lg transition-colors">
                    Cancel
                </button>
                <button id="clear-chat-btn" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-secondary text-sm rounded-lg transition-colors">
                    Clear Chat
                </button>
                <span class="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center gap-2">
                    <span class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                    REASONING ENGINE
                </span>
            </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex overflow-hidden">
            <!-- Left: Agents Panel -->
            <div class="w-72 border-r border-white/5 overflow-hidden bg-black/30 flex flex-col">
                <div class="p-4 overflow-auto flex-1">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-bold text-white text-sm uppercase tracking-wider">AI AGENTS</h3>
                        <select id="category-filter" data-testid="category-filter" class="bg-white/5 text-xs text-secondary rounded px-2 py-1 border border-white/10">
                            <option value="">All Categories</option>
                            ${Object.entries(AGENT_CATEGORIES).map(([key, val]) =>
                                `<option value="${key}">${val.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div id="agents-grid" class="grid grid-cols-2 gap-2">
                        ${DIRECTOR_AGENTS.map(agent => `
                            <button class="agent-btn p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all hover:scale-[1.02] cursor-pointer" data-agent="${agent.id}" data-category="${agent.category}" data-testid="agent-card">
                                <div class="text-lg mb-1">${agent.icon}</div>
                                <div class="font-bold text-white text-xs leading-tight">${agent.name}</div>
                                <div class="text-[10px] text-secondary truncate">${agent.description}</div>
                            </button>
                        `).join('')}
                    </div>

                    <!-- Active Agents -->
                    <div class="mt-6">
                        <h4 class="font-bold text-white text-sm mb-3 flex items-center gap-2">
                            <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                            ACTIVE AGENTS
                        </h4>
                        <div id="active-agents" class="space-y-2 max-h-48 overflow-auto">
                            <div class="text-xs text-secondary italic p-2">No agents running</div>
                        </div>
                    </div>

                    <!-- Recent History -->
                    <div class="mt-6">
                        <h4 class="font-bold text-white text-sm mb-3">RECENT ACTIONS</h4>
                        <div id="action-history" class="space-y-2 max-h-40 overflow-auto">
                            <div class="text-xs text-secondary italic p-2">No actions yet</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Center: Video + Chat -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- Video Preview -->
                <div class="p-4 border-b border-white/5">
                    <div class="bg-black rounded-2xl overflow-hidden">
                        <div class="aspect-video flex items-center justify-center bg-black/80 relative">
                            ${videoUrl ? `
                                <video
                                    id="director-video"
                                    class="max-w-full max-h-full"
                                    controls
                                    src="${escapeHtml(videoUrl)}"
                                >
                                    Your browser does not support video playback.
                                </video>
                            ` : `
                                <div class="text-center p-8">
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-secondary mx-auto mb-4">
                                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                                        <line x1="7" y1="2" x2="7" y2="22"/>
                                        <line x1="17" y1="2" x2="17" y2="22"/>
                                        <line x1="2" y1="12" x2="22" y2="12"/>
                                        <line x1="2" y1="7" x2="7" y2="7"/>
                                        <line x1="2" y1="17" x2="7" y2="17"/>
                                        <line x1="17" y1="17" x2="22" y2="17"/>
                                        <line x1="17" y1="7" x2="22" y2="7"/>
                                    </svg>
                                    <p class="text-secondary">No video loaded</p>
                                    <p class="text-xs text-muted mt-2">Open Director from the Render studio to load a video</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Chat Interface -->
                <div class="flex-1 flex flex-col overflow-hidden p-4">
                    <h3 class="font-bold text-white mb-3 text-sm flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        AI CHAT
                        <span class="ml-auto text-xs text-secondary font-normal">Powered by VideoDB</span>
                    </h3>

                    <!-- Chat Messages -->
                    <div id="chat-messages" class="flex-1 overflow-auto space-y-3 mb-4 min-h-[180px] max-h-[280px]"></div>

                    <!-- Command Input -->
                    <div class="flex gap-3">
                        <input
                            type="text"
                            id="command-input" data-testid="command-input"
                            placeholder="Type your command (e.g., 'Summarize this video')"
                            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary/50"
                        >
                        <button id="send-command-btn" class="px-6 py-3 btn-secondary-modern font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send
                        </button>
                    </div>
                </div>
            </div>

            <!-- Right: Tools Panel -->
            <div class="w-80 border-l border-white/5 p-4 overflow-auto bg-black/30">
                <!-- Processing Status -->
                <div id="processing-status" data-testid="processing-status" class="hidden mb-6">
                    <h4 class="font-bold text-white text-sm mb-3 flex items-center gap-2">
                        <div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        PROCESSING
                    </h4>
                    <div class="bg-white/5 rounded-xl p-3">
                        <div class="mb-3">
                            <span id="processing-title" class="text-sm text-white font-bold">Processing...</span>
                        </div>
                        <div id="processing-steps" class="space-y-1 text-xs"></div>
                        <div class="mt-3 pt-3 border-t border-white/10">
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-secondary">Progress</span>
                                <span id="progress-percent" class="text-primary font-bold">0%</span>
                            </div>
                            <div class="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div id="progress-bar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <h3 class="font-bold text-white mb-3 text-sm uppercase tracking-wider">QUICK ACTIONS</h3>
                <div class="space-y-2">
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="summarize" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">📝</div>
                        <div><div class="font-bold text-white text-sm">Summarize</div><div class="text-xs text-secondary">Generate video summary</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="highlights" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">⚡</div>
                        <div><div class="font-bold text-white text-sm">Extract Highlights</div><div class="text-xs text-secondary">Find best moments</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="scenes" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎬</div>
                        <div><div class="font-bold text-white text-sm">Detect Scenes</div><div class="text-xs text-secondary">Identify boundaries</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="subtitles" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">💬</div>
                        <div><div class="font-bold text-white text-sm">Add Subtitles</div><div class="text-xs text-secondary">Auto-generate captions</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="dubbing" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎤</div>
                        <div><div class="font-bold text-white text-sm">Dub Video</div><div class="text-xs text-secondary">Translate audio</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="broll" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎞️</div>
                        <div><div class="font-bold text-white text-sm">Add B-Roll</div><div class="text-xs text-secondary">Overlay footage</div></div>
                    </button>
                    <button id="pexels-director-btn" type="button" class="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer">
                        <div class="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                        </div>
                        <div><div class="font-bold text-white text-sm">Browse B-Roll from Pexels</div><div class="text-xs text-secondary">Stock footage library</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="voiceover" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎙️</div>
                        <div><div class="font-bold text-white text-sm">Voiceover</div><div class="text-xs text-secondary">Add AI narration</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="shorts" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">📱</div>
                        <div><div class="font-bold text-white text-sm">Create Shorts</div><div class="text-xs text-secondary">TikTok/Reels/Shorts</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="color" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🎨</div>
                        <div><div class="font-bold text-white text-sm">Color Correction</div><div class="text-xs text-secondary">Adjust colors</div></div>
                    </button>
                    <button class="action-btn w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left flex items-center gap-3 transition-colors cursor-pointer" data-action="stabilize" data-testid="quick-action-btn">
                        <div class="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">🪄</div>
                        <div><div class="font-bold text-white text-sm">Stabilize</div><div class="text-xs text-secondary">Fix shaky footage</div></div>
                    </button>
                </div>

                <!-- Video Output -->
                <div class="mt-6">
                    <h4 class="font-bold text-white text-sm mb-3">RESULT</h4>
                    <div id="result-preview" class="bg-white/5 rounded-xl p-3 min-h-[80px]">
                        <div class="text-xs text-secondary italic">Run an agent to see results here.</div>
                    </div>
                </div>

                <!-- Pexels Attribution -->
                <div id="pexels-director-attribution" class="mt-3"></div>
            </div>
        </div>
    `;

    // ── DOM refs ──────────────────────────────────────────────────────
    const commandInput = container.querySelector('#command-input');
    const sendCommandBtn = container.querySelector('#send-command-btn');
    const chatMessages = container.querySelector('#chat-messages');
    const cancelBtn = container.querySelector('#cancel-btn');
    const processingStatus = container.querySelector('#processing-status');
    const processingTitle = container.querySelector('#processing-title');
    const processingSteps = container.querySelector('#processing-steps');
    const progressBar = container.querySelector('#progress-bar');
    const progressPercent = container.querySelector('#progress-percent');
    const resultPreview = container.querySelector('#result-preview');
    const activeAgentsEl = container.querySelector('#active-agents');
    const actionHistoryEl = container.querySelector('#action-history');

    // ── Event Handlers ────────────────────────────────────────────────
    container.querySelector('#back-btn').onclick = () => {
        navigate('render', { videoId, videoUrl });
    };

    container.querySelector('#clear-chat-btn').onclick = () => {
        if (pendingPromptResolve) {
            const resolve = pendingPromptResolve;
            pendingPromptResolve = null;
            resolve(null);
        }
        chatHistory = [];
        try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
        chatMessages.innerHTML = '';
        addMessage(buildInitialGreeting(), {});
    };

    // Delegate clicks on agent suggestion chips inside the chat.
    chatMessages.addEventListener('click', (e) => {
        const chip = e.target.closest('.agent-suggestion-chip');
        if (!chip) return;
        const agentId = chip.dataset.agentId;
        const agent = DIRECTOR_AGENTS.find((a) => a.id === agentId);
        if (!agent) return;
        if (!videoUrl) {
            addMessage(`Please open Director with a video URL (from the Render studio) before running ${agent.name}.`, { isError: true });
            showToast('No video loaded', 'warning');
            return;
        }
        commandInput.value = agent.description;
        processCommand(agent.description);
    });

    cancelBtn.onclick = () => {
        if (pollAbort) {
            pollAbort.abort();
            pollAbort = null;
        }
        isProcessing = false;
        cancelBtn.classList.add('hidden');
        processingStatus.classList.add('hidden');
        showToast('Job cancelled', 'warning');
    };

    container.querySelector('#category-filter').onchange = (e) => {
        const category = e.target.value;
        container.querySelectorAll('.agent-btn').forEach(btn => {
            if (!category || btn.dataset.category === category) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        });
    };

    const pexelsDirectorBtn = container.querySelector('#pexels-director-btn');
    const pexelsDirectorAttr = container.querySelector('#pexels-director-attribution');
    if (pexelsDirectorBtn) {
        pexelsDirectorBtn.onclick = async () => {
            const { browsePexelsVideos } = await import('../lib/studioPexels.js');
            browsePexelsVideos({
                title: 'Browse B-Roll',
                studioName: 'Director',
                onSelect: (asset) => {
                    const detail = {
                        url: asset.video_files?.[0]?.link || asset.url || asset.original,
                        source: 'pexels',
                        attribution: asset.photographer || (asset.user && asset.user.name) || 'Pexels',
                        photographer_url: asset.photographer_url || (asset.user && asset.user.url) || 'https://www.pexels.com',
                        pexelsUrl: asset.url || '',
                    };
                    window.dispatchEvent(new CustomEvent('addBRoll', { detail }));
                    if (pexelsDirectorAttr) {
                        pexelsDirectorAttr.innerHTML = '';
                        import('../lib/attributionChip.js').then(mod => mod.renderAttributionChip(asset, pexelsDirectorAttr));
                    }
                    addMessage(`B-Roll selected: ${asset.photographer || 'Pexels video'}`, { isAction: true });
                }
            });
        };
    }

    // ── Chat persistence ──────────────────────────────────────────────
    const CHAT_STORAGE_KEY = 'director_chat_history';
    let chatHistory = loadChatHistory();

    function loadChatHistory() {
        try {
            const raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveChatHistory() {
        try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
        } catch (e) {
            console.warn('[Director] Failed to persist chat history', e);
        }
    }

    function buildInitialGreeting() {
        return `
            <p class="text-sm text-white">Hello! I'm Director, your AI video assistant with ${DIRECTOR_AGENTS.length} production-ready agents backed by VideoDB and FFmpeg.</p>
            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="bg-white/5 p-2 rounded"><span class="text-primary font-bold">🎬</span> Scene Detection</div>
                <div class="bg-white/5 p-2 rounded"><span class="text-primary font-bold">⚡</span> Highlights</div>
                <div class="bg-white/5 p-2 rounded"><span class="text-primary font-bold">💬</span> Subtitles</div>
                <div class="bg-white/5 p-2 rounded"><span class="text-primary font-bold">🎤</span> Dubbing</div>
            </div>
            <p class="text-xs text-primary mt-3">Click any agent or type a command below. Make sure your VideoDB + OpenAI keys are set in Settings.</p>
        `;
    }

    function renderSuggestionChips(agentIds) {
        return (agentIds || []).map((id) => {
            const agent = DIRECTOR_AGENTS.find((a) => a.id === id);
            if (!agent) return '';
            return `<button type="button" class="agent-suggestion-chip bg-white/10 hover:bg-primary/20 border border-white/10 rounded-full px-3 py-1 text-xs text-white transition-colors" data-agent-id="${escapeHtml(agent.id)}">${escapeHtml(agent.icon)} ${escapeHtml(agent.name)}</button>`;
        }).join('');
    }

    function renderMessageFromHistory(entry) {
        if (!entry || !entry.type) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message flex gap-3';
        const safe = escapeHtml(String(entry.content || ''));

        if (entry.type === 'user') {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary rounded-full flex-shrink-0 flex items-center justify-center text-black text-xs font-bold">YOU</div>
                <div class="bg-primary/20 rounded-2xl rounded-tr-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${safe}</p>
                </div>
            `;
        } else if (entry.type === 'error') {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-red-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">!</div>
                <div class="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${safe}</p>
                </div>
            `;
        } else if (entry.type === 'action') {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-green-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">✓</div>
                <div class="bg-green-500/10 border border-green-500/20 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <div class="text-sm text-white">${safe}</div>
                </div>
            `;
        } else if (entry.type === 'suggestions') {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-red-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">!</div>
                <div class="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${safe}</p>
                    <div class="mt-3 flex flex-wrap gap-2">${renderSuggestionChips(entry.agentIds)}</div>
                    <p class="mt-3 text-xs text-secondary">Or try keywords like: summarize, search, clip, subtitle, highlight, scene, speed, color, stabilize</p>
                </div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <div class="text-sm text-white">${safe}</div>
                </div>
            `;
        }

        chatMessages.appendChild(msgDiv);
    }

    function restoreChatHistory() {
        if (chatHistory.length === 0) {
            addMessage(buildInitialGreeting(), {});
            return;
        }
        chatMessages.innerHTML = '';
        chatHistory.forEach(renderMessageFromHistory);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ── Chat helpers ──────────────────────────────────────────────────
    function addMessage(content, { isUser = false, isAction = false, isError = false, isSuggestions = false, agentIds = [] } = {}) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message flex gap-3';

        let type;
        if (isUser) type = 'user';
        else if (isSuggestions) type = 'suggestions';
        else if (isError) type = 'error';
        else if (isAction) type = 'action';
        else type = 'ai';

        if (isUser) {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary rounded-full flex-shrink-0 flex items-center justify-center text-black text-xs font-bold">YOU</div>
                <div class="bg-primary/20 rounded-2xl rounded-tr-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${escapeHtml(String(content))}</p>
                </div>
            `;
        } else if (isError && !isSuggestions) {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-red-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">!</div>
                <div class="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${escapeHtml(String(content))}</p>
                </div>
            `;
        } else if (isSuggestions) {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-red-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">!</div>
                <div class="bg-red-500/10 border border-red-500/20 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white">${escapeHtml(String(content))}</p>
                    <div class="mt-3 flex flex-wrap gap-2">${renderSuggestionChips(agentIds)}</div>
                    <p class="mt-3 text-xs text-secondary">Or try keywords like: summarize, search, clip, subtitle, highlight, scene, speed, color, stabilize</p>
                </div>
            `;
        } else if (isAction) {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-green-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">✓</div>
                <div class="bg-green-500/10 border border-green-500/20 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <div class="text-sm text-white">${content}</div>
                </div>
            `;
        } else {
            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <div class="text-sm text-white">${content}</div>
                </div>
            `;
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Persist a structured record (not raw HTML) to keep restore XSS-safe.
        chatHistory.push({
            type,
            content: String(content),
            agentIds: isSuggestions ? agentIds.slice() : undefined,
            timestamp: Date.now(),
        });
        saveChatHistory();
    }

    // Restore chat history (or seed the initial greeting) on mount.
    restoreChatHistory();

    function updateActiveAgents() {
        if (activeAgents.size === 0) {
            activeAgentsEl.innerHTML = '<div class="text-xs text-secondary italic p-2">No agents running</div>';
            return;
        }
        activeAgentsEl.innerHTML = Array.from(activeAgents).map(agentId => {
            const agent = DIRECTOR_AGENTS.find(a => a.id === agentId);
            return `
                <div class="p-2 bg-white/5 rounded-lg flex items-center gap-2">
                    <span class="text-lg">${escapeHtml(agent?.icon || '🤖')}</span>
                    <span class="text-xs text-white flex-1">${escapeHtml(agent?.name || agentId)}</span>
                    <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                </div>
            `;
        }).join('');
    }

    function addToHistory(command, agentId) {
        if (actionHistoryEl.querySelector('.italic')) {
            actionHistoryEl.innerHTML = '';
        }
        const actionEl = document.createElement('div');
        actionEl.className = 'p-2 bg-white/5 rounded-lg text-xs text-white flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors';
        const agent = DIRECTOR_AGENTS.find(a => a.id === agentId);
        actionEl.innerHTML = `
            <span class="text-primary">✓</span>
            <span class="flex-1 truncate">${escapeHtml(command.slice(0, 30))}${command.length > 30 ? '...' : ''}</span>
            <span class="text-secondary ml-auto">${escapeHtml(agent?.name || agentId)}</span>
        `;
        actionEl.onclick = () => {
            commandInput.value = command;
            commandInput.focus();
        };
        actionHistoryEl.insertBefore(actionEl, actionHistoryEl.firstChild);
        while (actionHistoryEl.children.length > 10) {
            actionHistoryEl.removeChild(actionHistoryEl.lastChild);
        }
    }

    function setSteps(steps) {
        processingSteps.innerHTML = steps.map((s, i) => `
            <div class="flex items-center gap-2 text-secondary" data-step="${i}">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span>${escapeHtml(s)}</span>
            </div>
        `).join('');
    }

    function tickStep(idx) {
        const els = processingSteps.querySelectorAll('[data-step]');
        els.forEach((el, i) => {
            if (i < idx) {
                el.classList.remove('text-secondary');
                el.classList.add('text-white');
                el.querySelector('span').classList.remove('bg-secondary', 'animate-pulse', 'bg-primary');
                el.querySelector('span').classList.add('bg-primary');
            } else if (i === idx) {
                el.classList.remove('text-secondary');
                el.classList.add('text-white');
                el.querySelector('span').classList.remove('bg-secondary', 'bg-primary');
                el.querySelector('span').classList.add('bg-primary', 'animate-pulse');
            }
        });
        const pct = Math.round(((idx + 1) / els.length) * 100);
        progressBar.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
    }

    function finishSteps() {
        const els = processingSteps.querySelectorAll('[data-step]');
        els.forEach((el) => {
            el.classList.remove('text-secondary');
            el.classList.add('text-white');
            el.querySelector('span').classList.remove('bg-secondary', 'animate-pulse');
            el.querySelector('span').classList.add('bg-primary');
        });
        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
    }

    // ── Result rendering ──────────────────────────────────────────────
    function renderResult(result, agentId) {
        if (!result) return;
        // Two response shapes:
        //   1) videoagent polled job: result.result is the job's { status, ...agentOutput }
        //   2) ffmpeg agent action:   result.result is { success, action, ...inlineOutput }
        const data = result.result || result;

        // ── Find a playable/downloadable URL or base64 asset ──────────
        // For create-shorts the base64 lives inside data.shorts[0].
        const shortsItem = Array.isArray(data.shorts) ? data.shorts[0] : null;
        const brollItem = Array.isArray(data.broll) ? data.broll[0] : null;

        const inlineBase64 = data.base64
            || shortsItem?.base64
            || data.voiceover && data.audioBase64
            || brollItem?.url;
        const inlineFormat = data.format
            || shortsItem?.format
            || (data.mimeType && data.mimeType.startsWith('audio/') ? 'mp3' : null)
            || (data.audioBase64 ? 'mp3' : null);

        const playUrl = data.url || data.downloadUrl || data.audioUrl ||
                        data.srtUrl || data.exportedUrl ||
                        (data.dubbedVideo && `/videoagent/file/${data.dubbedVideo}`) ||
                        (data.upscaledVideo && `/videoagent/file/${data.upscaledVideo}`) ||
                        (data.correctedVideo && `/videoagent/file/${data.correctedVideo}`) ||
                        (data.stabilizedVideo && `/videoagent/file/${data.stabilizedVideo}`);

        let html = `<div class="space-y-2">`;
        html += `<div class="text-xs text-secondary">Agent: <span class="text-white font-bold">${escapeHtml(agentId)}</span> · Source: <span class="text-primary">${escapeHtml(result.source || data.source || 'api')}</span></div>`;

        // Summary text (OpenAI-generated or static)
        const memeCaption = data.meme && (data.meme.caption || (data.meme.topText ? `${data.meme.topText} / ${data.meme.bottomText || ''}` : ''));
        const titleAndTags = data.title
            ? `${data.title}${Array.isArray(data.hashtags) ? ' ' + data.hashtags.join(' ') : ''}`
            : null;
        const summary = data.summary || data.analysis || data.comparison ||
                        data.recommendation || data.storyboard || data.screenplay ||
                        memeCaption || titleAndTags || data.report;
        if (summary) {
            html += `<div class="text-sm text-white bg-black/30 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">${escapeHtml(String(summary).slice(0, 1500))}</div>`;
        }

        // Scenes
        if (Array.isArray(data.scenes)) {
            html += `<div class="text-xs text-secondary">${data.scenes.length} scene${data.scenes.length !== 1 ? 's' : ''} detected</div>`;
        }
        // Highlights / moments
        if (Array.isArray(data.highlights)) {
            html += `<div class="text-xs text-secondary">${data.highlights.length} highlight${data.highlights.length !== 1 ? 's' : ''} found</div>`;
        }
        // Search results
        if (Array.isArray(data.results)) {
            html += `<div class="text-xs text-secondary">${data.results.length} match${data.results.length !== 1 ? 'es' : ''} found</div>`;
        }
        // SRT subtitles
        if (data.srt) {
            html += `<div class="text-xs text-secondary">SRT generated (${String(data.srt).length} chars)</div>`;
        }
        // Timeline
        if (data.timeline) {
            html += `<div class="text-xs text-secondary">Timeline compiled</div>`;
        }
        // Shorts
        if (Array.isArray(data.shorts) && data.shorts.length) {
            html += `<div class="text-xs text-secondary">${data.shorts.length} short${data.shorts.length !== 1 ? 's' : ''} created</div>`;
        }
        // B-roll
        if (Array.isArray(data.broll) && data.broll.length) {
            html += `<div class="text-xs text-secondary">${data.broll.length} B-roll clip${data.broll.length !== 1 ? 's' : ''}</div>`;
        }
        // Audio overlay / voiceover
        if (data.voiceover) {
            html += `<div class="text-xs text-secondary">Voiceover generated</div>`;
        }

        // Inline base64 audio/video
        if (inlineBase64 && inlineFormat && typeof inlineBase64 === 'string' && !inlineBase64.startsWith('http')) {
            const mime = inlineFormat === 'mp3' || inlineFormat === 'wav' || inlineFormat === 'mpeg'
                ? (inlineFormat === 'wav' ? 'audio/wav' : 'audio/mpeg')
                : 'video/mp4';
            const dataUrl = `data:${mime};base64,${inlineBase64}`;
            if (mime.startsWith('audio/')) {
                html += `<audio controls class="w-full mt-1" src="${dataUrl}"></audio>`;
            } else {
                html += `<video controls class="w-full mt-1 max-h-48" src="${dataUrl}"></video>`;
            }
        }
        // Playable file (URL-based)
        if (playUrl && typeof playUrl === 'string' && !inlineBase64) {
            const full = playUrl.startsWith('http') ? playUrl : `${getBackendBase()}${playUrl}`;
            const isAudio = /\.(mp3|wav|mpeg|webm)$/i.test(playUrl) || data.mimeType === 'audio/mpeg';
            if (isAudio) {
                html += `<audio controls class="w-full mt-1" src="${escapeHtml(full)}"></audio>`;
            } else {
                html += `<video controls class="w-full mt-1 max-h-48" src="${escapeHtml(full)}"></video>`;
            }
            html += `<a href="${escapeHtml(full)}" download class="text-xs text-primary hover:underline block mt-1">⬇ Download</a>`;
        }

        html += `</div>`;
        resultPreview.innerHTML = html;
    }

    // ── Keyword → Agent inference (chat-only fallback) ────────────────
    const KEYWORD_TO_AGENT = {
        summarizer: ['summarize', 'summary', 'tldr', 'recap', 'overview'],
        search: ['search', 'find', 'look for', 'where'],
        clipper: ['clip', 'cut', 'segment', 'trim'],
        dubbing: ['dub', 'translate', 'language', 'spanish', 'french', 'german'],
        subtitler: ['subtitle', 'caption', 'transcribe', 'subtitles'],
        subtitle_agent: ['subtitle agent', 'auto subtitle', 'embed subtitle'],
        highlighter: ['highlight', 'best moment', 'key moment'],
        auto_highlights: ['auto highlight', 'automatic highlight', 'ai highlight'],
        scenes: ['scene', 'boundary', 'chapter', 'detect scene'],
        broll: ['b-roll', 'broll', 'overlay', 'stock footage'],
        voiceover: ['voiceover', 'narration', 'narrate'],
        ai_voiceovers: ['ai voiceover', 'ai narration'],
        voice_cloning: ['voice clone', 'clone voice', 'voice print', 'clone'],
        editor: ['edit', 'arrange', 'storyboard edit'],
        enhancer: ['enhance', 'upscale', 'sharpen', 'improve quality'],
        compiler: ['compile', 'combine', 'merge videos'],
        meme: ['meme', 'funny', 'viral'],
        musicvideo: ['music video', 'song', 'music'],
        trailer: ['trailer', 'preview clip', 'teaser'],
        trailer_narration: ['trailer narration', 'dramatic narration'],
        compilation: ['compilation', 'highlights reel', 'best of'],
        social: ['shorts', 'tiktok', 'reel', 'vertical', 'social media'],
        preview: ['thumbnail', 'cover', 'preview image'],
        thumbnail: ['thumbnail agent', 'pick thumbnail', 'best frame'],
        montage: ['montage', 'sequence'],
        story: ['story', 'narrative'],
        storyboarding: ['storyboard', 'shot list', 'shot-by-shot'],
        color: ['color', 'grade', 'tone', 'color correct'],
        stabilize: ['stabilize', 'shaky', 'steady'],
        speed: ['speed', 'slow', 'fast', 'speed up', 'slow motion'],
        reverse: ['reverse', 'backwards', 'rewind'],
        comparison: ['compare', 'versus', 'vs'],
        audio_overlays: ['audio overlay', 'sound effect', 'sfx', 'music overlay'],
        keyword_search: ['keyword search', 'spoken word search', 'find word'],
        output_formatting: ['output format', 'aspect ratio', 'export format'],
        visual_search: ['visual search', 'image query', 'find by image'],
        slack_agent: ['slack', 'post to slack', 'send to slack'],
        text_to_movie: ['text to movie', 'script to movie', 'text to video'],
        faceless_video_creator: ['faceless', 'no face', 'faceless video'],
        ai_ad_films: ['ad film', 'advertisement', 'product ad', 'commercial'],
        tiktok_lyric_video: ['tiktok lyric', 'lyric video', 'song clip'],
        kids_storyteller: ['kids story', 'children', 'storytime', 'kids'],
        year_in_frames: ['year in frames', 'yearly recap', 'annual recap'],
        profanity_remover: ['profanity', 'clean language', 'beep', 'censor'],
        sales_assistant: ['sales', 'crm', 'follow-up', 'sales call'],
        dynamic_ads: ['dynamic ad', 'ad variation', 'ad creative', 'dynamic creative'],
        intro_outro: ['intro', 'outro', 'opening', 'closing', 'title sequence'],
        brand_elements: ['brand', 'watermark', 'logo', 'branding'],
    };
    function inferAgentId(text) {
        const lower = text.toLowerCase();
        for (const [agentId, keywords] of Object.entries(KEYWORD_TO_AGENT)) {
            if (keywords.some((k) => lower.includes(k))) return agentId;
        }
        return null;
    }

    // ── Inline input prompts for agents that need extra data ──────────
    // These four agent categories require user-provided fields beyond the
    // main chat command. The form is rendered as a chat bubble; the caller
    // awaits a Promise that resolves with the collected fields, or `null`
    // if the user cancelled.
    function getRequiredInputFields(agentId) {
        switch (agentId) {
            case 'voice_cloning':
                return [{
                    key: 'text',
                    label: 'Text to synthesize',
                    placeholder: 'Enter the text the cloned voice should speak…',
                    required: true,
                }];
            case 'audio_overlays':
            case 'ai_voiceovers':
                return [{
                    key: 'text',
                    label: 'Audio description / script',
                    placeholder: 'Describe the audio overlay or paste a script…',
                    required: true,
                }];
            case 'comparison':
                return [
                    { key: 'videoUrlA', label: 'Video A URL', placeholder: 'https://example.com/video-a.mp4', required: true },
                    { key: 'videoUrlB', label: 'Video B URL', placeholder: 'https://example.com/video-b.mp4', required: true },
                ];
            case 'compiler':
            case 'compilation':
            case 'montage':
                return [{
                    key: 'collectionId',
                    label: 'VideoDB Collection ID',
                    placeholder: 'default',
                    default: 'default',
                    hint: 'The VideoDB collection to compile from. Use "default" if you are unsure.',
                    required: true,
                }];
            default:
                return [];
        }
    }

    let pendingPromptResolve = null;

    function promptForAgentInput(agentId, agentName) {
        return new Promise((resolve) => {
            const fields = getRequiredInputFields(agentId);
            if (!fields.length) {
                resolve({});
                return;
            }

            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-message flex gap-3';
            msgDiv.dataset.agentPrompt = '1';

            const formHtml = fields.map((f) => `
                <div class="mt-2">
                    <label class="block text-xs text-secondary mb-1">${escapeHtml(f.label)}</label>
                    <input
                        type="text"
                        data-input-key="${escapeHtml(f.key)}"
                        data-testid="agent-prompt-${escapeHtml(f.key)}"
                        placeholder="${escapeHtml(f.placeholder || '')}"
                        ${f.default ? `value="${escapeHtml(f.default)}"` : ''}
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50"
                    />
                    ${f.hint ? `<p class="text-[10px] text-muted mt-1">${escapeHtml(f.hint)}</p>` : ''}
                </div>
            `).join('');

            msgDiv.innerHTML = `
                <div class="w-8 h-8 bg-primary/20 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">AI</div>
                <div class="bg-white/10 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p class="text-sm text-white"><span class="font-bold">${escapeHtml(agentName)}</span> needs a bit more info to run:</p>
                    ${formHtml}
                    <p data-error class="hidden text-xs text-red-300 mt-2"></p>
                    <div class="flex gap-2 mt-3">
                        <button data-action="run" data-testid="agent-prompt-run" class="px-4 py-1.5 btn-secondary-modern font-bold text-sm rounded-lg hover:scale-105 transition-transform">Run</button>
                        <button data-action="cancel" data-testid="agent-prompt-cancel" class="px-4 py-1.5 bg-white/5 text-secondary text-sm rounded-lg hover:bg-white/10 transition-colors">Cancel</button>
                    </div>
                </div>
            `;

            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            const firstInput = msgDiv.querySelector('input');
            if (firstInput) firstInput.focus();

            const cleanup = () => {
                if (msgDiv.parentNode) msgDiv.parentNode.removeChild(msgDiv);
                if (pendingPromptResolve === resolve) pendingPromptResolve = null;
            };

            const showError = (text) => {
                const errEl = msgDiv.querySelector('[data-error]');
                if (!errEl) return;
                errEl.textContent = text;
                errEl.classList.remove('hidden');
            };

            const handleRun = () => {
                const result = {};
                for (const f of fields) {
                    const input = msgDiv.querySelector(`[data-input-key="${f.key}"]`);
                    const v = input ? input.value.trim() : '';
                    if (f.required !== false && !v) {
                        showError(`Please provide a value for "${f.label}".`);
                        if (input) input.focus();
                        return;
                    }
                    result[f.key] = v;
                }
                cleanup();
                resolve(result);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            pendingPromptResolve = resolve;

            msgDiv.querySelector('[data-action="run"]').onclick = handleRun;
            msgDiv.querySelector('[data-action="cancel"]').onclick = handleCancel;

            msgDiv.querySelectorAll('input').forEach((inp) => {
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRun();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancel();
                    }
                });
            });
        });
    }

    // ── Main command processor ────────────────────────────────────────
    async function processCommand(command) {
        if (!command.trim() || isProcessing) return;

        // Entitlement gate — every agent run checks the user's plan/credits.
        if (!(await requireEntitlement())) {
            addMessage('This feature requires an active subscription. Please check your plan in Settings.', { isError: true });
            return;
        }

        const agentId = inferAgentId(command);
        if (!agentId) {
            const suggestedIds = DIRECTOR_AGENTS.slice(0, 6).map((a) => a.id);
            addMessage("I couldn't match that to a specific agent. Try one of these or use a keyword:", {
                isError: true,
                isSuggestions: true,
                agentIds: suggestedIds,
            });
            return;
        }

        const agent = DIRECTOR_AGENTS.find(a => a.id === agentId);
        if (!agent) return;

        // ── Prompt for extra input (e.g. voice-cloning text, comparison URLs) ─
        // Some agents need fields beyond the main command. Show an inline form
        // and wait for the user to fill it in. Resolves with the collected
        // fields, or `null` if the user cancelled.
        const extraInput = await promptForAgentInput(agentId, agent.name);
        if (extraInput === null) {
            addMessage(`${agent.name} cancelled.`, { isError: true });
            return;
        }

        // ── Visual disabled state while a job is in flight ─────────────
        const allBtns = container.querySelectorAll('.agent-btn, .action-btn, #send-command-btn');
        allBtns.forEach((b) => {
            b.disabled = true;
            b.classList.add('opacity-50', 'pointer-events-none');
        });
        commandInput.disabled = true;

        isProcessing = true;
        pollAbort = new AbortController();
        cancelBtn.classList.remove('hidden');
        addMessage(command, { isUser: true });
        commandInput.value = '';

        // Echo the extra input back into the chat so the user has a record.
        const echoEntries = Object.entries(extraInput).filter(([, v]) => v);
        if (echoEntries.length) {
            const echoText = echoEntries.map(([k, v]) => `${k}: ${v}`).join('\n');
            addMessage(echoText, { isUser: true });
        }

        // Show processing status
        processingStatus.classList.remove('hidden');
        processingTitle.textContent = agent.name;
        const steps = AGENT_STEPS[agentId] || ['Processing…', 'Finalizing…'];
        setSteps(steps);
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';

        activeAgents.add(agentId);
        updateActiveAgents();

        // Animate steps
        let stepIdx = 0;
        const stepTimer = setInterval(() => {
            if (stepIdx < steps.length - 1) {
                tickStep(stepIdx);
                stepIdx++;
            }
        }, 1500);

        // Real progress callback — the polled job sends { progress, currentStep, stage }.
        // When the backend reports real progress, override the static step animation.
        let lastReportedProgress = 0;
        const onProgress = (job) => {
            if (typeof job.progress === 'number' && job.progress > lastReportedProgress) {
                lastReportedProgress = job.progress;
                progressBar.style.width = `${job.progress}%`;
                progressPercent.textContent = `${Math.round(job.progress)}%`;
                // Sync the step animation to the backend's currentStep.
                if (typeof job.currentStep === 'number' && job.currentStep > stepIdx) {
                    stepIdx = Math.min(job.currentStep - 1, steps.length - 1);
                    tickStep(stepIdx);
                }
            }
        };

        try {
            const result = await runAgentById(agentId, {
                videoUrl,
                videoId,
                prompt: command,
                ...extraInput,
            }, { signal: pollAbort.signal, onProgress });

            clearInterval(stepTimer);
            finishSteps();

            // Build a chat-friendly summary
            const data = result.result || result;
            let summary = '';
            if (data.summary) summary = data.summary;
            else if (Array.isArray(data.scenes)) summary = `Detected ${data.scenes.length} scenes.`;
            else if (Array.isArray(data.highlights)) summary = `Found ${data.highlights.length} highlights.`;
            else if (Array.isArray(data.results)) summary = `Found ${data.results.length} matches.`;
            else if (Array.isArray(data.segments)) summary = `Segmented into ${data.segments.length} clips.`;
            else if (data.transcription) summary = `Transcribed ${String(data.transcription).length} characters of audio.`;
            else if (data.srt) summary = `Generated SRT subtitles (${String(data.srt).length} chars).`;
            else if (data.dubbedVideo || data.url) summary = `Dubbed video ready.`;
            else if (data.upscaledVideo || data.sped || data.shorts) summary = `Video processed.`;
            else if (data.correctedVideo) summary = `Color-corrected video ready.`;
            else if (data.stabilizedVideo) summary = `Stabilized video ready.`;
            else if (data.timeline) summary = `Compiled timeline from collection.`;
            else if (data.meme) summary = `Meme concept: ${data.meme.caption || data.meme.topText || 'created'}`;
            else if (data.title) summary = `Title: ${data.title}`;
            else if (Array.isArray(data.shorts)) summary = `Created ${data.shorts.length} short(s).`;
            else if (Array.isArray(data.broll)) summary = `Found ${data.broll.length} B-roll clip(s).`;
            else if (data.reversed) summary = `Video reversed.`;
            else summary = `${agent.name} complete.`;

            addMessage(summary, { isAction: true });
            renderResult(result, agentId);
            addToHistory(command, agentId);
        } catch (err) {
            clearInterval(stepTimer);
            console.error('[Director]', err);
            const msg = err?.message || String(err);
            if (msg.includes('API key not configured') || /api[_\s-]?key|VIDEO_DB_API_KEY|OPENAI_API_KEY/i.test(msg)) {
                addMessage(`Missing API key. Add your VideoDB + OpenAI keys in Settings to use ${agent.name}.`, { isError: true });
            } else if (msg.includes('cancelled') || msg.includes('aborted')) {
                addMessage('Cancelled.', { isError: true });
            } else {
                addMessage(`${agent.name} failed: ${msg}`, { isError: true });
            }
        } finally {
            isProcessing = false;
            pollAbort = null;
            cancelBtn.classList.add('hidden');
            activeAgents.delete(agentId);
            updateActiveAgents();
            // Re-enable UI
            allBtns.forEach((b) => {
                b.disabled = false;
                b.classList.remove('opacity-50', 'pointer-events-none');
            });
            commandInput.disabled = false;
            commandInput.focus();
            setTimeout(() => {
                processingStatus.classList.add('hidden');
                progressBar.style.width = '0%';
                progressPercent.textContent = '0%';
            }, 1500);
        }
    }

    sendCommandBtn.onclick = () => processCommand(commandInput.value);
    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') processCommand(commandInput.value);
    });

    // Agent buttons
    container.querySelectorAll('.agent-btn').forEach(btn => {
        btn.onclick = async () => {
            if (isProcessing) return;
            const agentId = btn.dataset.agent;
            const agent = DIRECTOR_AGENTS.find(a => a.id === agentId);
            if (!agent) return;
            if (!videoUrl) {
                addMessage(`Please open Director with a video URL (from the Render studio) before running ${agent.name}.`, { isError: true });
                showToast('No video loaded', 'warning');
                return;
            }
            await processCommand(agent.description);
        };
    });

    // Quick action buttons
    container.querySelectorAll('.action-btn').forEach(btn => {
        btn.onclick = async () => {
            if (isProcessing) return;
            const action = btn.dataset.action;
            const map = {
                summarize: 'summarize this video',
                highlights: 'extract the best highlights',
                scenes: 'detect all scenes',
                subtitles: 'add subtitles',
                dubbing: 'dub to Spanish',
                broll: 'add B-roll',
                voiceover: 'add voiceover',
                shorts: 'create shorts for social media',
                color: 'color correct',
                stabilize: 'stabilize',
            };
            await processCommand(map[action] || action);
        };
    });

    return container;
}
