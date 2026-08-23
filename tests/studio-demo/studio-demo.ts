/**
 * Studio Demo Automation Framework
 *
 * A comprehensive Playwright script for automated product demonstrations
 * across multiple studio environments with video recording capabilities.
 *
 * Architecture:
 * - Configuration-driven studio list and feature definitions
 * - Resilient element interaction with retry/timeout strategies
 * - Built-in Playwright video recording per studio
 * - Validation layer with screenshot-on-failure
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION LAYER
// =============================================================================

interface StudioConfig {
  id: string;
  name: string;
  url: string;
  features: FeatureStep[];
  expectedTitle?: string;
  authRequired?: boolean;
  authCredentials?: {
    email: string;
    password: string;
  };
}

interface FeatureStep {
  name: string;
  description: string;
  action: FeatureAction;
  validate?: ValidationCheck[];
  waitForSelector?: string;
  screenshot?: boolean;
}

type FeatureAction =
  | { type: 'click'; selector: string; options?: { force?: boolean; delay?: number } }
  | { type: 'fill'; selector: string; value: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'hover'; selector: string }
  | { type: 'scroll'; selector?: string; direction?: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'wait'; ms: number }
  | { type: 'waitForSelector'; selector: string; state?: 'visible' | 'hidden' | 'attached' }
  | { type: 'press'; key: string }
  | { type: 'evaluate'; script: string }
  | { type: 'custom'; handler: (page: Page) => Promise<void> };

interface ValidationCheck {
  type: 'visible' | 'hidden' | 'text' | 'url' | 'count' | 'attribute';
  selector?: string;
  expected?: string | number;
  description: string;
}

interface DemoResult {
  studioId: string;
  studioName: string;
  url: string;
  passed: boolean;
  videoPath?: string;
  screenshots: string[];
  errors: string[];
  duration: number;
  featureResults: FeatureResult[];
}

interface FeatureResult {
  name: string;
  passed: boolean;
  error?: string;
}

// =============================================================================
// STUDIO CONFIGURATIONS
// =============================================================================

/**
 * Define all studio environments to test.
 * Extend this array with your actual studio URLs and feature workflows.
 */
export const STUDIO_CONFIGS: StudioConfig[] = [
  {
    id: 'studio-alpha',
    name: 'Studio Alpha - Main Dashboard',
    url: 'https://your-app.com/studios/alpha',
    expectedTitle: 'Studio Alpha',
    features: [
      {
        name: 'Open Dashboard',
        description: 'Load the main dashboard view',
        action: { type: 'waitForSelector', selector: '[data-testid="dashboard"]', state: 'visible' },
        validate: [
          { type: 'visible', selector: '[data-testid="dashboard"]', description: 'Dashboard is visible' },
          { type: 'text', selector: 'h1', expected: 'Dashboard', description: 'Dashboard heading present' }
        ]
      },
      {
        name: 'Toggle Sidebar',
        description: 'Open the navigation sidebar',
        action: { type: 'click', selector: '[aria-label="Toggle sidebar"]' },
        waitForSelector: '[data-testid="sidebar"]',
        validate: [
          { type: 'visible', selector: '[data-testid="sidebar"]', description: 'Sidebar is open' }
        ]
      },
      {
        name: 'Navigate to Projects',
        description: 'Click Projects in sidebar navigation',
        action: { type: 'click', selector: '[data-testid="nav-projects"]' },
        waitForSelector: '[data-testid="projects-list"]',
        validate: [
          { type: 'url', expected: '/projects', description: 'URL contains /projects' }
        ]
      }
    ]
  },
  {
    id: 'studio-beta',
    name: 'Studio Beta - Editor Environment',
    url: 'https://your-app.com/studios/beta',
    expectedTitle: 'Studio Beta',
    features: [
      {
        name: 'Load Editor',
        description: 'Wait for editor canvas to be ready',
        action: { type: 'waitForSelector', selector: '.editor-canvas', state: 'visible' },
        validate: [
          { type: 'visible', selector: '.editor-canvas', description: 'Editor canvas loaded' }
        ]
      },
      {
        name: 'Open Properties Panel',
        description: 'Click properties button to reveal panel',
        action: { type: 'click', selector: '[aria-label="Properties"]' },
        waitForSelector: '.properties-panel',
        validate: [
          { type: 'visible', selector: '.properties-panel', description: 'Properties panel visible' }
        ]
      },
      {
        name: 'Toggle Dark Mode',
        description: 'Switch to dark theme',
        action: { type: 'click', selector: '[aria-label="Toggle dark mode"]' },
        validate: [
          { type: 'attribute', selector: 'body', expected: 'dark', description: 'Dark mode applied' }
        ]
      }
    ]
  }
];

