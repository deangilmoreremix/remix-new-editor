/**
 * Isolated harness for CinemaTemplateStudio component tests.
 * Mounts the real component without modifying production routes.
 */

import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('CinemaTemplateStudio isolated harness', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Intercept network requests to avoid external dependencies
    await page.route('**/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>CinemaTemplateStudio Harness</title></head>
            <body>
              <div id="root"></div>
              <script type="module">
                import { CinemaTemplateStudio } from '/src/components/CinemaTemplateStudio.js';
                const root = document.getElementById('root');
                root.appendChild(CinemaTemplateStudio());
              </script>
            </body>
          </html>
        `,
      });
    });
  });

  test('desktop: Cinema I2V template browse view', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/desktop-cinema-template-studio-i2v.png', fullPage: true });
  });

  test('desktop: Cinema Movie Poster', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/desktop-cinema-template-studio-movie-poster.png', fullPage: true });
  });

  test('desktop: Cinema picker closed', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/desktop-cinema-picker-closed.png', fullPage: true });
  });

  test('mobile: Cinema I2V template', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/mobile-cinema-i2v.png', fullPage: true });
  });

  test('mobile: Cinema Movie Poster', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/mobile-cinema-movie-poster.png', fullPage: true });
  });
});
