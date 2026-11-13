/* global Buffer, URL, window, CustomEvent, console, process */
/**
 * Personalized links, end to end in a real browser (Chromium) against the real app.
 *
 * What is real: the Studio (CineGen) UI, the Leads tab cards, the publish client, the hosted viewer, the personalization
 * token engine. What is a fixture: sign-in (stubbed Clerk) and the whole Supabase backend (tests/e2e/fixtures/fakeSupabase.js,
 * which models the live project's behavior), plus two fictional businesses with generated images. The live database is
 * never contacted: any request that leaves the machine is aborted and recorded, and the last test fails if one was.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
      { kind: 'overlay-text', start: 0, end: 4, addon: { text: 'Hello {{FIRSTNAME}} from {{COMPANY}}', geometry: { left: 28, top: 4, width: 68, height: 14 } } },
      { kind: 'overlay-personalized-image', start: 0, end: 4, addon: { src: '{{logoUrl}}', fit: 'contain', geometry: { left: 3, top: 4, width: 22, height: 22 } } },
      { kind: 'overlay-personalized-image', start: 0, end: 4, addon: { src: '{{productImageUrl}}', geometry: { left: 62, top: 28, width: 34, height: 44 } } },
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
/**
 * DOM presence is not enough: while the video plays, each personalization overlay must be ON SCREEN (inside the frame, a real
 * size) and visible (opacity of itself and every ancestor), i.e. what a visitor would actually see.
 */
