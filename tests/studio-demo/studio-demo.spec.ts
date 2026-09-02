import { test, expect } from '@playwright/test';
import {
  StudioDemoOrchestrator,
  STUDIO_CONFIGS,
  type StudioConfig
} from './studio-demo';

/**
 * Studio Demo Automation Test Suite
 *
 * Executes video-recorded product demonstrations across all configured studios.
 *
 * Environment Variables:
 * - STUDIO_URLS: Override STUDIO_CONFIGS with comma-separated URLs
 * - VIDEO_CONVERT: Set to 'true' to auto-convert WebM to MP4 via FFmpeg
 * - BASE_URL: Base URL for the application
 */

test.describe('Studio Demo Automation', () => {
  let orchestrator: StudioDemoOrchestrator;
  let studios: StudioConfig[];

  // Load studio configurations before tests
  test.beforeAll(() => {
    // Allow overriding studio URLs via environment variable
    const envUrls = process.env.STUDIO_URLS;
    if (envUrls) {
      const urls = envUrls.split(',').map((url, index) => ({
        id: `env-studio-${index + 1}`,
        name: `Environment Studio ${index + 1}`,
        url: url.trim(),
        features: [
          {
            name: 'Load Page',
            description: 'Navigate to and load the studio page',
            action: { type: 'wait', ms: 2000 } as const,
            validate: [
              { type: 'url', expected: url.trim(), description: 'URL loaded successfully' }
            ]
          }
        ]
      })) as StudioConfig[];
      studios = urls.length > 0 ? urls : STUDIO_CONFIGS;
    } else {
      studios = STUDIO_CONFIGS;
    }
  });

  test.beforeEach(async ({ page }) => {
    // Initialize orchestrator with page
    orchestrator = new StudioDemoOrchestrator(page);

    // Set viewport for consistent video recording
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Set default timeout for the page
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
  });

  test.afterEach(async () => {
    // Generate and save report
    const reportPath = orchestrator.saveReport();
    console.log(`\n[Test] Demo report saved: ${reportPath}`);

    // Optional: Convert videos to MP4
    if (process.env.VIDEO_CONVERT === 'true') {
      console.log('[Test] Converting videos to MP4...');
      await orchestrator['videoRecorder'].postProcessVideos();
    }
  });

  test('record all studios', async ({ page }) => {
    test.info().annotations.push({ type: 'demo', description: 'Records all studio environments' });
    test.setTimeout(60 * 60 * 1000);

    const results = await orchestrator.runAllStudios(studios);

    // Assert that at least one studio passed (for CI/CD gating)
    const passed = results.filter((r) => r.passed).length;
    console.log(`\n[Test] Summary: ${passed}/${studios.length} studios passed`);

    // Fail if all studios failed
    expect(passed).toBeGreaterThan(0);
  });

  test('record single studio by ID', async ({ page }) => {
    const studioId = process.env.TEST_STUDIO_ID;
    if (!studioId) {
      test.skip(true, 'Set TEST_STUDIO_ID to run this test');
      return;
    }

    const studio = STUDIO_CONFIGS.find((s) => s.id === studioId);
    if (!studio) {
      test.skip(true, `Studio with ID "${studioId}" not found in config`);
      return;
    }

    const result = await orchestrator.runStudioDemo(studio);
    expect(result.passed).toBe(true);
  });
});
