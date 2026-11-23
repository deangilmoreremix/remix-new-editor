// Timeline AI tools. Request building is the app's own code (src/lib/muapi/frameModels.js, the same builders
// netlify/functions/timeline-ai.js uses), so these tools cannot drift from what the editor sends.
import { z } from '../packages/studio-mcp-core/src/index.js';
import {
  FIRST_LAST_FRAME_MODELS, VIDEO_EXTEND_MODELS, MUSIC_MODELS, LAYER_MODELS, WATERMARK_MODELS,
  buildFirstLastFramePayload, buildVideoExtendPayload, buildExtendBeforePayload, buildMusicPayload, buildLayerPayload, buildWatermarkPayload,
} from '../src/lib/muapi/frameModels.js';

const keys = (t) => Object.keys(t);
const oneOf = (t) => z.enum(keys(t)).optional().describe(`One of: ${keys(t).join(', ')}`);
const url = (what) => z.string().url().describe(`${what} (public https URL; use upload_file for local files)`);

export const customTools = [
  {
    name: 'video_fill_gap', timeoutMs: 600_000,
    description: 'Generate a clip that bridges two frames (first + last frame to video). With only one frame, it is used for both ends.',
    input: { first_frame_url: url('First frame').optional(), last_frame_url: url('Last frame').optional(), prompt: z.string().optional(), duration: z.number().optional().describe('Seconds (clamped to the model range)'), resolution: z.string().optional(), model: oneOf(FIRST_LAST_FRAME_MODELS) },
    build: (a) => buildFirstLastFramePayload({ model: a.model, firstFrameUrl: a.first_frame_url, lastFrameUrl: a.last_frame_url, prompt: a.prompt, duration: a.duration, resolution: a.resolution }),
  },
  {
    name: 'video_extend', timeoutMs: 600_000,
    description: 'Extend a clip: direction "after" continues it from its own video; "before" animates a lead-in that ends on its first frame.',
    input: { direction: z.enum(['after', 'before']).describe('Extend after or before the clip'), video_url: url('Clip video (direction=after)').optional(), first_frame_url: url('Clip first frame (direction=before)').optional(), prompt: z.string().optional(), duration: z.number().optional(), model: z.string().optional().describe(`after: ${keys(VIDEO_EXTEND_MODELS).join(', ')}; before: ${keys(FIRST_LAST_FRAME_MODELS).join(', ')}`) },
    build: (a) => (a.direction === 'before'
      ? buildExtendBeforePayload({ model: a.model, firstFrameUrl: a.first_frame_url, prompt: a.prompt, duration: a.duration })
      : buildVideoExtendPayload({ model: a.model, videoUrl: a.video_url, prompt: a.prompt, duration: a.duration })),
  },
  {
    name: 'video_remove_watermark', timeoutMs: 600_000,
    description: 'Remove a watermark from a video.',
    input: { video_url: url('Video'), model: oneOf(WATERMARK_MODELS) },
    build: (a) => buildWatermarkPayload({ model: a.model, videoUrl: a.video_url }),
  },
  {
    name: 'image_layers', timeoutMs: 300_000,
    description: 'Split an image into separate transparent layers (foreground, mid-ground, background).',
    input: { image_url: url('Image'), prompt: z.string().optional(), model: oneOf(LAYER_MODELS) },
    build: (a) => buildLayerPayload({ model: a.model, imageUrl: a.image_url, prompt: a.prompt }),
  },
  {
    name: 'music_create', timeoutMs: 300_000,
    description: 'Create a music track. Instrumental from a description, or with vocals when lyrics are given (then style tags are used).',
    input: { prompt: z.string().optional().describe('Describe the music (instrumental)'), lyrics: z.string().optional(), style: z.string().optional().describe('Style tags, e.g. "cinematic orchestral"'), title: z.string().optional(), duration: z.number().optional().describe('Seconds, 10-180'), model: oneOf(MUSIC_MODELS) },
    build: (a) => buildMusicPayload({ model: a.model, prompt: a.prompt, lyrics: a.lyrics, style: a.style, title: a.title, duration: a.duration, instrumental: !a.lyrics }),
  },
];

// ── Zack D studio (netlify/functions/zackd.js, run as the key's owner) ──────────────────────────────
// The studio function speaks { action: 'trends' | 'script' | 'submit' | 'status' }; the gateway returns its own JSON.
async function zackdWait(client, requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await client.studio('zackd', { action: 'status', requestId });
    if (r.status === 'done') return { status: 'completed', request_id: requestId, url: r.url };
    if (r.status === 'failed') return { status: 'failed', request_id: requestId, error: r.error };
    if (Date.now() >= deadline) return { status: 'processing', request_id: requestId };
    await client.sleep(4000);
  }
}

