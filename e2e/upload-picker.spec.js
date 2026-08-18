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

// ─────────────────────────────────────────────────────────────────────────────
// Insufficient credits / not signed in (402) path
//
// Offline mock: the muapi proxy returns 402 (no credits). The user must see the
// SINGLE actionable message "Please sign in and add api credits." for BOTH the
// image picker (toast) and the video studio (alert). This guards the regression
// where every failure collapsed to the generic "Upload returned no URL".
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Upload — insufficient credits (402) shows actionable message', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a fake (obfuscated) MuAPI key so the no-key guard is bypassed and
    // the upload actually reaches the (mocked) proxy.
    await page.addInitScript(({ key, storageKey, salt }) => {
      try {
        const obfuscated = btoa(salt + key);
        sessionStorage.setItem(storageKey, obfuscated);
        localStorage.setItem(storageKey, obfuscated);
      } catch (e) { /* storage may be disabled */ }
    }, { key: FAKE_MUAPI_KEY, storageKey: MUAPI_STORAGE_KEY, salt: OBFUSCATION_SALT });

    // Mock the proxy to reject with 402 (no credits).
    await page.route('**/muapi-proxy**', (route) =>
      route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' }),
      })
    );
  });

  test('image studio picker shows "Please sign in and add api credits." on 402', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto('/#/image');
    await page.waitForTimeout(1000);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(IMG);

    // The friendly, actionable message must be visible as a toast.
    await expect(
      page.getByText('Please sign in and add api credits.', { exact: false }),
      'image picker should surface the credits message on 402'
    ).toBeVisible({ timeout: 8000 });

    expect(pageErrors, `Uncaught errors in image picker: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('video studio shows "Please sign in and add api credits." on 402', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      d.dismiss().catch(() => {});
    });

    await page.goto('/#/video');
    await page.waitForTimeout(1000);

    // Open the video upload picker, then choose a file via the file chooser.
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('button[title="Upload video to remove watermark"]').click(),
    ]);
    await fileChooser.setFiles(IMG);
    await page.waitForTimeout(1500);

    expect(
      dialogs.some((m) => /Please sign in and add api credits\./.test(m)),
      `Expected friendly credits dialog, got: ${dialogs.join(' | ') || '(none)'}`
    ).toBe(true);
  });

  test('cinema frame-mode picker shows "Please sign in and add api credits." on 402', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto('/#/cinema');
    await page.waitForTimeout(1000);

    // Cinema renders the shared UploadPicker in frame mode; its reference-media
    // input is an input[type="file"] inside the trigger button. We do not click
    // the trigger — setInputFiles works on the (hidden) input directly, matching
    // the SUCCESS cinema test above.
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(IMG);

    // The shared picker maps 402 → the single actionable toast.
    await expect(
      page.getByText('Please sign in and add api credits.', { exact: false }),
      'cinema frame picker should surface the credits message on 402'
    ).toBeVisible({ timeout: 8000 });

    expect(pageErrors, `Uncaught errors in cinema picker: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AudioStudio — reference audio upload (offline mock)
//
// Regression guard for the "Audio Studio upload" feature: AudioStudio only
// mounts its createAudioFileUploader once a model that accepts a reference
// track is selected (minimax-voice-clone => requiresAudio). Selecting that
// model must render `input[accept="audio/*"]`, and the picked file must flow
// through muapi.uploadFile (capped at 10MB) → the mocked muapi proxy.
//
// Covers both the happy path (200 → "Ready to generate") and the 402 path
// (the uploader surfaces a toast rather than crashing).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AudioStudio — reference audio upload (offline mock)', () => {
  // Self-contained: each test injects a fake key + arms its own proxy response
  // (200 vs 402), so the two paths don't depend on describe-level route setup.
  const AUDIO_FIXTURE = path.join(SPEC_DIR, 'fixtures', 'sample-audio.mp3');

  // /#/audio lazy-imports AudioStudio from a heavy shared bundle (includes video
  // plugin machinery), so cold-start render of the model list can exceed 10s.
  test.setTimeout(90000);

  async function injectMuapiKey(page) {
    await page.addInitScript(({ key, storageKey, salt }) => {
      try {
        const obfuscated = btoa(salt + key);
        sessionStorage.setItem(storageKey, obfuscated);
        localStorage.setItem(storageKey, obfuscated);
      } catch { /* storage may be disabled */ }
    }, { key: FAKE_MUAPI_KEY, storageKey: MUAPI_STORAGE_KEY, salt: OBFUSCATION_SALT });
  }

  test('selecting a voice-clone model renders the audio uploader and uploads it (mocked 200)', async ({ page }) => {
    const proxyCalls = [];
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await injectMuapiKey(page);

    await page.route('**/muapi-proxy**', (route) => {
      proxyCalls.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://fake.test/uploaded.mp3' }),
      });
    });

    await page.goto('/#/audio');
    // Wait for the heavy lazy bundle to settle before asserting the model list.
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForSelector('[data-model-id="minimax-voice-clone"]', { timeout: 30000 });

    // Voice-clone is NOT the default; the uploader only appears after selecting
    // a model that requires/accepts audio (requiresAudio/hasAudio flag in
    // renderSchemaControlsSection).
    await page.click('[data-model-id="minimax-voice-clone"]');
    await page.waitForSelector('input[accept="audio/*"]', { state: 'attached', timeout: 8000 });

    const fileInput = page.locator('input[accept="audio/*"]').first();
    await fileInput.setInputFiles(AUDIO_FIXTURE);
    await page.waitForTimeout(800);

    expect(pageErrors, `Uncaught errors in audio studio: ${pageErrors.join(' | ')}`).toEqual([]);

    expect(
      proxyCalls.length,
      `Expected the mocked muapi proxy to be hit on audio upload, got ${proxyCalls.length}: ${proxyCalls.join(', ')}`
    ).toBeGreaterThan(0);

    // The uploader reflects success (file picked + POST returned a URL).
    await expect(
      page.getByText('Ready to generate', { exact: false }),
      'audio uploader should show the ready state after a successful upload'
    ).toBeVisible({ timeout: 6000 });
  });

  test('voice-clone shows an actionable toast on 402 (no credits)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await injectMuapiKey(page);

    await page.route('**/muapi-proxy**', (route) =>
      route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' }),
      })
    );

    await page.goto('/#/audio');
    await page.waitForSelector('[data-model-id="minimax-voice-clone"]', { timeout: 10000 });

    await page.click('[data-model-id="minimax-voice-clone"]');
    await page.waitForSelector('input[accept="audio/*"]', { state: 'attached', timeout: 8000 });

    await page.locator('input[accept="audio/*"]').first().setInputFiles(AUDIO_FIXTURE);
    await page.waitForTimeout(800);

    // createAudioFileUploader surfaces 402 as a toast (not a crash).
    await expect(
      page.getByText(/Upload failed[\s\S]*402/),
      'audio uploader should surface a 402 toast'
    ).toBeVisible({ timeout: 8000 });

    expect(pageErrors, `Uncaught errors in audio studio 402: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
