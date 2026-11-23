// Live-tab bridge: lets an MCP key drive a studio that only exists inside the user's open browser tab.
//
//   MCP tool call → gateway enqueues a command for one of the key owner's tabs → the tab (which the user switched on) polls,
//   runs it against the page, and posts the result → the gateway hands the result back.
//
// This module is the server half and is pure: storage is injected (Supabase in production, memory in tests). Rules enforced here:
//   - a command can only be enqueued for a session owned by the same user as the MCP key, and only for a tool that session registered;
//   - the risk class of a command is the one the TAB registered for that tool, never one the caller supplies;
//   - commands expire (60 s), arguments and results are size-capped, and a tab that stops polling stops being listed (20 s).
import { sanitizeDeep } from './sanitize.js';

export const LIMITS = Object.freeze({
  commandTtlMs: 60_000,
  liveWindowMs: 20_000,
  maxArgsBytes: 64 * 1024,
  maxResultBytes: 1024 * 1024,
  maxTools: 200,
  maxSessionsPerUser: 8,
  defaultWaitMs: 20_000,
  waitPollMs: 350,
});

const TOOL_NAME = /^[a-z][a-z0-9_]{1,60}$/;
const RISKS = ['read', 'write', 'destructive', 'publish'];
const sizeOf = (v) => { try { return Buffer.byteLength(JSON.stringify(v ?? null)); } catch { return Infinity; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BridgeError extends Error {
  constructor(message, { status = 400, code = 'bridge_error' } = {}) { super(message); this.name = 'BridgeError'; this.status = status; this.code = code; }
}

/** Clean what a tab announces: names, one-line descriptions, a JSON-schema-ish input shape, a risk class. Drops anything else. */
export function normalizeTools(tools) {
  if (!Array.isArray(tools)) throw new BridgeError('tools must be a list', { code: 'bad_tools' });
  if (tools.length > LIMITS.maxTools) throw new BridgeError(`at most ${LIMITS.maxTools} tools per tab`, { code: 'bad_tools' });
  const seen = new Set();
  return tools.map((t) => {
    const name = String(t?.name || '');
    if (!TOOL_NAME.test(name)) throw new BridgeError(`invalid tool name "${name.slice(0, 40)}"`, { code: 'bad_tools' });
    if (seen.has(name)) throw new BridgeError(`duplicate tool "${name}"`, { code: 'bad_tools' });
    seen.add(name);
    const risk = RISKS.includes(t.risk) ? t.risk : 'write'; // unknown or missing: treat as a change
    const schema = t.schema && typeof t.schema === 'object' && sizeOf(t.schema) <= 8 * 1024 ? t.schema : { type: 'object', properties: {} };
    return { name, description: String(t.description || '').slice(0, 400), risk, schema };
  });
}

/**
 * store: {
 *   createSession({ userId, label, studio, tools }) -> session
 *   updateSession(id, userId, patch) -> session | null          (patch: { tools?, label?, studio?, last_seen?, closed_at? })
 *   getSession(id, userId) -> session | null
 *   liveSessions(userId, sinceIso) -> session[]
 *   countOpen(userId, sinceIso) -> number
 *   enqueue(cmd) -> command
 *   claim(sessionId, userId, limit, nowIso) -> command[]        (pending, unexpired -> running; atomic)
 *   respond(id, sessionId, userId, { status, result, error }) -> command | null
 *   getCommand(id, userId) -> command | null
 *   expireOld(userId, nowIso) -> void
 * }
 */
export function createBridge({ store, now = Date.now, limits = LIMITS, brandName = 'MCP' } = {}) {
  const iso = (t = now()) => new Date(t).toISOString();
  const liveSince = () => iso(now() - limits.liveWindowMs);

  const publicSession = (s) => ({ id: s.id, label: s.label, studio: s.studio, last_seen: s.last_seen, tools: (s.tools || []).map((t) => ({ name: t.name, description: t.description, risk: t.risk, schema: t.schema })) });

  return {
    // ── tab side (authenticated by the user's app session) ─────────────────────────────────────────────
    async register(userId, { label, studio, tools, sessionId }) {
      const clean = normalizeTools(tools);
      const meta = { label: String(label || 'Browser tab').slice(0, 80), studio: String(studio || 'app').slice(0, 60) };
      if (sessionId) {
        const s = await store.updateSession(sessionId, userId, { ...meta, tools: clean, last_seen: iso(), closed_at: null });
        if (s) return publicSession(s);
      }
      if ((await store.countOpen(userId, liveSince())) >= limits.maxSessionsPerUser) throw new BridgeError('Too many tabs are connected. Close one first.', { status: 429, code: 'too_many_sessions' });
      return publicSession(await store.createSession({ userId, ...meta, tools: clean }));
    },

    /** Returns { commands } for this tab. Also the heartbeat. A closed or unknown session gets { gone: true }. */
    async poll(userId, sessionId, { max = 5 } = {}) {
      const s = await store.updateSession(sessionId, userId, { last_seen: iso() });
      if (!s || s.closed_at) return { gone: true, commands: [] };
      await store.expireOld(userId, iso());
      const commands = await store.claim(sessionId, userId, Math.min(Math.max(1, max), 10), iso());
      return { commands: commands.map((c) => ({ id: c.id, tool: c.tool, args: c.args, risk: c.risk })) };
    },

    async respond(userId, sessionId, commandId, { status, result, error } = {}) {
      if (!['done', 'error', 'declined'].includes(status)) throw new BridgeError('status must be done, error or declined', { code: 'bad_response' });
      const safe = status === 'done' ? sanitizeDeep(result ?? null, brandName) : null;
      if (status === 'done' && sizeOf(safe) > limits.maxResultBytes) {
        return store.respond(commandId, sessionId, userId, { status: 'error', result: null, error: `The result was too large (over ${Math.round(limits.maxResultBytes / 1024)} KB). Ask for less, or have the tab return a URL.` });
      }
      return store.respond(commandId, sessionId, userId, { status, result: safe, error: error ? String(error).slice(0, 500) : null });
    },

    async close(userId, sessionId) { await store.updateSession(sessionId, userId, { closed_at: iso() }); },

    // ── gateway side (authenticated by the MCP key; userId is the key's owner) ─────────────────────────
    async sessions(userId) { return (await store.liveSessions(userId, liveSince())).map(publicSession); },

    /** The registered risk of one tool in one of the owner's live tabs, or null. Used by the gateway BEFORE it runs governance. */
    async toolRisk(userId, sessionId, tool) {
      const s = await store.getSession(String(sessionId || ''), userId);
      if (!s || s.closed_at || s.last_seen < liveSince()) return null;
      return (s.tools || []).find((t) => t.name === tool)?.risk ?? null;
    },

    /** Enqueue and wait. Returns the finished command, or { status: 'pending', id } when the wait runs out. */
    async call(userId, { session, tool, args, waitMs = limits.defaultWaitMs }) {
      const s = await store.getSession(String(session || ''), userId);
      if (!s || s.closed_at) throw new BridgeError('That tab is not connected. List tabs with studio_sessions.', { status: 404, code: 'no_session' });
      if (s.last_seen < liveSince()) throw new BridgeError('That tab stopped responding (closed, asleep, or MCP control was switched off).', { status: 410, code: 'session_stale' });
      const def = (s.tools || []).find((t) => t.name === tool);
      if (!def) throw new BridgeError(`That tab has no tool "${String(tool).slice(0, 40)}".`, { status: 404, code: 'no_tool' });
      const a = args && typeof args === 'object' ? args : {};
      if (sizeOf(a) > limits.maxArgsBytes) throw new BridgeError(`Arguments are too large (over ${limits.maxArgsBytes / 1024} KB).`, { status: 413, code: 'args_too_large' });
      const cmd = await store.enqueue({ session_id: s.id, clerk_user_id: userId, tool, args: a, risk: def.risk, expires_at: iso(now() + limits.commandTtlMs) });
      return this.waitFor(userId, cmd.id, waitMs);
    },

    async waitFor(userId, id, waitMs) {
      const deadline = now() + Math.max(0, waitMs);
      for (;;) {
        const c = await store.getCommand(id, userId);
        if (!c) throw new BridgeError('No such command.', { status: 404, code: 'no_command' });
        if (!['pending', 'running'].includes(c.status)) return shape(c);
        if (c.expires_at < iso()) { await store.expireOld(userId, iso()); return shape({ ...c, status: 'expired' }); }
        if (now() >= deadline) return { id: c.id, status: c.status === 'running' ? 'running' : 'pending' };
        await sleep(limits.waitPollMs);
      }
    },

    async result(userId, id) { return this.waitFor(userId, id, 0); },
  };
}

function shape(c) {
  const base = { id: c.id, status: c.status };
  if (c.status === 'done') return { ...base, result: c.result };
  if (c.status === 'error') return { ...base, error: c.error || 'The tab reported an error.' };
  if (c.status === 'declined') return { ...base, error: 'You declined this action in the tab.' };
  if (c.status === 'expired') return { ...base, error: 'The tab did not answer in time (60 s). It may be busy, asleep or switched off.' };
  return base;
}

export function createMemoryBridgeStore({ now = Date.now } = {}) {
  const sessions = new Map();
  const commands = new Map();
  const iso = (t = now()) => new Date(t).toISOString();
  let n = 0;
  const id = (p) => `${p}${(++n).toString(16).padStart(7, '0')}-0000-4000-8000-000000000000`;
  return {
    sessions, commands,
    createSession: async ({ userId, label, studio, tools }) => { const s = { id: id('5'), clerk_user_id: userId, label, studio, tools, last_seen: iso(), created_at: iso(), closed_at: null }; sessions.set(s.id, s); return s; },
    updateSession: async (sid, userId, patch) => { const s = sessions.get(sid); if (!s || s.clerk_user_id !== userId) return null; Object.assign(s, patch); return s; },
    getSession: async (sid, userId) => { const s = sessions.get(sid); return s && s.clerk_user_id === userId ? s : null; },
    liveSessions: async (userId, since) => [...sessions.values()].filter((s) => s.clerk_user_id === userId && !s.closed_at && s.last_seen >= since),
    countOpen: async (userId, since) => [...sessions.values()].filter((s) => s.clerk_user_id === userId && !s.closed_at && s.last_seen >= since).length,
    enqueue: async (c) => { const row = { id: id('c'), status: 'pending', result: null, error: null, created_at: iso(), ...c }; commands.set(row.id, row); return row; },
    claim: async (sid, userId, limit, nowIso) => {
      const out = [];
      for (const c of commands.values()) {
        if (out.length >= limit) break;
        if (c.session_id === sid && c.clerk_user_id === userId && c.status === 'pending' && c.expires_at > nowIso) { c.status = 'running'; out.push({ ...c }); }
      }
      return out;
    },
    respond: async (cid, sid, userId, { status, result, error }) => {
      const c = commands.get(cid);
      if (!c || c.session_id !== sid || c.clerk_user_id !== userId || !['pending', 'running'].includes(c.status)) return null;
      Object.assign(c, { status, result, error }); return c;
    },
    getCommand: async (cid, userId) => { const c = commands.get(cid); return c && c.clerk_user_id === userId ? { ...c } : null; },
    expireOld: async (userId, nowIso) => { for (const c of commands.values()) if (c.clerk_user_id === userId && ['pending', 'running'].includes(c.status) && c.expires_at < nowIso) c.status = 'expired'; },
  };
}

/** Supabase store (tables from BRIDGE_MIGRATION_SQL). `admin` is a service-role client. */
export function createSupabaseBridgeStore(admin) {
  const S = 'mcp_bridge_sessions';
  const C = 'mcp_bridge_commands';
  const un = ({ data, error }) => { if (error) throw error; return data; };
  return {
    createSession: async ({ userId, label, studio, tools }) => un(await admin.from(S).insert({ clerk_user_id: userId, label, studio, tools }).select('*').single()),
    updateSession: async (sid, userId, patch) => un(await admin.from(S).update(patch).eq('id', sid).eq('clerk_user_id', userId).select('*').maybeSingle()),
    getSession: async (sid, userId) => un(await admin.from(S).select('*').eq('id', sid).eq('clerk_user_id', userId).maybeSingle()),
    liveSessions: async (userId, since) => un(await admin.from(S).select('*').eq('clerk_user_id', userId).is('closed_at', null).gte('last_seen', since).order('last_seen', { ascending: false })) || [],
    countOpen: async (userId, since) => (un(await admin.from(S).select('id').eq('clerk_user_id', userId).is('closed_at', null).gte('last_seen', since)) || []).length,
    enqueue: async (c) => un(await admin.from(C).insert(c).select('*').single()),
    claim: async (sid, userId, limit, nowIso) => {
      const pending = un(await admin.from(C).select('id').eq('session_id', sid).eq('clerk_user_id', userId).eq('status', 'pending').gt('expires_at', nowIso).order('created_at').limit(limit)) || [];
      if (!pending.length) return [];
      // the status filter makes the update atomic: a command already claimed by another poll is not returned twice
      return un(await admin.from(C).update({ status: 'running' }).in('id', pending.map((p) => p.id)).eq('status', 'pending').select('*')) || [];
    },
    respond: async (cid, sid, userId, { status, result, error }) => un(await admin.from(C).update({ status, result, error }).eq('id', cid).eq('session_id', sid).eq('clerk_user_id', userId).in('status', ['pending', 'running']).select('*').maybeSingle()),
    getCommand: async (cid, userId) => un(await admin.from(C).select('*').eq('id', cid).eq('clerk_user_id', userId).maybeSingle()),
    expireOld: async (userId, nowIso) => { await admin.from(C).update({ status: 'expired' }).eq('clerk_user_id', userId).in('status', ['pending', 'running']).lt('expires_at', nowIso); },
  };
}

export const BRIDGE_MIGRATION_SQL = `
create table if not exists public.mcp_bridge_sessions (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  label text not null default 'Browser tab',
  studio text not null default 'app',
  tools jsonb not null default '[]'::jsonb,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists mcp_bridge_sessions_user_idx on public.mcp_bridge_sessions (clerk_user_id) where closed_at is null;
create table if not exists public.mcp_bridge_commands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mcp_bridge_sessions (id) on delete cascade,
  clerk_user_id text not null,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  risk text not null default 'write' check (risk in ('read', 'write', 'destructive', 'publish')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error', 'declined', 'expired')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists mcp_bridge_commands_pending_idx on public.mcp_bridge_commands (session_id, status, created_at);
alter table public.mcp_bridge_sessions enable row level security;
alter table public.mcp_bridge_commands enable row level security;
revoke all on table public.mcp_bridge_sessions, public.mcp_bridge_commands from anon, authenticated;
`;