customTools.push(
  {
    name: 'zackd_trends',
    description: 'Zack D studio: suggest trending topics for a curiosity-loop short (needs your OpenAI key saved in Settings).',
    input: { query: z.string().max(200).optional().describe('Niche or keyword') },
    run: (a, client) => client.studio('zackd', { action: 'trends', query: a.query }),
  },
  {
    name: 'zackd_script',
    description: 'Zack D studio: turn a topic into a beat map (script with visual and narration per beat).',
    input: { topic: z.string().min(1).max(200), max_beats: z.number().int().min(2).max(12).optional() },
    run: (a, client) => client.studio('zackd', { action: 'script', topic: a.topic, maxBeats: a.max_beats }),
  },
  {
    name: 'zackd_submit',
    description: 'Zack D studio: make one media asset. kind=image (prompt), clip (image_url + prompt), tts (text), music (prompt or mood), captions (video_url). Waits for the result unless wait=false.',
    input: {
      kind: z.enum(['image', 'clip', 'tts', 'music', 'captions']),
      prompt: z.string().optional(), text: z.string().optional(), mood: z.string().optional(), voice: z.string().optional(),
      image_url: z.string().url().optional(), video_url: z.string().url().optional(),
      aspect: z.enum(['9:16', '16:9', '1:1']).optional(), duration: z.number().optional(), language: z.string().optional(), theme: z.string().optional(),
      wait: z.boolean().optional().describe('Wait for the result (default true)'),
    },
    run: async (a, client) => {
      const body = { action: 'submit', kind: a.kind, prompt: a.prompt, text: a.text, mood: a.mood, voice: a.voice, imageUrl: a.image_url, videoUrl: a.video_url, aspect: a.aspect, duration: a.duration, language: a.language, theme: a.theme };
      const r = await client.studio('zackd', body);
      if (r.status === 'done') return { status: 'completed', url: r.url };
      if (!r.requestId) return r;
      return a.wait === false ? { status: 'processing', request_id: r.requestId } : zackdWait(client, r.requestId, 600_000);
    },
  },
  {
    name: 'zackd_status',
    description: 'Zack D studio: check a media job started with zackd_submit.',
    input: { request_id: z.string().min(4).max(128) },
    run: (a, client) => zackdWait(client, a.request_id, 0),
  },
);

// ── Brand Studio site scraper (netlify/functions/brand-scrape.mts) ───────────────────────────────────
// Returns the scraped brand data (text, colours, images). The base64 screenshot is dropped unless asked for.
customTools.push({
  name: 'brand_scrape',
  description: 'Scrape a public website for brand information (copy, colours, logos, images) to feed brand and campaign writing. Pair with text_generate or vision_describe to analyse it.',
  input: { url: z.string().url().describe('Public website address'), include_screenshot: z.boolean().optional().describe('Include the page screenshot as base64 (large)') },
  run: async (a, client) => {
    const r = await client.studio('brand-scrape', { url: a.url });
    if (r?.data && !a.include_screenshot) { const { screenshot, ...rest } = r.data; return { ok: r.ok, data: { ...rest, screenshot: screenshot ? '(omitted; pass include_screenshot=true)' : undefined } }; }
    return r;
  },
});

// ── Voiceover (netlify/functions/agent-audio.js, run as the key's owner) ─────────────────────────────
async function audioWait(client, requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await client.studio('agent-audio', { action: 'status', requestId });
    if (r.status === 'done') return { status: 'completed', request_id: requestId, url: r.url };
    if (r.status === 'failed') return { status: 'failed', request_id: requestId, error: r.error };
    if (Date.now() >= deadline) return { status: 'processing', request_id: requestId };
    await client.sleep(3000);
  }
}

customTools.push({
  name: 'voiceover_create',
  description: 'Narrate text with a natural voice (MiniMax voices by default; provider "openai" uses your OpenAI key and returns the audio as a data URL). Max 3000 characters.',
  input: {
    text: z.string().min(1).max(3000),
    voice: z.string().optional().describe('e.g. Wise_Woman, Deep_Voice_Man, Calm_Woman (OpenAI: marin, alloy, nova...)'),
    speed: z.number().min(0.25).max(4).optional(), pitch: z.number().int().min(-12).max(12).optional(),
    provider: z.enum(['minimax', 'openai']).optional(), instructions: z.string().max(500).optional().describe('OpenAI only: how to speak'),
    wait: z.boolean().optional().describe('Wait for the result (default true)'),
  },
  run: async (a, client) => {
    const r = await client.studio('agent-audio', { action: 'submit', kind: 'tts', text: a.text, voice: a.voice, speed: a.speed, pitch: a.pitch, provider: a.provider === 'openai' ? 'openai' : undefined, instructions: a.instructions });
    if (r.status === 'done') return { status: 'completed', url: r.url };
    if (!r.requestId) return r;
    return a.wait === false ? { status: 'processing', request_id: r.requestId } : audioWait(client, r.requestId, 300_000);
  },
});

// ── Lead Finder and website discovery (netlify/functions/_shared/personalizationRun.mts) ───────────────
// The app's own route handlers run as the key's owner; the gateway allow-lists the paths (see ALLOWED_ROUTES there).
const pz = (client, method, path, extra = {}) => client.studio('personalization', { method, path, ...extra });
const STAGES = ['New', 'Qualified', 'Shortlisted', 'Demo Created', 'Contacted', 'Responded', 'Converted', 'Not Interested'];
const ID80 = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);

