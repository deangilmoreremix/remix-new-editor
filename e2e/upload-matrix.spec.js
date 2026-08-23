// e2e/upload-matrix.spec.js
//
// Production-readiness matrix for the upload pickers. Exercises EVERY picker
// across EVERY media type, in BOTH the success (200) and the insufficient-
// credits (402) paths, fully offline (mocked muapi proxy). The goal is to prove
// there are no uncaught failures and that the user always sees the single
// actionable message on 402.
//
// Run: npx playwright test e2e/upload-matrix.spec.js --project=chromium
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.join(SPEC_DIR, 'fixtures', 'start-image.png');
const VIDEO = path.join(SPEC_DIR, 'fixtures', 'sample-video.mp4');

const FAKE_MUAPI_KEY = 'test-muapi-key-0001';
const MUAPI_STORAGE_KEY = 'muapi_key';
const OBFUSCATION_SALT = 'muapi_2024_';

// arm: inject a fake (obfuscated) muapi key so the no-key guard is bypassed,
// and mock the proxy. `calls` (optional) counts fulfilled proxy requests.
async function arm(page, status, body, calls) {
  await page.addInitScript(({ key, storageKey, salt }) => {
    try {
      const obfuscated = btoa(salt + key);
      sessionStorage.setItem(storageKey, obfuscated);
      localStorage.setItem(storageKey, obfuscated);
    } catch (e) { /* storage may be disabled */ }
  }, { key: FAKE_MUAPI_KEY, storageKey: MUAPI_STORAGE_KEY, salt: OBFUSCATION_SALT });

  await page.route('**/muapi-proxy**', (route) => {
    if (calls) calls.n += 1;
    return route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

// Every picker × media type. `strategy: 'chooser'` means the file input is
// opened via a button click (file chooser); otherwise we set files directly on
// the input locator. `ui: 'alert'` captures window.alert; `ui: 'toast'` expects
// an on-page toast containing the message.
const PICKERS = [
  { name: 'image-picker',        route: '/#/image',     media: 'image', input: 'input[type="file"]', strategy: 'direct', ui: 'toast' },
  { name: 'video-studio',        route: '/#/video',     media: 'video', trigger: 'button[title="Upload video to remove watermark"]', strategy: 'chooser', ui: 'alert' },
  { name: 'lipsync-image',       route: '/#/lipsync',   media: 'image', input: 'button[title="Upload portrait image"] input[type="file"]', strategy: 'direct', ui: 'alert' },
  { name: 'lipsync-video',       route: '/#/lipsync',   media: 'video', input: 'button[title="Upload source video"] input[type="file"]', strategy: 'direct', ui: 'alert' },
  { name: 'lipsync-audio',       route: '/#/lipsync',   media: 'audio', input: 'button[title="Upload audio file"] input[type="file"]', strategy: 'direct', ui: 'alert' },
  { name: 'video-agent-video',   route: '/#/video-agent', media: 'video', input: '#video-file-input', strategy: 'direct', ui: 'toast' },
  { name: 'avatar-audio',        route: '/#/avatar',    media: 'audio', input: 'button[title="Upload audio"] input[type="file"]', strategy: 'direct', ui: 'alert' },
];

// The dev server compiles this (large) app on demand, so the first paint of a
// studio route can take a while. Wait explicitly for the picker element to be
// attached instead of relying on a fixed sleep.
const READY_TIMEOUT = 60_000;

async function selectFile(page, p, file = IMG) {
  if (p.strategy === 'chooser') {
    const trigger = page.locator(p.trigger).first();
    await trigger.waitFor({ state: 'visible', timeout: READY_TIMEOUT });
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      trigger.click(),
    ]);
    await fc.setFiles(file);
  } else {
    const input = page.locator(p.input).first();
    await input.waitFor({ state: 'attached', timeout: READY_TIMEOUT });
    await input.setInputFiles(file);
  }
}

for (const p of PICKERS) {
  test(`${p.name} (${p.media}) uploads successfully on 200`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = [];
    const calls = { n: 0 };
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/uploaded.png' }, calls);

    await page.goto(p.route);
    await page.waitForTimeout(1000);
    await selectFile(page, p, p.media === 'video' ? VIDEO : IMG);
    await page.waitForTimeout(2000);

    expect(calls.n, `muapi proxy should have been called for ${p.name}`).toBeGreaterThan(0);
    expect(errors, `Uncaught errors in ${p.name}: ${errors.join(' | ')}`).toEqual([]);
  });

  test(`${p.name} (${p.media}) shows "Please sign in and add api credits." on 402`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = [];
    const dialogs = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await arm(page, 402, { detail: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' });

    await page.goto(p.route);
    await page.waitForTimeout(1000);
    await selectFile(page, p, p.media === 'video' ? VIDEO : IMG);
    await page.waitForTimeout(2000);

    if (p.ui === 'alert') {
      expect(
        dialogs.some((m) => /Please sign in and add api credits\./.test(m)),
        `Expected friendly alert for ${p.name}, got: ${dialogs.join(' | ') || '(none)'}`
      ).toBe(true);
    } else {
      await expect(
        page.getByText('Please sign in and add api credits.', { exact: false }),
        `Expected friendly toast for ${p.name}`
      ).toBeVisible({ timeout: 8000 });
    }
    expect(errors, `Uncaught errors in ${p.name}: ${errors.join(' | ')}`).toEqual([]);
  });
}