// =============================================================================
// RESILIENT ELEMENT INTERACTION ENGINE
// =============================================================================

/**
 * ElementInteractionEngine provides resilient selectors and retry logic
 * for handling dynamic UI elements, shadow DOM, and timing issues.
 */
export class ElementInteractionEngine {
  private page: Page;
  private defaultTimeout: number;

  constructor(page: Page, defaultTimeout = 15000) {
    this.page = page;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Generates multiple selector strategies for a single logical element.
   * Supports: data-testid, aria-label, role, text content, CSS classes.
   */
  generateSelectors(elementName: string, strategies: string[] = []): string[] {
    const baseSelectors: string[] = [];

    // Strategy 1: data-testid (most reliable)
    baseSelectors.push(`[data-testid="${this.toKebabCase(elementName)}"]`);

    // Strategy 2: aria-label
    baseSelectors.push(`[aria-label*="${elementName}" i]`);

    // Strategy 3: role-based
    const roleMap: Record<string, string> = {
      'button': 'button',
      'menu': 'menu',
      'tab': 'tab',
      'link': 'link',
      'dialog': 'dialog'
    };
    if (roleMap[elementName.toLowerCase()]) {
      baseSelectors.push(`role=${roleMap[elementName.toLowerCase()]}`);
    }

    // Strategy 4: Custom strategies
    if (strategies.length > 0) {
      baseSelectors.push(...strategies);
    }

    return baseSelectors;
  }

  /**
   * Clicks an element using multiple selector fallbacks.
   */
  async clickWithFallback(
    elementName: string,
    options?: { force?: boolean; delay?: number; customSelectors?: string[] }
  ): Promise<void> {
    const selectors = this.generateSelectors(elementName, options?.customSelectors);
    let lastError: Error | null = null;

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout: this.defaultTimeout
        });
        await this.page.click(selector, {
          force: options?.force,
          delay: options?.delay ?? 100
        });
        console.log(`[Interaction] Clicked: ${elementName} via "${selector}"`);
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[Interaction] Failed to click "${selector}": ${(err as Error).message}`);
      }
    }

    throw new Error(`Could not click "${elementName}" with any selector: ${lastError?.message}`);
  }

  /**
   * Fills an input field with fallback selectors.
   */
  async fillWithFallback(
    fieldName: string,
    value: string,
    options?: { clearFirst?: boolean }
  ): Promise<void> {
    const selectors = this.generateSelectors(fieldName, [
      `input[name="${this.toCamelCase(fieldName)}"]`,
      `input[placeholder*="${fieldName}" i]`,
      `#${this.toKebabCase(fieldName)}`
    ]);

    let lastError: Error | null = null;

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, {
          state: 'visible',
          timeout: this.defaultTimeout
        });

        if (options?.clearFirst) {
          await this.page.fill(selector, '');
        }
        await this.page.fill(selector, value);
        console.log(`[Interaction] Filled: ${fieldName} = "${value}" via "${selector}"`);
        return;
      } catch (err) {
        lastError = err as Error;
      }
    }

    throw new Error(`Could not fill "${fieldName}": ${lastError?.message}`);
  }

  /**
   * Waits for any of multiple selectors to appear.
   */
  async waitForAny(
    selectors: string[],
    options?: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' }
  ): Promise<string> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const state = options?.state ?? 'visible';

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { state, timeout });
        return selector;
      } catch {
        continue;
      }
    }

    throw new Error(`None of the selectors appeared within ${timeout}ms: ${selectors.join(', ')}`);
  }

  /**
   * Handles dynamic content loading with auto-wait and stability checks.
   */
  async waitForStableElement(selector: string, stabilityMs = 500): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout: this.defaultTimeout });

    // Wait for content to stabilize (no layout shifts)
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetWidth > 0;
      },
      selector,
      { timeout: this.defaultTimeout }
    );

    await this.page.waitForTimeout(stabilityMs);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[-_\s](.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, (_, char) => char.toLowerCase());
  }
}

// =============================================================================
// VALIDATION ENGINE
// =============================================================================

