import { test, expect } from '@playwright/test';

// Acceptance for the Personalization + Lead Finder modal ported from
// OpenHiggsBolt (src/features/personalization). The lead search is served by
// netlify/functions/personalization-api.mts in a deployment; here the API is
// stubbed so the spec runs against `npm run dev` alone.

const BUSINESSES = [
  {
    id: 'osm-node-1',
    source: 'OPENSTREETMAP',
    osmType: 'node',
    osmId: '1',
    name: 'Acme Roofing',
    category: 'Home Contractors',
    address: '1 Main St, Fort Lauderdale, Florida',
    website: 'https://acme-roofing.example',
    phone: '555-0100',
    ownership: 'independent',
    score: 91,
    signals: { phone: true, website: true },
  },
];

// First-run "set up your API keys" dialog (SettingsModal) opens shortly after
// load when no keys are stored; close it so it doesn't cover the page.
async function dismissWelcome(page) {
  const title = page.getByText('Welcome — set up your API keys');
  try {
    await title.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    return;
  }
  await page.getByRole('button', { name: 'Close' }).first().click();
  await expect(title).toHaveCount(0);
}

test.describe('Personalization + Lead Finder modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/personalization/find-businesses', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          query: { niche: 'Home Contractors', location: 'Fort Lauderdale, FL', radiusMiles: 5 },
          count: BUSINESSES.length,
          businesses: BUSINESSES,
        }),
      }),
    );
    await page.route('**/api/personalization/leads', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) }),
    );
  });

  test('opens from a studio Personalize button with the remix palette', async ({ page }) => {
    await page.goto('/#/image', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 15000 });
    await dismissWelcome(page);
    await expect(page.locator('.btn-personalize').first()).toBeVisible({ timeout: 15000 });
    await page.locator('.btn-personalize').first().click();

    await expect(page.getByText('STEP 1 — WHO IS THIS FOR?')).toBeVisible({ timeout: 60000 });
    const findMyBrand = page.locator('#pz-find-my-brand');
    await expect(findMyBrand).toBeVisible();
    // Neon-yellow primary border (remix --color-primary), not OpenHiggsBolt cyan.
    await expect(findMyBrand).toHaveCSS('border-top-color', 'rgb(217, 255, 0)');
  });

  test('finds local businesses by niche and location', async ({ page }) => {
    await page.goto('/#/leadfinder', { waitUntil: 'domcontentloaded' });
    await dismissWelcome(page);
    await expect(page.getByRole('heading', { name: 'Find local businesses that need video' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sign in to see your saved leads.')).toBeVisible();

    await page.getByRole('button', { name: 'Find businesses' }).click();
    await expect(page.getByText('STEP 1 — WHO IS THIS FOR?')).toBeVisible({ timeout: 60000 });

    await page.getByText(/find a local business by niche/i).first().click();
    await page.locator('#business-niche').selectOption('home-contractors');
    await page.locator('#business-location').fill('Fort Lauderdale, FL');
    await page.locator('button', { hasText: /mi/ }).first().click();

    await expect(page.getByText('Acme Roofing').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /use this business/i }).first()).toBeVisible();
  });

  test('closes when the route changes', async ({ page }) => {
    await page.goto('/#/leadfinder', { waitUntil: 'domcontentloaded' });
    await dismissWelcome(page);
    await page.getByRole('button', { name: 'Find businesses' }).click();
    await expect(page.getByText('STEP 1 — WHO IS THIS FOR?')).toBeVisible({ timeout: 60000 });

    await page.evaluate(() => { window.location.hash = '#/image'; });
    await expect(page.getByText('STEP 1 — WHO IS THIS FOR?')).toHaveCount(0, { timeout: 10000 });
  });
});

test.describe('Personalization entry points (OpenHiggsBolt parity)', () => {
  test('landing demo cards have "Personalize This Demo" styled like "View Prompt"', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const personalize = page.locator('[data-mmx-cta="personalize"]').first();
    for (let i = 0; i < 80 && (await personalize.count()) === 0; i++) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(300);
    }
    await expect(personalize).toBeAttached({ timeout: 30000 });
    const row = personalize.locator('xpath=..');
    const view = row.locator('[data-mmx-cta="view-prompt"]');
    expect(await personalize.getAttribute('class')).toBe(await view.getAttribute('class'));

    await personalize.scrollIntoViewIfNeeded();
    await personalize.click();
    await expect(page.getByText('Find your business').first()).toBeVisible({ timeout: 60000 });
  });

  test('free Find My Brand opens the modal signed-out', async ({ page }) => {
    await page.goto('/#/find-my-brand', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pz-find-my-brand')).toBeVisible({ timeout: 60000 });
  });

  test('"Edit in Image Studio" hand-off opens Image Studio in image-to-image mode', async ({ page }) => {
    await page.goto('/#/apps', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content-area', { timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => localStorage.setItem('sv_studio_prefill', JSON.stringify({
      route: 'image', prompt: 'Acme hero shot', params: { referenceImageUrl: 'https://picsum.photos/id/10/600/400' }, ref: 'personalization', at: Date.now(),
    })));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(() => { window.location.hash = '#/image'; });
    const prompt = page.locator('#i-prompt-textarea');
    await expect(prompt).toHaveValue('Acme hero shot', { timeout: 30000 });
    await expect(prompt).toHaveAttribute('placeholder', /transform this image/i, { timeout: 15000 });
    expect(errors).toEqual([]);
  });
});
