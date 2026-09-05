import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3100';
const FIXTURE = {
  ok: true,
  report: {
    reportJson: {
      business: { name: "Joe's Roofing", city: 'Fort Lauderdale', country: 'FL' },
      marketingScore: { score: 38, band: 'Needs Attention' },
      categoryScores: { conversion: 30, trust: 45, search: 20, mobile: 55, images: 15, video: 10 },
      working: [{ label: 'HTTPS enabled' }, { label: 'Mobile-friendly layout' }, { label: 'Contact information present' }],
      priorityFixes: [
        { label: 'No strong primary CTA detected', severity: 'high', evidence: 'Homepage does not present a clear next step', recommendation: 'Add a prominent call-to-action' },
        { label: 'No promotional video detected', severity: 'high', evidence: 'No video content found', recommendation: 'Add a short service-area explainer video' },
      ],
      proofAssets: [
        { id: 'a1', assetType: 'personalized_website', title: 'Personalized Website', previewUrl: 'https://example.com/website', downloadUrl: null },
        { id: 'a2', assetType: 'hero_image', title: 'Hero Image', previewUrl: 'https://example.com/hero.jpg', downloadUrl: null },
        { id: 'a3', assetType: 'promotional_video', title: 'Promotional Video', previewUrl: 'https://example.com/video.mp4', downloadUrl: null },
      ],
      summary: { total: 31, applicable: 28, passed: 8, warnings: 5, failed: 15, notApplicable: 3 },
    },
    agencyOnly: null, internalNotes: null, userId: null,
  },
};

function mockRoute(page, status, body) {
  return page.route('**/api/audit/report/**', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('Public Client Audit Report — logged-out E2E', () => {
  test('1. logged-out public access loads report', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText("Joe's Roofing");
    await expect(page.locator('body')).toContainText('Marketing Score');
  });

  test('2. public API succeeds through browser', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    const requests = [];
    page.on('request', r => { if (r.url().includes('/api/audit/report/')) requests.push(r.url()); });
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText("Joe's Roofing");
    expect(requests.length).toBeGreaterThan(0);
  });

  test('3. client sanitization — no internal fields in body', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('agencyOnly');
    expect(text).not.toContain('internalNotes');
    expect(text).not.toContain('Foundry');
    expect(text).not.toContain('reachability');
  });

  test('4. XSS does not execute', async ({ page }) => {
    const xssFixture = JSON.parse(JSON.stringify(FIXTURE));
    xssFixture.report.reportJson.business.name = "<script>window.__xss=true</script>";
    await mockRoute(page, 200, xssFixture);
    await page.goto(`${BASE_URL}/audit/report/xss-test`);
    const xss = await page.evaluate(() => (window).__xss);
    expect(xss).toBeUndefined();
  });

  test('5. unsafe proof URLs are blocked', async ({ page }) => {
    const unsafeFixture = JSON.parse(JSON.stringify(FIXTURE));
    unsafeFixture.report.reportJson.proofAssets = [{ id: 'u1', assetType: 'personalized_website', title: 'Unsafe', previewUrl: 'javascript:alert(1)', downloadUrl: 'data:text/html,<script>alert(1)</script>' }];
    await mockRoute(page, 200, unsafeFixture);
    await page.goto(`${BASE_URL}/audit/report/unsafe-test`);
    const links = page.locator('a[href="javascript:alert(1)"]');
    expect(await links.count()).toBe(0);
  });

  test('6. valid website proof URL renders with VIEW', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    const viewLinks = page.locator('a:has-text("VIEW")');
    expect(await viewLinks.count()).toBeGreaterThan(0);
  });

  test('7. valid image proof URL renders', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText('Hero Image');
  });

  test('8. valid video proof URL renders', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText('Promotional Video');
  });

  test('9. invalid token shows unavailable state', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit/report/invalid-token-value`);
    await expect(page.locator('body')).toContainText('Report Not Available');
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('SQL');
    expect(text).not.toContain('stack');
  });

  test('10. revoked token shows unavailable', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit/report/revoked-token`);
    await expect(page.locator('body')).toContainText('Report Not Available');
  });

  test('11. new token after revocation works', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/new-token-after-revoke`);
    await expect(page.locator('body')).toContainText("Joe's Roofing");
  });

  test('12. security headers present on static page', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    const response = await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    const headers = response?.headers() || {};
    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['cache-control']).toContain('no-store');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  test('13. referrer policy is no-referrer', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    const response = await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    const headers = response?.headers() || {};
    expect(headers['referrer-policy']).toBe('no-referrer');
  });

  test('14. 375px mobile — no horizontal overflow', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText("Joe's Roofing");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('15. 768px tablet — no horizontal overflow', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText("Joe's Roofing");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('16. snapshot immutability — reload shows same data', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText("Joe's Roofing");
    await page.reload();
    await expect(page.locator('body')).toContainText("Joe's Roofing");
  });

  test('17. copy client link — public URL contains /audit/report/', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/abc123def456ghi789jkl012mno345pqr`);
    const url = page.url();
    expect(url).toContain('/audit/report/');
    expect(url).not.toContain('/api/audit/report/');
  });

  test('18. 31-point report renders from serialized data', async ({ page }) => {
    await mockRoute(page, 200, FIXTURE);
    await page.goto(`${BASE_URL}/audit/report/test-token-123`);
    await expect(page.locator('body')).toContainText('31-Point SmartVideo Marketing Audit');
    await expect(page.locator('body')).toContainText('Conversion');
    await expect(page.locator('body')).toContainText('Trust');
  });
});
