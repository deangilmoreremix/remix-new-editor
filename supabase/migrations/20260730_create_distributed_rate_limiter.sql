-- Distributed Rate Limiter
-- Stores rate limit counters in the database so they work across
-- multiple Deno instances and Deno regions (Supabase edge runs across
-- many regions automatically). The previous in-memory Map implementation
-- was per-instance, meaning a user could bypass limits by hitting different
-- regions or triggering cold starts.
--
-- Schema: one row per (scope, key, window_start). The "scope" identifies
-- which rate limit bucket (e.g. "muapi-proxy", "ai-thumbnail-generator")
-- and the "key" identifies the caller (user ID, IP hash, or API key hash).
-- The "count" increments atomically via an UPSERT, and the "window_start"
-- is the timestamp of the start of the current window. Old rows are
-- garbage-collected by a periodic cleanup function.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rate_limits_scope_key_window_unique
    UNIQUE (scope, key, window_start)
);

-- Index for the hot path: lookup by scope + key + window_start
CREATE INDEX IF NOT EXISTS rate_limits_lookup_idx
  ON public.rate_limits (scope, key, window_start DESC);

-- Index for the cleanup function: scan by window_start
CREATE INDEX IF NOT EXISTS rate_limits_window_idx
  ON public.rate_limits (window_start);

-- Atomic increment-and-check function. This is the core of the
-- distributed rate limiter: it atomically upserts a row, increments
-- the count, and returns the new count along with whether the limit
-- was exceeded.
--
-- Returns a JSON object with:
--   allowed: boolean — whether the request is within the limit
--   count: integer — the new count after this request
--   limit: integer — the configured limit
--   window_start: ISO timestamp of the current window
--   reset_at: ISO timestamp when the window resets
CREATE OR REPLACE FUNCTION public.rate_limit_check(
  p_scope TEXT,
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Compute the start of the current window. We use a fixed-window
  -- approach: the window resets every p_window_seconds, aligned to
  -- UNIX epoch. This is simpler than sliding windows and sufficient
  -- for the rate limits we care about (per-minute, per-hour).
  v_window_start := to_timestamp(
    floor(extract(EPOCH FROM NOW()) / p_window_seconds) * p_window_seconds
  );

  -- Atomic upsert: insert a new row with count=1 if none exists for
  -- this scope+key+window, otherwise increment the existing count.
  INSERT INTO public.rate_limits (scope, key, window_start, count, updated_at)
  VALUES (p_scope, p_key, v_window_start, 1, NOW())
  ON CONFLICT (scope, key, window_start)
  DO UPDATE SET
    count = public.rate_limits.count + 1,
    updated_at = NOW()
  RETURNING count INTO v_count;

  v_allowed := v_count <= p_limit;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'count', v_count,
    'limit', p_limit,
    'window_start', v_window_start,
    'reset_at', v_window_start + (p_window_seconds || ' seconds')::INTERVAL
  );
END;
$$;

-- Cleanup function: delete rate limit rows older than the maximum
-- window we care about (24 hours by default). Run this via pg_cron
-- or a Supabase scheduled function.
CREATE OR REPLACE FUNCTION public.rate_limit_cleanup(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- RLS: the rate_limits table is only accessed by the service role
-- (via SECURITY DEFINER functions). Enable RLS but allow no direct
-- access from anon/authenticated roles.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- The service role bypasses RLS by default, so the rate_limit_check
-- and rate_limit_cleanup functions will work. No policies are needed
-- for service role access.
-- Explicit deny for anon/authenticated to be safe:
CREATE POLICY "rate_limits_no_anon_access" ON public.rate_limits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Grant execute on the functions to the service role (and anon for
-- completeness, though the SECURITY DEFINER means they run as the
-- function owner regardless).
GRANT EXECUTE ON FUNCTION public.rate_limit_check(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.rate_limit_cleanup(INTEGER) TO service_role;
