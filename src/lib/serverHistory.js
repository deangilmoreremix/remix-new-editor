// Server-side MuAPI history (GET /history) folded into the Library. The
// response shape isn't documented, so this reads the common field names and
// ignores anything it can't make sense of; callers treat failure as "no extras".

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i;

export function normalizeServerHistory(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.items || payload?.history || payload?.results || [];
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    const url = row?.url
      || (Array.isArray(row?.outputs) ? row.outputs[0] : undefined)
      || row?.output
      || row?.result?.url
      || row?.result?.outputs?.[0];
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue;
    out.push({
      id: row.request_id || row.id || url,
      requestId: row.request_id || row.id,
      url,
      type: VIDEO_RE.test(url) ? 'video' : AUDIO_RE.test(url) ? 'audio' : 'image',
      prompt: row.prompt || row.input?.prompt || row.payload?.prompt || '',
      model: row.model || row.endpoint || row.task_name || '',
      timestamp: row.created_at || row.createdAt || row.timestamp || null,
      source: 'server',
    });
  }
  return out;
}

/** Local items first; server items are added only when their URL isn't already present. */
export function mergeServerHistory(localItems, serverItems) {
  const seen = new Set(localItems.map((i) => i.url).filter(Boolean));
  const extras = serverItems.filter((i) => !seen.has(i.url));
  return [...localItems, ...extras].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

export async function fetchServerHistory(client, { limit = 50, timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return normalizeServerHistory(await client.getHistory({ limit }, controller.signal));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
