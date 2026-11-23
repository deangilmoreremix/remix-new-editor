// Per-key request rate limit: a counter per key per fixed window (default 120 requests per minute).
// Same store shape for memory (tests, local) and Supabase (shared across serverless instances).
// If the store itself fails the limiter falls back to a per-instance counter rather than blocking everyone or letting everything through.

export const DEFAULT_PER_MINUTE = 120;

/** @typedef {{ hit: (keyId: string, windowStartMs: number) => Promise<number> }} RateStore */

/**
 * @param {{ store: RateStore, perMinute?: number, windowMs?: number, now?: () => number, brandName?: string }} o
 */
export function createRateLimiter({ store, perMinute = DEFAULT_PER_MINUTE, windowMs = 60_000, now = Date.now, brandName = 'this service' }) {
  const fallback = createMemoryRateStore();
  return {
    perMinute,
    /** @returns {Promise<{ ok: boolean, retryAfter?: number, remaining?: number, message?: string }>} */
    async check(keyId) {
      if (!keyId || perMinute <= 0) return { ok: true };
      const t = now();
      const windowStart = Math.floor(t / windowMs) * windowMs;
      let count;
      try { count = await store.hit(String(keyId), windowStart); } catch { count = await fallback.hit(String(keyId), windowStart); }
      if (count > perMinute) {
        const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - t) / 1000));
        return { ok: false, retryAfter, message: `Too many requests for this ${brandName} key (limit ${perMinute} per minute). Try again in ${retryAfter}s.` };
      }
      return { ok: true, remaining: perMinute - count };
    },
  };
}

/** @returns {RateStore} */
export function createMemoryRateStore() {
  const counts = new Map();
  return {
    hit: async (keyId, windowStart) => {
      for (const k of counts.keys()) if (!k.endsWith(`|${windowStart}`)) counts.delete(k); // keep only the current window
      const k = `${keyId}|${windowStart}`;
      counts.set(k, (counts.get(k) || 0) + 1);
      return counts.get(k);
    },
  };
}

/** Supabase-backed store (function from the mcp_rate_expiry migration). `admin` is a service-role client. @returns {RateStore} */
export function createSupabaseRateStore(admin) {
  return {
    async hit(keyId, windowStart) {
      const { data, error } = await admin.rpc('mcp_rate_hit', { p_key_id: keyId, p_window: new Date(windowStart).toISOString() });
      if (error) throw error;
      return Number(data);
    },
  };
}

export const RATE_MIGRATION_SQL = `
create table if not exists public.mcp_rate_window (
  key_id uuid not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key_id, window_start)
);
create or replace function public.mcp_rate_hit(p_key_id uuid, p_window timestamptz) returns integer
language plpgsql as $$
declare c integer;
begin
  insert into public.mcp_rate_window (key_id, window_start, count) values (p_key_id, p_window, 1)
  on conflict (key_id, window_start) do update set count = public.mcp_rate_window.count + 1
  returning count into c;
  if random() < 0.01 then
    delete from public.mcp_rate_window where window_start < now() - interval '1 hour';
  end if;
  return c;
end $$;
alter table public.mcp_rate_window enable row level security;
revoke all on table public.mcp_rate_window from anon, authenticated;
revoke all on function public.mcp_rate_hit(uuid, timestamptz) from public, anon, authenticated;
`;