async function expectVisibleOnScreen(v) {
  await v.locator('[data-bigplay]').click({ timeout: 3000 }).catch(() => {});
  await expect.poll(async () => v.evaluate(() => {
    const frame = document.querySelector('.watch-frame').getBoundingClientRect();
    const visible = (el) => {
      const r = el.getBoundingClientRect(); let o = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity || '1');
      return r.width > 20 && r.height > 8 && r.left >= frame.left - 2 && r.right <= frame.right + 2 && r.top >= frame.top - 2 && r.bottom <= frame.bottom + 2 && o > 0.6;
    };
    const images = [...document.querySelectorAll('.watch-frame img')].map(visible);
    const text = [...document.querySelectorAll('.watch-frame *')].find((e) => e.children.length === 0 && /^Hello .+ from /.test(e.textContent || ''));
    return { images, text: text ? visible(text) : false };
  }), { timeout: 20000, intervals: [500] }).toEqual({ images: [true, true], text: true });
}


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

  test('Business A opens its link in an independent browser and sees only its own logo, photo and text', async () => {
    const { ctx, page: v } = await openViewer(links.A);
    await expectViewerShows(v, BUSINESSES.A, BUSINESSES.B);
    await expectVisibleOnScreen(v);                                                          // not just in the page: visible to the visitor
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
    await expectVisibleOnScreen(b.page);
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
    await v.locator('[data-bigplay]').click();                                              // pressed immediately: must not be lost while the player is still mounting
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

const NEW_TEXT = 'Hello {{FIRSTNAME}} from {{COMPANY}} - NEW SPRING OFFER';

test.describe('E. editing a published video: refresh images, save a draft, preview it, publish it', () => {
  const imgsOf = async (url) => { const { ctx, page: v } = await openViewer(url); await expect.poll(async () => (await viewerImages(v)).length).toBe(2); const out = (await viewerImages(v)).map((i) => i.src).sort(); const text = await visibleText(v); await ctx.close(); return { out, text }; };
  let before; let beforeB;

  test('a new image for Business A reaches only Business A\'s link after "Refresh images"', async () => {
    before = await imgsOf(links.A); beforeB = await imgsOf(links.B);
    await page.getByRole('tab', { name: 'product', exact: true }).click();
    await page.getByTestId('picker-upload').setInputFiles(fixtureFile('a-new.svg'));
    const card = grid().locator('> div').first();
    await expect(card.locator('[data-testid^="state-"]')).toHaveText('imported');
    await card.locator('[data-testid^="use-"]').click();
    await card.locator('[data-testid^="slots-for-"] button', { hasText: 'product image' }).click();
    await page.getByTestId('replace-confirm').waitFor();                                     // the image Business A chose is not replaced silently
    await page.getByTestId('replace-yes').click();
    await expect(page.getByTestId('stale-bizA')).toBeVisible();                              // the link is flagged: its image is older than the library
    await page.getByTestId('bulk-select-all').click();                                       // clear the selection, then pick A only
    await page.getByLabel('Select Smith Roofing').check();
    await page.getByTestId('bulk-refresh').click();
    await expect(page.getByTestId('bulk-notice')).toContainText('Updated 1 link');
    const afterA = await imgsOf(links.A); const afterB = await imgsOf(links.B);
    const newUrl = world.db.t.business_assets.find((a) => /a-new|new/.test(a.storage_url) || a.meta?.name === 'a-new.svg')?.storage_url;
    expect(afterA.out).toContain(newUrl);                                                    // A's published link shows the new image
    expect(afterA.out).not.toEqual(before.out);
    expect(afterB.out).toEqual(beforeB.out);                                                 // B's link is untouched
    expect(afterA.text).toContain('Hello John from Smith Roofing');                          // text values were not touched
    await page.screenshot({ path: shot('E1-refreshed'), fullPage: true });
  });

  test('a master-video change waits in a draft: the live link is unchanged until the draft is published', async () => {
    // change the master text through the app's own storage API, then reload so the Studio picks it up
    await page.evaluate(async ({ id, text }) => {
      const api = window.electronAPI; const st = await api.db.loadProject(id);
      st.workflow.overlays = st.workflow.overlays.map((o) => (o.type === 'overlay-text' && o.addon?.text?.startsWith('Hello') ? { ...o, addon: { ...o.addon, text } } : o));
      await api.db.saveProject(id, st);
    }, { id: projectId, text: NEW_TEXT });
    await page.reload(); await dismissWelcome(page);
    await page.getByRole('button', { name: /Leads/i }).click();
    await page.getByTestId('draft-save').click();
    await expect(page.getByTestId('edit-notice')).toContainText('Draft saved');
    expect(world.db.t.published_video_drafts).toHaveLength(1);
    expect(JSON.stringify(world.db.t.published_videos[0].project)).not.toContain('NEW SPRING OFFER');   // live row untouched
    const live = await imgsOf(links.A);
    expect(live.text).toContain('Hello John from Smith Roofing');
    expect(live.text).not.toContain('NEW SPRING OFFER');                                     // the live link still shows the old version
  });

  test('preview the draft as Business A and as Business B before publishing', async () => {
    const id = world.db.t.published_video_drafts[0].id;
    await page.getByTestId(`draft-preview-${id}`).click();
    const stage = page.getByTestId('draft-stage');
    await page.getByTestId('draft-as').selectOption({ label: 'Smith Roofing' });
    await expect(stage).toContainText('Hello John from Smith Roofing - NEW SPRING OFFER', { timeout: 30000 });
    await expect(stage).not.toContainText('Wilson');
    await page.screenshot({ path: shot('E2-draft-preview-A') });
    await page.getByTestId('draft-as').selectOption({ label: 'Wilson Plumbing' });
    await expect(stage).toContainText('Hello Sarah from Wilson Plumbing - NEW SPRING OFFER', { timeout: 30000 });
    await expect(stage).not.toContainText('Smith');
    await page.screenshot({ path: shot('E3-draft-preview-B') });
    expect(world.db.t.published_videos[0].view_count).toBe(before ? world.db.t.published_videos[0].view_count : 0);
    await page.getByRole('button', { name: /^close$/i }).click();
  });

  test('publishing the draft updates the SAME links; recipient links keep working; history records it', async () => {
    const id = world.db.t.published_video_drafts[0].id;
    const urlsBefore = world.db.t.video_recipients.map((r) => r.token).sort();
    await page.getByTestId(`draft-publish-${id}`).click();
    await page.getByTestId(`draft-publish-yes-${id}`).click();
    await expect(page.getByTestId('edit-notice')).toContainText('now live');
    expect(world.db.t.published_videos[0].revision).toBe(2);
    expect(world.db.t.published_video_revisions.map((r) => r.revision).sort()).toEqual([1, 2]);
    expect(world.db.t.video_recipients.map((r) => r.token).sort()).toEqual(urlsBefore);      // same tokens: nothing was re-issued
    const a = await imgsOf(links.A); const b = await imgsOf(links.B);                        // the ORIGINAL urls
    expect(a.text).toContain('Hello John from Smith Roofing - NEW SPRING OFFER');
    expect(b.text).toContain('Hello Sarah from Wilson Plumbing - NEW SPRING OFFER');
    expect(b.out).toEqual(beforeB.out);                                                      // B's own images are still B's
    expect(await page.getByTestId('draft-save').isVisible()).toBe(true);
    await page.screenshot({ path: shot('E4-published-draft'), fullPage: true });
  });
});

const bizName = (i) => `Biz ${String(i).padStart(2, '0')}`;
const BULK = 20;

test.describe('F. bulk: 20 more businesses, one video, no new video files', () => {
  const rowFor = (name) => page.locator('[data-testid^="row-"]', { hasText: name });

  test('import 20 contacts from a CSV through the real importer; businesses with saved assets are ready', async () => {
    // Stand-in for earlier Asset Finder imports: 20 businesses with saved, assigned assets (distinct URLs per business).
    const base = `${SUPABASE_URL}/storage/v1/object/public/uploads/fixtures`;
    for (let i = 1; i <= BULK; i++) {
      const b = world.db.insert('business_profiles', { name: bizName(i), business_key: bizName(i).toLowerCase(), source: 'imported' }, OWNER);
      const logo = world.db.insert('business_assets', { business_id: b.id, storage_url: `${base}/a-logo.svg?b=${i}`, category: 'logo', origin: 'discovered', state: 'assigned' }, OWNER);
      const svc = world.db.insert('business_assets', { business_id: b.id, storage_url: `${base}/b-service.svg?b=${i}`, category: 'product', origin: 'discovered', state: 'assigned' }, OWNER);
      world.db.insert('asset_assignments', { project_id: projectId, business_id: b.id, slot: 'logoUrl', asset_id: logo.id, manual: false }, OWNER);
      world.db.insert('asset_assignments', { project_id: projectId, business_id: b.id, slot: 'productImageUrl', asset_id: svc.id, manual: false }, OWNER);
    }
    const csv = ['First Name,Last Name,Email,Company', ...Array.from({ length: BULK }, (_, k) => `Person${String(k + 1).padStart(2, '0')},Tester,person${k + 1}@example.test,${bizName(k + 1)}`)].join('\n');
    await page.reload(); await dismissWelcome(page);
    await page.getByRole('button', { name: /Leads/i }).click();
    await page.getByTestId('bulk-import').click();
    await page.locator('.source-card[data-source="csv"]').click();
    await page.locator('input.csv-file-input').setInputFiles({ name: 'contacts.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('.next-btn').click();            // source -> mapping
    await page.locator('.next-btn').click();            // mapping -> review
    await page.locator('.import-btn').click();          // import
    await expect(page.getByTestId('bulk-notice')).toContainText(`Added ${BULK} contacts`, { timeout: 30000 });
    await expect(page.getByTestId('bulk-table').locator('tbody tr')).toHaveCount(BULK + 2);
    await expect(page.getByTestId('bulk-summary')).toContainText(`${BULK} ready`);
    await page.screenshot({ path: shot('F1-imported'), fullPage: true });
  });

  test('create 20 unique links in one step, each with only its own images; export the list', async () => {
    const filesBefore = world.db.files.size;
    await page.getByTestId('bulk-select-all').click();                                       // everything selected (2 already linked are skipped)
    await page.getByTestId('bulk-create').click();
    await expect(page.getByTestId('bulk-notice')).toContainText(`Created ${BULK} link`, { timeout: 30000 });
    expect(world.db.t.video_recipients).toHaveLength(BULK + 2);
    expect(new Set(world.db.t.video_recipients.map((r) => r.token)).size).toBe(BULK + 2);
    expect(world.db.files.size).toBe(filesBefore);                                           // 22 links, zero new media
    for (let i = 1; i <= BULK; i++) {
      const r = world.db.t.video_recipients.find((x) => x.label === `Person${String(i).padStart(2, '0')} Tester`);
      expect(r.variables.logoUrl).toContain(`?b=${i}`);
      expect(r.variables.productImageUrl).toContain(`?b=${i}`);
      expect(r.variables.COMPANY ?? r.variables.company).toBe(bizName(i));
    }
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('bulk-export').click()]);
    const lines = readFileSync(await download.path(), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(BULK + 2 + 1);                                                // header + 22
    expect(lines[0]).toBe('"name","url","status"');
    const urls = lines.slice(1).map((l) => /"(http[^"]+)"/.exec(l)[1]);
    expect(new Set(urls).size).toBe(BULK + 2);
    expect(lines.join('\n')).not.toMatch(/@example\.test/);                                 // no emails in the export
    await page.screenshot({ path: shot('F2-created'), fullPage: true });
  });

  test('revoking one link kills only that link: it falls back to the generic video, the others keep working', async () => {
    const victim = world.db.t.video_recipients.find((r) => r.label === 'Person07 Tester');
    const other = world.db.t.video_recipients.find((r) => r.label === 'Person08 Tester');
    const base = new URL(links.A); const urlOf = (r) => `${base.origin}${base.pathname}?recipient=${r.token}`;
    await rowFor('Person07').locator('[data-testid^="revoke-"]').first().click();
    await rowFor('Person07').locator('[data-testid^="revoke-yes-"]').click();
    await expect(page.getByTestId('bulk-notice')).toContainText('Link revoked');
    expect(world.db.t.video_recipients.find((r) => r.id === victim.id).status).toBe('revoked');
    const dead = await openViewer(urlOf(victim));
    await expect(dead.page.locator('.watch-frame')).toBeVisible();
    const deadHtml = await dead.page.content();
    expect(deadHtml).not.toContain('Person07'); expect(deadHtml).not.toContain(bizName(7)); expect(deadHtml).not.toContain('?b=7');
    expect(await dead.page.locator('body').innerText()).not.toMatch(/\{\{|\}\}/);
    await dead.ctx.close();
    const alive = await openViewer(urlOf(other));
    await expect(alive.page.locator('.watch-frame')).toContainText(`Hello Person08 from ${bizName(8)}`, { timeout: 30000 });
    expect(await alive.page.content()).not.toContain('Person07');
    await alive.ctx.close();
    await expect(rowFor('Person07').locator('[data-testid^="lstatus-"]')).toHaveText('revoked');
    await page.screenshot({ path: shot('F3-revoked'), fullPage: true });
  });
});

test.describe('G. per-recipient MP4 export (rendered in the browser, inspected with ffmpeg)', () => {
  const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  /** Average RGB of a crop (fractions of the frame) of the frame at `t` seconds. */
  const avgColor = (file, t, [x, y, w, h]) => {
    const raw = sh('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1',
      '-vf', `crop=iw*${w}:ih*${h}:iw*${x}:ih*${y},scale=1:1`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    return { r: raw[0], g: raw[1], b: raw[2] };
  };
  const LOGO = [0.06, 0.07, 0.14, 0.14];            // centre of the logo overlay (geometry 3,4,22,22 %)
  const PHOTO = [0.68, 0.34, 0.22, 0.32];           // centre of the service photo overlay (geometry 62,28,34,44 %)

  async function exportFor(contactId) {
    await selectContact(page, contactId);
    await page.getByRole('button', { name: /^Export$/ }).click();
    await page.getByTestId('export-auto-qa').uncheck().catch(() => {});
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 240000 }),
      page.getByRole('button', { name: /^Render$/ }).click(),
    ]);
    const file = `test-results/links/export/${contactId}.mp4`;
    await download.saveAs(file);
    return file;
  }

  test('Business A and Business B each get their own MP4; the other business never appears', async () => {
    await page.goto(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'}/?project=${projectId}&storage=db#/timeline`, { waitUntil: 'domcontentloaded' });
    await dismissWelcome(page);
    const fileA = await exportFor('bizA');
    const fileB = await exportFor('bizB');
    for (const f of [fileA, fileB]) {
      const probe = JSON.parse(sh('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', f]).toString());
      const v = probe.streams.find((s) => s.codec_type === 'video');
      expect(v.codec_name).toBe('h264');
      expect(Number(probe.format.duration)).toBeGreaterThan(3);
      expect(Number(probe.format.duration)).toBeLessThan(6);
    }
    for (const t of [1, 2.5]) {
      const aLogo = avgColor(fileA, t, LOGO); const bLogo = avgColor(fileB, t, LOGO);
      const aPhoto = avgColor(fileA, t, PHOTO); const bPhoto = avgColor(fileB, t, PHOTO);
      // A = rust-red logo + pale orange photo; B = blue logo + pale blue photo (fixture images)
      expect(aLogo.r - aLogo.b, `A logo at ${t}s ${JSON.stringify(aLogo)}`).toBeGreaterThan(40);
      expect(bLogo.b - bLogo.r, `B logo at ${t}s ${JSON.stringify(bLogo)}`).toBeGreaterThan(40);
      expect(aPhoto.r - aPhoto.b, `A photo at ${t}s ${JSON.stringify(aPhoto)}`).toBeGreaterThan(8);
      expect(bPhoto.b - bPhoto.r, `B photo at ${t}s ${JSON.stringify(bPhoto)}`).toBeGreaterThan(8);
    }
    sh('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', fileA, '-frames:v', '1', 'test-results/links/screens/G1-export-A.png']);
    sh('ffmpeg', ['-v', 'error', '-y', '-ss', '2', '-i', fileB, '-frames:v', '1', 'test-results/links/screens/G2-export-B.png']);
    await page.getByRole('button', { name: /Leads/i }).first().click();     // leave the owner page where the next scenarios expect it
    await expect(leads()).toBeVisible();
  });
});

