// src/lib/social/postWriter.js
//
// AI writer for the "Schedule post" window: from the picture or video being posted, the platforms
// picked, a tone and a language, drafts one caption and its hashtags. One small text request on the
// user's MuAPI key (the same one the Outreach writer uses), made only when they click Write.
// Prompts and parsing are plain functions; the request itself is passed in (`generate`).

export const POST_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', limit: 2200 },
  { id: 'tiktok', name: 'TikTok', limit: 2200 },
  { id: 'youtube', name: 'YouTube', limit: 5000 },
  { id: 'facebook', name: 'Facebook', limit: 2200 },
  { id: 'linkedin', name: 'LinkedIn', limit: 3000 },
  { id: 'twitter', name: 'X (Twitter)', limit: 280 },
];

export const POST_TONES = ['Friendly', 'Professional', 'Playful', 'Bold', 'Inspirational'];

const MAX_HASHTAGS = 12;
const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Longest caption (hashtags included) every picked platform accepts. */
export function captionLimit(platformIds = []) {
  const limits = POST_PLATFORMS.filter((p) => platformIds.includes(p.id)).map((p) => p.limit);
  return limits.length ? Math.min(...limits) : 2200;
}

/** One hashtag, cleaned: no #, no spaces or symbols, at most 30 characters. '' when nothing is left. */
export function cleanHashtag(tag) {
  return String(tag ?? '').replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 30);
}

/** Hashtags as the window stores them: cleaned, unique, capped. Accepts an array or text like "#a #b, c". */
export function normalizeHashtags(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(/[\s,]+/);
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const tag = cleanHashtag(raw);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

/** The request. `media` = { type: 'image'|'video', prompt?: string } describes what is being posted. */
export function buildPostPrompt({ platforms = [], tone = 'Friendly', language = 'English', media = {}, topic = '' } = {}) {
  const picked = POST_PLATFORMS.filter((p) => platforms.includes(p.id));
  const names = picked.length ? picked.map((p) => p.name).join(', ') : 'social media';
  const limit = captionLimit(platforms);
  const tag = POST_TONES.includes(tone) ? tone : 'Friendly';
  const kind = media.type === 'video' ? 'video' : 'image';
  const about = clean(topic, 400) || clean(media.prompt, 400) || `a new ${kind}`;
  const budget = Math.max(40, limit - 120); // room left for the hashtags on the shortest platform
  return {
    prompt: [
      `Write a social media post for a ${kind}.`,
      `What it shows: ${about}`,
      `Platforms: ${names}. Tone: ${tag}. Write in ${clean(language, 40) || 'English'}.`,
      `The caption starts with a hook, stays under ${budget} characters, and may use at most two emojis. Do not put hashtags in the caption.`,
      `Then give ${Math.min(MAX_HASHTAGS, 8)} relevant hashtags without the # sign.`,
      'Reply with JSON only: {"caption": "...", "hashtags": ["...", "..."]}',
    ].join('\n'),
    maxChars: limit,
  };
}

const jsonIn = (text) => {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
};

/** The reply → { caption, hashtags } that fits `maxChars` with its hashtags. Throws when the reply is unusable. */
export function parsePostReply(text, { maxChars = 2200 } = {}) {
  const j = jsonIn(text);
  if (!j || typeof j.caption !== 'string' || !j.caption.trim()) throw new Error('The AI reply was not a usable post. Try again.');
  const hashtags = normalizeHashtags(j.hashtags);
  let caption = j.caption.replace(/\\n/g, '\n').replace(/#[\p{L}\p{N}_]+/gu, '').replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim();
  // Hashtags are appended on publish ("#a #b"): keep the whole post under the limit.
  const tagChars = hashtags.reduce((n, t) => n + t.length + 2, 0);
  const room = Math.max(20, maxChars - tagChars - 2);
  if (caption.length > room) caption = `${caption.slice(0, room - 1).trimEnd()}…`;
  return { caption, hashtags };
}

/** Write one post: builds the prompt, asks `generate(prompt, signal)`, parses the reply. */
export async function writePostWithAI(input = {}, { generate, signal } = {}) {
  const gen = generate || (await import('../outreach/aiWriter.js')).muapiGenerate;
  const { prompt, maxChars } = buildPostPrompt(input);
  return parsePostReply(await gen(prompt, signal), { maxChars });
}
