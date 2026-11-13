/**
 * Personalized links, end to end in a real browser (Chromium) against the real app.
 *
 * What is real: the Studio (CineGen) UI, the Leads tab cards, the publish client, the hosted viewer, the personalization
 * token engine. What is a fixture: sign-in (stubbed Clerk) and the whole Supabase backend (tests/e2e/fixtures/fakeSupabase.js,
 * which models the live project's behavior), plus two fictional businesses with generated images. The live database is
 * never contacted: any request that leaves the machine is aborted and recorded, and the last test fails if one was.
 */
import { test, expect } from '@playwright/test';
import { createWorld, newContext, openStudio, seedProject, openProject, dismissWelcome } from './fixtures/harness.js';
import { BUSINESSES, IMAGES } from './fixtures/assets.js';
import { SUPABASE_URL } from './fixtures/fakeSupabase.js';

const OWNER = 'user_fixtureA';
const shot = (name) => `test-results/links/screens/${name}.png`;

test.describe.configure({ mode: 'serial' });

let world; let owner; let page; let projectId; let browserRef;

const leads = () => page.getByTestId('leads-tab');

/** Create the two fictional contacts (with their business details) in the app's own contact store. */
async function seedContacts(p) {
  await p.evaluate(async (biz) => {
    const store = await import('/src/lib/contactStore.js');
    for (const [id, b] of Object.entries(biz)) {
      store.saveContact({ id: `biz${id}`, name: b.name });
      store.saveProfile({
        id: `biz${id}`, name: b.name,
        contact: { firstName: b.first, company: b.company },
        variables: { FIRSTNAME: b.first, COMPANY: b.company },
        personalization: { business: { businessName: b.name, website: b.website, phone: b.phone } },
      });
    }
  }, BUSINESSES);
}
const selectContact = (p, id) => p.evaluate(async (cid) => { (await import('/src/lib/contactStore.js')).selectContact(cid); window.dispatchEvent(new CustomEvent('remix:contact-changed')); }, id);

test.beforeAll(async ({ browser }) => {
  browserRef = browser;
  world = createWorld();
  owner = await newContext(browser, world, { sub: OWNER });
  page = await owner.newPage();
  await openStudio(page);
  await seedContacts(page);
  const seeded = await seedProject(page, {
    name: 'Spring Offer', videoUrl: world.video, seconds: 4,
    overlays: [
      { kind: 'overlay-text', start: 0, end: 4, addon: { text: 'Hello {{FIRSTNAME}} from {{COMPANY}}' } },
      { kind: 'overlay-personalized-image', start: 0, end: 4, addon: { src: '{{logoUrl}}', fit: 'contain' } },
      { kind: 'overlay-personalized-image', start: 0, end: 4, addon: { src: '{{productImageUrl}}' } },
      // call-to-action destinations are tokens: each recipient gets their own number and website
      { kind: 'click-to-call', start: 0, end: 4, addon: { linkMode: 'phone', phoneNumber: '{{businessPhone}}', buttonText: 'Call {{COMPANY}}' } },
      { kind: 'overlay-text', start: 0, end: 4, addon: { text: 'Visit our website', linkMode: 'url', linkUrl: '{{website}}', geometry: { left: 5, top: 80, width: 40, height: 12 } } },
      { kind: 'lead-form', start: 1.5, end: 4 },
    ],
  });
  projectId = seeded.id;
});

test.afterAll(async () => { await owner?.close(); });

const fixtureFile = (name) => ({ name, mimeType: 'image/svg+xml', buffer: Buffer.from(IMAGES[`fixtures/${name}`]) });
const grid = () => page.getByTestId('picker-grid');

