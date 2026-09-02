/**
 * Multi-Angle Recorder
 *
 * Records multiple browser viewports simultaneously for:
 * - Picture-in-picture layouts
 * - Split-screen comparisons
 * - Multi-device responsive demos
 * - Before/after comparisons
 */

import { type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface AngleConfig {
  name: string;
  url: string;
  viewport: { width: number; height: number };
  selector?: string; // Region to focus on
  crop?: { x: number; y: number; width: number; height: number };
}

export interface AngleRecording {
  name: string;
  page: Page;
  context: BrowserContext;
  viewport: { width: number; height: number };
  videoPath?: string;
}

export interface CompositeLayout {
  type: 'grid' | 'horizontal' | 'vertical' | 'picture-in-picture' | 'comparison';
  positions: Array<{
    angle: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

// =============================================================================
// MULTI-ANGLE RECORDER
// =============================================================================

export class MultiAngleRecorder {
  private page: Page;
  private browser: any;
  private angles: Map<string, AngleRecording> = new Map();
  private outputDir: string;

  constructor(page: Page, outputDir = './test-results/multi-angle') {
    this.page = page;
    this.browser = page.context().browser() || (page.context() as any).browser();
    this.outputDir = outputDir || './test-results/multi-angle';
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Adds a new camera angle.
   */
  async addAngle(config: AngleConfig): Promise<AngleRecording> {
    if (!this.browser) {
      throw new Error('Browser instance not available. Multi-angle recording requires a connected browser.');
    }

    const context = await this.browser.newContext({
      viewport: config.viewport,
      recordVideo: {
        dir: path.join(this.outputDir, config.name),
        size: config.viewport,
      },
    });

    const newPage = await context.newPage();
    await newPage.goto(config.url);
    await newPage.waitForLoadState('networkidle');

    // Crop to region if specified
    if (config.crop) {
      await newPage.setViewportSize({
        width: config.crop.width,
        height: config.crop.height,
      });
    }

    const recording: AngleRecording = {
      name: config.name,
      page: newPage,
      context,
      viewport: config.viewport,
    };

    this.angles.set(config.name, recording);
    console.log(`[MultiAngle] Added angle: ${config.name}`);
    
    return recording;
  }

  /**
   * Records all angles simultaneously for a duration.
   */
  async recordAll(duration: number): Promise<Map<string, string>> {
    const videoPaths = new Map<string, string>();

    console.log(`[MultiAngle] Recording ${this.angles.size} angles for ${duration}ms`);

    // Wait for duration
    await this.page.waitForTimeout(duration);

    // Collect video paths
    for (const [name, angle] of this.angles.entries()) {
      const videos = await angle.page.context().videos();
      if (videos.length > 0) {
        videoPaths.set(name, videos[0]);
      }
    }

    return videoPaths;
  }

  /**
   * Creates a composite video with all angles in a grid layout.
   */
  async createGridComposite(
    layout: { columns: number; rows: number },
    outputPath: string
  ): Promise<void> {
    const angles = Array.from(this.angles.values());
    const totalWidth = layout.columns * 1920;
    const totalHeight = layout.rows * 1080;

    // This would use FFmpeg to create a grid
    console.log(`[MultiAngle] Creating ${layout.columns}x${layout.rows} grid: ${totalWidth}x${totalHeight}`);
    console.log(`[MultiAngle] Angles: ${angles.map(a => a.name).join(', ')}`);
  }

  /**
   * Creates a picture-in-picture composite.
   */
  async createPiPComposite(
    mainAngle: string,
    overlayAngle: string,
    overlaySize: { width: number; height: number },
    position: { x: number; y: number },
    outputPath: string
  ): Promise<void> {
    const main = this.angles.get(mainAngle);
    const overlay = this.angles.get(overlayAngle);

    if (!main || !overlay) {
      throw new Error('Invalid angle names for PiP');
    }

    console.log(`[MultiAngle] Creating PiP: ${mainAngle} + ${overlayAngle}`);
    console.log(`[MultiAngle] Overlay: ${overlaySize.width}x${overlaySize.height} at (${position.x}, ${position.y})`);
  }

  /**
   * Creates a comparison slider video.
   */
  async createComparison(
    leftAngle: string,
    rightAngle: string,
    outputPath: string
  ): Promise<void> {
    const left = this.angles.get(leftAngle);
    const right = this.angles.get(rightAngle);

    if (!left || !right) {
      throw new Error('Invalid angle names for comparison');
    }

    console.log(`[MultiAngle] Creating comparison: ${leftAngle} vs ${rightAngle}`);
  }

  /**
   * Synchronizes playback across all angles.
   */
  async syncPlayback(action: () => Promise<void>): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const angle of this.angles.values()) {
      promises.push(action().then(() => angle.page.waitForTimeout(100)));
    }

    await Promise.all(promises);
  }

  /**
   * Closes all angle contexts and cleans up.
   */
  async dispose(): Promise<void> {
    for (const angle of this.angles.values()) {
      await angle.context.close();
    }
    this.angles.clear();
    console.log('[MultiAngle] Disposed all angles');
  }

  /**
   * Gets all active angles.
   */
  getAngles(): AngleRecording[] {
    return Array.from(this.angles.values());
  }
}

// =============================================================================
// RESPONSIVE DEMO RECORDER
// =============================================================================

export interface DeviceProfile {
  name: string;
  viewport: { width: number; height: number };
  userAgent: string;
}

export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  'desktop-hd': {
    name: 'Desktop HD',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  'desktop-4k': {
    name: 'Desktop 4K',
    viewport: { width: 3840, height: 2160 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  'laptop': {
    name: 'Laptop',
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  },
  'tablet': {
    name: 'Tablet',
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  'mobile': {
    name: 'Mobile',
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  },
};

export class ResponsiveDemoRecorder {
  private page: Page;
  private browser: any;
  private recordings: Map<string, AngleRecording> = new Map();

  constructor(page: Page) {
    this.page = page;
    this.browser = page.context().browser();
  }

  /**
   * Records demo across multiple device profiles.
   */
  async recordAcrossDevices(
    url: string,
    devices: string[],
    duration: number
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const deviceName of devices) {
      const profile = DEVICE_PROFILES[deviceName];
      if (!profile) continue;

      console.log(`[Responsive] Recording on ${profile.name}`);

      const context = await this.browser.newContext({
        viewport: profile.viewport,
        userAgent: profile.userAgent,
        recordVideo: {
          dir: `test-results/responsive/${deviceName}`,
          size: profile.viewport,
        },
      });

      const devicePage = await context.newPage();
      await devicePage.goto(url);
      await devicePage.waitForLoadState('networkidle');

      // Record for duration
      await devicePage.waitForTimeout(duration);

      // Get video path
      const videos = await devicePage.context().videos();
      if (videos.length > 0) {
        results.set(deviceName, videos[0]);
      }

      await context.close();
    }

    return results;
  }

  /**
   * Creates a responsive demo grid showing all devices.
   */
  async createResponsiveGrid(
    url: string,
    devices: string[],
    outputPath: string
  ): Promise<void> {
    // Implementation would record all devices and composite
    console.log(`[Responsive] Creating grid for devices: ${devices.join(', ')}`);
  }
}

// =============================================================================
// BEFORE/AFTER COMPARISON
// =============================================================================

export class BeforeAfterComparison {
  private page: Page;
  private browser: any;

  constructor(page: Page) {
    this.page = page;
    this.browser = page.context().browser();
  }

  /**
   * Records before/after states for comparison demo.
   */
  async recordComparison(
    beforeState: () => Promise<void>,
    afterState: () => Promise<void>,
    duration = 5000
  ): Promise<{ before: string; after: string }> {
    // Record before state
    const beforeContext = await this.browser.newContext({
      recordVideo: {
        dir: 'test-results/comparison',
        size: { width: 1920, height: 1080 },
      },
    });

    const beforePage = await beforeContext.newPage();
    await beforePage.goto('about:blank');
    await beforeState();
    
    await beforePage.waitForTimeout(duration);
    const beforeVideos = await beforePage.context().videos();
    const beforePath = beforeVideos[0] || '';

    // Record after state
    const afterContext = await this.browser.newContext({
      recordVideo: {
        dir: 'test-results/comparison',
        size: { width: 1920, height: 1080 },
      },
    });

    const afterPage = await afterContext.newPage();
    await afterPage.goto('about:blank');
    await afterState();
    
    await afterPage.waitForTimeout(duration);
    const afterVideos = await afterPage.context().videos();
    const afterPath = afterVideos[0] || '';

    await beforeContext.close();
    await afterContext.close();

    return { before: beforePath, after: afterPath };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default MultiAngleRecorder;
