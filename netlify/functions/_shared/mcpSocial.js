// Social publishing for the MCP: the same upstream routes the app's socialPublishing.js uses, run with the key owner's own stored key and
// the owner's own id as the social "external user" (the app sets it to the signed-in user id too). Connecting, renaming and disconnecting
// accounts are OAuth/ownership actions and stay in the app; only listing accounts, publishing and checking a publish are offered here.
const UPSTREAM = 'https://api.muapi.ai/api/v1';
export const PLATFORMS = ['youtube', 'tiktok', 'instagram'];
export const SOCIAL_ACTIONS = { accounts: 'read', status: 'read', publish: 'publish' };
const MAX_PAYLOAD_CHARS = 20_000;

const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const err = (statusCode, message) => reply(statusCode, { error: { message } });
const brandText = (s) => String(s ?? '').replace(/mu-?api(?:\.ai|app)?/gi, 'SmartVid');

export function createSocialStudio({ fetchImpl = (...a) => fetch(...a) } = {}) {
  async function up(path, key, init = {}) {
    const res = await fetchImpl(`${UPSTREAM}/${path}`, { ...init, headers: { 'x-api-key': key, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return err(401, 'Your SmartVid API key was rejected. Check it in SmartVid → Settings → API keys.');
      const detail = data?.detail?.error || data?.detail || data?.error?.message || data?.error || data?.message || res.statusText;
      return err(res.status >= 500 ? 502 : res.status, brandText(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300));
    }
    return reply(200, JSON.parse(brandText(JSON.stringify(data))));
  }
  return async function socialStudio(body, who) {
    if (!who?.userId || who.userId === 'byok' || !who.keys?.muapi) return err(401, 'This needs a signed-in SmartVid MCP key.');
    const action = String(body?.action || '');
    if (!Object.hasOwn(SOCIAL_ACTIONS, action)) return err(400, 'Unknown action.');
    const key = who.keys.muapi;
    if (action === 'accounts') return up(`social/ext/accounts?external_user_id=${encodeURIComponent(who.userId)}`, key);
    if (action === 'status') {
      const id = String(body?.request_id || '');
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return err(400, 'A valid request id is required.');
      return up(`predictions/${id}/result`, key);
    }
    const platform = String(body?.platform || '');
    if (!PLATFORMS.includes(platform)) return err(400, `Platform must be one of: ${PLATFORMS.join(', ')}.`);
    const payload = body?.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : null;
    if (!payload || JSON.stringify(payload).length > MAX_PAYLOAD_CHARS) return err(400, 'Give the post details as an object (up to 20 KB).');
    // The owner id is always the key's owner; a caller cannot post as someone else's connected accounts.
    return up(`${platform}-publish`, key, { method: 'POST', body: JSON.stringify({ ...payload, external_user_id: who.userId }) });
  };
}
