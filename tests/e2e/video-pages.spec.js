/* global process */
// Video Pages, end to end, signed in (see playwright.video-pages.config.js for how to run it).
//  1. In every studio: the top-bar Video Pages button opens the window, an uploaded video goes on the page,
//     and a design opens in the page editor.
//  2. Once, in depth: edit the headline, trim the video and set its poster, save, publish, then open the
//     public page signed out and check the edit is there and the video actually loads.
// Nothing here spends credits or sends email. The pages it creates are drafts/test pages of the test account.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STUDIOS = [
  'explore', 'apps', 'smart-video-studio', 'academy', 'image', 'edit', 'upscale', 'commercial', 'brand', 'video', 'cinema',
  'templates', 'cinema-template', 'storyboard', 'animate', 'effects', 'ai-vfx', 'videotools', 'audio', 'lipsync', 'avatar',
  'character', 'influencer', 'zackd', 'video-agent', 'motion-director', 'director', 'timeline', 'workbench', 'personalizer',
  'outreach', 'smartwarmupai', 'website-builder', 'viral', 'media-hub', 'library', 'content-library',
];
const HEADLINE = `Video Pages check ${Date.now() % 100000}`;

// A tiny real MP4 made with ffmpeg (skips the suite when ffmpeg is missing).
const dir = mkdtempSync(join(tmpdir(), 'vp-'));
const clip = join(dir, 'vp-check.mp4');
try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=15', '-pix_fmt', 'yuv420p', clip]); } catch { /* checked below */ }

test.skip(!process.env.VIDEO_PAGES_STORAGE_STATE, 'needs VIDEO_PAGES_STORAGE_STATE (a signed-in test account)');
test.skip(!existsSync(clip), 'needs ffmpeg to make the test clip');

async function openStudio(page, route) {
  await page.goto(`/#/${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('[data-video-pages-button]').first().waitFor({ state: 'visible', timeout: 30_000 });
  const keys = page.locator('[data-api-keys-modal] [aria-label="Close"]');
  if (await keys.count()) await keys.first().click().catch(() => {});
}

/** Click Video Pages, upload the clip, open the "Editable landing page" design. Returns the picker locator. */
async function uploadAndOpenEditor(page) {
  await page.locator('[data-video-pages-button]').first().click();
  const picker = page.locator('[data-landing-picker]');
  await expect(picker).toBeVisible({ timeout: 20_000 });
  const chooser = page.locator('[data-video-chooser]');
  if (!(await chooser.count())) await picker.getByRole('button', { name: /^(Choose|Change) video$|^Choose a video$/ }).first().click();
  await chooser.locator('input[type=file]').first().setInputFiles(clip);
  await expect(picker.locator('[data-picker-video]')).toContainText('vp-check', { timeout: 20_000 });
  await picker.getByText('Editable landing page', { exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Save as my page' })).toBeVisible({ timeout: 30_000 });
  return picker;
}

for (const route of STUDIOS) {
  test(`Video Pages from ${route}: opens, takes an upload, opens the editor`, async ({ page }) => {
    await openStudio(page, route);
    await uploadAndOpenEditor(page);
  });
}

test('edit, trim, save, publish: the public page shows the edit and the video loads', async ({ page, browser }) => {
  await openStudio(page, 'image');
  const picker = await uploadAndOpenEditor(page);
  const canvas = () => page.frames().find((f) => f.url() === 'about:srcdoc');
  await expect.poll(() => !!canvas(), { timeout: 20_000 }).toBe(true);
  await canvas().locator('h1').first().click();

  const visible = async (sel, pred = async () => true) => {
    const all = picker.locator(sel);
    for (let i = 0; i < await all.count(); i++) { const f = all.nth(i); if (await f.isVisible() && await pred(f)) return f; }
    return null;
  };
  const headline = await visible('textarea', async (f) => /smarter way/i.test(await f.inputValue()));
  expect(headline, 'the hero headline field').not.toBeNull();
  await headline.fill(HEADLINE);
  for (const [name, value] of [['viewerStart', '0.2'], ['viewerEnd', '1.5'], ['viewerPosterAt', '1']]) {
    const f = await visible(`input[name="${name}"]`);
    expect(f, `video field ${name}`).not.toBeNull();
    await f.fill(value); await f.press('Tab');
  }
  await expect(canvas().locator('h1').first()).toContainText(HEADLINE);

  await page.getByRole('button', { name: 'Save as my page' }).click();
  await expect(picker).toContainText('Saved to Video Pages', { timeout: 90_000 });
  page.on('dialog', (d) => d.accept());
  await picker.getByRole('button', { name: /Publish and copy link/i }).click();
  await expect(picker).toContainText('published', { timeout: 30_000 });
  const url = (await picker.innerText()).match(/https:\/\/\S+\/p\/[A-Za-z0-9]+/)?.[0];
  expect(url, 'the page link').toBeTruthy();

  // As a visitor: no sign-in.
  const visitor = await browser.newContext({ storageState: undefined });
  const pub = await visitor.newPage();
  await pub.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await expect(pub.locator('h1').first()).toContainText(HEADLINE, { timeout: 30_000 });
  const video = pub.locator('video').first();
  await expect(video).toHaveCount(1);
  await expect.poll(async () => video.evaluate((v) => ({ ok: !v.error, ready: v.readyState })), { timeout: 30_000 })
    .toMatchObject({ ok: true });
  await expect.poll(async () => video.evaluate((v) => v.readyState), { timeout: 30_000 }).toBeGreaterThan(0);
  expect(await video.evaluate((v) => v.currentSrc || v.src)).toMatch(/\/uploads\/smartvideo\//);
  await visitor.close();
});
