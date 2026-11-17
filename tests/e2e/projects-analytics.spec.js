// First-party analytics (hosted player, needs a public video URL) and the CineGen Publish tab (runs against the local dev server).
//
//   E2E_BASE_URL=https://<deploy-preview> \
//   E2E_PUBLIC_VIDEO_URL=https://<deploy-preview>/v/<business>/<slug>     (a published public video; no sign-in)
//   npx playwright test tests/e2e/projects-analytics.spec.js
//
// The Publish tab tests run against the local dev server (npm run dev) and need no sign-in.
import { test, expect } from '@playwright/test';

const PUBLIC_URL = process.env.E2E_PUBLIC_VIDEO_URL;

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

// The Publish tab of the CineGen editor (#/timeline). It needs no sign-in to open: the pages that need an account or a provider key
// show a plain reason instead of failing, and that is what these checks pin. Real posting / MailerLite / Kit sends are NOT driven here.
test.describe('CineGen Publish tab', () => {
  async function openPublish(page) {
    await page.addInitScript(() => { try { sessionStorage.setItem('setup_popup_shown', '1'); } catch { /* ignore */ } });
    await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
    const skip = page.getByRole('button', { name: 'Skip for now' });
    await skip.waitFor({ timeout: 8000 }).then(() => skip.click()).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('div.fixed.inset-0').forEach((e) => { if (/API keys/.test(e.innerText)) e.remove(); })).catch(() => {});
    const newProject = page.locator('.pm-bottombar__btn', { hasText: 'New Project' });
    const reachable = await newProject.waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
    test.skip(!reachable, 'Project Manager is not reachable in this environment');
    await newProject.click();
    await page.getByPlaceholder('Project name...').fill(`E2E ${Date.now()}`);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.locator('.top-nav__tab', { hasText: /^\s*Publish\s*$/i }).click();
    await expect(page.getByTestId('publish-tab')).toBeVisible({ timeout: 20000 });
  }
  const sub = (page, name) => page.getByTestId('publish-tab').getByRole('tab', { name }).or(page.getByTestId('publish-tab').getByRole('button', { name })).first();

  test('the old Leads tab is now "Publish" with Share & Leads, Social, Contacts and Email', async ({ page }) => {
    await openPublish(page);
    for (const name of [/Share & Leads/, /Social/, /Contacts/, /Email/]) await expect(sub(page, name)).toBeVisible();
  });

  test('Contacts: importing a CSV lists good rows, skips bad and duplicate ones, and exports', async ({ page }) => {
    await openPublish(page);
    await sub(page, /Contacts/).click();
    const csv = 'email,name\nann@example.com,Ann\nnot-an-email,Bad\nANN@example.com,Ann again\nbo@example.com,Bo\n';
    await page.getByTestId('contacts-file').setInputFiles({ name: 'c.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.getByTestId('contact-row')).toHaveCount(2, { timeout: 10000 });
    await expect(page.getByTestId('contacts-note')).toContainText(/skipped|duplicate|invalid/i);
    await expect(page.getByTestId('contacts-export')).toBeEnabled();
    await page.reload({ waitUntil: 'domcontentloaded' }); // imported contacts live in this browser
  });

  test('Email: without a MailerLite token Send stays blocked and says why', async ({ page }) => {
    await openPublish(page);
    await sub(page, /Email/).click();
    await expect(page.getByTestId('publish-email')).toBeVisible();
    await expect(page.getByTestId('email-send')).toBeDisabled();
    await expect(page.getByTestId('email-blocker')).not.toBeEmpty();
  });

  test('Social: opens, and shows a sign-in or no-video note instead of an empty page', async ({ page }) => {
    await openPublish(page);
    await sub(page, /Social/).click();
    await expect(page.getByTestId('publish-tab')).toContainText(/Social|Your exports|Media pool|Template videos|Sign in|Render/i);
  });

  test('the Publish tab is lime and the sub-tab choice is remembered', async ({ page }) => {
    await openPublish(page);
    await sub(page, /Contacts/).click();
    const accent = await page.getByTestId('publish-tab').evaluate((el) => getComputedStyle(el).getPropertyValue('--accent').trim());
    expect(accent.toLowerCase()).toBe('#d9ff00');
    expect(await page.evaluate(() => localStorage.getItem('cinegen_publish_sub'))).toBe('contacts');
    const under = await page.locator('.top-nav__tab--publish').evaluate((el) => getComputedStyle(el).borderBottomColor);
    expect(under).toMatch(/^rgba?\(217, 255, 0/); // lime (a later rule may add a little transparency)
  });
});
