/**
 * Personalized Smart Speech on the published player: asks /api/watch-voice
 * to speak a clip's line with the viewer's link values (?firstname=Ann).
 * Any failure returns null, and the clip keeps its fallback audio.
 */
export const VOICE_ENDPOINT = '/api/watch-voice';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenNames = (text) => [...String(text || '').matchAll(/\{\{\s*(?:d\s+)?([a-zA-Z0-9_ -]+?)(?:\s+"[^"]*")?\s*\}\}/g)].map((m) => m[1]);
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The link values a line needs, or null when one is missing (keep the fallback). */
export function tokensForLine(text, profile) {
  const vars = {};
  Object.entries(profile?.variables || {}).forEach(([k, v]) => { if (v) vars[norm(k)] = String(v); });
  const out = {};
  for (const name of tokenNames(text)) {
    const v = vars[norm(name)];
    if (!v && !new RegExp(`\\{\\{\\s*d\\s+${name}\\s+"`).test(text)) return null;
    if (v) out[norm(name)] = v.slice(0, 40);
  }
  return out;
}

export async function fetchPersonalVoice({ publishedId, clip, profile }, { fetchImpl = fetch, pollMs = 1500, timeoutMs = 45_000 } = {}) {
  if (!publishedId || !clip?.tts?.personalized) return null;
  const tokens = tokensForLine(clip.tts.text, profile);
  if (!tokens) return null;
  const post = async (body) => {
    const res = await fetchImpl(VOICE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    return res.ok && data?.ok ? data : null;
  };
  try {
    const first = await post({ action: 'submit', publishedId, clipId: String(clip.id), tokens });
    if (!first) return null;
    if (first.status === 'done') return first.url || null;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await sleep(pollMs);
      const s = await post({ action: 'status', requestId: first.requestId, cacheKey: first.cacheKey });
      if (s?.status === 'done') return s.url || null;
      if (!s || s.status === 'failed') return null;
    }
  } catch { /* network: keep the fallback */ }
  return null;
}

/** True when a published project uses Smart Speech or AI voiceovers. */
export const usesAiVoice = (project) => (project?.tracks || []).some((t) => (t.items || t.clips || []).some((c) => c.tts || c.role === 'voiceover'));
