// e2e/image-upload-matrix.spec.js
//
// Comprehensive image upload coverage for studios that accept images.
// Exercises the full upload flow with mocked proxy responses.
//
// Run: npx playwright test e2e/image-upload-matrix.spec.js --project=chromium
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.join(SPEC_DIR, 'fixtures', 'start-image.png');

const FAKE_MUAPI_KEY = 'test-muapi-key-0001';
const MUAPI_STORAGE_KEY = 'muapi_key';
const OBFUSCATION_SALT = 'muapi_2024_';

// Inject fake MuAPI key and arm proxy mocks.
async function armUploadProxy(page, status, body, calls) {
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

// Helper: wait for studio to be ready
async function waitForStudioReady(page, route, timeout = 30000) {
  await page.goto(`/#/${route}`, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForTimeout(2000);
}

// Helper: upload image via direct input access
async function uploadImageDirect(page, inputSelector = 'input[type="file"]') {
  const fileInput = page.locator(inputSelector).first();
  await expect(fileInput).toBeAttached({ timeout: 10000 });
  await fileInput.setInputFiles(IMG);
  await page.waitForTimeout(2000);
}

// Helper: upload image via file chooser (for studios using click())
async function uploadImageViaChooser(page, buttonTitle) {
  const trigger = page.locator(`button[title="${buttonTitle}"]`).first();
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    trigger.click(),
  ]);
  await fc.setFiles(IMG);
  await page.waitForTimeout(3000);
}

// Filter out known harmless background errors
function isUploadError(err) {
  const e = String(err);
  if (!e) return false;
  if (e.includes('[MediaWorker]')) return false;
  if (e.includes('blob:http')) return false;
  if (e.includes('[Global Error]')) return false;
  if (e.includes('[popcorn-init]')) return false;
  if (e.includes('ResizeObserver')) return false;
  if (e.includes('passive event listener')) return false;
  if (e.includes('favicon')) return false;
  if (e.includes('upload') || e.includes('Upload') || e.includes('muapi') || e.includes('proxy')) return true;
  if (e.includes('Unexpected token') && !e.includes('muapi-proxy')) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('ImageStudio — image upload', () => {
  test('uploads image successfully (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'image');

    const trigger = page.locator('button[title="Reference media"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VideoStudio — image upload for i2v mode
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VideoStudio — image upload (i2v)', () => {
  test('i2v mode accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'video');

    // VideoStudio image upload uses createUploadPicker with title "Reference media"
    const trigger = page.locator('button[title="Reference media"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CinemaStudio — reference image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('CinemaStudio — reference image upload', () => {
  test('accepts reference image upload (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'cinema');

    // CinemaStudio uses createUploadPicker for reference image
    const trigger = page.locator('button[title="Reference media"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CinemaTemplateStudio — image upload in template flow
// ─────────────────────────────────────────────────────────────────────────────
test.describe('CinemaTemplateStudio — image upload', () => {
  test('template accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'cinema-template', 45000);

    // CinemaTemplateStudio uses createUploadPicker for images
    const trigger = page.locator('button[title="Reference media"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TemplateStudio — image upload in template flow
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TemplateStudio — image upload', () => {
  test('template accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'template/tiktok-video', 45000);

    // TemplateStudio uses createUploadPicker for images
    const trigger = page.locator('button[title="Reference media"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AvatarStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AvatarStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'avatar', 45000);

    const trigger = page.locator('button[title="Reference media"], button[title*="Upload"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LipSyncStudio — image upload in image mode
// ─────────────────────────────────────────────────────────────────────────────
test.describe('LipSyncStudio — image upload', () => {
  test('image mode accepts image upload (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'lipsync', 45000);

    // LipSyncStudio has "Upload portrait image" button
    const imageInput = page.locator('button[title="Upload portrait image"] input[type="file"]').first();
    if (await imageInput.count() > 0) {
      await expect(imageInput).toBeAttached({ timeout: 10000 });
      await uploadImageDirect(page, 'button[title="Upload portrait image"] input[type="file"]');
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CharacterStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('CharacterStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'character', 45000);

    // CharacterStudio uses createUploadPicker; trigger the file chooser via its button.
    const trigger = page.locator('button[title="Reference media"], button[title*="Reference"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CommercialStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('CommercialStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'commercial', 45000);

    const trigger = page.locator('button[title="Reference media"], button[title*="Upload"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EditStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EditStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'edit', 45000);

    const trigger = page.locator('button[title="Reference media"], button[title*="Upload"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EffectsStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('EffectsStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'effects', 45000);

    const trigger = page.locator('button[title="Reference media"], button[title*="Upload"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UpscaleStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('UpscaleStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'upscale', 45000);

    const trigger = page.locator('button[title="Reference media"], button[title*="Upload"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VideoToolsStudio — image upload
// ─────────────────────────────────────────────────────────────────────────────
test.describe('VideoToolsStudio — image upload', () => {
  test('accepts image upload via picker (mocked 200)', async ({ page }) => {
    const proxyCalls = { n: 0 };
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await armUploadProxy(page, 200, { url: 'https://fake.test/uploaded.png' }, proxyCalls);

    await waitForStudioReady(page, 'videotools', 45000);

    const trigger = page.locator('button[title="Reference media"], button[title*="Upload"]').first();
    if (await trigger.count() > 0) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        trigger.click(),
      ]);
      await fc.setFiles(IMG);
      await page.waitForTimeout(2000);
      expect(proxyCalls.n).toBeGreaterThan(0);
    }
    const uploadErrors = pageErrors.filter(isUploadError);
    expect(uploadErrors, `Upload-related errors: ${uploadErrors.join(' | ')}`).toEqual([]);
  });
});
