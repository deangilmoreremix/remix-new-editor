// tests/e2e/upload-picker.spec.js
//
// Browser-level smoke test for the shared UploadPicker across studios.
// Focuses on the most important production concern raised: the picker must
// behave gracefully (no uncaught errors) when the user has NOT entered their
// MuAPI key — i.e. the common "no key" state. These tests run fully offline:
// they never need a network, an API key, or a credit balance.
//
// To run (in CI where Playwright browsers are installed):
//   npx playwright test tests/e2e/upload-picker.spec.js
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM-safe __dirname (package.json has "type": "module").
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.join(SPEC_DIR, 'fixtures', 'start-image.png');

// Studios that mount the shared UploadPicker and are cheap to mount.
const STUDIOS = ['image', 'video', 'cinema', 'character', 'commercial', 'upscale', 'edit', 'effects'];

test.describe('UploadPicker — no API key (graceful, no crashes)', () => {
  for (const route of STUDIOS) {
    test(`studio "${route}" picker handles a file selection without throwing when no key is set`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));

      await page.goto(`/#/${route}`);
      await page.waitForTimeout(1000);

      // The picker renders a hidden file input.
      const fileInput = page.locator('input[type="file"]').first();
      await expect(fileInput).toBeAttached();

      // Even without a key, selecting a file must NOT throw.
      await fileInput.setInputFiles(IMG);
      await page.waitForTimeout(600);

      expect(pageErrors, `Uncaught errors in ${route}: ${pageErrors.join(' | ')}`).toEqual([]);

      // The upload panel exists (mounted) somewhere on the page.
      await expect(page.locator('.upload-panel').first()).toBeAttached();
    });
  }

  test('cinema studio frame-mode picker renders START and END slots', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto('/#/cinema');
    await page.waitForTimeout(1000);

    // Open the upload picker (frame mode) via its trigger button.
    const trigger = page.locator('button[title="Reference media"], button[title*="frame"], button[title*="Frame"]').first();
    await trigger.click();
    await page.waitForTimeout(400);

    // START / END frame slots should be present in frame mode.
    await expect(page.getByText('START', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('END', { exact: true }).first()).toBeVisible();

    expect(pageErrors, `Uncaught errors in cinema frame picker: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UploadPicker — successful upload path (offline mock)
//
// These tests exercise the FULL happy path: validateFile → muapi.uploadFile →
// proxy → processFileUpload → thumbnail + history update. Everything runs
// OFFLINE: the only network response is a Playwright route that fulfills the
// muapi proxy with a fake JSON `{ url }`. No real key, no real network, no
// credentials.
//
// The fake MuAPI key is injected via addInitScript into the exact storage key
// the app reads (`muapi_key` in src/lib/apiKeyManager.js), using the same
// obfuscation the app uses (`btoa('muapi_2024_' + key)`). The key must be
// >= 10 chars, so we use 'test-muapi-key-0001'.
// ─────────────────────────────────────────────────────────────────────────────
const FAKE_MUAPI_KEY = 'test-muapi-key-0001';
const MUAPI_STORAGE_KEY = 'muapi_key';              // src/lib/apiKeyManager.js KEY_STORAGE.muapi
const OBFUSCATION_SALT = 'muapi_2024_';             // src/lib/apiKeyManager.js OBFUSCATION_SALT
const MOCK_PROXY_RESPONSE = { url: 'https://fake.test/uploaded.png' };

test.describe('UploadPicker — successful upload path (offline mock)', () => {
  let proxyCalls = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    proxyCalls = [];
    pageErrors = [];

    // 1) Inject a fake (obfuscated) MuAPI key so _requireMuapiKey() / hasMuapiKey()
    //    pass without any real key. Mirrors apiKeyManager.obfuscate().
    await page.addInitScript(({ key, storageKey, salt }) => {
      try {
        const obfuscated = btoa(salt + key);
        // sessionStorage is read first by apiKeyManager; set both for safety.
        sessionStorage.setItem(storageKey, obfuscated);
        localStorage.setItem(storageKey, obfuscated);
      } catch (e) {
        // Storage may be disabled; the in-memory cache still works for this session.
      }
    }, { key: FAKE_MUAPI_KEY, storageKey: MUAPI_STORAGE_KEY, salt: OBFUSCATION_SALT });

    // 2) Mock the muapi proxy. Covers both the relative path
    //    (/functions/v1/muapi-proxy) and any absolute Supabase-URL form
    //    (${VITE_SUPABASE_URL}/functions/v1/muapi-proxy).
    await page.route('**/muapi-proxy**', (route) => {
      proxyCalls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PROXY_RESPONSE),
      });
    });

    page.on('pageerror', (e) => pageErrors.push(String(e)));
  });

  test('image studio uploads a selected file end-to-end (mocked proxy)', async ({ page }) => {
    await page.goto('/#/image');
    await page.waitForTimeout(1000);

    // The picker renders a hidden file input.
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    // Select a real (valid) PNG fixture — validates → fetch mock → processFileUpload.
    await fileInput.setInputFiles(IMG);
    // Allow the real pipeline to run: validateFile → proxy fetch → thumbnail update.
    await page.waitForTimeout(1200);

    // No uncaught errors during the full upload path.
    expect(pageErrors, `Uncaught errors during upload: ${pageErrors.join(' | ')}`).toEqual([]);

    // The mocked proxy MUST have been hit (this is the strongest offline signal
    // that the real upload pipeline actually executed).
    expect(
      proxyCalls.length,
      `Expected muapi proxy to be called at least once, got ${proxyCalls.length}: ${proxyCalls.join(', ')}`
    ).toBeGreaterThan(0);

    // The picker reflects success: the trigger button now shows a thumbnail
    // <img> with a non-empty src (a local object/data URL).
    const triggerImg = page.locator('button[title="Reference media"] img').first();
    await expect(triggerImg, 'picker should show a thumbnail after a successful upload').toHaveAttribute('src', /\S+/, { timeout: 5000 });
  });

  test('cinema frame-mode uploads both START and END frames', async ({ page }) => {
    await page.goto('/#/cinema');
    await page.waitForTimeout(1000);

    // Open the upload picker (frame mode) via its trigger button.
    const trigger = page.locator('button[title="Reference media"], button[title*="frame"], button[title*="Frame"]').first();
    await trigger.click();
    await page.waitForTimeout(400);

    // START / END frame slots should be present in frame mode.
    await expect(page.getByText('START', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('END', { exact: true }).first()).toBeVisible();

    // The frame picker reuses one hidden file input; uploads are routed to the
    // next empty slot (START first, then END via firstEmptyFrameSlot()).
    const fileInput = page.locator('input[type="file"]').first();

    // START frame.
    await fileInput.setInputFiles(IMG);
    await page.waitForTimeout(1500);

    // END frame (START is now filled, so the next upload targets END).
    await fileInput.setInputFiles(IMG);
    await page.waitForTimeout(1500);

    expect(pageErrors, `Uncaught errors during frame upload: ${pageErrors.join(' | ')}`).toEqual([]);

    // Both START and END uploads should have hit the mocked proxy.
    expect(
      proxyCalls.length,
      `Expected muapi proxy to be called twice (START + END), got ${proxyCalls.length}: ${proxyCalls.join(', ')}`
    ).toBeGreaterThanOrEqual(2);
  });
});
