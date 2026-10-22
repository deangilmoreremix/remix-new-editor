// e2e/studio-upload-coverage.spec.js
//
// Phase 3 upload coverage — the six surfaces no other e2e spec reaches:
//   1. Storyboard        (/#/storyboard)      reference-attachment toolbar
//   2. Personalizer      (/#/personalizer)    image-element "Upload image…"
//   3. Element Library   (elements/element-image-upload.jsx)
//   4. AI Captions       (modals/AICaptionsModal.jsx)
//   5. Chat attachments  (chat/ChatStudio.jsx useAttachmentState)
//   6. Timeline editor   (/#/timeline)        #uploadBtn → uploadPipeline
//
// Route facts verified by throwaway probes (see /tmp/kilo/task-r2-report.md):
//   - Storyboard: `#video-intent-form` mounts COLLAPSED (.hidden); the
//     attachment toolbar only becomes visible after clicking
//     `#video-intent-toggle`. Upload → ingestStudioUpload → saveAsset, which
//     throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE any MuAPI
//     transport call (assetLibrary.js:227-241). The toast then shows the
//     describeMuapiUploadError fallback (MUAPI_NETWORK text). So the mockable
//     200/402 proxy responses can never be reached offline for this surface.
//   - Personalizer: palette "Image" adds an element whose properties panel
//     contains an "Upload image…" button; on upload error the BUTTON LABEL
//     ITSELF becomes describeMuapiUploadError(err) (observed). Same
//     saveAsset gate → 200/402 unreachable offline.
//   - Element Library: ElementsTab/ElementImageUpload are not mounted by ANY
//     route in this build (grep-verified; elements-tab.jsx has no importer).
//   - AI Captions: the modal only opens from post-generation result handlers
//     (8 call sites across studios). Probed twice with the entitlement cache
//     re-seeded and a fully mocked successful generation: VideoStudio's
//     generate flow crashes BEFORE any network call — createLoadingOverlay
//     returns { show, hide, element } (lib/loading.js:58) but
//     VideoStudio.js:1999-2002 calls .appendChild() on it (TypeError,
//     unhandled rejection; Generate button stuck disabled; 0 proxy requests
//     in the trace). The modal is therefore unreachable in this build and the
//     surface is skipped with that code-path reason.
//   - Chat: /#/chat mounts vanilla ChatStudio.js — zero file inputs
//     (probe-verified). The useAttachmentState-powered React ChatStudio.jsx
//     (the only attachment upload surface) is imported by nothing (dead code
//     in this build).
//   - Timeline: #uploadBtn → #uploadInput → processFileUpload →
//     muapi.uploadFile → Supabase edge `muapi-proxy` (observed POST to
//     https://<project>.supabase.co/functions/v1/muapi-proxy). 200 success
//     and 402 credits mapping ARE reachable offline; a proxy 5xx exercises
//     muapi.uploadFile's fallback to durable Supabase Storage.
//
// Mock strategy (per test, e2e-only, no src changes):
//   - BYOK key injection exactly like e2e/upload-matrix.spec.js arm().
//   - `**/muapi-proxy**` + `**/api.muapi.ai/**` fulfilled with per-test
//     status/body, with a call counter (the proxy URL is the project's real
//     Supabase functions host, so the glob is what makes this hermetic).
//   - `**/rest/v1/**` → 200 [] and `**/storage/v1/**` → 200 {Key} so the
//     flows stay offline (probes observed real REST reads: instructions,
//     media list) — except where a test asserts the storage fallback.
//   - `**/lib/media-worker.js` stub, same as upload-boundary.spec.js: the
//     file does not exist and the dev server's SPA-fallback HTML would
//     otherwise kill the blob worker with an uncaught SyntaxError.
//
// Run: npx playwright test e2e/studio-upload-coverage.spec.js
//      --config=playwright-matrix.config.ts --project=chromium
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const IMG_FIXTURE = path.join(SPEC_DIR, 'fixtures', 'start-image.png');

const FAKE_MUAPI_KEY = 'test-muapi-key-0001';
const MUAPI_STORAGE_KEY = 'muapi_key';
const OBFUSCATION_SALT = 'muapi_2024_';

const PROXY_200 = { url: 'https://fake.test/uploaded.png' };
const PROXY_402 = {
  error: { message: '402 Payment Required: out of credits' },
};
const PROXY_500 = { error: { message: 'Internal Server Error' } };

const MUAPI_NETWORK_FALLBACK =
  'A network error interrupted the upload. Check your connection and try again.';
const CREDITS_MESSAGE = 'Please sign in and add api credits.';

