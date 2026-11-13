/* eslint-disable no-undef -- document / getComputedStyle run inside page.evaluate (the browser) */
import { test, expect } from '@playwright/test';

/**
 * "Add to timeline" modal (CineGen editor, EDIT tab): the "+ Add" button in the Overlays lane opens one modal with every
 * way to add content (Animations, Motion graphics, Overlays & forms, End screens & connect forms, plus an All tab).
 * Smart Speech, Template Generator and Personalization are NOT in it: they have their own buttons in the lane header.
 *
 * Skips when the editor shell is gated (no Project Manager reachable), like the other timeline specs.
 * Animations previews are not asserted: they need the HyperFrames thumbnails (public/hyperframes/thumbs) or network for fonts.
 */

const TABS = {
  all: /^▦\s*All/,
  animations: /^✦\s*Animations/,
  motion: /^✺\s*Motion graphics/,
  overlays: /^▭\s*Overlays/,
  endscreens: /^▶\s*End screens/,
};

const dialog = (page) => page.getByRole('dialog', { name: 'Add to timeline' });
const lane = (page) => page.locator('[data-testid="overlay-lane"] [role="button"]');
const addButton = (page) => page.getByRole('button', { name: 'Add to timeline', exact: true });
// the modal's own tab strip is the first "Categories" tablist (the Animations panel has another one inside)
const topTab = (page, name) => dialog(page).getByRole('tablist', { name: 'Categories' }).first().getByRole('tab', { name: TABS[name] });
const cardIds = (page, prefix) => page.locator(`[data-testid^="${prefix}"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')).filter((t) => !t.endsWith('-add')));
const tabCount = async (page, name) => Number(((await topTab(page, name).innerText()).match(/(\d+)\s*$/) || [])[1]);

async function openEditor(page) {
  await page.goto('/#/timeline', { waitUntil: 'domcontentloaded' });
  const skip = page.getByRole('button', { name: 'Skip for now' });
  await skip.waitFor({ timeout: 8000 }).then(() => skip.click()).catch(() => {});
  // the welcome overlay can stay mounted after Skip; it only asks for API keys, so remove it
  await page.evaluate(() => document.querySelectorAll('div.fixed.inset-0').forEach((e) => { if (/API keys/.test(e.innerText)) e.remove(); })).catch(() => {});
  const newProject = page.locator('.pm-bottombar__btn', { hasText: 'New Project' });
  const reachable = await newProject.waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  test.skip(!reachable, 'Timeline editor is gated in this environment');
  await newProject.click();
  await page.getByPlaceholder('Project name...').fill(`E2E ${Date.now()}`);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.locator('.top-nav__tab', { hasText: /^\s*EDIT\s*$/i }).click();
  await expect(addButton(page)).toBeVisible({ timeout: 20000 });
}

async function openModal(page, tab = 'all') {
  await addButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await topTab(page, tab).click();
}

/** Click the + of a card and wait for the modal to close. Returns after the lane has grown. */
async function addViaPlus(page, tab, testId, { phone = '212 555 0147', exact = true } = {}) {
  const before = await lane(page).count();
  await openModal(page, tab);
  const plus = page.getByTestId(`${testId}-add`);
  await plus.scrollIntoViewIfNeeded();
  await plus.click();
  // Connect Form templates ask for the number the buttons should dial before adding
  const phoneInput = page.locator('input[aria-label="Phone number"]');
  if (await phoneInput.waitFor({ state: 'visible', timeout: 1200 }).then(() => true).catch(() => false)) {
    await phoneInput.fill(phone);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await expect(dialog(page)).toBeHidden();
  if (exact) await expect(lane(page)).toHaveCount(before + 1);
  else await expect.poll(() => lane(page).count()).toBeGreaterThan(before);
}

/** first, last and n evenly spaced items */
const sample = (ids, n) => [...new Set([0, ids.length - 1, ...Array.from({ length: n }, (_, i) => Math.floor(((i + 1) * ids.length) / (n + 1)))])].map((i) => ids[i]);

test.describe('Add to timeline modal', () => {
  test.beforeEach(async ({ page }) => { await openEditor(page); });

  test('lane header: + Add and the three feature buttons; no old dropdown', async ({ page }) => {
    await expect(addButton(page)).toHaveText(/\+ Add/);
    for (const name of ['Smart Speech', 'Template Generator', 'Personalization']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(page.locator('select[aria-label="Add overlay"]')).toHaveCount(0);
  });

  test('tabs and counts: All is the sum of the others', async ({ page }) => {
    await openModal(page, 'all');
    const [all, animations, motion, overlays, endscreens] = await Promise.all(['all', 'animations', 'motion', 'overlays', 'endscreens'].map((t) => tabCount(page, t)));
    expect(overlays).toBe(10);
    expect(endscreens).toBe(13);
    expect(animations).toBeGreaterThan(200);
    expect(motion).toBeGreaterThan(200);
    expect(all).toBe(animations + motion + overlays + endscreens);
    // none of the features that have their own modal is a card here
    for (const name of ['Smart Speech', 'Template Generator', 'Personalization']) await expect(dialog(page).locator('.add-card', { hasText: new RegExp(`^${name}`) })).toHaveCount(0);
  });

  test('every card has a + with the "Add to the timeline" tooltip', async ({ page }) => {
    for (const [tab, expected] of [['overlays', 10], ['endscreens', 13]]) {
      await openModal(page, tab);
      await expect(page.locator('.add-card')).toHaveCount(expected);
      await expect(page.locator('.add-card-plus')).toHaveCount(expected);
      await expect(page.locator('.add-card-plus').first()).toHaveAccessibleName(/Add to the timeline/);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
    }
    await openModal(page, 'overlays');
    const plus = page.locator('.add-card-plus').first();
    const tip = () => plus.evaluate((e) => ({ text: getComputedStyle(e, '::after').content, opacity: Number(getComputedStyle(e, '::after').opacity) }));
    await expect.poll(async () => (await tip()).opacity).toBeLessThan(0.1);
    await plus.hover();
    await expect.poll(async () => (await tip()).opacity).toBeGreaterThan(0.9);
    expect((await tip()).text).toContain('Add to the timeline');
    // the Animations and Motion graphics cards get it too
    for (const tab of ['animations', 'motion']) {
      await topTab(page, tab).click();
      await expect(page.locator('.add-card-plus').first()).toBeVisible();
      expect(await page.locator('.add-card-plus').count()).toBe(await page.locator('.add-card').count());
    }
  });

  test('Esc and click outside close it; clicking inside does not', async ({ page }) => {
    await openModal(page, 'animations');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await openModal(page, 'overlays');
    await dialog(page).getByText('Add to timeline', { exact: true }).first().click();
    await expect(dialog(page)).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(dialog(page)).toBeHidden();
  });

  test('+ adds every overlay (10) to the lane, once each', async ({ page }) => {
    test.setTimeout(240_000);
    await openModal(page, 'overlays');
    const ids = (await cardIds(page, 'add-')).filter((t) => !t.startsWith('add-tpl:'));
    await page.keyboard.press('Escape');
    expect(ids).toHaveLength(10);
    for (const id of ids) await addViaPlus(page, 'overlays', id);
    await expect(lane(page)).toHaveCount(10);
  });

  test('+ adds every end screen and connect form (13); connect forms ask for a phone', async ({ page }) => {
    test.setTimeout(240_000);
    await openModal(page, 'endscreens');
    const ids = await cardIds(page, 'add-tpl:');
    await page.keyboard.press('Escape');
    expect(ids).toHaveLength(13);
    for (const id of ids) await addViaPlus(page, 'endscreens', id, { exact: false });
  });

  test('a connect form: Cancel adds nothing, Add with a number does', async ({ page }) => {
    await openModal(page, 'endscreens');
    await dialog(page).locator('.add-card-wrap', { hasText: 'Connect Form: Call us now' }).locator('.add-card-plus').click();
    const phone = page.locator('input[aria-label="Phone number"]');
    await expect(phone).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(phone).toHaveCount(0);
    await expect(dialog(page)).toBeVisible();
    await expect(lane(page)).toHaveCount(0);
    await dialog(page).locator('.add-card-wrap', { hasText: 'Connect Form: Call us now' }).locator('.add-card-plus').click();
    await phone.fill('212 555 0147');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(dialog(page)).toBeHidden();
    await expect.poll(() => lane(page).count()).toBeGreaterThan(0);
  });

  test('the List Builder can only be added once', async ({ page }) => {
    await addViaPlus(page, 'overlays', 'add-list-builder');
    await openModal(page, 'overlays');
    await page.getByTestId('add-list-builder-add').click(); // selects the existing one instead of adding another
    await expect(dialog(page)).toBeHidden();
    await expect(lane(page).filter({ hasText: 'List Builder' })).toHaveCount(1);
    await expect(lane(page)).toHaveCount(1);
  });

  test('+ adds sampled animations and motion graphics; the card body adds exactly one block', async ({ page }) => {
    test.setTimeout(300_000);
    for (const [tab, prefix] of [['animations', 'animation-'], ['motion', 'mg-']]) {
      await openModal(page, tab);
      const ids = await cardIds(page, prefix);
      await page.keyboard.press('Escape');
      expect(ids.length).toBeGreaterThan(200);
      for (const id of sample(ids, 8)) await addViaPlus(page, tab, id);
    }
    // same sample from the All tab
    await openModal(page, 'all');
    const animation = (await cardIds(page, 'animation-'))[3];
    await page.keyboard.press('Escape');
    await addViaPlus(page, 'all', animation);
    // clicking the card itself (not the +) adds one block, not two
    const before = await lane(page).count();
    await openModal(page, 'overlays');
    await page.getByTestId('add-overlay-lower-third').click();
    await expect(dialog(page)).toBeHidden();
    await expect(lane(page)).toHaveCount(before + 1);
  });

  test('All tab: sections, search across types, and the live-preview cap while scrolling', async ({ page }) => {
    await openModal(page, 'all');
    await expect(dialog(page).locator('section[aria-label]')).toHaveCount(4);
    expect(await page.locator('.add-card').count()).toBe(await tabCount(page, 'all'));
    await dialog(page).getByRole('textbox', { name: 'Search', exact: true }).fill('lower');
    await expect.poll(() => dialog(page).locator('section[aria-label]').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('.add-card').count()).toBeLessThan(await tabCount(page, 'all'));
    await dialog(page).getByRole('textbox', { name: 'Search', exact: true }).fill('');
    const scroller = dialog(page).locator('section').first().locator('xpath=ancestor::div[contains(@style,"overflow: auto")][1]');
    for (const y of [2000, 6000, 12000, 20000, 40000]) {
      await scroller.evaluate((e, top) => { e.scrollTop = top; }, y);
      await page.waitForTimeout(700);
      expect(await page.locator('iframe.code-preview-frame').count()).toBeLessThanOrEqual(20);
    }
  });

  test('overlay and end-screen cards render a real preview; motion graphics show their thumbnail', async ({ page }) => {
    test.setTimeout(180_000);
    for (const tab of ['overlays', 'endscreens']) {
      await openModal(page, tab);
      const cards = dialog(page).locator('.add-card');
      const n = await cards.count();
      for (let i = 0; i < n; i++) {
        await cards.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(() => cards.nth(i).evaluate((c) => c.querySelectorAll('.addon-overlay-layer > *, img').length), { message: `card ${i} of ${tab} is blank` }).toBeGreaterThan(0);
      }
      await page.keyboard.press('Escape');
    }
    await openModal(page, 'motion');
    const imgs = dialog(page).locator('.add-card img');
    await expect.poll(() => imgs.count()).toBeGreaterThan(5);
    await expect.poll(() => imgs.evaluateAll((els) => els.slice(0, 8).every((e) => e.complete && e.naturalWidth > 0))).toBe(true);
  });

  test('the List Builder card preview shows the form only: no pointer-hint bubble over it, before or after 5 s, or on hover', async ({ page }) => {
    await openModal(page, 'overlays');
    const card = dialog(page).locator('.add-card-wrap', { hasText: 'List Builder' });
    const hint = card.locator('.overlay-arrow');
    await expect(card.locator('form')).toBeVisible();
    await expect(hint).toHaveCount(0);
    await page.waitForTimeout(6000); // the hint used to appear for the first 5 s, then fade
    await expect(card.locator('form')).toBeVisible();
    await expect(hint).toHaveCount(0);
    await card.hover();
    await page.waitForTimeout(1200);
    await expect(card.locator('form')).toBeVisible();
    await expect(hint).toHaveCount(0);
  });

  test('the Library sidebar has a Browse everything button that opens the modal', async ({ page }) => {
    await page.getByTestId('open-library').first().click();
    await page.getByTestId('library-open-add').click();
    await expect(dialog(page)).toBeVisible();
    await expect(topTab(page, 'all')).toBeVisible();
  });

  test('the modal covers the whole app (side rail included) and + Add is not cut off', async ({ page }) => {
    await expect(addButton(page)).toHaveText('+ Add'); // fully visible, not "+ A…"
    expect(await addButton(page).evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await openModal(page, 'overlays');
    // the corner and the left edge belong to the modal's backdrop, not to the app header or rail
    for (const [x, y] of [[2, 2], [6, 360]]) {
      expect(await page.evaluate(([px, py]) => !!document.elementFromPoint(px, py)?.closest('[role="dialog"][aria-modal="true"]'), [x, y]), `point ${x},${y}`).toBe(true);
    }
    // hovering the dialog must not pop an unrelated help card over it
    await page.mouse.move(640, 300);
    await page.waitForTimeout(900);
    await expect(page.locator('.help-tooltip, [data-help-card]')).toHaveCount(0);
  });

  test('the BILD lower third (GSAP based) renders its title and shows no error notice', async ({ page }) => {
    test.setTimeout(120_000);
    await openModal(page, 'all');
    await dialog(page).getByRole('textbox', { name: 'Search', exact: true }).fill('BILD');
    await dialog(page).locator('.add-card-wrap', { hasText: 'BILD Style' }).first().locator('.add-card-plus').click();
    await expect(dialog(page)).toBeHidden();
    await expect(lane(page)).toHaveCount(1);
    // the animation's own script runs inside the sandboxed preview frame; its text shows over the video
    const frame = page.frameLocator('iframe.code-preview-frame').first();
    await expect(frame.locator('#lb-main-text').first()).not.toBeEmpty({ timeout: 60_000 }); // the block's script set its title; with a missing gsap it never runs
    await expect(frame.locator('#lb-main-text').first()).toBeVisible();
    await expect(page.getByText(/could not be rendered|gsap\.timeline is not a function/i)).toHaveCount(0);
  });

  for (const [name, selector] of [['Smart Speech', '.speech-modal'], ['Template Generator', '.modal-overlay.active'], ['Personalization', '.modal-overlay.active']]) {
    test(`the ${name} button opens its own modal`, async ({ page }) => {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator(selector).first()).toBeVisible({ timeout: 15000 });
      await expect(dialog(page)).toHaveCount(0);
    });
  }
});