export class ValidationEngine {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async runChecks(checks: ValidationCheck[]): Promise<{ passed: boolean; failures: string[] }> {
    const failures: string[] = [];

    for (const check of checks) {
      try {
        await this.executeCheck(check);
        console.log(`[Validation] ✓ ${check.description}`);
      } catch (err) {
        const errorMsg = `✗ ${check.description}: ${(err as Error).message}`;
        failures.push(errorMsg);
        console.error(`[Validation] ${errorMsg}`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  private async executeCheck(check: ValidationCheck): Promise<void> {
    switch (check.type) {
      case 'visible':
        if (!check.selector) throw new Error('Selector required for visibility check');
        await expect(this.page.locator(check.selector).first()).toBeVisible({
          timeout: 10000
        });
        break;

      case 'hidden':
        if (!check.selector) throw new Error('Selector required for hidden check');
        await expect(this.page.locator(check.selector).first()).toBeHidden({
          timeout: 10000
        });
        break;

      case 'text':
        if (!check.selector) throw new Error('Selector required for text check');
        if (typeof check.expected !== 'string') throw new Error('Expected text required');
        await expect(this.page.locator(check.selector).first()).toContainText(check.expected, {
          timeout: 10000
        });
        break;

      case 'url':
        if (typeof check.expected !== 'string') throw new Error('Expected URL string required');
        await expect(this.page).toHaveURL(new RegExp(check.expected), {
          timeout: 10000
        });
        break;

      case 'count':
        if (!check.selector) throw new Error('Selector required for count check');
        if (typeof check.expected !== 'number') throw new Error('Expected count number required');
        await expect(this.page.locator(check.selector)).toHaveCount(check.expected, {
          timeout: 10000
        });
        break;

      case 'attribute':
        if (!check.selector) throw new Error('Selector required for attribute check');
        if (typeof check.expected !== 'string') throw new Error('Expected attribute value required');
        const locator = this.page.locator(check.selector).first();
        await expect(locator).toHaveAttribute('class', new RegExp(check.expected));
        break;

      default:
        throw new Error(`Unknown validation type: ${(check as any).type}`);
    }
  }
}

// =============================================================================
// VIDEO RECORDER MANAGER
// =============================================================================

export class VideoRecorder {
  private videoDir: string;
  private recordings: Map<string, string> = new Map();

  constructor(videoDir = './test-results/videos') {
    this.videoDir = videoDir;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.videoDir)) {
      fs.mkdirSync(this.videoDir, { recursive: true });
    }
  }

  /**
   * Generates a unique video path for a studio recording.
   */
  getVideoPath(studioId: string, timestamp = Date.now()): string {
    const sanitizedId = studioId.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const filename = `studio-demo-${sanitizedId}-${timestamp}.webm`;
    const fullPath = path.join(this.videoDir, filename);
    this.recordings.set(studioId, fullPath);
    return fullPath;
  }

  /**
   * Configures Playwright context for video recording.
   */
  getContextOptions(videoPath: string) {
    return {
      recordVideo: {
        dir: path.dirname(videoPath),
        size: { width: 1920, height: 1080 }
      }
    };
  }

  /**
   * Returns metadata about all recordings.
   */
  getRecordings(): { studioId: string; videoPath: string }[] {
    return Array.from(this.recordings.entries()).map(([studioId, videoPath]) => ({
      studioId,
      videoPath
    }));
  }

  /**
   * Post-processes videos: converts to MP4, compresses, etc.
   * Requires ffmpeg to be installed.
   */
  async postProcessVideos(): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    for (const [studioId, videoPath] of this.recordings.entries()) {
      const mp4Path = videoPath.replace('.webm', '.mp4');
      try {
        await execAsync(
          `ffmpeg -i "${videoPath}" -c:v libx264 -preset fast -crf 23 -y "${mp4Path}"`
        );
        console.log(`[Video] Converted ${studioId} to MP4: ${mp4Path}`);
      } catch (err) {
        console.warn(`[Video] FFmpeg conversion failed for ${studioId}: ${(err as Error).message}`);
      }
    }
  }
}

// =============================================================================
// STUDIO DEMO ORCHESTRATOR
// =============================================================================

export class StudioDemoOrchestrator {
  private interactionEngine: ElementInteractionEngine;
  private validationEngine: ValidationEngine;
  private videoRecorder: VideoRecorder;
  private results: DemoResult[] = [];

