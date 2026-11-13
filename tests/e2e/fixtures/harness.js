/* global process, window */
import { FakeSupabase, signInAs, SUPABASE_URL } from './fakeSupabase.js';
import { IMAGES } from './assets.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const APP = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';
export const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

/** One fake backend shared by every browser context of a test (owner, viewers...). Fixture files are preloaded. */
export function createWorld() {
  const db = new FakeSupabase();
  const url = (p) => `${SUPABASE_URL}/storage/v1/object/public/uploads/${p}`;
  db.putFile('fixtures/source.webm', readFileSync(join(here, 'source.webm')), 'video/webm');
  for (const [path, body] of Object.entries(IMAGES)) db.putFile(path, body, 'image/svg+xml');
  return { db, url, video: url('fixtures/source.webm') };
}

/** A browser context behind the fake backend, optionally signed in. Viewers (no sub) are anonymous. */
export async function newContext(browser, world, { sub = null, viewport = { width: 1400, height: 900 } } = {}) {
  // bypassCSP: the vite dev server sends a media-src CSP that blocks the player's silent data: audio (production sends none)
  const context = await browser.newContext({ viewport, bypassCSP: true });
  await world.db.attach(context);
  if (sub) await signInAs(context, sub);
  return context;
}

/** Open the Studio and wait until the project manager is ready (the app, not a stub). */
export async function openStudio(page) {
  await page.goto(`${APP}/#/timeline`, { waitUntil: 'domcontentloaded' });
  await dismissWelcome(page);
  await page.getByText('New Project', { exact: true }).first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !!window.electronAPI?.db?.createProject, null, { timeout: 30000 });
}

/** The first-run "set up your API keys" dialog is closable; close it like a user would. */
export async function dismissWelcome(page) {
  const welcome = page.getByText('Welcome — set up your API keys');
  if (await welcome.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
    await page.locator('[aria-label*="lose" i]').first().click().catch(() => {});
    await welcome.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}

/**
 * Create a project through the app's own storage API (same code the "New Project" button uses) and give it one video
 * clip plus the given overlay recipes. Overlays are built with the app's real `createOverlay`, then tuned.
 * `overlays`: [{ kind, start, end, set: (clip) => void }]. Returns { id }.
 */
export async function seedProject(page, { name, videoUrl, seconds = 4, overlays = [] }) {
  const recipes = overlays.map((o) => ({ kind: o.kind, start: o.start ?? 0, end: o.end ?? seconds, patch: o.patch ?? {}, addon: o.addon ?? {} }));
  return page.evaluate(async ({ name, videoUrl, seconds, recipes }) => {
    const api = window.electronAPI;
    const { createOverlay } = await import('/src/cinegen/lib/overlays/overlays.ts');
    const state = await api.db.createProject(name);
    const created = new Date().toISOString();
    state.assets.push({ id: 'asset-source', name: 'source.webm', type: 'video', file_ref: videoUrl, source_url: videoUrl, duration: seconds, width: 640, height: 360, created_at: created, status: 'online', metadata: '{}' });
    const tl = state.timelines[0]; tl.duration = seconds;
    const vTrack = tl.tracks.find((t) => t.kind === 'video');
    tl.clips.push({ id: 'clip-source', asset_id: 'asset-source', track_id: vTrack.id, name: 'source', start_time: 0, duration: seconds, trim_start: 0, trim_end: 0, speed: 1, opacity: 1, volume: 1, flip_h: 0, flip_v: 0, keyframes: [] });
    state.workflow.overlays = recipes.map((r) => {
      const o = createOverlay(r.kind, r.start, seconds);
      Object.assign(o, r.patch, { start: r.start, end: r.end });
      if (o.addon) o.addon = { ...o.addon, ...r.addon }; else Object.assign(o, r.addon);
      return o;
    });
    await api.db.saveProject(state.project.id, state);
    return { id: state.project.id, overlays: state.workflow.overlays };
  }, { name, videoUrl, seconds, recipes });
}

export async function openProject(page, id) {
  await page.goto(`${APP}/?project=${id}&storage=db#/timeline`, { waitUntil: 'domcontentloaded' });
  await dismissWelcome(page);
}
