// Timeline AI tools. Request building is the app's own code (src/lib/muapi/frameModels.js, the same builders
// netlify/functions/timeline-ai.js uses), so these tools cannot drift from what the editor sends.
import { readFileSync } from 'node:fs';
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
    risk: 'read',
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
    risk: 'read',
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
    risk: 'destructive',
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
    risk: 'read',
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

// ── Video Pages (the app's landing-page data layer, run as the key's owner) ─────────────────────────
const PAGE_ID = z.string().regex(/^[A-Za-z0-9_-]{8,32}$/).describe('Page id from video_pages_list');
const pg = (client, body) => client.studio('pages', body);
customTools.push(
  { name: 'video_pages_templates', description: 'List the Video Page templates.', input: {}, run: (a, client) => pg(client, { action: 'templates' }) },
  { name: 'video_pages_list', description: 'List your Video Pages with their public links.', input: {}, run: (a, client) => pg(client, { action: 'list' }) },
  { name: 'video_pages_get', description: 'One Video Page with its link and embed code.', input: { id: PAGE_ID }, run: (a, client) => pg(client, { action: 'get', id: a.id }) },
  {
    name: 'video_pages_create',
    description: 'Create a draft Video Page around a video (https link). It is not public until video_pages_publish.',
    input: { title: z.string().max(200).optional(), video_url: url('Video'), poster_url: z.string().url().optional(), duration: z.number().optional(), template: z.string().optional().describe('Template id from video_pages_templates'), config: z.record(z.string(), z.unknown()).optional().describe('Page settings (sanitized by the app)') },
    run: (a, client) => pg(client, { action: 'create', ...a }),
  },
  { name: 'video_pages_update', description: 'Change a page title, poster or settings.', input: { id: PAGE_ID, title: z.string().max(200).optional(), poster_url: z.string().url().optional(), config: z.record(z.string(), z.unknown()).optional() }, run: (a, client) => pg(client, { action: 'update', ...a }) },
  { name: 'video_pages_publish', risk: 'publish', description: 'Make a Video Page public at its link.', input: { id: PAGE_ID }, run: (a, client) => pg(client, { action: 'publish', id: a.id }) },
  { name: 'video_pages_unpublish', description: 'Take a Video Page offline (it stays saved).', input: { id: PAGE_ID }, run: (a, client) => pg(client, { action: 'unpublish', id: a.id }) },
  { name: 'video_pages_delete', risk: 'destructive', description: 'Delete a Video Page and its stats.', input: { id: PAGE_ID }, run: (a, client) => pg(client, { action: 'delete', id: a.id }) },
  { name: 'video_pages_stats', description: 'Views, plays, completions, clicks and leads for a page, plus per-contact activity.', input: { id: PAGE_ID }, run: (a, client) => pg(client, { action: 'stats', id: a.id }) },
  { name: 'video_pages_contacts', description: 'Recipients of personalized links for a page.', input: { id: PAGE_ID }, run: (a, client) => pg(client, { action: 'contacts', id: a.id }) },
  { name: 'video_pages_add_contacts', description: 'Add recipients (up to 500 per call) for personalized links. Each contact is an object like { firstname, company, city }.', input: { id: PAGE_ID, contacts: z.array(z.record(z.string(), z.string())).min(1).max(500) }, run: (a, client) => pg(client, { action: 'add_contacts', id: a.id, contacts: a.contacts }) },
  { name: 'video_pages_remove_contact', risk: 'destructive', description: 'Remove a recipient.', input: { contact_id: z.string().min(6).max(40) }, run: (a, client) => pg(client, { action: 'remove_contact', contact_id: a.contact_id }) },
);

customTools.push({
  name: 'usage_info',
  description: 'Your SmartVid account at a glance: generation credit balance.',
  input: {},
  run: async (a, client) => ({ balance: await client.balance() }),
});

// ── Social publishing (upstream publish routes, run as the key's owner) ─────────────────────────────
const PLATFORM = z.enum(['youtube', 'tiktok', 'instagram']);
customTools.push(
  { name: 'social_accounts_list', description: 'Social accounts you have connected in SmartVid (connecting or removing accounts is done in the app).', input: {}, run: (a, client) => client.studio('social', { action: 'accounts' }) },
  {
    name: 'social_publish', risk: 'publish', timeoutMs: 120_000,
    description: 'Publish a video or image to one of your connected accounts. This posts publicly. The payload is the platform\'s post details (account id, media link, title or caption); see social_accounts_list for account ids. Returns a request id for social_publish_status.',
    input: { platform: PLATFORM, payload: z.record(z.string(), z.unknown()).describe('Post details, e.g. { account_id, video_url, title, caption }') },
    run: (a, client) => client.studio('social', { action: 'publish', platform: a.platform, payload: a.payload }),
  },
  { name: 'social_publish_status', description: 'Check a publish started with social_publish.', input: { request_id: z.string().min(6).max(80) }, run: (a, client) => client.studio('social', { action: 'status', request_id: a.request_id }) },
);

// ── Director (separately deployed backend; the gateway scopes its shared collections and sessions to the key's owner) ─────
const dir = (client, body) => client.studio('director', body);
const COLLECTION = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).describe('Collection id from director_collections_list');
const MEDIA_KIND = z.enum(['video', 'audio', 'image']);
const DIRECTOR_SESSION = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).describe('Session id returned by director_chat');
const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const DIRECTOR_RENDER_AGENTS = ['subtitle', 'scenes', 'highlight_reel', 'voiceover', 'dubbing', 'social'];

