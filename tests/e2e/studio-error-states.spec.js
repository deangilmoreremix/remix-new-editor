// tests/e2e/studio-error-states.spec.js
// Verifies studio surfaces mount cleanly (no thrown errors, no console errors,
// no `alert()` dialogs) and that the generate flow is wired up to disable the
// button + reveal a Cancel button once a job is in flight.
//
// Setup: this file lives in tests/e2e/ alongside the existing tests, but the
// project's playwright.config.js declares `testDir: './e2e'`. Either:
//   1. update testDir to './tests/e2e', or
//   2. run with `npx playwright test tests/e2e/studio-error-states.spec.js`.
// The webServer block (port 3000, baseURL http://localhost:3000) is reused.
import { test, expect } from '@playwright/test';

// Studio hash routes. Names follow src/lib/router.js pageLoaders.
// `aivfx` -> `ai-vfx` and `cinema-template-studio` resolves to the `cinema`
// route (CinemaTemplateStudio is mounted from there).
const STUDIO_ROUTES = [
  'video',
  'cinema',
  'image',
  'effects',
  'videotools',
  'lipsync',
  'avatar',
  'commercial',
  'influencer',
  'character',
  'edit',
  'upscale',
  'training',
  'audio',
  'chat',
  'storyboard',
  'ai-vfx',
  'cinema',          // cinema-template-studio is mounted at /#/cinema
  'templates',
];

// Routes known to require a text/textarea prompt + a generate button so we can
// drive a click without file uploads or extra UI gating.
const GENERATABLE_STUDIOS = [
  { route: 'image',  textareaId: 'i-prompt-textarea', tooltip: 'Generate AI image from prompt' },
  { route: 'video',  textareaId: 'v-prompt-textarea', tooltip: 'Generate AI video from prompt' },
];

// Filter out fatal console noise. React/Three.js emit noisy warnings we don't
// care about; we only fail the test on real errors.
function attachConsoleRecorder(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
}

test.describe('Studio error states', () => {
  for (const route of STUDIO_ROUTES) {
    test(`studio "${route}" mounts without errors`, async ({ page }) => {
      const consoleErrors = [];
      attachConsoleRecorder(page, consoleErrors);

      // Stub any alert/confirm/prompt so a stray dialog would have already
      // been intercepted; we also assert the dialog handler at the end.
      let dialogTriggered = null;
      page.on('dialog', async (dialog) => {
        dialogTriggered = `${dialog.type()}: ${dialog.message()}`;
        await dialog.dismiss();
      });

      await page.goto(`/#/${route}`);
      // Studio chrome (back + menu buttons) is mounted on every studio.
      await expect(page.locator('[data-studio-back]').first())
        .toBeVisible({ timeout: 10_000 });

      // Some studio forms are form cards appended to the studio container;
      // asserting any form/textarea is present is enough to prove the studio
      // actually rendered rather than a PlaceholderPage.
      const form = page.locator('#app form, #app textarea, #app input[type="text"]').first();
      await expect(form).toBeVisible({ timeout: 10_000 });

      // Give async mount work a beat to throw.
      await page.waitForTimeout(300);

      expect(dialogTriggered, `Unexpected dialog on /#/${route}`).toBeNull();
      expect(consoleErrors, `Console errors on /#/${route}: ${consoleErrors.join('\n')}`)
        .toEqual([]);
    });
  }
});

test.describe('Generate flow', () => {
  for (const studio of GENERATABLE_STUDIOS) {
    test(`studio "${studio.route}" disables Generate and shows Cancel after click`, async ({ page }) => {
      let dialogTriggered = null;
      page.on('dialog', async (dialog) => {
        dialogTriggered = `${dialog.type()}: ${dialog.message()}`;
        await dialog.dismiss();
      });

      // Block external network so the request either fails fast or hangs
      // (we don't care which - we just need the in-flight state).
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('http://localhost:3000') || url.startsWith('http://127.0.0.1:3000')) {
          return route.continue();
        }
        return route.abort();
      });

      await page.goto(`/#/${studio.route}`);
      await expect(page.locator('[data-studio-back]').first())
        .toBeVisible({ timeout: 10_000 });

      const textarea = page.locator(`#${studio.textareaId}`);
      await expect(textarea).toBeVisible();
      await textarea.fill('Test prompt for E2E error-state coverage.');

      const generateBtn = page.locator(`button[data-tooltip="${studio.tooltip}"]`);
      await expect(generateBtn).toBeEnabled();
      await generateBtn.click();

      // While the job is in flight the createAbortAwareGenerate helper sets
      // disabled=true on the generate button and inserts a sibling Cancel
      // button with text "Cancel".
      await expect(generateBtn).toBeDisabled({ timeout: 5_000 });
      const cancelBtn = page.locator('#app button:has-text("Cancel")').first();
      await expect(cancelBtn).toBeVisible();

      expect(dialogTriggered, `Unexpected dialog on /#/${studio.route} generate`).toBeNull();
    });
  }
});

test.describe('No alert() dialogs across studio flow', () => {
  // Sweep all listed studios, navigate, and fail the test if a native dialog
  // is ever raised. The dialog handler rejects via the pageerror sink below.
  for (const route of STUDIO_ROUTES) {
    test(`studio "${route}" never triggers alert/confirm/prompt`, async ({ page }) => {
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.dismiss();
      });

      await page.goto(`/#/${route}`);
      await expect(page.locator('[data-studio-back]').first())
        .toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(400);

      expect(dialogs, `Dialogs triggered on /#/${route}`).toEqual([]);
    });
  }
});
