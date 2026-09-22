import { test, expect } from '@playwright/test';

const CONTACT_ID = 'e2e-personalization-contact';

const seededProfile = {
  id: CONTACT_ID,
  contact: {
    name: 'Jane Client',
    firstName: 'Jane',
    lastName: 'Client',
    email: 'jane@example.com',
    company: 'Acme Roofing',
    phone: '555-0100',
  },
  company: {
    name: 'Acme Roofing',
    industry: 'Roofing',
    summary: 'Local residential and commercial roofing company.',
  },
  intelligence: {
    products: ['Roof replacement'],
    services: ['Roof repair'],
    painPoints: ['Storm damage'],
    tone: 'professional',
  },
  variables: {},
  personalization: {
    audience: 'client',
    business: {
      audience: 'client',
      name: 'Jane Client',
      website: 'https://example.com',
      businessName: 'Acme Roofing',
      industry: 'Roofing',
      location: 'Fort Lauderdale, FL',
      productService: 'Roof replacement',
      offer: 'Free roof inspection',
      ctaHeadline: 'Protect your home',
      callToAction: 'Book your free inspection',
      phone: '555-0100',
      email: 'jane@example.com',
      brandDescription: 'Trusted local roofing company',
    },
    assets: {
      identities: [{
        id: 'presenter1',
        role: 'presenter_identity',
        name: 'Owner',
        url: 'https://placehold.co/500x500/png',
        originalUrl: 'https://placehold.co/500x500/png',
        sourceCategory: 'person',
        versions: [],
      }],
      primaryIdentityId: 'presenter1',
      logos: [{
        id: 'logo1',
        role: 'logo',
        name: 'Primary Logo',
        url: 'https://placehold.co/600x300/png',
        originalUrl: 'https://placehold.co/600x300/png',
        sourceCategory: 'logo',
        versions: [],
      }],
      primaryLogoId: 'logo1',
      products: [{
        id: 'product1',
        role: 'product_reference',
        name: 'Roofing Service',
        url: 'https://placehold.co/600x400/png',
        originalUrl: 'https://placehold.co/600x400/png',
        sourceCategory: 'service',
        versions: [],
      }],
      brandReferences: [{
        id: 'brand1',
        role: 'brand_reference',
        name: 'Completed Roof',
        url: 'https://placehold.co/600x400/png',
        originalUrl: 'https://placehold.co/600x400/png',
        sourceCategory: 'completed_work',
        versions: [],
      }],
      firstFrame: {
        id: 'first1',
        role: 'first_frame',
        name: 'Opening',
        url: 'https://placehold.co/1280x720/png',
        originalUrl: 'https://placehold.co/1280x720/png',
        sourceCategory: 'storefront',
        versions: [],
      },
      lastFrame: {
        id: 'last1',
        role: 'last_frame',
        name: 'Ending',
        url: 'https://placehold.co/1280x720/png',
        originalUrl: 'https://placehold.co/1280x720/png',
        sourceCategory: 'brand',
        versions: [],
      },
      ctaGraphic: {
        id: 'cta1',
        role: 'cta_graphic',
        name: 'CTA',
        url: 'https://placehold.co/1280x720/png',
        originalUrl: 'https://placehold.co/1280x720/png',
        sourceCategory: 'brand',
        versions: [],
      },
      audio: [],
      savedReferences: [],
    },
    discoveredAssets: [],
    generationOptions: {
      exactLogoHandling: 'final-overlay',
      exactCtaHandling: 'final-end-card',
    },
  },
};

