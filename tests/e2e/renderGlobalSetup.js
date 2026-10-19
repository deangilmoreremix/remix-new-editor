/**
 * Playwright global setup — Render acceptance suite.
 *
 * A cold Vite dev server performs dependency pre-bundling on its first real
 * navigation. That work can exceed Playwright's 30s navigation timeout, which
 * made the FIRST test in the suite fail with a bare page.goto timeout while
 * every subsequent test passed — a false failure unrelated to Render Studio.
 *
 * This warms the server before any test runs: it polls the base URL and then
 * requests the app entry module so Vite finishes optimizing dependencies and
 * the module graph is resident. Tests then navigate against a warm server.
 *
 * Fail loudly if the server never becomes reachable, rather than letting every
 * test time out with an unhelpful navigation error.
 */
const BASE_URL = process.env.RENDER_BASE_URL || 'http://127.0.0.1:3100';
const ENTRY_MODULE = '/src/components/RenderPage.js';
const OVERALL_TIMEOUT_MS = 180_000;

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return true;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev server at ${BASE_URL} never became ready (${lastError})`);
}

async function warmEntryModule() {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}${ENTRY_MODULE}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        await res.text();
        return;
      }
    } catch {
      /* keep retrying — first transform can be slow */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  // Non-fatal: the suite still runs, it just pays the cold-start cost on the
  // first navigation. We warn rather than hard-fail so a slow machine is not
  // blocked outright.
  console.warn(`[render globalSetup] warning: ${ENTRY_MODULE} did not warm in time`);
}

export default async function globalSetup() {
  await waitForServer(OVERALL_TIMEOUT_MS);
  await warmEntryModule();
}