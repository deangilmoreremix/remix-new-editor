/** Minimal PostgREST client for server-side jobs (service role). Errors carry `status`; they never include row data. */
export const supabaseConfig = (env = process.env) => ({
  url: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  key: env.SUPABASE_SERVICE_ROLE_KEY || '',
});

export const rest = (cfg, fetchImpl) => async (path, { method = 'GET', body, prefer } = {}) => {
  const res = await fetchImpl(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw Object.assign(new Error(`${method} ${path.split('?')[0]} failed (HTTP ${res.status})`), { status: res.status });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

/** PostgREST `in.(...)` list with quoted values. */
export const inList = (ids) => `in.(${ids.map((i) => `"${String(i).replace(/"/g, '')}"`).join(',')})`;