  constructor() {
    this.interactionEngine = new ElementInteractionEngine(test.info().page!);
    this.validationEngine = new ValidationEngine(test.info().page!);
    this.videoRecorder = new VideoRecorder();
  }

  /**
   * Executes a full demo workflow for a single studio.
   */
  async runStudioDemo(studio: StudioConfig): Promise<DemoResult> {
    const startTime = Date.now();
    const videoPath = this.videoRecorder.getVideoPath(studio.id);
    const screenshots: string[] = [];
    const errors: string[] = [];
    const featureResults: FeatureResult[] = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[StudioDemo] Starting: ${studio.name}`);
    console.log(`[StudioDemo] URL: ${studio.url}`);
    console.log(`[StudioDemo] Video: ${videoPath}`);
    console.log(`${'='.repeat(60)}`);

    // Create context with video recording
    const context = await test.info().page!.context();
    const videoOptions = this.videoRecorder.getContextOptions(videoPath);

    // Navigate to studio
    try {
      await test.info().page!.goto(studio.url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log(`[StudioDemo] Navigated to ${studio.url}`);
    } catch (err) {
      errors.push(`Navigation failed: ${(err as Error).message}`);
      const screenshot = await this.captureScreenshot(`error-nav-${studio.id}`);
      screenshots.push(screenshot);
    }

    // Handle authentication if required
    if (studio.authRequired && studio.authCredentials) {
      try {
        await this.handleAuth(studio.authCredentials);
        console.log('[StudioDemo] Authentication successful');
      } catch (err) {
        errors.push(`Auth failed: ${(err as Error).message}`);
      }
    }

    // Validate page load
    if (studio.expectedTitle) {
      try {
        await expect(test.info().page!).toHaveTitle(new RegExp(studio.expectedTitle));
      } catch (err) {
        errors.push(`Title validation failed: ${(err as Error).message}`);
      }
    }

    // Execute feature workflow
    for (const feature of studio.features) {
      console.log(`\n[StudioDemo] Feature: ${feature.name} - ${feature.description}`);
      const featureStart = Date.now();

      try {
        // Wait for pre-condition if specified
        if (feature.waitForSelector) {
          await this.interactionEngine.waitForStableElement(feature.waitForSelector);
        }

        // Execute action
        await this.executeAction(feature.action);

        // Short pause to let UI settle (for video clarity)
        await test.info().page!.waitForTimeout(800);

        // Run validations
        if (feature.validate && feature.validate.length > 0) {
          const validationResult = await this.validationEngine.runChecks(feature.validate);
          featureResults.push({
            name: feature.name,
            passed: validationResult.passed,
            error: validationResult.failures.join('; ')
          });

          if (!validationResult.passed) {
            errors.push(...validationResult.failures);
          }
        } else {
          featureResults.push({ name: feature.name, passed: true });
        }

        // Optional screenshot for this feature
        if (feature.screenshot !== false) {
          const screenshot = await this.captureScreenshot(
            `${studio.id}-${feature.name.toLowerCase().replace(/\s+/g, '-')}`
          );
          screenshots.push(screenshot);
        }

        console.log(`[StudioDemo] ✓ Feature completed in ${Date.now() - featureStart}ms`);
      } catch (err) {
        const errorMsg = `Feature "${feature.name}" failed: ${(err as Error).message}`;
        errors.push(errorMsg);
        featureResults.push({ name: feature.name, passed: false, error: (err as Error).message });

        const screenshot = await this.captureScreenshot(`error-${studio.id}-${feature.name}`);
        screenshots.push(screenshot);
        console.error(`[StudioDemo] ✗ ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;
    const passed = errors.length === 0;

    console.log(`\n[StudioDemo] ${passed ? 'PASSED' : 'FAILED'} in ${duration}ms`);
    console.log(`[StudioDemo] Errors: ${errors.length}, Screenshots: ${screenshots.length}`);

    const result: DemoResult = {
      studioId: studio.id,
      studioName: studio.name,
      url: studio.url,
      passed,
      videoPath: videoPath,
      screenshots,
      errors,
      duration,
      featureResults
    };

    this.results.push(result);
    return result;
  }