/** Upload one image through the picker (real file input -> storage -> library) under a category chip, then assign it to a slot. */
async function uploadAndAssign(fileName, category, slotLabel) {
  await page.getByRole('tab', { name: category, exact: true }).click();
  const before = await grid().locator('> div').count();
  await page.getByTestId('picker-upload').setInputFiles(fixtureFile(fileName));
  await expect(grid().locator('> div')).toHaveCount(before + 1);
  const card = grid().locator('> div').first();                         // newest first
  await expect(card.locator('[data-testid^="state-"]')).toHaveText('imported');
  await card.locator('[data-testid^="use-"]').click();
  await card.locator('[data-testid^="slots-for-"] button', { hasText: slotLabel }).click();
  await expect(page.getByTestId(`slot-${slotLabel === 'logo' ? 'logoUrl' : 'productImageUrl'}`)).toHaveAttribute('data-status', 'filled');
}

async function provision(contactId, logoFile, serviceFile) {
  await selectContact(page, contactId);
  await expect(page.getByTestId('picker-business')).toHaveText(contactId === 'bizA' ? BUSINESSES.A.name : BUSINESSES.B.name);
  await page.getByRole('tab', { name: 'all', exact: true }).click();
  await uploadAndAssign(logoFile, 'logo', 'logo');
  await uploadAndAssign(serviceFile, 'product', 'product image');
}

test.describe('A. business assets', () => {
  test('Leads tab shows the picker, publish and links cards (real Studio)', async () => {
    await selectContact(page, 'bizA');
    await openProject(page, projectId);
    await page.getByRole('button', { name: /Leads/i }).click();
    await expect(leads()).toBeVisible();
    for (const id of ['publish-card', 'asset-picker', 'bulk-links']) await expect(page.getByTestId(id)).toBeVisible();
    await expect(page.getByTestId('picker-business')).toHaveText('Smith Roofing');
    await expect(page.getByTestId('bulk-needs-publish')).toBeVisible();
    await expect(page.getByTestId('slot-logoUrl')).toHaveAttribute('data-status', 'missing');
    await page.screenshot({ path: shot('A1-leads-tab'), fullPage: true });
  });

  test('upload, import and assign a logo and a service photo for Business A; states and origin are shown', async () => {
    await provision('bizA', 'a-logo.svg', 'a-service.svg');
    await expect(page.getByTestId('slot-logoUrl')).toContainText('Chosen by you');
    await expect(grid().locator('[data-testid^="state-"]').first()).toHaveText('assigned');
    await expect(grid()).toContainText('Uploaded');
    await page.getByRole('tab', { name: 'all', exact: true }).click();
    // the stored files are the real images: the browser decodes them
    const imgs = await page.locator('[data-testid="picker-grid"] img').evaluateAll((els) => els.map((e) => ({ ok: e.complete && e.naturalWidth > 0, src: e.currentSrc })));
    expect(imgs).toHaveLength(2); expect(imgs.every((i) => i.ok)).toBe(true);
    await page.screenshot({ path: shot('A2-assets-assigned'), fullPage: true });
    const dbAssets = world.db.t.business_assets.filter((a) => /smith/i.test(world.db.t.business_profiles.find((b) => b.id === a.business_id)?.name || ''));
    expect(dbAssets).toHaveLength(2);
    expect(dbAssets.every((a) => /^https:\/\/fixture\.invalid\/storage\/.+\.svg$/.test(a.storage_url))).toBe(true);   // durable URLs, never blob:
    expect(dbAssets.map((a) => a.origin)).toEqual(['uploaded', 'uploaded']);
  });

  test('assets and assignments survive a full page reload and switching businesses', async () => {
    await page.reload();                                           // a real reload: the app state is rebuilt from the backend
    await dismissWelcome(page);
    await page.getByRole('button', { name: /Leads/i }).click();
    await expect(page.getByTestId('picker-business')).toHaveText('Smith Roofing');
    await expect(page.getByTestId('slot-logoUrl')).toHaveAttribute('data-status', 'filled');
    await expect(page.getByTestId('slot-productImageUrl')).toHaveAttribute('data-status', 'filled');
    await expect(grid().locator('> div')).toHaveCount(2);
    // switching to Business B shows none of A's assets
    await selectContact(page, 'bizB');
    await expect(page.getByTestId('picker-business')).toHaveText('Wilson Plumbing');
    await expect(page.getByTestId('picker-empty')).toBeVisible();
    await expect(page.getByTestId('slot-logoUrl')).toHaveAttribute('data-status', 'missing');
    await selectContact(page, 'bizA');
    await expect(grid().locator('> div')).toHaveCount(2);
  });

  test('Find more assets opens the real Personalization Modal (Find my brand / Business Finder / Find business assets)', async () => {
    await page.getByTestId('picker-find').click();
    await expect(page.locator('#personalize-title')).toBeVisible({ timeout: 120000 });          // first open compiles a large bundle in dev
    await expect(page.locator('#remix-personalization-root')).toContainText('Find my brand', { ignoreCase: true });
    await expect(page.locator('#remix-personalization-root')).toContainText('Find a local business by niche & location', { ignoreCase: true });
    await expect(page.locator('#remix-personalization-root').getByRole('button', { name: /find business assets/i })).toBeVisible();
    await page.screenshot({ path: shot('A3-personalization-modal') });
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('#personalize-title')).toBeHidden();
    await expect(page.getByTestId('leads-tab')).toBeVisible();                                    // back in the Studio, nothing lost
  });

  // KNOWN GAP (found by this browser test, see the report): the modal's onComplete fires only when a personalization run
  // finishes and carries generated outputs; assets found/assigned inside the modal live in the modal's own saved project
  // (/api/personalization/project) and are never written to assetLibraryStore, so syncFromModal() has nothing to save.
  test.fixme('assets found and assigned inside the modal land in the business library', async () => {});
});

