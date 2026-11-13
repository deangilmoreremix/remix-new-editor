/* global Buffer, URL */
/**
 * The hosted viewer in a PRODUCTION BUILD, with the browser's content-security rules enforced (no bypassCSP).
 * The published video, recipients and images are the data the main spec produced through the real publish path
 * (fixtures/published-fixture.json); the backend is still the fake, so no real service is contacted.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createWorld, newContext, APP } from './fixtures/harness.js';
import { BUSINESSES } from './fixtures/assets.js';

const dump = JSON.parse(readFileSync(new URL('./fixtures/published-fixture.json', import.meta.url), 'utf8'));
let world;

test.beforeAll(() => {
  world = createWorld();
  for (const [name, rows] of Object.entries(dump.tables)) world.db.t[name] = rows;
  for (const [path, type, b64] of dump.files) world.db.putFile(path, Buffer.from(b64, 'base64'), type);
});

const recipientFor = (name) => world.db.t.video_recipients.find((r) => r.label === name && r.status === 'active' && !r.revoked_at);

for (const who of [BUSINESSES.A, BUSINESSES.B]) {
  test(`production build: ${who.name} sees its own personalized video, plays it, and nothing is blocked by the page's security rules`, async ({ browser }) => {
    const video = world.db.t.published_videos[0];
    const business = world.db.t.video_owner_profiles[0].business_slug;
    const r = recipientFor(who.name);
    const ctx = await newContext(browser, world, { bypassCSP: false });
    const page = await ctx.newPage();
    const problems = [];
    page.on('console', (m) => { if (/content security policy|refused to/i.test(m.text())) problems.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`${APP}/v/${business}/${video.slug}?recipient=${r.token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.watch-frame')).toContainText(`Hello ${who.first} from ${who.company}`, { timeout: 60000 });
    await page.locator('[data-bigplay]').click({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('.watch-frame .retarget-form')).toBeVisible({ timeout: 30000 });   // the lead form is scheduled at 1.5 s: it only appears if the video really played
    const imgs = await page.locator('.watch-frame img').evaluateAll((els) => els.map((e) => ({ src: e.currentSrc, ok: e.complete && e.naturalWidth > 0 })));
    expect(imgs).toHaveLength(2);
    expect(imgs.every((i) => i.ok)).toBe(true);
    const bizRow = world.db.t.business_profiles.find((b) => b.name === who.name);
    const own = world.db.t.business_assets.filter((a) => a.business_id === bizRow.id && ['logo', 'product'].includes(a.category)).map((a) => a.storage_url);
    for (const i of imgs) expect(own).toContain(i.src);
    await expect(page.locator('.watch-frame a[href^="tel:"]').first()).toHaveAttribute('href', `tel:${who.phone}`);
    await page.screenshot({ path: `test-results/links/screens/P-prod-${who.first}.png` });
    expect(problems).toEqual([]);
    expect(world.db.escaped).toEqual([]);
    await ctx.close();
  });
}