async function discoverWait(client, jobId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await pz(client, 'GET', '/discover-assets/status', { query: { jobId } });
    const st = String(r.status || '').toLowerCase();
    if (['complete', 'completed', 'done', 'error', 'failed'].includes(st) || r.error) return { job_id: jobId, ...r };
    if (Date.now() >= deadline) return { status: 'processing', job_id: jobId };
    await client.sleep(3000);
  }
}

customTools.push(
  {
    name: 'leads_list',
    description: 'List your saved Lead Finder leads (business, pipeline stage, notes, starred).',
    input: {},
    run: (a, client) => pz(client, 'GET', '/leads'),
  },
  {
    name: 'leads_save',
    description: 'Save a business as a lead. `business` is a record from businesses_find (needs at least id and name).',
    input: { business: z.record(z.any()).describe('A business record from businesses_find'), stage: z.enum(STAGES).optional(), notes: z.string().max(5000).optional() },
    run: (a, client) => pz(client, 'POST', '/leads', { body: { business: a.business, stage: a.stage, notes: a.notes } }),
  },
  {
    name: 'leads_update',
    description: 'Change a lead\'s pipeline stage, notes or starred flag (at least one).',
    input: { lead_id: ID80, stage: z.enum(STAGES).optional(), notes: z.string().max(5000).optional(), starred: z.boolean().optional() },
    run: (a, client) => pz(client, 'PATCH', `/leads/${a.lead_id}`, { body: { stage: a.stage, notes: a.notes, starred: a.starred } }),
  },
  {
    name: 'leads_delete',
    description: 'Delete a saved lead.',
    input: { lead_id: ID80 },
    run: (a, client) => pz(client, 'DELETE', `/leads/${a.lead_id}`),
  },
  {
    name: 'businesses_find',
    description: 'Find local businesses of one niche near a location (Lead Finder search). If the niche is not supported the error lists the supported ones.',
    input: { niche: z.string().min(1).max(60), location: z.string().min(2).max(120).describe('e.g. "Austin, TX"'), radius_miles: z.number().min(1).max(100).optional(), limit: z.number().int().min(1).max(50).optional(), include_chains: z.boolean().optional() },
    run: (a, client) => pz(client, 'POST', '/find-businesses', { body: { niche: a.niche, location: a.location, radiusMiles: a.radius_miles, limit: a.limit, includeChains: a.include_chains } }),
  },
  {
    name: 'business_research',
    description: 'Research a business from its website: what it does, offers and contact details.',
    input: { website_url: z.string().url() },
    run: (a, client) => pz(client, 'POST', '/research-business', { body: { websiteUrl: a.website_url } }),
  },
  {
    name: 'business_contact_enrich',
    description: 'Find contact details for a business from its own website, or (with no website) find its website from its name and place.',
    input: {
      website_url: z.string().url().optional(),
      name: z.string().max(200).optional().describe('Business name (to find its website)'), city: z.string().max(100).optional(), region: z.string().max(100).optional(),
      postal_code: z.string().max(20).optional(), phone: z.string().max(40).optional(), email: z.string().max(200).optional(),
    },
    run: async (a, client) => {
      if (a.website_url) return pz(client, 'POST', '/enrich-business', { body: { websiteUrl: a.website_url } });
      if (!a.name) throw Object.assign(new Error('Provide website_url, or a business name to find its website.'), { code: 'BAD_INPUT' });
      return pz(client, 'POST', '/resolve-website', { body: { name: a.name, city: a.city, region: a.region, postalCode: a.postal_code, phone: a.phone, email: a.email } });
    },
  },
  {
    name: 'brand_assets_discover',
    description: 'Find a website\'s logo, brand colours, images and avatar (Brand discovery). Starts a job and waits for it unless wait=false.',
    input: { website_url: z.string().url(), wait: z.boolean().optional().describe('Wait for the result (default true)') },
    run: async (a, client) => {
      const r = await pz(client, 'POST', '/discover-assets', { body: { websiteUrl: a.website_url } });
      const id = r.jobId || r.job_id;
      if (String(r.status).toLowerCase() === 'complete' || !id) return r;
      return a.wait === false ? { status: 'processing', job_id: id } : discoverWait(client, id, 120_000);
    },
  },
  {
    name: 'brand_assets_status',
    description: 'Check a brand discovery job started with brand_assets_discover.',
    input: { job_id: ID80 },
    run: (a, client) => discoverWait(client, a.job_id, 0),
  },
  {
    name: 'find_my_brand',
    description: 'Free brand discovery sample for a website (logo, colours, images). Lower limits than brand_assets_discover.',
    input: { website_url: z.string().url() },
    run: (a, client) => pz(client, 'POST', '/demo/discover', { body: { websiteUrl: a.website_url } }),
  },
);