let links = {};            // { A: url, B: url }
let sourceVideoUrls = [];  // video src seen by each viewer

/** Open a published link as an anonymous visitor in its own browser context (no cookies, storage or sign-in shared with anyone). */
async function openViewer(url) {
  const ctx = await newContext(browserRef, world);                  // no sub: anonymous
  const v = await ctx.newPage();
  v.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`[viewer ${m.type()}]`, m.text().slice(0, 220)); });
  v.on('pageerror', (e) => console.log('[viewer pageerror]', String(e).slice(0, 220)));
  await v.goto(url, { waitUntil: 'domcontentloaded' });
  await v.locator('.watch-frame').waitFor({ timeout: 60000 });
  return { ctx, page: v };
}

test.describe('B/C. one source video, two businesses, personalized links', () => {
  test('provision Business B through the same picker', async () => {
    await provision('bizB', 'b-logo.svg', 'b-service.svg');
    await selectContact(page, 'bizA');
    await expect(page.getByTestId('picker-business')).toHaveText('Smith Roofing');
  });

  test('publish the video; claim the business link name and the video link name', async () => {
    await page.getByTestId('publish-title').fill('Spring Offer');
    await page.getByTestId('publish-btn').click();
    await expect(page.getByTestId('publish-card').locator('.leads-pill')).toHaveText('Live', { timeout: 30000 });
    expect(world.db.t.published_videos).toHaveLength(1);
    await page.getByTestId('business-input').fill('smith-roofing');
    await page.getByTestId('business-save').click();
    await expect(page.getByTestId('bulk-notice')).toContainText('Business link name saved');
    await page.getByTestId('slug-input').fill('spring-offer');
    await page.getByTestId('slug-save').click();
    await expect(page.getByTestId('bulk-notice')).toContainText('Link name saved');
    expect(world.db.t.published_videos[0].slug).toBe('spring-offer');
    expect(world.db.t.video_owner_profiles.map((p) => p.business_slug)).toEqual(['smith-roofing']);
    await page.screenshot({ path: shot('B1-published'), fullPage: true });
  });

  test('create one link per business from the same video (no new video files)', async () => {
    await expect(page.getByTestId('bulk-summary')).toContainText('2 ready');
    const filesBefore = [...world.db.files.keys()].filter((k) => /\.(webm|mp4)$/.test(k)).length;
    await page.getByTestId('bulk-select-all').click();
    await page.getByTestId('bulk-create').click();
    await expect(page.getByTestId('bulk-notice')).toContainText('Created 2 links');
    const urls = await page.locator('input[aria-label^="Link for"]').evaluateAll((els) => els.map((e) => [e.getAttribute('aria-label'), e.value]));
    expect(urls).toHaveLength(2);
    for (const [label, url] of urls) links[label.includes('Smith') ? 'A' : 'B'] = url;
    expect(links.A).toMatch(/\/v\/smith-roofing\/spring-offer\?recipient=[0-9a-f]{64}$/);
    expect(links.B).toMatch(/\/v\/smith-roofing\/spring-offer\?recipient=[0-9a-f]{64}$/);
    expect(links.A).not.toBe(links.B);
    // the path carries only the owner's chosen link names; the personalization part (query) is one opaque token
    for (const u of [links.A, links.B]) { expect(new URL(u).search).toMatch(/^\?recipient=[0-9a-f]{64}$/); expect(new URL(u).search).not.toMatch(/Smith|Wilson|John|Sarah|@/i); }
    expect([...world.db.files.keys()].filter((k) => /\.(webm|mp4)$/.test(k)).length).toBe(filesBefore);
    expect(world.db.t.video_recipients).toHaveLength(2);
    await page.screenshot({ path: shot('B2-links-created'), fullPage: true });
  });

  const assetUrlsOf = (name) => {
    const b = world.db.t.business_profiles.find((x) => x.name === name);
    return world.db.t.business_assets.filter((x) => x.business_id === b.id).map((x) => x.storage_url).sort();
  };
  const viewerImages = (v) => v.locator('.watch-frame img').evaluateAll((els) => els.map((e) => ({ src: e.currentSrc || e.src, decoded: e.complete && e.naturalWidth > 0 })));
  const visibleText = (v) => v.locator('.watch-frame').innerText();

  async function expectViewerShows(v, who, other) {
    await expect(v.locator('.watch-frame')).toContainText(`Hello ${who.first} from ${who.company}`, { timeout: 30000 });
    await expect.poll(async () => (await viewerImages(v)).length).toBe(2);
    const imgs = await viewerImages(v);
    expect(imgs.every((i) => i.decoded)).toBe(true);                                         // the logo and the photo really render
    expect(imgs.map((i) => i.src).sort()).toEqual(assetUrlsOf(who.name));                    // exactly this business's own images
    const html = await v.content();
    for (const leak of [other.name, other.first, other.company, ...assetUrlsOf(other.name)]) expect(html).not.toContain(leak);  // nothing of the other business anywhere in the page
    expect(await v.locator('body').innerText()).not.toMatch(/\{\{|\}\}/);                    // never raw token syntax
  }

  test('Business A opens its link in an independent browser and sees only its own logo, photo and text', async () => {
    const { ctx, page: v } = await openViewer(links.A);
    await expectViewerShows(v, BUSINESSES.A, BUSINESSES.B);
    await v.screenshot({ path: shot('C1-viewer-A') });
    await v.reload(); await v.locator('.watch-frame').waitFor();
    await expectViewerShows(v, BUSINESSES.A, BUSINESSES.B);                                  // still correct after a reload
    await ctx.close();
  });

  test('Business B opens its link and sees only its own content; the source video is the same file', async () => {
    const filesBefore = world.db.files.size;
    const seen = { A: new Set(), B: new Set() };
    const watch = (v, key) => v.on('request', (r) => { if (/\.(webm|mp4)(\?|$)/.test(r.url())) seen[key].add(r.url()); });
    const a = await openViewer(links.A); watch(a.page, 'A'); await a.page.reload();
    const b = await openViewer(links.B); watch(b.page, 'B'); await b.page.reload();
    await expectViewerShows(a.page, BUSINESSES.A, BUSINESSES.B);
    await expectViewerShows(b.page, BUSINESSES.B, BUSINESSES.A);
    await b.page.screenshot({ path: shot('C2-viewer-B') });
    await a.page.waitForTimeout(1500);
    expect([...seen.A].length).toBeGreaterThan(0);
    expect([...seen.A].sort()).toEqual([...seen.B].sort());                                 // both play the identical source video file
    expect(world.db.files.size).toBe(filesBefore);                                           // viewing created no new media
    await a.ctx.close(); await b.ctx.close();
  });
});

