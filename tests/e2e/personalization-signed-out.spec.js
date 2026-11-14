/* global window, CustomEvent, Buffer, localStorage */
/**
 * The personalization demo, as a SIGNED-OUT visitor (no Clerk session at all): open the Studio, find a business's assets with
 * the real Personalization Modal (discovery endpoint is a fixture), keep them in the browser-local demo library, assign them to
 * slots and see them in the contact's preview data. Nothing is written to any account database, and publishing / uploads
 * ask for sign-in. Same fake backend as the main spec; a request that tries to leave the machine is recorded and fails the test.
 */
import { test, expect } from '@playwright/test';
import { createWorld, newContext, openStudio, seedProject, openProject, dismissWelcome } from './fixtures/harness.js';
import { BUSINESSES } from './fixtures/assets.js';

test.describe.configure({ mode: 'serial' });
let world; let ctx; let page; let projectId;
const grid = () => page.getByTestId('picker-grid');
const profileVars = (id) => page.evaluate(async (cid) => (await import('/src/lib/contactStore.js')).getProfile(cid)?.variables || {}, id);
const selectContact = (id) => page.evaluate(async (cid) => { (await import('/src/lib/contactStore.js')).selectContact(cid); window.dispatchEvent(new CustomEvent('remix:contact-changed')); }, id);

test.beforeAll(async ({ browser }) => {
  world = createWorld();
  ctx = await newContext(browser, world);                      // no `sub`: signed out
  page = await ctx.newPage();
  await openStudio(page);
  await page.evaluate(async (biz) => {
    const store = await import('/src/lib/contactStore.js');
    for (const [id, b] of Object.entries(biz)) {
      store.saveContact({ id: `biz${id}`, name: b.name });
      store.saveProfile({ id: `biz${id}`, name: b.name, contact: { firstName: b.first, company: b.company }, variables: { FIRSTNAME: b.first, COMPANY: b.company }, personalization: { business: { businessName: b.name, website: b.website, phone: b.phone } } });
    }
  }, BUSINESSES);
  projectId = (await seedProject(page, {
    name: 'Demo', videoUrl: world.video, seconds: 4,
    overlays: [
      { kind: 'overlay-personalized-image', start: 0, end: 4, addon: { src: '{{logoUrl}}', fit: 'contain', geometry: { left: 3, top: 4, width: 22, height: 22 } } },
      { kind: 'overlay-personalized-image', start: 0, end: 4, addon: { src: '{{productImageUrl}}', geometry: { left: 62, top: 28, width: 34, height: 44 } } },
    ],
  })).id;
});
test.afterAll(async () => { await ctx?.close(); });

test('a signed-out visitor has no account, and the Leads tab explains the demo', async () => {
  expect(await page.evaluate(() => !!window.Clerk?.user)).toBe(false);
  await selectContact('bizA');
  await openProject(page, projectId);
  await page.getByRole('button', { name: /Leads/i }).click();
  await expect(page.getByTestId('picker-signin')).toContainText('Demo mode');
  await expect(page.getByTestId('picker-business')).toHaveText('Smith Roofing');       // the business library is usable, not hidden
  await expect(page.getByTestId('publish-card')).toContainText('Sign in to publish');
});

test('Find more assets: the real modal finds the business\'s images and the visitor keeps them in the demo library', async () => {
  const found = [
    { id: 'd1', sourceUrl: BUSINESSES.A.website, previewUrl: world.url('fixtures/a-logo.svg'), sourceType: 'website', category: 'logo', selected: true, recommended: true, rejected: false, assignedSection: 'logo', autoAssigned: true },
    { id: 'd2', sourceUrl: BUSINESSES.A.website, previewUrl: world.url('fixtures/a-service.svg'), sourceType: 'website', category: 'service', selected: true, recommended: true, rejected: false, assignedSection: 'products', autoAssigned: true },
  ];
  await ctx.route('**/api/personalization/discover-assets', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ discoveredAssets: found, providerUsed: 'FIXTURE', status: 'complete' }) }));
  await page.getByTestId('picker-find').click();
  const modal = page.locator('#remix-personalization-root');
  await expect(page.locator('#personalize-title')).toBeVisible({ timeout: 120000 });
  await modal.locator('input[placeholder="https://joesroofing.com"]').fill(BUSINESSES.A.website);
  await modal.getByRole('button', { name: /find business assets/i }).click();
  await modal.getByRole('button', { name: /use selected assets/i }).click({ timeout: 30000 });
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('remix_demo_business_library_v1') || '{}').business_assets?.length || 0), { timeout: 30000 }).toBe(2);
  await modal.getByRole('button', { name: /^cancel$/i }).first().click().catch(() => {});
  await expect(page.locator('#personalize-title')).toBeHidden();
  await page.getByRole('tab', { name: 'all', exact: true }).click();
  await expect(grid().locator('> div')).toHaveCount(2);
  await expect(grid()).toContainText('Found on website');
  await page.screenshot({ path: 'test-results/links/screens/S1-signed-out-found.png', fullPage: true });
});

test('assign them to the slots: the contact\'s preview data is filled, and it survives a page reload', async () => {
  for (const [cat, label] of [['logo', 'logo'], ['service', 'product image']]) {
    await page.getByRole('tab', { name: cat, exact: true }).click();
    const card = grid().locator('> div').first();
    await card.locator('[data-testid^="use-"]').click();
    await card.locator('[data-testid^="slots-for-"] button', { hasText: label }).click();
  }
  await expect(page.getByTestId('slot-logoUrl')).toHaveAttribute('data-status', 'filled');
  await expect(page.getByTestId('slot-productImageUrl')).toHaveAttribute('data-status', 'filled');
  const vars = await profileVars('bizA');
  expect(vars.logoUrl).toBe(world.url('fixtures/a-logo.svg'));
  expect(vars.productImageUrl).toBe(world.url('fixtures/a-service.svg'));
  expect((await profileVars('bizB')).logoUrl).toBeUndefined();                          // the other business is untouched
  await page.reload();
  await dismissWelcome(page);
  await page.getByRole('button', { name: /Leads/i }).click();
  await expect(page.getByTestId('slot-logoUrl')).toHaveAttribute('data-status', 'filled');
  await expect(page.getByTestId('slot-productImageUrl')).toHaveAttribute('data-status', 'filled');
});

test('another business starts empty; uploads and publishing ask for sign-in; no account data was written', async () => {
  await selectContact('bizB');
  await expect(page.getByTestId('picker-business')).toHaveText('Wilson Plumbing');
  await expect(page.getByTestId('picker-empty')).toBeVisible();
  await selectContact('bizA');
  await page.getByTestId('picker-upload').setInputFiles({ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(page.getByTestId('leads-tab')).toContainText(/Sign in to upload/i);
  for (const t of ['business_profiles', 'business_assets', 'asset_assignments', 'video_recipients', 'published_videos']) expect(world.db.t[t], t).toHaveLength(0);
  expect(world.db.escaped).toEqual([]);
});