// Same BYOK injection as e2e/upload-matrix.spec.js arm().
async function injectKey(page) {
  await page.addInitScript(({ key, storageKey, salt }) => {
    try {
      const obfuscated = btoa(salt + key);
      sessionStorage.setItem(storageKey, obfuscated);
      localStorage.setItem(storageKey, obfuscated);
    } catch (e) { /* storage may be disabled */ }
  }, { key: FAKE_MUAPI_KEY, storageKey: MUAPI_STORAGE_KEY, salt: OBFUSCATION_SALT });
}

// Mock the Supabase REST + Storage hosts the app reaches for real (probes
// observed rest/v1/instructions and rest/v1/media reads) so the suites stay
// hermetic. supabase-js tolerates [] for selects and 204 for writes.
async function mockSupabaseDataPlane(page, storageBody = { Key: 'uploads/anonymous/probe.png' }) {
  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 204 });
  });
  await page.route('**/storage/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storageBody) })
  );
}

// media-worker stub — see e2e/upload-boundary.spec.js:104-120 for why.
async function mockMediaWorker(page) {
  await page.route('**/lib/media-worker.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: "self.onmessage = (e) => { const d = e.data || {}; self.postMessage({ success: false, action: d.action, fileId: d.fileId, error: 'media worker unavailable in tests' }); };",
    })
  );
}