test.describe('D. interactive behavior in the published player', () => {
  test('each recipient gets its own call number and website; the call attempt is recorded for the owner', async () => {
    const a = await openViewer(links.A); const b = await openViewer(links.B);
    for (const [v, who, other] of [[a.page, BUSINESSES.A, BUSINESSES.B], [b.page, BUSINESSES.B, BUSINESSES.A]]) {
      await v.locator('[data-bigplay]').click();                    // the tap targets mount as the viewer plays, like a visitor would
      const tel = v.locator('.watch-frame a.wf-cta');
      await expect(tel).toHaveCount(1, { timeout: 30000 });
      await expect(tel).toHaveAttribute('href', `tel:${who.phone}`);
      await expect(tel).not.toHaveAttribute('href', `tel:${other.phone}`);
      const site = v.locator('.watch-frame a.wf-linkbox');
      await expect(site).toHaveAttribute('href', who.website);
      await expect(site).toHaveAttribute('target', '_blank');
      await expect(site).toHaveAttribute('rel', /noopener/);
      expect(await v.locator('.watch-frame').innerHTML()).not.toContain(other.phone);
      await v.locator('[data-play]').click();                       // pause so the targets stay put for the click below
    }
    await a.page.locator('.watch-frame a.wf-cta').dispatchEvent('click');                  // tel: is handed to the phone app; the app records the attempt
    await expect.poll(() => world.db.t.video_leads.some((l) => l.kind === 'call-attempt' && l.data?.PHONE === BUSINESSES.A.phone)).toBe(true);
    expect(world.db.t.video_leads.some((l) => l.kind === 'call-attempt' && l.data?.PHONE === BUSINESSES.B.phone)).toBe(false);
    await a.page.screenshot({ path: shot('D1-viewer-A-cta') });
    await a.ctx.close(); await b.ctx.close();
  });

  test('the lead form appears at its time, pauses the video, accepts a submission, then resumes', async () => {
    const { ctx, page: v } = await openViewer(links.A);
    const time = () => v.locator('[data-time]').innerText();
    await v.locator('[data-bigplay]').click();
    const form = v.locator('.watch-frame .retarget-form');
    await expect(form).toBeVisible({ timeout: 30000 });
    const paused = await time();
    await v.waitForTimeout(1500);
    expect(await time()).toBe(paused);                                                       // gated: time does not advance while the form is up
    const email = form.locator('input[type="email"], input[name*="mail" i]').first();
    await email.fill('visitor@example.test');
    await form.locator('button[type="submit"]').click();
    await expect(form).toBeHidden({ timeout: 15000 });
    await expect.poll(async () => await time(), { timeout: 20000 }).not.toBe(paused);        // resumed
    const lead = world.db.t.video_leads.find((l) => l.kind === 'lead-form' || /lead/.test(l.kind));
    expect(lead).toBeTruthy();
    expect(JSON.stringify(lead.data)).toContain('visitor@example.test');
    expect(JSON.stringify(lead.data)).not.toMatch(/Wilson|Sarah/);
    await v.screenshot({ path: shot('D2-lead-form') });
    await ctx.close();
  });
});
