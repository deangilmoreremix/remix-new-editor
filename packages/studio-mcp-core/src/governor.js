// Safeguards for tools that change or publish things.
//
// Every request the gateway runs for an MCP key gets a risk class:
//   read         looks at something
//   write        creates or changes something that can be undone or regenerated (includes paid generation)
//   destructive  deletes or overwrites something
//   publish      sends something outside the app (social posts, public pages, emails)
// destructive and publish need an explicit confirm: true, and are capped per key per day. Every call is written to an audit log
// that holds the tool, risk, outcome and time, and nothing else: no arguments, URLs, prompts or keys.
//
// The gateway applies this itself, so it holds even if someone calls the gateway directly with a leaked key.
// The stdio server applies the confirm rule too, so the model gets a clear message before anything is sent.

export const RISKS = ['read', 'write', 'destructive', 'publish'];
export const NEEDS_CONFIRM = new Set(['destructive', 'publish']);
export const DEFAULT_CAPS = { destructive: 50, publish: 20 };

// Things only a person may do. No tool may do them; a test walks every registered tool name against this list.
export const HUMAN_ONLY = [
  /(^|_)(save|set|update|replace|delete|clear)_?(api_?)?keys?($|_)/,
  /(^|_)(create|revoke|rotate)_?mcp_?keys?($|_)/,
  /(^|_)(checkout|upgrade|subscribe|purchase|billing)($|_)/,
  /(^|_)(connect|authorize|oauth)_?(social|account|provider)?($|_)/,
];
export const humanOnlyViolations = (toolNames) => toolNames.filter((n) => HUMAN_ONLY.some((re) => re.test(String(n).toLowerCase())));

const utcDay = (now) => new Date(now()).toISOString().slice(0, 10);

export function confirmMessage(label, risk) {
  return `This would ${risk === 'publish' ? 'publish or send' : 'delete or overwrite'} something (${label}). Nothing was done. Call again with confirm: true if you want it.`;
}

/**
 * store: { incr(keyId, day, risk) -> count after increment, audit(row), recent(userId, limit) }
 * returns { check, record, recent }
 */
export function createGovernor({ store, caps = DEFAULT_CAPS, now = Date.now } = {}) {
  return {
    /** Decide before running. Returns { ok: true } or { ok: false, status, message }. Counts the call against the daily cap when it is allowed. */
    async check({ keyId, risk, confirm, label = 'this action' }) {
      if (!RISKS.includes(risk)) return { ok: false, status: 500, message: `Unknown risk class for ${label}.` };
      if (!NEEDS_CONFIRM.has(risk)) return { ok: true };
      if (confirm !== true) return { ok: false, status: 409, code: 'confirm_required', message: confirmMessage(label, risk) };
      if (!keyId) return { ok: true }; // local-development principal: no key to count against
      const cap = caps[risk];
      const used = await store.incr(keyId, utcDay(now), risk);
      if (cap !== undefined && used > cap) return { ok: false, status: 429, code: 'daily_cap', message: `Daily limit reached for ${risk} actions (${cap} per day per key). It resets at midnight UTC.` };
      return { ok: true };
    },
    /** Write one audit row. Never throws: an audit failure must not break (or hide) the action. */
    async record({ keyId, userId, tool, risk, ok, ms }) {
      try { await store.audit({ key_id: keyId || null, clerk_user_id: userId || null, tool: String(tool).slice(0, 80), risk, ok: !!ok, ms: Math.max(0, Math.round(ms || 0)), at: new Date(now()).toISOString() }); } catch { /* best effort */ }
    },
    recent: (userId, limit = 50) => store.recent(userId, limit),
  };
}

export function createMemoryGovernorStore() {
  const counts = new Map();
  const rows = [];
  return {
    rows,
    incr: async (keyId, day, risk) => { const k = `${keyId}|${day}|${risk}`; counts.set(k, (counts.get(k) || 0) + 1); return counts.get(k); },
    audit: async (row) => { rows.push(row); },
    recent: async (userId, limit) => rows.filter((r) => r.clerk_user_id === userId).slice(-limit).reverse(),
  };
}

/** Supabase-backed store (tables from the mcp_governor migration). `admin` is a service-role client. */
export function createSupabaseGovernorStore(admin) {
  return {
    async incr(keyId, day, risk) {
      const { data, error } = await admin.rpc('mcp_usage_incr', { p_key_id: keyId, p_day: day, p_risk: risk });
      if (error) throw error;
      return Number(data);
    },
    async audit(row) { const { error } = await admin.from('mcp_audit').insert(row); if (error) throw error; },
    async recent(userId, limit) {
      const { data, error } = await admin.from('mcp_audit').select('tool, risk, ok, ms, at').eq('clerk_user_id', userId).order('at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
  };
}

export const GOVERNOR_MIGRATION_SQL = `
create table if not exists public.mcp_usage_daily (
  key_id uuid not null,
  day date not null,
  risk text not null check (risk in ('destructive', 'publish')),
  count integer not null default 0,
  primary key (key_id, day, risk)
);
create table if not exists public.mcp_audit (
  id bigint generated always as identity primary key,
  key_id uuid,
  clerk_user_id text,
  tool text not null,
  risk text not null check (risk in ('read', 'write', 'destructive', 'publish')),
  ok boolean not null,
  ms integer not null default 0,
  at timestamptz not null default now()
);
create index if not exists mcp_audit_user_idx on public.mcp_audit (clerk_user_id, at desc);
create or replace function public.mcp_usage_incr(p_key_id uuid, p_day date, p_risk text) returns integer
language sql as $$
  insert into public.mcp_usage_daily (key_id, day, risk, count) values (p_key_id, p_day, p_risk, 1)
  on conflict (key_id, day, risk) do update set count = public.mcp_usage_daily.count + 1
  returning count;
$$;
alter table public.mcp_usage_daily enable row level security;
alter table public.mcp_audit enable row level security;
revoke all on table public.mcp_usage_daily, public.mcp_audit from anon, authenticated;
revoke all on function public.mcp_usage_incr(uuid, date, text) from public, anon, authenticated;
`;
