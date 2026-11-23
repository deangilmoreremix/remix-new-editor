// Director for the MCP: a gateway studio in front of the separately deployed Director backend (apps/director/backend, DIRECTOR_API_URL).
//
// The backend has NO accounts: its session list and its media collections are shared by everyone who can reach it, and its routes trust
// whatever ids they are given. So this module is the isolation layer. For a key's owner it:
//   - creates collections with the owner's tag in their name and only ever shows, reads, writes or deletes collections that carry it
//     (every collection id is checked against its name first; unknown or someone else's -> 404, same as "not found");
//   - makes every session and conversation id start with the owner's tag, checks that tag before reading or deleting a session, and
//     never calls the backend's "list all sessions" route without filtering the answer;
//   - only forwards an explicit allow-list of routes, with validated ids, size-capped bodies and https-only media links;
//   - needs a collection for every agent run, so an agent can never fall back to the backend's shared default collection.
// The owner tag is a hash of the verified key owner's user id, added by the gateway; nothing in a request can name another owner.
// Responses are scrubbed of provider names and of anything that looks like a key or token.
import { createHash, randomBytes } from 'node:crypto';

const ok = (data, statusCode = 200) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const err = (statusCode, message, code) => ok({ error: { message, ...(code ? { code } : {}) } }, statusCode);

export const RENDER_AGENTS = ['subtitle', 'scenes', 'highlight_reel', 'voiceover', 'dubbing', 'social'];
export const MEDIA_KINDS = ['video', 'audio', 'image'];

// risk per action; the gateway's classifier reads this table, never the caller.
export const DIRECTOR_ACTIONS = {
  health: 'read', config_check: 'read',
  collections_list: 'read', collection_get: 'read', collection_create: 'write', collection_delete: 'destructive',
  media_list: 'read', media_get: 'read', media_url: 'read', media_delete: 'destructive', upload: 'write',
  render_agent: 'write', agent_chat: 'write', workflow: 'write',
  session_get: 'read', sessions_list: 'read', session_delete: 'destructive',
};

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const AGENT_NAME = /^[a-z0-9_]{1,40}$/;
const MAX_TEXT = 4000;
const MAX_STEPS = 20;
const MAX_BODY_BYTES = 64 * 1024;
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;

export const ownerTag = (userId) => `sv-${createHash('sha256').update(`director|${userId}`).digest('hex').slice(0, 16)}`;

function validMediaUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && !PRIVATE_HOST.test(u.hostname) && u.hostname.includes('.') && String(raw).length <= 2000;
  } catch { return false; }
}

/** The backend's address from the environment, or null. https only (http only for localhost development). */
export function directorBase(env = process.env) {
  const raw = String(env.DIRECTOR_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return raw;
  } catch { /* fall through */ }
  return null;
}

const PROVIDER = [[/video-?db/gi, 'media library'], [/mu-?api(\.ai|app)?/gi, 'SmartVid'], [/fal\.ai/gi, 'SmartVid']];
const SECRETISH = /(^|_)(key|api_?key|token|secret|password|authorization|credential)s?$/i;
export function scrubDirector(value) {
  if (typeof value === 'string') return PROVIDER.reduce((s, [re, to]) => s.replace(re, to), value);
  if (Array.isArray(value)) return value.map(scrubDirector);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRETISH.test(k)).map(([k, v]) => [k, scrubDirector(v)]));
  }
  return value;
}

/**
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} [deps]
 */
