import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmartWarmupAIStudio } from '../SmartWarmupAIStudio.js';

const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0)); };
const res = (text = '') => ({ ok: true, text: async () => text });

// The backend is "asleep": its health request stays pending until released.
function stubNetwork() {
  let release;
  const health = new Promise((resolve) => { release = () => resolve(res()); });
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url);
    if (u.endsWith('/smartwarmupai-app/index.html')) return res('<script src="/smartwarmupai-app/x.js">');
    if (u.endsWith('/smartwarmupai-help/index.html')) return res('<a href="/smartwarmupai-help/">');
    if (u.endsWith('/config.js')) return res('window.__WARMBLY_ENV__ = { DEMO: "0", HOST_SESSION: "1" };');
    if (u.endsWith('/smartwarmupai-api/health')) return health;
    return { ok: false, text: async () => '' };
  }));
  return release;
}

describe('SmartWarmupAIStudio while the backend wakes', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('keeps Help usable during the wait and keeps the chosen tab afterwards', async () => {
    const release = stubNetwork();
    const el = SmartWarmupAIStudio();
    document.body.append(el);
    await flush();

    const frame = (k) => el.querySelector(`iframe[data-frame="${k}"]`);
    expect(frame('help')).toBeTruthy();   // Help loads at once...
    expect(frame('app')).toBeNull();      // ...the dashboard waits for the backend
    expect(el.textContent).toMatch(/Starting SmartWarmupAI/); // and says so

    el.querySelector('button[data-tab="help"]').click();
    expect(frame('help').style.display).toBe('block'); // Help is visible during the wait

    release();
    await flush();
    expect(frame('app')).toBeTruthy();                  // the dashboard loads once the backend answers
    expect(frame('help').style.display).toBe('block');  // and the person stays on Help
    expect(frame('app').style.display).toBe('none');
    el.cleanup();
  });

  it('shows the dashboard when the person stays on it', async () => {
    const release = stubNetwork();
    const el = SmartWarmupAIStudio();
    document.body.append(el);
    await flush();
    release();
    await flush();
    expect(el.querySelector('iframe[data-frame="app"]').style.display).toBe('block');
    expect(el.textContent).not.toMatch(/Starting SmartWarmupAI/);
    el.cleanup();
  });
});