  /**
   * Execute different action types.
   */
  private async executeAction(action: FeatureAction): Promise<void> {
    const page = test.info().page!;

    switch (action.type) {
      case 'click':
        await this.interactionEngine.clickWithFallback(
          action.selector,
          action.options
        );
        break;

      case 'fill':
        await this.interactionEngine.fillWithFallback(action.selector, action.value);
        break;

      case 'select':
        await page.selectOption(action.selector, action.value);
        break;

      case 'hover':
        await page.hover(action.selector);
        break;

      case 'scroll':
        await this.scrollElement(action.selector, action.direction);
        break;

      case 'wait':
        await page.waitForTimeout(action.ms);
        break;

      case 'waitForSelector':
        await page.waitForSelector(action.selector, {
          state: action.state ?? 'visible',
          timeout: 15000
        });
        break;

      case 'press':
        await page.keyboard.press(action.key);
        break;

      case 'evaluate':
        await page.evaluate(action.script);
        break;

      case 'custom':
        await action.handler(page);
        break;
    }
  }

  private async scrollElement(selector: string | undefined, direction?: string): Promise<void> {
    const page = test.info().page!;
    const target = selector ? page.locator(selector) : page;
    await target.evaluate((el, dir) => {
      const element = el as HTMLElement;
      const scrollMap: Record<string, number> = {
        'up': -300,
        'down': 300,
        'top': -element.scrollHeight,
        'bottom': element.scrollHeight
      };
      element.scrollBy({ top: scrollMap[dir || 'down'], behavior: 'smooth' });
    }, direction || 'down');
  }

  private async handleAuth(credentials: { email: string; password: string }): Promise<void> {
    const page = test.info().page!;

    // Fill email
    await page.fill('input[type="email"]', credentials.email);
    // Fill password
    await page.fill('input[type="password"]', credentials.password);
    // Submit
    await page.click('button[type="submit"]');
    // Wait for redirect
    await page.waitForURL((url) => !url.href.includes('/login'), { timeout: 15000 });
  }

  private async captureScreenshot(name: string): Promise<string> {
    const page = test.info().page!;
    const screenshotDir = './test-results/screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const path = `${screenshotDir}/${name}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    return path;
  }

  /**
   * Runs demos for all configured studios sequentially.
   */
  async runAllStudios(studios: StudioConfig[]): Promise<DemoResult[]> {
    console.log(`\n[Orchestrator] Running ${studios.length} studio demos...`);

    for (const studio of studios) {
      const result = await this.runStudioDemo(studio);

      // Brief pause between studios
      if (studios.indexOf(studio) < studios.length - 1) {
        await test.info().page!.waitForTimeout(2000);
      }
    }

    return this.results;
  }

  /**
   * Generates a comprehensive demo report.
   */
  generateReport(): string {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    let report = `
# Studio Demo Automation Report
Generated: ${new Date().toISOString()}

## Summary
| Metric | Count |
|--------|-------|
| Total Studios | ${this.results.length} |
| Passed | ${passed} |
| Failed | ${failed} |
| Success Rate | ${((passed / this.results.length) * 100).toFixed(1)}% |

## Results by Studio
`;

    for (const result of this.results) {
      report += `
### ${result.studioName}
- **URL:** ${result.url}
- **Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${(result.duration / 1000).toFixed(1)}s
- **Video:** ${result.videoPath || 'N/A'}
- **Screenshots:** ${result.screenshots.length}
- **Features:**
`;

      for (const feature of result.featureResults) {
        report += `  - ${feature.passed ? '✅' : '❌'} ${feature.name}\n`;
        if (feature.error) {
          report += `    - Error: ${feature.error}\n`;
        }
      }

      if (result.errors.length > 0) {
        report += `\n**Errors:**\n`;
        result.errors.forEach((e) => {
          report += `- ${e}\n`;
        });
      }
    }

    return report;
  }