// muapi-proxy + direct-MuAPI mocks with a call counter. Returns { calls }
// (the counter object) so tests can assert that NO transport call happened.
async function mockMuapiTransport(page, status, body) {
  const calls = { n: 0 };
  const fulfill = (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/muapi-proxy**', (route) => { calls.n += 1; return fulfill(route); });
  // Files >8MB bypass the proxy and go direct — kept on the same contract.
  await page.route('**/api.muapi.ai/**', (route) => { calls.n += 1; return fulfill(route); });
  return calls;
}

// Defensive dismissal of the first-run setup modal (z-100) — same pattern as
// e2e/upload-picker.spec.js dismissCinemaModal. A no-op when the BYOK key is
// already injected, but harmless.
async function dismissSetupModal(page) {
  const overlay = page.locator('div.fixed.inset-0.z-\\[100\\]', { hasText: 'Welcome — set up your API keys' });
  const appeared = await overlay.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
  if (appeared) {
    await page.getByRole('button', { name: 'Skip for now' }).click().catch(() => {});
    await overlay.waitFor({ state: 'removed', timeout: 5000 }).catch(() => {});
  }
}

// The timeline toast (#toast, .status-toast) keeps its textContent after the
// 3s auto-hide, so text polling is race-free.
function waitForTimelineToast(page, pattern, timeout = 90_000) {
  return page.waitForFunction(
    (reSource) => {
      const el = document.getElementById('toast');
      return el && new RegExp(reSource).test(el.textContent || '');
    },
    pattern,
    { timeout },
  );
}

test.describe('Studio upload coverage — Phase 3 (six unreached surfaces)', () => {
  test.setTimeout(180_000);

  // ── 1. Storyboard (/#/storyboard) ─────────────────────────────────────────
  test('storyboard: reference-image upload surfaces the sign-in gate toast and never reaches the MuAPI transport', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await injectKey(page);
    await mockMediaWorker(page);
    await mockSupabaseDataPlane(page);
    const proxy = await mockMuapiTransport(page, 200, PROXY_200);

    await page.goto('/#/storyboard', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForSelector('#vi-premise', { state: 'attached', timeout: 90_000 });
    await dismissSetupModal(page);

    // The attachment toolbar lives inside the collapsed #video-intent-form.
    await page.locator('#video-intent-toggle').click();
    const refImages = page.locator('button[title="Reference Images"]');
    await expect(refImages).toBeVisible({ timeout: 15_000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      refImages.click(),
    ]);
    await fileChooser.setFiles(IMG_FIXTURE);

    // saveAsset (assetLibrary.js) throws ASSET_SIGN_IN_REQUIRED for the
    // signed-out user before any transport call; StoryboardStudio's catch
    // shows describeMuapiUploadError(err) as an error toast.
    await expect(
      page.locator('.bg-red-600', { hasText: MUAPI_NETWORK_FALLBACK })
    ).toBeVisible({ timeout: 30_000 });
    expect(proxy.n, 'MuAPI transport must not be reached for a durable-save-gated flow').toEqual(0);
    expect(errors, `Uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  // The 200/402 sub-cases are unreachable offline for this surface: the
  // upload routes through ingestStudioUpload → saveAsset, which throws
  // ASSET_SIGN_IN_REQUIRED for the signed-out user (assetLibrary.js:227-241)
  // BEFORE any MuAPI transport call — the mocked proxy status can never be
  // observed without a real Clerk session. The sign-in gate test above is
  // the honest offline coverage for this code path.
  test('storyboard: mocked proxy 200 success path', async () => {
    test.skip(true, 'unreachable offline: ingestStudioUpload → saveAsset throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE the MuAPI transport call, so a mocked proxy 200 can never be observed; requires real Clerk sign-in');
  });

  test('storyboard: mocked proxy 402 credits error path', async () => {
    test.skip(true, 'unreachable offline: ingestStudioUpload → saveAsset throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE the MuAPI transport call, so a mocked proxy 402 can never be observed; requires real Clerk sign-in');
  });

  // ── 2. Personalizer (/#/personalizer) ─────────────────────────────────────
  test('personalizer: image-element upload surfaces the sign-in gate in the properties panel and never reaches the MuAPI transport', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await injectKey(page);
    await mockMediaWorker(page);
    await mockSupabaseDataPlane(page);
    const proxy = await mockMuapiTransport(page, 200, PROXY_200);

    await page.goto('/#/personalizer', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const paletteImage = page.locator('button', { hasText: 'Image' }).first();
    await expect(paletteImage).toBeVisible({ timeout: 90_000 });
    await dismissSetupModal(page);

    await paletteImage.click();
    const uploadBtn = page.locator('button', { hasText: 'Upload image' }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 15_000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadBtn.click(),
    ]);
    await fileChooser.setFiles(IMG_FIXTURE);

    // Observed behaviour: the same properties-panel button's label is
    // replaced with describeMuapiUploadError(err) after the saveAsset gate
    // rejects the signed-out upload.
    await expect(
      page.locator('button', { hasText: MUAPI_NETWORK_FALLBACK })
    ).toBeVisible({ timeout: 30_000 });
    expect(proxy.n, 'MuAPI transport must not be reached for a durable-save-gated flow').toEqual(0);
    expect(errors, `Uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  // Same durable-save gate as the storyboard: Personalizer.js:1368 calls
  // ingestStudioUpload, whose saveAsset step throws ASSET_SIGN_IN_REQUIRED
  // for the signed-out user before any MuAPI transport call.
  test('personalizer: mocked proxy 200 success path', async () => {
    test.skip(true, 'unreachable offline: ingestStudioUpload → saveAsset throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE the MuAPI transport call, so a mocked proxy 200 can never be observed; requires real Clerk sign-in');
  });

  test('personalizer: mocked proxy 402 credits error path', async () => {
    test.skip(true, 'unreachable offline: ingestStudioUpload → saveAsset throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE the MuAPI transport call, so a mocked proxy 402 can never be observed; requires real Clerk sign-in');
  });

  // ElementImageUpload is a dead surface in this build: element-modal.jsx ←
  // elements-tab.jsx ← no importer anywhere in src/ (grep-verified), so no
  // URL renders it. LibraryPage.js's MUAPI_STUDIOS 'element-library' entry
  // does not mount the React elements tab.
  test('element library: image upload through ElementImageUpload dropzone', async () => {
    test.skip(true, 'surface not mounted in this build: src/components/elements/element-image-upload.jsx is only reachable via element-modal.jsx ← elements-tab.jsx, and elements-tab.jsx has no importer — no route/URL renders it, so the dropzone upload cannot be driven');
  });

  // ── 4. AI Captions (modals/AICaptionsModal.jsx) ───────────────────────────
  // Unreachable in the current build, probed twice with the entitlement cache
  // re-seeded AND a fully mocked, successful generation (submit → request_id,
  // poll → completed). The modal only opens from post-generation result
  // handlers (8 addCaptionButton call sites across studios), and VideoStudio's
  // generate flow crashes BEFORE any network call:
  //   VideoStudio.js:1999-2002 calls loadingOverlay.appendChild(...) on the
  //   object returned by createLoadingOverlay (src/lib/loading.js:58), which
  //   is { show, hide, element } — no appendChild. TypeError becomes an
  //   unhandled promise rejection; the Generate button stays disabled and no
  //   muapi-proxy request is ever fired (trace-verified: 0 proxy requests).
  // If that API-mismatch bug is fixed, the drive path in this file's history
  // (prompt → Generate → "Add AI Captions" → upload tab → file → generate)
  // documents how to reach the modal.
  test('ai captions: modal opens via mocked VideoStudio generation and its upload surfaces the raw sign-in-gate message', async () => {
    test.skip(true, 'surface unreachable in current build: AICaptionsModal opens only from post-generation handlers, and VideoStudio generate crashes first — createLoadingOverlay (lib/loading.js:58) returns {show,hide,element} but VideoStudio.js:1999-2002 calls .appendChild() on it, throwing TypeError (unhandled rejection, probe/trace-verified: button stuck disabled, zero proxy requests). Requires the loading-overlay API mismatch fix plus real Clerk sign-in (saveAsset gate) for the upload itself');
  });

  // AICaptionsModal.uploadFileIfNeeded → ingestStudioUpload → saveAsset
  // throws ASSET_SIGN_IN_REQUIRED before the MuAPI upload — and in the
  // current build the modal cannot even be opened (VideoStudio generate
  // crashes first, see the AI Captions skip above), so the mocked proxy
  // statuses are doubly unreachable offline.
  test('ai captions: mocked proxy 200 success path', async () => {
    test.skip(true, 'unreachable offline: the modal cannot be opened at all in this build (VideoStudio generate crashes at the createLoadingOverlay API mismatch before any network call) and, once open, uploadFileIfNeeded → ingestStudioUpload → saveAsset throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE the MuAPI transport call — a mocked proxy 200 can never be observed');
  });

  test('ai captions: mocked proxy 402 credits error path', async () => {
    test.skip(true, 'unreachable offline: the modal cannot be opened at all in this build (VideoStudio generate crashes at the createLoadingOverlay API mismatch before any network call) and, once open, uploadFileIfNeeded → ingestStudioUpload → saveAsset throws ASSET_SIGN_IN_REQUIRED for the signed-out user BEFORE the MuAPI transport call — a mocked proxy 402 can never be observed');
  });

  // Probe fact: /#/chat renders vanilla ChatStudio.js — zero input[type=file]
  // elements, headings ["Chat Studio","All Studios"]. The attachment upload
  // surface (useAttachmentState → uploadFileToStorage → Supabase Storage)
  // lives in the React chat/ChatStudio.jsx, which is imported by nothing in
  // this build (dead code), so it cannot be driven through the UI.
  test('chat: attachment upload 200 + storage-error surface', async () => {
    test.skip(true, 'surface not mounted in this build: /#/chat renders vanilla ChatStudio.js which has zero file inputs (probe-verified); the useAttachmentState attachment UI lives in chat/ChatStudio.jsx which no module imports (dead code), so the upload cannot be driven through the UI');
  });

  // ── 6. Timeline editor (/#/timeline) ──────────────────────────────────────
  test('timeline: upload via #uploadBtn succeeds through the mocked muapi-proxy and toasts Added', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await injectKey(page);
    await mockMediaWorker(page);
    await mockSupabaseDataPlane(page);
    const proxy = await mockMuapiTransport(page, 200, PROXY_200);

    await page.goto('/#/timeline', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForSelector('#uploadInput', { state: 'attached', timeout: 90_000 });
    await dismissSetupModal(page);
    await expect(page.locator('#uploadBtn')).toBeVisible();

    await page.locator('#uploadInput').setInputFiles(IMG_FIXTURE);

    // processFileUpload → muapi.uploadFile → proxy 200 → clip inserted →
    // "Added {filename}" toast (TimelineEditorPage showToast → #toast).
    await waitForTimelineToast(page, 'Added .*start-image');
    expect(proxy.n, 'timeline upload must go through the MuAPI transport').toBeGreaterThan(0);
    expect(errors, `Uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('timeline: 402 from muapi-proxy maps to the credits toast', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await injectKey(page);
    await mockMediaWorker(page);
    await mockSupabaseDataPlane(page);
    const proxy = await mockMuapiTransport(page, 402, PROXY_402);

    await page.goto('/#/timeline', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForSelector('#uploadInput', { state: 'attached', timeout: 90_000 });
    await dismissSetupModal(page);

    await page.locator('#uploadInput').setInputFiles(IMG_FIXTURE);

    // uploadErrorToast → formatErrorMessage maps 402 → the actionable
    // credits message (kept unprefixed by uploadErrorToast).
    await waitForTimelineToast(page, CREDITS_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    expect(proxy.n, 'the 402 must be observed on the MuAPI transport').toBeGreaterThan(0);
    expect(errors, `Uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('timeline: proxy 5xx falls back to durable Supabase Storage and still toasts Added', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await injectKey(page);
    await mockMediaWorker(page);
    await mockSupabaseDataPlane(page, { Key: 'uploads/anonymous/timeline-fallback.png' });
    const proxy = await mockMuapiTransport(page, 500, PROXY_500);

    await page.goto('/#/timeline', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForSelector('#uploadInput', { state: 'attached', timeout: 90_000 });
    await dismissSetupModal(page);

    await page.locator('#uploadInput').setInputFiles(IMG_FIXTURE);

    // muapi.uploadFile: transportUpload retries the 5xx three times, then
    // legacy.fallbackToStorage uploads to Supabase Storage (mocked 200 by
    // mockSupabaseDataPlane). The surface still ends in the success toast.
    await waitForTimelineToast(page, 'Added .*start-image');
    expect(proxy.n, 'the 5xx must first be observed on the MuAPI transport').toBeGreaterThan(0);
    expect(errors, `Uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
