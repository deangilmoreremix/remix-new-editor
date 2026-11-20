// tests/e2e/onboarding.spec.js
// The app-wide onboarding (#/onboarding): all six steps, tool picker, skip, resume, redirect when done, redo.
// Runs in dev-bypass mode (?dev), where there is no Clerk user, so answers live in this browser's storage.
import { test, expect } from '@playwright/test';

const OPEN = '/?dev#/onboarding';
const open = async (page, url = OPEN) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-onboarding]', { timeout: 30_000 });
};
const stepText = (page) => page.locator('[data-onboarding]').getByText(/^Step \d of 6$/);

async function answerUpToSource(page) {
  await page.click('[data-onb-goal="ai-video"]');
  await page.click('[data-onb-team="2-5"]');
  await page.click('[data-onb-volume="100+"]');
  await page.fill('input[name=company]', 'Acme Inc.');
  await page.fill('input[name=website]', 'acme.com');
  await page.fill('input[name=jobTitle]', 'Account Executive');
  await page.click('[data-onb-work] button[type=submit]');
}

test.describe('App-wide onboarding', () => {
  test('walks all six steps, picks tools by thumbnail, and opens the first chosen tool', async ({ page }) => {
    await open(page);
    await expect(page.locator('h1')).toContainText('What do you want to do first?');
    await expect(stepText(page)).toHaveText('Step 1 of 6');
    await answerUpToSource(page);
    await expect(page.locator('h1')).toContainText('how did you hear about us?');
    await page.click('[data-onb-heard="linkedin"]');

    // 6a: the goal's own video types come first; Continue needs a choice
    await expect(stepText(page)).toHaveText('Step 6 of 6');
    await expect(page.locator('[data-onb-type]').first()).toHaveAttribute('data-onb-type', 'text-to-video');
    await expect(page.locator('[data-onb-continue]')).toBeDisabled();
    await page.click('[data-onb-type="talking"]');
    await page.click('[data-onb-continue]');

    // 6b: grouped like the side menu, recommended first, every card has a picture
    const groups = await page.locator('[data-onb-group]').evaluateAll((n) => n.map((e) => e.getAttribute('data-onb-group')));
    expect(groups).toEqual(['Discover', 'Image', 'Video', 'Agents', 'My Work']);
    const firstVideo = await page.locator('[data-onb-group="Video"] [data-onb-tool]').first().getAttribute('data-onb-tool');
    expect(firstVideo).toBe('avatar');
    expect(await page.locator('[data-onb-tool]').count()).toBe(38);
    expect(await page.locator('[data-onb-open]').count()).toBe(38);
    await page.locator('[data-onb-tool]').last().scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('[data-onb-tool] img').evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length)).toBe(0);

    await page.click('[data-onb-tool="lipsync"]');
    await page.click('[data-onb-tool="avatar"]');
    await expect(page.locator('[data-onb-start]')).toHaveText('Start');
    await page.click('[data-onb-start]');

    // 6c: get ready. Try a wrong key (rejected, nothing saved), then a good one, then open the studio.
    await expect(page.locator('h1')).toContainText('Get ready for your first result');
    await expect(page.locator('[data-onb-finish]')).toHaveText('Open Lip Sync Studio');
    await page.route('**/functions/v1/muapi-proxy', async (route) => {
      const key = route.request().headers()['x-api-key'];
      if (key === 'wrongkey123456') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"bad key"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"balance": 25}' });
    });
    await page.fill('[data-onb-key-input]', 'wrongkey123456');
    await page.click('[data-onb-key-test]');
    await expect(page.locator('.ob-key-status')).toContainText('did not accept');
    await expect(page.locator('[data-onb-key-form]')).toHaveCount(1);
    await page.fill('[data-onb-key-input]', 'goodkey1234567');
    await page.click('[data-onb-key-test]');
    await expect(page.locator('[data-onb-key-connected]')).toContainText('25 credits');
    await page.click('[data-onb-finish]');
    await page.waitForFunction(() => location.hash === '#/lipsync', null, { timeout: 30_000 });
    await expect(page.locator('[data-onboarding]')).toHaveCount(0);
    // the setup popup does not cover the studio, and the sample prompt is waiting in its prompt box
    await expect(page.locator('[data-studio-prompt]')).toHaveValue(/Acme Inc\./, { timeout: 30_000 });
    await expect(page.locator('[data-redo-onboarding], [data-auth-modal]')).toHaveCount(0);
  });

  test('Skip for now on the get-ready screen opens the studio without a key', async ({ page }) => {
    await open(page);
    await answerUpToSource(page);
    await page.click('[data-onb-heard="linkedin"]');
    await page.click('[data-onb-type="talking"]');
    await page.click('[data-onb-continue]');
    await page.click('[data-onb-tool="avatar"]');
    await page.click('[data-onb-start]');
    await expect(page.locator('[data-onb-key-form]')).toHaveCount(1); // the dev placeholder key is not a real key
    await page.click('[data-onb-plans]');
    await expect(page.locator('[data-upgrade]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('[data-upgrade] button[aria-label="Close"]')?.click());
    await page.click('[data-onb-ready-skip]');
    await page.waitForFunction(() => location.hash === '#/avatar', null, { timeout: 30_000 });
    await expect(page.locator('[data-redo-onboarding], [data-auth-modal]')).toHaveCount(0);
  });

  test('step 1 is two large cards; the Academy button leaves to the Academy and onboarding does not come back', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-onb-goal]')).toHaveCount(2);
    await page.click('[data-onb-academy]');
    await page.waitForFunction(() => location.hash === '#/academy', null, { timeout: 30_000 });
    await expect(page.locator('[data-onboarding]')).toHaveCount(0);
    // going back to the onboarding link sends a skipped user straight on
    await page.goto(OPEN, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.hash === '#/image', null, { timeout: 30_000 });
  });

  test('reloading resumes at the saved step with the saved answers', async ({ page }) => {
    await open(page);
    await page.click('[data-onb-goal="personal"]');
    await page.click('[data-onb-team="solo"]');
    await expect(stepText(page)).toHaveText('Step 3 of 6');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-onboarding]');
    await expect(stepText(page)).toHaveText('Step 3 of 6');
    await page.click('[data-onb-back]');
    await expect(page.locator('[data-onb-team="solo"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a finished onboarding redirects away, and ?redo=1 restarts it with the old answers', async ({ page }) => {
    await open(page);
    await answerUpToSource(page);
    await page.click('[data-onb-heard="google"]');
    await page.click('[data-onb-all-tools]');
    await page.click('[data-onb-start]'); // nothing selected: Explore all tools
    await page.click('[data-onb-finish]');
    await page.waitForFunction(() => location.hash === '#/apps', null, { timeout: 30_000 });

    await page.goto(OPEN, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.hash === '#/apps', null, { timeout: 30_000 });
    await expect(page.locator('[data-onboarding]')).toHaveCount(0);

    await open(page, '/?dev&redo=1#/onboarding');
    await expect(stepText(page)).toHaveText('Step 1 of 6');
    await page.click('[data-onb-goal="ai-video"]');
    await page.click('[data-onb-back]');
    await expect(page.locator('[data-onb-goal="ai-video"]')).toHaveAttribute('aria-pressed', 'true');
    // abandoning the redo leaves the earlier completion in place
    await page.goto(OPEN, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.hash === '#/apps', null, { timeout: 30_000 });
  });

  test('works on a phone-sized screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await answerUpToSource(page);
    await page.click('[data-onb-heard="google"]');
    await page.click('[data-onb-all-tools]');
    await expect(page.locator('[data-onb-bar]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
