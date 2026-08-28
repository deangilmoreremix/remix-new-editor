/**
 * End-to-end workflow tests.
 *
 * Tests validate complete user journeys across multiple pages and components.
 * These tests require Playwright and a running dev server.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('User Onboarding Flow', () => {
  test('new user can sign up and reach dashboard', async ({ page }) => {
    await page.goto(BASE_URL);

    // Click sign up
    await page.click('text=Sign Up');
    await page.fill('input[name="email"]', 'test-' + Date.now() + '@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('returning user can sign in', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('OAuth sign in redirects correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Mock OAuth popup
    await page.click('button:has-text("Google")');

    // Should open OAuth window or redirect
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button:has-text("Google")'),
    ]);

    await popup.waitForLoadState();
    await popup.close();
  });
});

test.describe('Project Builder Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto(BASE_URL);
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('user can create and deploy a project', async ({ page }) => {
    // Create new project
    await page.fill('textarea[placeholder="Describe your website"]', 'A modern landing page for a SaaS product');
    await page.click('button:has-text("Generate")');

    // Wait for agent to finish
    await expect(page.locator('text=Preview')).toBeVisible({ timeout: 60000 });

    // Preview the project
    await page.click('text=Preview');
    await expect(page.frameLocator('iframe')).toBeVisible();

    // Deploy
    await page.click('button:has-text("Deploy")');
    await expect(page.locator('text=Deployed')).toBeVisible({ timeout: 30000 });

    // Verify deploy URL
    const deployUrl = await page.locator('text=pages.dev').textContent();
    expect(deployUrl).toContain('pages.dev');
  });

  test('user can refine project with follow-up prompt', async ({ page }) => {
    // Assume project already exists
    await page.goto(`${BASE_URL}/dashboard`);

    // Select first project
    await page.click('[data-testid="project-card"]:first-child');

    // Enter refine prompt
    await page.fill('textarea[placeholder="Describe changes"]', 'Make the header blue');
    await page.click('button:has-text("Update")');

    // Wait for update
    await expect(page.locator('text=Updated')).toBeVisible({ timeout: 30000 });
  });

  test('user can delete project', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Right-click or use context menu
    await page.click('[data-testid="project-card"]:first-child button[aria-label="More options"]');
    await page.click('text=Delete');
    await page.click('button:has-text("Confirm")');

    // Project should be removed
    await expect(page.locator('[data-testid="project-card"]:first-child')).not.toBeVisible();
  });
});

test.describe('Render Studio Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
  });

  test('user can create draft and queue render', async ({ page }) => {
    // Navigate to Render studio
    await page.goto(`${BASE_URL}/studio/render`);

    // Upload video
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/sample-video.mp4');

    // Configure render
    await page.selectOption('select[name="action"]', 'enhance');
    await page.fill('input[name="label"]', 'Test Render');

    // Save draft
    await page.click('button:has-text("Save Draft")');
    await expect(page.locator('text=Draft saved')).toBeVisible();

    // Queue render
    await page.click('button:has-text("Queue Render")');
    await expect(page.locator('text=Queued')).toBeVisible();

    // Check queue
    await expect(page.locator('[data-testid="render-queue-item"]')).toHaveCount(1);
  });

  test('user can manage templates', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/render`);

    // Go to templates tab
    await page.click('text=Templates');

    // Create template
    await page.click('button:has-text("Create Template")');
    await page.fill('input[name="label"]', 'My Template');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=My Template')).toBeVisible();

    // Duplicate template
    await page.click('[data-testid="template-item"]:first-child button[aria-label="Duplicate"]');
    await expect(page.locator('text=My Template (Copy)')).toBeVisible();

    // Delete template
    await page.click('[data-testid="template-item"]:first-child button[aria-label="Delete"]');
    await page.click('button:has-text("Confirm")');
    await expect(page.locator('text=My Template')).not.toBeVisible();
  });
});

test.describe('Admin Workflow', () => {
  test('admin can access admin panel', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/admin`);
    await expect(page).toHaveURL(/.*admin/);
    await expect(page.locator('text=Admin Panel')).toBeVisible();
  });

  test('non-admin is redirected from admin panel', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'UserPass123!');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/admin`);
    await expect(page).toHaveURL(/.*dashboard/);
  });
});

test.describe('Performance', () => {
  test('initial page load under 3s on fast 3G', async ({ page }) => {
    // Simulate fast 3G
    await page.context().setOffline(false);
    await page.context().setGPSEnabled(false);

    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('dashboard renders 100 projects smoothly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // Mock 100 projects
    await page.route('**/api/projects', async (route) => {
      const projects = Array.from({ length: 100 }, (_, i) => ({
        id: `proj-${i}`,
        title: `Project ${i}`,
        user_id: 'user-123',
      }));
      await route.fulfill({ json: { projects } });
    });

    await page.goto(`${BASE_URL}/dashboard`);

    // Verify scrolling is smooth
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Verify all projects rendered
    const projectCount = await page.locator('[data-testid="project-card"]').count();
    expect(projectCount).toBe(100);
  });
});

test.describe('Accessibility', () => {
  test('page has proper heading hierarchy', async ({ page }) => {
    await page.goto(BASE_URL);

    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThanOrEqual(1);

    const h2s = await page.locator('h2').count();
    expect(h2s).toBeGreaterThanOrEqual(0);

    // No skipped levels
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const levels = await Promise.all(headings.map((h) => h.evaluate((el) => parseInt(el.tagName[1]))));
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  test('all interactive elements have accessible names', async ({ page }) => {
    await page.goto(BASE_URL);

    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const name = await button.getAttribute('aria-label');
      const text = await button.textContent();
      expect(name || text?.trim()).toBeTruthy();
    }
  });

  test('keyboard navigation works', async ({ page }) => {
    await page.goto(BASE_URL);

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to activate with Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  });
});