test.describe('Unified personalization acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ contactId, profile }) => {
      localStorage.setItem('remix_contacts', JSON.stringify([{
        id: contactId,
        name: 'Jane Client',
        firstName: 'Jane',
        lastName: 'Client',
        email: 'jane@example.com',
        company: 'Acme Roofing',
      }]));
      localStorage.setItem('remix_contact_profiles', JSON.stringify([profile]));
      localStorage.setItem('remix_selected_contact_id', contactId);
      window.__personalizationApplied = null;
      window.addEventListener('remix:personalization-applied', (event) => {
        window.__personalizationApplied = event.detail;
      });
    }, { contactId: CONTACT_ID, profile: seededProfile });

    await page.goto('/#/image', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app', { timeout: 15000 });
    await expect(page.locator('.btn-personalize').first()).toBeVisible({ timeout: 15000 });
    await page.locator('.btn-personalize').first().click();
    await expect(page.locator('.pm-modal')).toBeVisible({ timeout: 10000 });
  });

  test('keeps one modal and persists Business / Client fields', async ({ page }) => {
    await expect(page.locator('.pm-modal')).toHaveCount(1);

    await page.getByRole('tab', { name: 'Business / Client' }).click();
    await expect(page.locator('[data-audience="client"]')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#pm-business-offer').fill('Same-day inspection');
    await page.locator('#pm-business-cta').fill('Schedule now');
    await page.locator('[data-action="save-business-profile"]').click();

    const saved = await page.evaluate((contactId) => {
      const profiles = JSON.parse(localStorage.getItem('remix_contact_profiles') || '[]');
      return profiles.find((profile) => profile.id === contactId);
    }, CONTACT_ID);

    expect(saved.personalization.audience).toBe('client');
    expect(saved.personalization.business.offer).toBe('Same-day inspection');
    expect(saved.personalization.business.callToAction).toBe('Schedule now');
    expect(saved.variables.offer).toBe('Same-day inspection');
  });

  test('shows role-aware assets, exact handling, and the integrated editor', async ({ page }) => {
    await page.getByRole('tab', { name: 'Assets' }).click();

    for (const label of [
      'Person / Presenter',
      'Logo',
      'Products / Services',
      'Brand References',
      'First Frame',
      'Last Frame',
      'CTA Graphic',
      'Saved References',
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    await expect(page.locator('[data-generation-option="exactLogoHandling"]')).toHaveValue('final-overlay');
    await expect(page.locator('[data-generation-option="exactCtaHandling"]')).toHaveValue('final-end-card');

    await page.locator('[data-action="open-imported-asset-editor"][data-asset-id="logo1"]').click();
    await expect(page.locator('[data-personalization-image-editor]')).toBeVisible();
    await expect(page.getByText('SmartVideo AI Image Editor')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Advanced Edit' })).toBeVisible();

    await page.getByRole('button', { name: 'Advanced Edit' }).click();
    await expect(page.getByText('AI Tools', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select / Mask Area' })).toBeVisible();

    await page.getByRole('button', { name: '← Simple Mode' }).click();
    await page.getByRole('button', { name: 'Close Editor' }).click();
    await expect(page.locator('[data-personalization-image-editor]')).toHaveCount(0);
  });

  test('applies capability context with first/last frame and deterministic exact assets', async ({ page }) => {
    const prompt = page.locator('#i-prompt-textarea');
    await prompt.fill('Create an ad for {{businessName}} with {{offer}}');

    // Footer Apply button is owned by the existing PersonalizeModal. Using it
    // proves the unified system still feeds the host studio rather than a
    // second backend/modal.
    await page.locator('[data-personalize-action="apply"]').click();
    await expect(page.locator('.pm-modal')).toHaveCount(0);

    const detail = await page.evaluate(() => window.__personalizationApplied);
    expect(detail).toBeTruthy();
    expect(detail.studioId).toBe('image');
    expect(detail.personalization.business.businessName).toBe('Acme Roofing');
    expect(detail.personalization.firstFrame.url).toBe('https://placehold.co/1280x720/png');
    expect(detail.personalization.lastFrame.url).toBe('https://placehold.co/1280x720/png');
    expect(detail.personalization.ctaGraphic.url).toBe('https://placehold.co/1280x720/png');
    expect(detail.personalization.exactOverlays.logoHandling).toBe('final-overlay');
    expect(detail.personalization.exactOverlays.ctaHandling).toBe('final-end-card');
    expect(detail.personalization.exactOverlayManifest.strategy).toBe('deterministic-final-composite');
    expect(detail.personalization.exactOverlayManifest.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'exact-logo', type: 'image-overlay', deterministic: true }),
      expect.objectContaining({ id: 'exact-cta-end-card', type: 'end-card-image', deterministic: true }),
    ]));

    await expect(prompt).toHaveValue(/Acme Roofing/);
    await expect(prompt).toHaveValue(/Free roof inspection/);
  });
});