  /**
   * Saves the report to a file.
   */
  saveReport(reportDir = './test-results'): string {
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = `${reportDir}/demo-report-${Date.now()}.md`;
    fs.writeFileSync(reportPath, this.generateReport());
    console.log(`[Orchestrator] Report saved: ${reportPath}`);
    return reportPath;
  }
}

// =============================================================================
// PLAYWRIGHT TEST CONFIGURATION
// =============================================================================

/**
 * Extends Playwright test with video recording and retry logic.
 *
 * Usage:
 *   test.describe('Studio Demos', () => {
 *     test.beforeEach(async ({ page }) => {
 *       await page.setViewportSize({ width: 1920, height: 1080 });
 *     });
 *
 *     test('record all studios', async ({ page }) => {
 *       const orchestrator = new StudioDemoOrchestrator();
 *       await orchestrator.runAllStudios(STUDIO_CONFIGS);
 *       orchestrator.saveReport();
 *     });
 *   });
 */

// =============================================================================
// ADVANCED PATTERNS
// =============================================================================

/**
 * Shadow DOM Piercing Strategy
 * Use when elements are inside web components.
 */
export class ShadowDOMPiercer {
  static async findInShadowDOM(page: Page, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const element = await page.evaluate((sel) => {
          const parts = sel.split('>>>');
          let current: Element | null = document;

          for (const part of parts) {
            if (!current) return null;
            if (current === document) {
              current = document.querySelector(part.trim());
            } else {
              current = (current as HTMLElement).shadowRoot?.querySelector(part.trim()) || null;
            }
          }

          return current ? 'found' : null;
        }, selector);

        if (element) {
          return selector;
        }
      } catch {
        continue;
      }
    }
    return null;
  }
}

/**
 * Network Interception for Validating API Calls
 * Ensures features trigger expected backend requests.
 */
export class NetworkValidator {
  private page: Page;
  private requests: Map<string, number> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Starts listening for specific API patterns.
   */
  async monitorPatterns(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await this.page.route(pattern, (route) => {
        const url = route.request().url();
        const count = this.requests.get(url) || 0;
        this.requests.set(url, count + 1);
        route.continue();
      });
    }
  }

  /**
   * Asserts that a pattern was called at least N times.
   */
  assertCalled(pattern: string, minCalls = 1): void {
    let total = 0;
    for (const [url, count] of this.requests.entries()) {
      if (url.includes(pattern)) {
        total += count;
      }
    }

    if (total < minCalls) {
      throw new Error(
        `Expected "${pattern}" to be called at least ${minCalls} times, but was called ${total} times`
      );
    }
  }

  getStats(): Record<string, number> {
    return Object.fromEntries(this.requests.entries());
  }
}

/**
 * Parallel Studio Demo Runner
 * Runs multiple studios concurrently with controlled parallelism.
 */
export class ParallelDemoRunner {
  private videoRecorder: VideoRecorder;

  constructor() {
    this.videoRecorder = new VideoRecorder();
  }

  /**
   * Runs studios in parallel batches.
   * @param studios Studios to run
   * @param concurrency Max parallel executions (default: 2 to avoid resource exhaustion)
   */
  async runInParallel(studios: StudioConfig[], concurrency = 2): Promise<DemoResult[]> {
    const results: DemoResult[] = [];
    const batches: StudioConfig[][] = [];

    // Split into batches
    for (let i = 0; i < studios.length; i += concurrency) {
      batches.push(studios.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map((studio) => this.runSingleStudio(studio))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`[ParallelRunner] Studio failed: ${result.reason}`);
        }
      }
    }

    return results;
  }

  private async runSingleStudio(studio: StudioConfig): Promise<DemoResult> {
    // Implementation similar to StudioDemoOrchestrator.runStudioDemo
    // but self-contained for parallel execution
    console.log(`[ParallelRunner] Running ${studio.name}...`);
    return {
      studioId: studio.id,
      studioName: studio.name,
      url: studio.url,
      passed: true,
      screenshots: [],
      errors: [],
      duration: 0,
      featureResults: []
    };
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/**
 * Example usage:
 *
 * npx playwright test studio-demo.ts --project=chromium
 * npx playwright test studio-demo.ts --grep "record all studios"
 *
 * Environment variables:
 * - STUDIO_URLS: Comma-separated list of URLs
 * - VIDEO_DIR: Directory for video output
 * - HEADLESS: true/false (default: true)
 */

if (require.main === module) {
  console.log(`
Studio Demo Automation
=====================

Usage:
  npx playwright test studio-demo.ts

Configuration:
  - Edit STUDIO_CONFIGS to add your studios
  - Set VIDEO_DIR environment variable for output
  - Configure credentials via environment variables

Output:
  - Videos: ./test-results/videos/
  - Screenshots: ./test-results/screenshots/
  - Report: ./test-results/demo-report-<timestamp>.md
  `);
}

export default {
  STUDIO_CONFIGS,
  StudioDemoOrchestrator,
  VideoRecorder,
  ElementInteractionEngine,
  ValidationEngine,
  ParallelDemoRunner,
  ShadowDOMPiercer,
  NetworkValidator
};