customTools.push(
  { name: 'director_health', description: 'Is the Director backend set up and reachable? Says "not configured" plainly when this deployment has none.', input: {}, run: (a, client) => dir(client, { action: 'health' }) },
  { name: 'director_config_check', description: 'Which Director features the backend has what it needs for (no secret values).', input: {}, run: (a, client) => dir(client, { action: 'config_check' }) },
  {
    name: 'director_agents_list',
    description: 'The Director studio\'s agents as the app lists them, plus the ones that can be run directly (render_agents). Listing an agent does not mean it can be run here: only render_agents run through director_run_agent; the rest are reachable by name through director_chat.',
    input: {},
    run: async () => ({ render_agents: DIRECTOR_RENDER_AGENTS, agents: readJson('./director-agents.json') }),
  },
  {
    name: 'director_run_agent', timeoutMs: 300_000,
    description: 'Run one finishing agent directly on a video in one of your collections: subtitle, scenes, highlight_reel, voiceover, dubbing, social. Params are the agent\'s own options.',
    input: { agent: z.enum(DIRECTOR_RENDER_AGENTS), collection_id: COLLECTION, video_id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), params: z.record(z.string(), z.unknown()).optional() },
    run: (a, client) => dir(client, { action: 'render_agent', agent: a.agent, collection_id: a.collection_id, video_id: a.video_id, params: a.params }),
  },
  {
    name: 'director_chat', timeoutMs: 300_000,
    description: 'Ask Director in plain language to work on media in one of your collections. Returns a session_id; pass it back to continue the conversation. Optionally restrict which agents may be used.',
    input: { text: z.string().min(1).max(4000), collection_id: COLLECTION, session_id: DIRECTOR_SESSION.optional(), agents: z.array(z.string().regex(/^[a-z0-9_]{1,40}$/)).max(10).optional() },
    run: (a, client) => dir(client, { action: 'agent_chat', text: a.text, collection_id: a.collection_id, session_id: a.session_id, agents: a.agents }),
  },
  {
    name: 'director_workflow',
    description: 'Send a list of steps ({ agent, params }) to Director\'s workflow endpoint. The backend records the steps; it does not run them for you.',
    input: { steps: z.array(z.object({ agent: z.string().max(40), params: z.record(z.string(), z.unknown()).optional() })).min(1).max(20), command: z.string().max(500).optional() },
    run: (a, client) => dir(client, { action: 'workflow', steps: a.steps, command: a.command }),
  },
  { name: 'director_collections_list', description: 'Your Director media collections (other people\'s are never shown).', input: {}, run: (a, client) => dir(client, { action: 'collections_list' }) },
  { name: 'director_collection_get', description: 'One of your collections.', input: { collection_id: COLLECTION }, run: (a, client) => dir(client, { action: 'collection_get', collection_id: a.collection_id }) },
  { name: 'director_collection_create', description: 'Create a media collection for Director.', input: { name: z.string().min(1).max(80), description: z.string().min(1).max(300) }, run: (a, client) => dir(client, { action: 'collection_create', name: a.name, description: a.description }) },
  { name: 'director_collection_delete', risk: 'destructive', description: 'Delete one of your collections and everything in it.', input: { collection_id: COLLECTION }, run: (a, client) => dir(client, { action: 'collection_delete', collection_id: a.collection_id }) },
  { name: 'director_media_list', description: 'List the videos, audio or images in one of your collections.', input: { collection_id: COLLECTION, kind: MEDIA_KIND }, run: (a, client) => dir(client, { action: 'media_list', collection_id: a.collection_id, kind: a.kind }) },
  { name: 'director_media_get', description: 'One item in a collection.', input: { collection_id: COLLECTION, kind: MEDIA_KIND, media_id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/) }, run: (a, client) => dir(client, { action: 'media_get', collection_id: a.collection_id, kind: a.kind, media_id: a.media_id }) },
  { name: 'director_media_url', description: 'A fresh link for an image or audio item.', input: { collection_id: COLLECTION, kind: z.enum(['audio', 'image']), media_id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/) }, run: (a, client) => dir(client, { action: 'media_url', collection_id: a.collection_id, kind: a.kind, media_id: a.media_id }) },
  { name: 'director_media_delete', risk: 'destructive', description: 'Delete one item from one of your collections.', input: { collection_id: COLLECTION, kind: MEDIA_KIND, media_id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/) }, run: (a, client) => dir(client, { action: 'media_delete', collection_id: a.collection_id, kind: a.kind, media_id: a.media_id }) },
  { name: 'director_upload', timeoutMs: 300_000, description: 'Add a video, audio or image to one of your collections from a public https link.', input: { collection_id: COLLECTION, source_url: url('Media') }, run: (a, client) => dir(client, { action: 'upload', collection_id: a.collection_id, source_url: a.source_url }) },
  { name: 'director_sessions_list', description: 'Your Director conversations.', input: {}, run: (a, client) => dir(client, { action: 'sessions_list' }) },
  { name: 'director_session_get', description: 'One Director conversation with its messages.', input: { session_id: DIRECTOR_SESSION }, run: (a, client) => dir(client, { action: 'session_get', session_id: a.session_id }) },
  { name: 'director_session_delete', risk: 'destructive', description: 'Delete one of your Director conversations.', input: { session_id: DIRECTOR_SESSION }, run: (a, client) => dir(client, { action: 'session_delete', session_id: a.session_id }) },
);
