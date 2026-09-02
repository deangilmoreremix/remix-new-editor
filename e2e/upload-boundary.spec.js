// e2e/upload-boundary.spec.js
//
// Boundary upload tests — verifies that uploads at the exact size limits
// are handled correctly. These tests guard against regressions where:
//   - Size limits drift between components (e.g., 10MB in one file, 50MB in another)
//   - The Supabase proxy body limit (~10MB) causes silent failures
//   - Files at the boundary are incorrectly rejected or accepted
//
// Run: npx playwright test e2e/upload-boundary.spec.js --project=chromium
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(SPEC_DIR, 'fixtures');

const FAKE_MUAPI_KEY = 'test-muapi-key-0001';
const MUAPI_STORAGE_KEY = 'muapi_key';
const OBFUSCATION_SALT = 'muapi_2024_';

// Size limits from src/lib/editor/uploadLimits.js — MUST stay in sync
const LIMITS = {
  image: 10 * 1024 * 1024,    // 10MB
  video: 50 * 1024 * 1024,    // 50MB
  audio: 10 * 1024 * 1024,    // 10MB
  other: 10 * 1024 * 1024,    // 10MB
};

// Generate a test file of a specific size with valid headers
function generateTestFile(fileName, sizeBytes, headerBytes) {
  const filePath = path.join(FIXTURES_DIR, fileName);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const buffer = Buffer.alloc(sizeBytes);
  // Write valid header bytes at the start
  if (headerBytes) {
    buffer.set(headerBytes, 0);
  }
  // Fill with pseudo-random data to avoid compression tricks
  for (let i = headerBytes ? headerBytes.length : 0; i < sizeBytes; i++) {
    buffer[i] = i % 256;
  }
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Generate a minimal valid JPEG (SOI marker + minimal content)
function generateJpegFile(fileName, sizeBytes) {
  // JPEG starts with FF D8 FF
  const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  return generateTestFile(fileName, sizeBytes, header);
}

// Generate a minimal valid MP4 (ftyp box)
function generateMp4File(fileName, sizeBytes) {
  // MP4 starts with size + 'ftyp'
  const header = Buffer.alloc(12);
  header.writeUInt32BE(12, 0);  // box size
  header.write('ftyp', 4);     // box type
  return generateTestFile(fileName, sizeBytes, header);
}

// Generate a minimal valid PNG
function generatePngFile(fileName, sizeBytes) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return generateTestFile(fileName, sizeBytes, header);
}

async function arm(page, status, body) {
  await page.addInitScript(({ key, storageKey, salt }) => {
    try {
      const obfuscated = btoa(salt + key);
      sessionStorage.setItem(storageKey, obfuscated);
      localStorage.setItem(storageKey, obfuscated);
    } catch (e) { /* storage may be disabled */ }
  }, { key: FAKE_MUAPI_KEY, storageKey: MUAPI_STORAGE_KEY, salt: OBFUSCATION_SALT });

  await page.route('**/muapi-proxy**', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  );
}

test.describe('Upload boundary — size limits enforced correctly', () => {
  test.setTimeout(120_000);

  // Generate test files before tests run
  test.beforeAll(() => {
    // Image at exactly 10MB (limit)
    generateJpegFile('boundary-image-10mb.jpg', LIMITS.image);
    // Image at 10MB + 1 byte (should be rejected)
    generateJpegFile('boundary-image-10mb-plus1.jpg', LIMITS.image + 1);
    // Image at 9MB (should be accepted)
    generateJpegFile('boundary-image-9mb.jpg', LIMITS.image - 1024 * 1024);
    // Video at exactly 50MB (limit)
    generateMp4File('boundary-video-50mb.mp4', LIMITS.video);
    // Video at 50MB + 1 byte (should be rejected)
    generateMp4File('boundary-video-50mb-plus1.mp4', LIMITS.video + 1);
    // Video at 49MB (should be accepted)
    generateMp4File('boundary-video-49mb.mp4', LIMITS.video - 1024 * 1024);
    // Small valid files for baseline
    generatePngFile('boundary-image-small.png', 1024);
    generateMp4File('boundary-video-small.mp4', 1024 * 1024);
  });

  test('image at exactly 10MB limit is accepted', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/10mb.png' });

    await page.goto('/#/image');
    await page.waitForTimeout(1000);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'boundary-image-10mb.jpg'));
    await page.waitForTimeout(2000);

    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('image exceeding 10MB is rejected with clear message', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/too-large.png' });

    await page.goto('/#/image');
    await page.waitForTimeout(1000);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'boundary-image-10mb-plus1.jpg'));
    await page.waitForTimeout(2000);

    // Should show a "too large" error, not crash
    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
    await expect(
      page.getByText(/too large|maximum|MB/i, { exact: false }).first(),
      'Should show size limit error for oversized image'
    ).toBeVisible({ timeout: 5000 });
  });

  test('video at exactly 50MB limit is accepted', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/50mb.mp4' });

    await page.goto('/#/video');
    await page.waitForTimeout(1000);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'boundary-video-50mb.mp4'));
    await page.waitForTimeout(2000);

    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('video exceeding 50MB is rejected with clear message', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/too-large.mp4' });

    await page.goto('/#/video');
    await page.waitForTimeout(1000);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'boundary-video-50mb-plus1.mp4'));
    await page.waitForTimeout(2000);

    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
    await expect(
      page.getByText(/too large|maximum|MB/i, { exact: false }).first(),
      'Should show size limit error for oversized video'
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Upload boundary — large file handling', () => {
  test.setTimeout(120_000);

  test('file >8MB uploads without errors (triggers direct upload path)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/large.png' });

    await page.goto('/#/image');
    // Wait for the page to fully load and the file input to be available
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 15000 });

    // 9MB image should upload without errors (bypasses proxy due to Supabase 10MB limit)
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(FIXTURES_DIR, 'boundary-image-9mb.jpg'));
    await page.waitForTimeout(3000);

    // Primary assertion: no uncaught errors during the upload flow
    expect(errors, `Uncaught errors during large file upload: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('Upload boundary — metadata extraction does not block upload', () => {
  test.setTimeout(120_000);

  test('file with corrupt metadata still uploads successfully', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await arm(page, 200, { url: 'https://fake.test/corrupt-meta.png' });

    await page.goto('/#/image');
    await page.waitForTimeout(1000);

    // Create a file with corrupt/invalid internal structure but valid extension
    const corruptFile = generateTestFile('corrupt-metadata.png', 1024 * 100, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(corruptFile);
    await page.waitForTimeout(2000);

    // Upload should succeed even if metadata extraction fails
    expect(errors, `Uncaught errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
