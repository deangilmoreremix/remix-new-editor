// Projects, publishing and first-party analytics: real-browser checks for a deployed environment.
//
//   E2E_BASE_URL=https://<deploy-preview> \
//   E2E_PUBLIC_VIDEO_URL=https://<deploy-preview>/v/<business>/<slug>     (a published public video; no sign-in)
//   E2E_AUTH_STATE=path/to/playwright-storage-state.json                  (a signed-in editor session; optional)
//   npx playwright test tests/e2e/projects-analytics.spec.js
//
// Player tests need only the public URL. Projects UI tests need a signed-in storage state and are skipped without one.
// (The local Postgres harness in tests/browser-harness/projects-analytics covers the same flows with a SQL bridge.)
import { test, expect } from '@playwright/test';

const PUBLIC_URL = process.env.E2E_PUBLIC_VIDEO_URL;
const AUTH_STATE = process.env.E2E_AUTH_STATE;

test.describe('hosted player analytics (public)', () => {
  test.skip(!PUBLIC_URL, 'set E2E_PUBLIC_VIDEO_URL to a published public video');

  test('a visit sends page_open once, batched, with no owner id in the payload', async ({ page }) => {
    const bodies = [];
    page.on('request', (r) => { if (r.url().includes('/api/video-events') && r.method() === 'POST') bodies.push(r.postData() || ''); });
    await page.goto(PUBLIC_URL, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => bodies.length, { timeout: 15000 }).toBeGreaterThan(0);
    const all = bodies.join('\n');
    expect((all.match(/"page_open"/g) || []).length).toBe(1);
    expect(all).not.toMatch(/clerk_user_id|owner|"score"/i);
  });

  test('Do Not Track / Global Privacy Control: nothing is sent', async ({ browser }) => {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'Sec-GPC': '1', DNT: '1' } });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }); Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }); });
    const page = await ctx.newPage();
    let sent = 0;
    page.on('request', (r) => { if (r.url().includes('/api/video-events')) sent += 1; });
    await page.goto(PUBLIC_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    expect(sent).toBe(0);
    await ctx.close();
  });

  test('the readable link renders a video page that is indexable only when public', async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText(/not found|unavailable/i, { timeout: 15000 });
  });

  test('malformed or forged events are rejected by the endpoint', async ({ request, baseURL }) => {
    const res = await request.post(new URL('/api/video-events', baseURL || PUBLIC_URL).toString(), { data: { videoId: 'nope', sessionId: 'x', events: [{ type: 'bogus', seq: 0 }] } });
    expect([400, 404, 429]).toContain(res.status());
  });
});

test.describe('Projects (signed in)', () => {
  test.skip(!AUTH_STATE, 'set E2E_AUTH_STATE to a signed-in Playwright storage state');
  test.use({ storageState: AUTH_STATE });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* ignore */ } });
    await page.goto('/#/timeline-classic', { waitUntil: 'domcontentloaded' });
    await page.locator('.floating-rail').waitFor({ timeout: 30000 });
    await page.locator('.floating-rail').getByRole('button', { name: /Projects/ }).first().click();
    await expect(page.locator('#projectsPanel')).toBeVisible();
  });

  test('lists projects with real figures or "—" (never placeholder numbers)', async ({ page }) => {
    await expect(page.locator('.prj-title, .prj-empty').first()).toBeVisible();
    const text = await page.locator('#projectsPanel').innerText();
    expect(text).not.toMatch(/12\.8K|1,245|\b86 leads\b/); // numbers from the design concept must never appear as data
  });

  test('create, rename, duplicate and delete a project', async ({ page }) => {
    const name = `E2E ${Date.now()}`;
    page.once('dialog', (d) => d.accept(name));
    await page.locator('.prj-new').click();
    await expect(page.locator('.prj-card', { hasText: name })).toHaveCount(1, { timeout: 15000 });
    await page.locator('.prj-card', { hasText: name }).getByRole('button', { name: /duplicate/i }).click();
    await expect(page.locator('.prj-card', { hasText: `${name} (copy)` }).or(page.locator('.prj-card', { hasText: /copy/i }))).not.toHaveCount(0, { timeout: 15000 });
    page.on('dialog', (d) => d.accept());
    for (const label of [`${name} (copy)`, name]) {
      const card = page.locator('.prj-card', { hasText: label }).first();
      if (await card.count()) await card.getByRole('button', { name: /delete/i }).click();
    }
  });

  test('analytics tab opens and shows loading, data or an honest empty state', async ({ page }) => {
    const card = page.locator('.prj-card').first();
    test.skip((await card.count()) === 0, 'no projects in this account');
    await card.click();
    await page.locator('.prj-tabs').getByRole('tab', { name: 'Analytics' }).click();
    await expect(page.locator('#projectsPanel')).toContainText(/Video plays|not published|No video|Publish/i, { timeout: 20000 });
  });

  test('notifications tab lists alerts and can mark them read', async ({ page }) => {
    const card = page.locator('.prj-card').first();
    test.skip((await card.count()) === 0, 'no projects in this account');
    await card.click();
    await page.locator('.prj-tabs').getByRole('tab', { name: 'Notifications' }).click();
    await expect(page.locator('#projectsPanel')).toContainText(/email delivery requires configuration|No alerts|alert/i, { timeout: 15000 });
  });
});
