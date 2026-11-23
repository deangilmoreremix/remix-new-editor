// Tab half of the live-tab bridge. Browser-safe (no Node APIs, no DOM): the app supplies fetch, auth headers and the dialog.
//
// Consent model:
//   - nothing runs until the user switches "Let MCP control this tab" on, and it resets on reload;
//   - read-only tools run silently;
//   - everything else asks in the page (Allow once / Allow all in this tab / No) unless the user already chose "allow all";
//   - a tool the tab did not register is refused, whatever the command says.

const IDLE_MS = 8000;
const ACTIVE_MS = 1500;
const ACTIVE_WINDOW_MS = 60_000;
const RUN_TIMEOUT_MS = 25_000;
const MAX_RESULT_BYTES = 900 * 1024;

const safeJson = (v) => {
  try {
    const s = JSON.stringify(v === undefined ? null : v, (_k, x) => (typeof x === 'function' ? undefined : typeof x === 'bigint' ? String(x) : x));
    return s.length > MAX_RESULT_BYTES ? { tooLarge: true } : JSON.parse(s);
  } catch { return { unserializable: true }; }
};

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('The tab took too long to do that.')), ms))]);

/**
 * @param {{
 *   endpoint: string,
 *   fetchImpl?: typeof fetch,
 *   getHeaders: () => Promise<Record<string, string>>,
 *   label?: string,
 *   confirm: (info: { tool: string, description: string, risk: string, args: unknown }) => Promise<'once' | 'all' | 'no'>,
 *   onState?: (s: { enabled: boolean, connected: boolean, allowAll: boolean, lastTool?: string, error?: string }) => void,
 *   now?: () => number,
 *   setTimeoutImpl?: typeof setTimeout,
 * }} o
 */
export function createTabBridge({ endpoint, fetchImpl = fetch, getHeaders, label = 'Browser tab', confirm, onState = () => {}, now = Date.now, setTimeoutImpl = setTimeout }) {
  const groups = new Map(); // studio id -> tools[]
  let sessionId = null;
  let enabled = false;
  let allowAll = false;
  let timer = null;
  let lastActivity = 0;
  let running = false;
  const state = { enabled: false, connected: false, allowAll: false };
  const emit = (patch = {}) => { Object.assign(state, { enabled, allowAll }, patch); onState({ ...state }); };

  const toolList = () => [...groups.values()].flat();
  const announced = () => toolList().map((t) => ({ name: t.name, description: t.description || '', risk: t.risk || 'write', schema: t.schema || { type: 'object', properties: {} } }));
  const studioLabel = () => [...groups.keys()].join(', ') || 'app';

  async function api(action, body) {
    const res = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await getHeaders()) }, body: JSON.stringify({ action, ...body }) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw Object.assign(new Error(data?.error?.message || `MCP bridge unavailable (HTTP ${res.status})`), { status: res.status });
    return data;
  }

  async function register() {
    const data = await api('register', { sessionId, label, studio: studioLabel(), tools: announced() });
    sessionId = data.session.id;
    emit({ connected: true, error: undefined });
  }

  async function execute(cmd) {
    const tool = toolList().find((t) => t.name === cmd.tool);
    if (!tool) return { status: 'error', error: `This tab has no tool "${String(cmd.tool).slice(0, 40)}" any more.` };
    const risk = tool.risk || 'write';
    if (risk !== 'read' && !allowAll) {
      const answer = await confirm({ tool: tool.name, description: tool.description || '', risk, args: cmd.args });
      if (answer === 'all') { allowAll = true; emit(); }
      else if (answer !== 'once') return { status: 'declined' };
    }
    try {
      const result = await withTimeout(Promise.resolve(tool.run(cmd.args || {})), RUN_TIMEOUT_MS);
      emit({ lastTool: tool.name });
      return { status: 'done', result: safeJson(result) };
    } catch (err) {
      return { status: 'error', error: String(err?.message || err).slice(0, 500) };
    }
  }

  async function tick() {
    if (!enabled || running) return schedule();
    running = true;
    try {
      const data = await api('poll', { sessionId });
      if (data.gone) { sessionId = null; await register(); }
      for (const cmd of data.commands || []) {
        lastActivity = now();
        const out = await execute(cmd);
        await api('respond', { sessionId, commandId: cmd.id, ...out }).catch(() => {});
      }
      emit({ connected: true, error: undefined });
    } catch (err) {
      emit({ connected: false, error: err?.message });
      if (err?.status === 401 || err?.status === 403) enabled = false; // signed out or not allowed: stop, do not hammer
    } finally { running = false; }
    schedule();
  }

  function schedule() {
    clearTimeoutSafe();
    if (!enabled) return;
    timer = setTimeoutImpl(tick, now() - lastActivity < ACTIVE_WINDOW_MS ? ACTIVE_MS : IDLE_MS);
  }
  const clearTimeoutSafe = () => { if (timer) { clearTimeout(timer); timer = null; } };

  return {
    state: () => ({ ...state }),
    /** A studio in this tab offers these tools while it is mounted. Re-announces to the server when the set changes. */
    setTools(studio, tools) {
      if (!tools?.length) groups.delete(studio); else groups.set(studio, tools);
      if (enabled && sessionId) register().catch((e) => emit({ error: e.message }));
    },
    toolNames: () => toolList().map((t) => t.name),
    async enable() {
      if (enabled) return;
      enabled = true; allowAll = false; lastActivity = now();
      emit();
      try { await register(); } catch (err) { enabled = false; emit({ connected: false, error: err.message }); throw err; }
      schedule();
    },
    async disable() {
      enabled = false; allowAll = false; clearTimeoutSafe();
      if (sessionId) await api('close', { sessionId }).catch(() => {});
      sessionId = null;
      emit({ connected: false });
    },
    setAllowAll(v) { allowAll = !!v; emit(); },
    /** exposed for tests: run one poll cycle now */
    tick,
    sessionId: () => sessionId,
  };
}