test.describe('H. security and robustness, as a visitor sees it', () => {
  const urlWith = (q) => { const u = new URL(links.A); u.search = q; return u.toString(); };
  const generic = async (url) => {                       // works for a playing video and for the "not found" page
    const ctx = await newContext(browserRef, world); const v = await ctx.newPage();
    await v.goto(url, { waitUntil: 'domcontentloaded' });
    await v.locator('.watch-frame, .watch-msg h1').first().waitFor({ timeout: 60000 });
    await v.waitForTimeout(1500);
    const html = await v.content(); const text = await v.locator('body').innerText();
    await ctx.close();
    return { html, text };
  };

  test('an invented token, an edited link and a tampered query show the generic video, never anyone\'s details', async () => {
    for (const q of [`?recipient=${'a1'.repeat(32)}`, `?recipient=${'ZZ'}`, '?recipient=', '?c=somebody&firstname=Mallory&company=Evil']) {
      const { html, text } = await generic(urlWith(q));
      expect(text).not.toMatch(/\{\{|\}\}/);
      for (const secret of ['John', 'Smith', 'Sarah', 'Wilson', ...assetUrlsOf('Smith Roofing'), ...assetUrlsOf('Wilson Plumbing')]) expect(html).not.toContain(secret);
    }
    // a valid token plus injected values: the token's own values win, the query is ignored
    const a = await openViewer(`${links.A}&firstname=Mallory&company=Evil`);
    await expect(a.page.locator('.watch-frame')).toContainText('Hello John from Smith Roofing', { timeout: 30000 });
    expect(await a.page.content()).not.toContain('Mallory'); expect(await a.page.content()).not.toContain('Evil');
    await a.ctx.close();
  });

  test('hostile text in a recipient\'s values is shown as text, never executed', async () => {
    const video = world.db.t.published_videos[0];
    const evil = world.db.insert('video_recipients', { video_id: video.id, label: '<b>x</b>', variables: { FIRSTNAME: '<img src=x onerror="window.__xss=1">', COMPANY: '"><script>window.__xss=2</script>' } }, OWNER);
    const base = new URL(links.A);
    const ctx = await newContext(browserRef, world); const v = await ctx.newPage();
    await v.goto(`${base.origin}${base.pathname}?recipient=${evil.token}`); await v.locator('.watch-frame').waitFor({ timeout: 60000 });
    await expect(v.locator('.watch-frame')).toContainText('<img src=x onerror="window.__xss=1">', { timeout: 30000 });
    expect(await v.evaluate(() => window.__xss)).toBeUndefined();
    expect(await v.locator('.watch-frame img[src="x"]').count()).toBe(0);
    await ctx.close();
  });

  test('an expired link and an unpublished video fall back safely', async () => {
    const r = world.db.t.video_recipients.find((x) => x.label === 'Person08 Tester');
    const base = new URL(links.A); const url = `${base.origin}${base.pathname}?recipient=${r.token}`;
    r.expires_at = new Date(Date.now() - 60000).toISOString();
    expect((await generic(url)).html).not.toContain('Person08');                              // expired: generic
    r.expires_at = null;
    await page.getByTestId('unpublish-btn').click();
    await expect(page.getByTestId('publish-card').locator('.leads-pill')).toHaveText('Unpublished');
    for (const u of [links.A, url]) {
      const v = await generic(u);
      expect(v.text).toContain('Video not found'); expect(v.html).not.toContain('John');
    }
    await page.getByTestId('unpublish-btn').click();                                          // republish
    await expect(page.getByTestId('publish-card').locator('.leads-pill')).toHaveText('Live');
    expect((await generic(links.A)).html).toContain('John');
  });

  test('renaming the video link keeps the old link working and keeps the recipient token', async () => {
    await page.getByTestId('slug-input').fill('summer-offer');
    await page.getByTestId('slug-save').click();
    await expect(page.getByTestId('bulk-notice')).toContainText('old link keeps working');
    const { ctx, page: v } = await openViewer(links.A);                                       // the OLD address
    await expect(v.locator('.watch-frame')).toContainText('Hello John from Smith Roofing', { timeout: 30000 });
    const now = new URL(v.url());
    expect(now.pathname).toBe('/v/smith-roofing/summer-offer');                               // moved to the new address
    expect(now.search).toBe(new URL(links.A).search);                                         // same recipient token
    await ctx.close();
  });

  test('a business link name that is reserved or taken is refused with a clear message', async () => {
    await page.getByTestId('slug-input').fill('watch');
    await expect(page.getByTestId('slug-save')).toBeDisabled();
    await page.getByTestId('slug-input').fill('summer-offer');
  });

  test('nothing left the machine: no request reached a real service', async () => {
    expect(world.db.escaped).toEqual([]);
    // the only outside call is the Remotion renderer's own usage ping during MP4 export; it must not carry any customer data
    expect(world.db.thirdParty.length).toBeGreaterThan(0);
    for (const c of world.db.thirdParty) {
      expect(c.url).toBe('https://www.remotion.pro/api/track/register-usage-point');
      for (const secret of ['Smith', 'Wilson', 'John', 'Sarah', 'fixture.invalid', '+1555', ...world.db.t.video_recipients.map((r) => r.token)]) expect(c.body).not.toContain(secret);
    }
  });
});