export function createDirectorStudio({ env = process.env, fetchImpl = fetch } = {}) {
  async function backend(base, path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(env.DIRECTOR_API_TOKEN ? { Authorization: `Bearer ${env.DIRECTOR_API_TOKEN}` } : {}) };
    const res = await fetchImpl(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(25_000) });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text.slice(0, 200) }; }
    return { status: res.status, data };
  }

  return async function director(input, who) {
    if (!who?.userId || who.userId === 'byok') return err(401, 'This needs a signed-in SmartVid MCP key.');
    const action = String(input?.action || '');
    if (!Object.hasOwn(DIRECTOR_ACTIONS, action)) return err(400, `Unknown action "${action.slice(0, 40)}".`);
    if (JSON.stringify(input).length > MAX_BODY_BYTES) return err(413, 'That request is too large.');

    const base = directorBase(env);
    if (!base) {
      if (action === 'health') return ok({ configured: false, status: 'not_configured', message: 'Director is not set up on this deployment (DIRECTOR_API_URL is not set).' });
      return err(503, 'Director is not set up on this deployment.', 'not_configured');
    }

    const tag = ownerTag(who.userId);
    const mine = (name) => typeof name === 'string' && name.startsWith(`${tag}-`);
    const publicName = (name) => (mine(name) ? name.slice(tag.length + 1) : name);
    const sessionMine = (id) => typeof id === 'string' && id.startsWith(`${tag}-`);
    const cid = input?.collection_id;

    // Is this collection one of the owner's? Anything else looks like "not found".
    async function ownsCollection(id) {
      if (!ID.test(String(id || ''))) return false;
      const { status, data } = await backend(base, `/videodb/collection/${encodeURIComponent(id)}`);
      return status === 200 && mine(data?.name);
    }
    const collectionGuard = async () => (await ownsCollection(cid) ? null : err(404, 'No such collection.'));
    const send = (r, shape = (d) => d) => (r.status >= 400
      ? err(r.status >= 500 ? 502 : r.status, scrubDirector(String(r.data?.message || r.data?.error || 'Director could not do that.')).slice(0, 300))
      : ok(scrubDirector(shape(r.data))));

    try {
      switch (action) {
        case 'health': {
          const r = await backend(base, '/health');
          return ok(scrubDirector({ configured: true, status: r.status === 200 ? 'ok' : 'unreachable', config: r.data?.config }));
        }
        case 'config_check': return send(await backend(base, '/config/check'));

        case 'collections_list': {
          const r = await backend(base, '/videodb/collection');
          return send(r, (d) => ({ collections: (Array.isArray(d) ? d : []).filter((c) => mine(c?.name)).map((c) => ({ id: c.id, name: publicName(c.name), description: c.description })) }));
        }
        case 'collection_get': {
          if (!ID.test(String(cid || ''))) return err(400, 'collection_id is required.');
          const r = await backend(base, `/videodb/collection/${encodeURIComponent(cid)}`);
          if (r.status !== 200 || !mine(r.data?.name)) return err(404, 'No such collection.');
          return ok(scrubDirector({ id: r.data.id, name: publicName(r.data.name), description: r.data.description }));
        }
        case 'collection_create': {
          const name = String(input?.name || '').trim(); const description = String(input?.description || '').trim();
          if (!name || name.length > 80) return err(400, 'A name (80 characters or fewer) is required.');
          if (!description || description.length > 300) return err(400, 'A description (300 characters or fewer) is required.');
          return send(await backend(base, '/videodb/collection', { method: 'POST', body: { name: `${tag}-${name}`, description } }),
            (d) => ({ collection: { id: d?.data?.collection?.id, name, description } }));
        }
        case 'collection_delete': {
          const g = await collectionGuard(); if (g) return g;
          return send(await backend(base, `/videodb/collection/${encodeURIComponent(cid)}`, { method: 'DELETE' }), () => ({ deleted: true }));
        }

        case 'media_list': case 'media_get': case 'media_url': case 'media_delete': {
          const kind = String(input?.kind || '');
          if (!MEDIA_KINDS.includes(kind)) return err(400, `kind must be one of ${MEDIA_KINDS.join(', ')}.`);
          const g = await collectionGuard(); if (g) return g;
          const mid = input?.media_id;
          if (action !== 'media_list' && !ID.test(String(mid || ''))) return err(400, 'media_id is required.');
          if (action === 'media_url' && kind === 'video') return err(400, 'Signed links are only available for images and audio.');
          const base2 = `/videodb/collection/${encodeURIComponent(cid)}/${kind}`;
          if (action === 'media_list') return send(await backend(base, base2));
          if (action === 'media_get') return send(await backend(base, `${base2}/${encodeURIComponent(mid)}`));
          if (action === 'media_url') return send(await backend(base, `${base2}/${encodeURIComponent(mid)}/generate_url`));
          return send(await backend(base, `${base2}/${encodeURIComponent(mid)}`, { method: 'DELETE' }), () => ({ deleted: true }));
        }
        case 'upload': {
          const g = await collectionGuard(); if (g) return g;
          if (!validMediaUrl(input?.source_url)) return err(400, 'source_url must be a public https URL.');
          return send(await backend(base, `/videodb/collection/${encodeURIComponent(cid)}/upload`, { method: 'POST', body: { source: input.source_url, source_type: 'url' } }));
        }

        case 'render_agent': {
          const agent = String(input?.agent || '');
          if (!RENDER_AGENTS.includes(agent)) return err(400, `agent must be one of ${RENDER_AGENTS.join(', ')}.`);
          if (!ID.test(String(input?.video_id || ''))) return err(400, 'video_id is required.');
          const g = await collectionGuard(); if (g) return g;
          const params = input?.params && typeof input.params === 'object' && !Array.isArray(input.params) ? input.params : {};
          // the backend takes ids from the body; ours always win over anything inside params
          const { collection_id: _c, video_id: _v, session_id: _s, conv_id: _cv, ...safeParams } = params;
          return send(await backend(base, `/api/render/agent/${agent}`, { method: 'POST', body: { session_id: `${tag}-${randomBytes(6).toString('hex')}`, conv_id: `${tag}-${randomBytes(6).toString('hex')}`, collection_id: cid, video_id: input.video_id, params: safeParams } }));
        }
        case 'agent_chat': {
          const text = String(input?.text || '').trim();
          if (!text || text.length > MAX_TEXT) return err(400, `text is required (up to ${MAX_TEXT} characters).`);
          const g = await collectionGuard(); if (g) return g;
          let session = input?.session_id;
          if (session !== undefined && !(typeof session === 'string' && ID.test(session) && sessionMine(session))) return err(404, 'No such session.');
          session = session || `${tag}-${randomBytes(6).toString('hex')}`;
          const agents = Array.isArray(input?.agents) ? input.agents.map(String).filter((a) => AGENT_NAME.test(a)).slice(0, 10) : [];
          const message = { session_id: session, conv_id: `${tag}-${randomBytes(6).toString('hex')}`, content: [{ type: 'text', text }], text, collection_id: cid, ...(agents.length ? { agents } : {}) };
          return send(await backend(base, '/agent', { method: 'POST', body: { message } }), (d) => ({ ...d, session_id: session }));
        }
        case 'workflow': {
          const steps = Array.isArray(input?.steps) ? input.steps.slice(0, MAX_STEPS).map((s) => (s && typeof s === 'object' ? { agent: String(s.agent || '').slice(0, 40), params: s.params && typeof s.params === 'object' ? s.params : {} } : null)).filter(Boolean) : [];
          if (!steps.length) return err(400, 'steps is required.');
          return send(await backend(base, '/videoagent/workflow', { method: 'POST', body: { steps, command: String(input?.command || '').slice(0, 500) } }));
        }

        case 'sessions_list': {
          const r = await backend(base, '/session');
          return send(r, (d) => ({ sessions: (Array.isArray(d) ? d : []).filter((s) => sessionMine(s?.session_id)).map((s) => ({ session_id: s.session_id, updated_at: s.updated_at, created_at: s.created_at })) }));
        }
        case 'session_get': case 'session_delete': {
          const id = input?.session_id;
          if (!(typeof id === 'string' && ID.test(id) && sessionMine(id))) return err(404, 'No such session.');
          if (action === 'session_get') return send(await backend(base, `/session/${encodeURIComponent(id)}`));
          return send(await backend(base, `/session/${encodeURIComponent(id)}`, { method: 'DELETE' }), () => ({ deleted: true }));
        }
        default: return err(400, 'Unknown action.');
      }
    } catch (e) {
      return err(502, scrubDirector(`Director could not be reached: ${String(e?.message || e)}`).slice(0, 200));
    }
  };
}
