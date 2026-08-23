/**
 * Camera Movement Engine for Cinematic Demo Recording
 *
 * Simulates professional camera movements within the browser viewport:
 * - Dolly in/out (zoom)
 * - Pan (scroll-based horizontal movement)
 * - Tilt (scroll-based vertical movement)
 * - Close-up (focus on element)
 * - Pull back (wide shot)
 * - Tracking shot (follow element)
 * - Crane shot (combined zoom + pan)
 * - Dutch angle (rotated perspective)
 *
 * All movements are smooth and interpolated for broadcast-quality feel.
 */

import { type Page, type BrowserContext } from '@playwright/test';

// =============================================================================
// CAMERA CONFIGURATION
// =============================================================================

export interface CameraConfig {
  width: number;
  height: number;
  frameRate: 30;
  // Default easing functions
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  easingParams?: [number, number, number, number]; // For cubic-bezier
  // Smoothing
  smoothing: number; // 0-1, higher = smoother but slower
}

export const DEFAULT_CAMERA: CameraConfig = {
  width: 1920,
  height: 1080,
  frameRate: 30,
  easing: 'ease-in-out',
  smoothing: 0.15,
};

export const CINEMATIC_CAMERA: CameraConfig = {
  width: 3840,
  height: 2160,
  frameRate: 60,
  easing: 'cubic-bezier',
  easingParams: [0.25, 0.1, 0.25, 1],
  smoothing: 0.1,
};

// =============================================================================
// CAMERA STATE
// =============================================================================

export interface CameraState {
  x: number; // Scroll X
  y: number; // Scroll Y
  zoom: number; // 1.0 = 100%
  rotation: number; // Degrees
  targetX?: number;
  targetY?: number;
  targetZoom?: number;
  targetRotation?: number;
}

export interface CameraMove {
  type: CameraMoveType;
  duration: number; // ms
  easing?: string;
  params?: Record<string, any>;
  onStart?: () => Promise<void>;
  onComplete?: () => Promise<void>;
}

export type CameraMoveType =
  | 'dolly-in'
  | 'dolly-out'
  | 'pan'
  | 'tilt'
  | 'track'
  | 'crane'
  | 'close-up'
  | 'pull-back'
  | 'reset'
  | 'custom';

// =============================================================================
// CAMERA MOVEMENT ENGINE
// =============================================================================

export class CameraMovementEngine {
  private page: Page;
  private context: BrowserContext;
  private config: CameraConfig;
  private state: CameraState;
  private isAnimating = false;
  private animationId: number | null = null;
  private moveHistory: CameraMove[] = [];

  constructor(page: Page, config: Partial<CameraConfig> = {}) {
    this.page = page;
    this.context = page.context();
    this.config = { ...DEFAULT_CAMERA, ...config };
    this.state = {
      x: 0,
      y: 0,
      zoom: 1.0,
      rotation: 0,
    };
  }

  /**
   * Initializes camera state from current page position.
   */
  async initialize(): Promise<void> {
    const viewport = this.page.viewportSize();
    if (!viewport) {
      await this.page.setViewportSize({ width: this.config.width, height: this.config.height });
    }

    // Get initial scroll position
    const scrollPos = await this.page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));

    this.state.x = scrollPos.x;
    this.state.y = scrollPos.y;
    this.state.zoom = 1.0;

    // Inject camera transform CSS if needed
    await this.injectCameraStyles();
  }

  /**
   * Injects CSS for smooth camera transforms.
   */
  private async injectCameraStyles(): Promise<void> {
    await this.page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'camera-movement-styles';
      style.textContent = `
        .camera-transform {
          transform-origin: 0 0;
          will-change: transform;
          transition: transform 0.1s linear;
        }
        .camera-smooth-scroll {
          scroll-behavior: smooth;
        }
        /* Hide cursor during camera moves for cleaner footage */
        .camera-moving {
          cursor: none !important;
        }
        .camera-moving * {
          cursor: none !important;
        }
      `;
      document.head.appendChild(style);
    });
  }

  /**
   * Executes a camera move with smooth interpolation.
   */
  async executeMove(move: CameraMove): Promise<void> {
    if (this.isAnimating) {
      await this.stopAnimation();
    }

    this.isAnimating = true;
    this.moveHistory.push(move);

    const startTime = Date.now();
    const startState = { ...this.state };

    // Set targets based on move type
    this.setMoveTargets(move);

    // Execute onStart callback
    if (move.onStart) {
      await move.onStart();
    }

    // Animate
    await this.animate(startState, move);

    // Execute onComplete callback
    if (move.onComplete) {
      await move.onComplete();
    }

    this.isAnimating = false;
  }

  /**
   * Sets target values for the camera move.
   */
  private setMoveTargets(move: CameraMove): void {
    const easing = move.easing || this.config.easing;

    switch (move.type) {
      case 'dolly-in':
        this.state.targetZoom = Math.min(this.state.zoom * 1.5, 4.0);
        break;
      case 'dolly-out':
        this.state.targetZoom = Math.max(this.state.zoom / 1.5, 0.5);
        break;
      case 'pan':
        this.state.targetX = (move.params?.distance || 300) + this.state.x;
        break;
      case 'tilt':
        this.state.targetY = (move.params?.distance || 300) + this.state.y;
        break;
      case 'track':
        // Follow an element - set target to element position
        this.state.targetX = move.params?.x || this.state.x;
        this.state.targetY = move.params?.y || this.state.y;
        break;
      case 'crane':
        this.state.targetZoom = move.params?.zoom || 2.0;
        this.state.targetX = move.params?.x || this.state.x;
        this.state.targetY = move.params?.y || this.state.y;
        break;
      case 'close-up':
        this.state.targetZoom = move.params?.zoom || 3.0;
        this.state.targetX = move.params?.x || this.state.x;
        this.state.targetY = move.params?.y || this.state.y;
        break;
      case 'pull-back':
        this.state.targetZoom = 0.5;
        this.state.targetX = 0;
        this.state.targetY = 0;
        break;
      case 'reset':
        this.state.targetX = 0;
        this.state.targetY = 0;
        this.state.targetZoom = 1.0;
        this.state.targetRotation = 0;
        break;
    }
  }

  /**
   * Animates camera movement using setTimeout (Node.js compatible).
   */
  private async animate(startState: CameraState, move: CameraMove): Promise<void> {
    const duration = move.duration;
    const startTime = Date.now();
    const frameInterval = 1000 / this.config.frameRate; // ms per frame

    return new Promise((resolve) => {
      const tick = async () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        const easedProgress = this.applyEasing(progress, move.easing || this.config.easing);

        // Interpolate state
        const currentState = this.interpolateState(startState, this.state, easedProgress);
        await this.applyState(currentState);

        if (progress < 1.0) {
          this.animationId = setTimeout(tick, frameInterval) as any;
        } else {
          this.animationId = null;
          resolve();
        }
      };

      this.animationId = setTimeout(tick, frameInterval) as any;
    });
  }

  /**
   * Interpolates between start and target camera state.
   */
  private interpolateState(start: CameraState, target: CameraState, t: number): CameraState {
    return {
      x: this.lerp(start.x, target.targetX ?? start.x, t),
      y: this.lerp(start.y, target.targetY ?? start.y, t),
      zoom: this.lerp(start.zoom, target.targetZoom ?? start.zoom, t),
      rotation: this.lerp(start.rotation, target.targetRotation ?? start.rotation, t),
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Applies camera state to the page.
   */
  private async applyState(state: CameraState): Promise<void> {
    // Apply zoom via CSS transform
    await this.page.evaluate(
      (state) => {
        const app = document.querySelector('#app') || document.body;
        if (app) {
          (app as HTMLElement).style.transform = `scale(${state.zoom}) rotate(${state.rotation}deg)`;
          (app as HTMLElement).style.transformOrigin = '0 0';
        }
      },
      state
    );

    // Apply scroll position
    await this.page.evaluate(
      (state) => {
        window.scrollTo({
          left: state.x,
          top: state.y,
          behavior: 'auto', // We handle smoothness ourselves
        });
      },
      state
    );
  }

  /**
   * Applies easing function to progress value.
   */
  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'cubic-bezier':
        // Approximate cubic-bezier with CSS
        return this.cubicBezier(t, 0.25, 0.1, 0.25, 1);
      default:
        return t;
    }
  }

  /**
   * Cubic bezier approximation.
   */
  private cubicBezier(t: number, p1: number, p2: number, p3: number, p4: number): number {
    // Simplified cubic bezier
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    return mt3 * 0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * 1;
  }

  /**
   * Stops any ongoing animation.
   */
  async stopAnimation(): Promise<void> {
    if (this.animationId !== null) {
      clearTimeout(this.animationId);
      this.animationId = null;
    }
    this.isAnimating = false;
  }

  // =============================================================================
  // HIGH-LEVEL CAMERA MOVES
  // =============================================================================

  /**
   * Dolly in (zoom in smoothly).
   */
  async dollyIn(duration = 1500, factor = 1.5): Promise<void> {
    await this.executeMove({
      type: 'dolly-in',
      duration,
      params: { factor },
    });
  }

  /**
   * Dolly out (zoom out smoothly).
   */
  async dollyOut(duration = 1500, factor = 1.5): Promise<void> {
    await this.executeMove({
      type: 'dolly-out',
      duration,
      params: { factor },
    });
  }

  /**
   * Pan horizontally across the page.
   */
  async pan(distance: number, duration = 2000): Promise<void> {
    await this.executeMove({
      type: 'pan',
      duration,
      params: { distance },
    });
  }

  /**
   * Tilt vertically across the page.
   */
  async tilt(distance: number, duration = 2000): Promise<void> {
    await this.executeMove({
      type: 'tilt',
      duration,
      params: { distance },
    });
  }

  /**
   * Close-up on a specific element.
   */
  async closeUp(selector: string, zoom = 3.0, padding = 100, duration = 1200): Promise<void> {
    const bbox = await this.getElementBBox(selector);
    if (!bbox) {
      throw new Error(`Element not found for close-up: ${selector}`);
    }

    // Center on element with padding
    const targetX = bbox.x - padding;
    const targetY = bbox.y - padding;

    await this.executeMove({
      type: 'close-up',
      duration,
      params: {
        x: targetX,
        y: targetY,
        zoom,
      },
    });
  }

  /**
   * Pull back to show full context.
   */
  async pullBack(duration = 1500): Promise<void> {
    await this.executeMove({
      type: 'pull-back',
      duration,
    });
  }

  /**
   * Track an element as it moves (for drag interactions).
   */
  async track(selector: string, duration = 2000): Promise<void> {
    const bbox = await this.getElementBBox(selector);
    if (!bbox) {
      throw new Error(`Element not found for tracking: ${selector}`);
    }

    await this.executeMove({
      type: 'track',
      duration,
      params: {
        x: bbox.x,
        y: bbox.y,
      },
    });
  }

  /**
   * Crane shot - combined zoom and pan.
   */
  async crane(options: {
    zoom: number;
    x: number;
    y: number;
    duration?: number;
  }): Promise<void> {
    await this.executeMove({
      type: 'crane',
      duration: options.duration || 2000,
      params: options,
    });
  }

  /**
   * Reset to initial state.
   */
  async reset(duration = 1000): Promise<void> {
    await this.executeMove({
      type: 'reset',
      duration,
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Gets bounding box of an element in page coordinates.
   */
  private async getElementBBox(selector: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = (el as HTMLElement).getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    }, selector);
  }

  /**
   * Scrolls an element into view smoothly.
   */
  async scrollToElement(selector: string, behavior: 'auto' | 'smooth' = 'smooth'): Promise<void> {
    await this.page.evaluate(
      (sel, behavior) => {
        const el = document.querySelector(sel);
        if (el) {
          (el as HTMLElement).scrollIntoView({ behavior, block: 'center', inline: 'center' });
        }
      },
      selector
    );
    await this.page.waitForTimeout(500);
  }

  /**
   * Gets current camera state.
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Gets move history for debugging/review.
   */
  getHistory(): CameraMove[] {
    return [...this.moveHistory];
  }

  /**
   * Disposes of resources.
   */
  async dispose(): Promise<void> {
    await this.stopAnimation();
    await this.reset(0);
  }
}

// =============================================================================
// CAMERA ANGLE PRESETS
// =============================================================================

export class CameraAnglePresets {
  /**
   * Standard wide shot showing full application.
   */
  static async wideShot(page: Page, duration = 2000): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await engine.reset(duration);
  }

  /**
   * Medium shot showing a specific section.
   */
  static async mediumShot(
    page: Page,
    selector: string,
    zoom = 1.5,
    duration = 1500
  ): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await engine.closeUp(selector, zoom, 200, duration);
  }

  /**
   * Close-up on a specific element.
   */
  static async closeUpShot(
    page: Page,
    selector: string,
    zoom = 3.0,
    duration = 1200
  ): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await engine.closeUp(selector, zoom, 50, duration);
  }

  /**
   * Extreme close-up for detailed feature showcase.
   */
  static async extremeCloseUp(page: Page, selector: string, duration = 1000): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await engine.closeUp(selector, 5.0, 20, duration);
  }

  /**
   * Bird's eye view - pull back to show entire page.
   */
  static async birdsEyeView(page: Page, duration = 2000): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await engine.pullBack(duration);
  }

  /**
   * Dutch angle - tilted perspective for dramatic effect.
   */
  static async dutchAngle(page: Page, degrees = 5, duration = 1000): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await page.evaluate((deg) => {
      const app = document.querySelector('#app') || document.body;
      if (app) {
        (app as HTMLElement).style.transform = `rotate(${deg}deg)`;
      }
    }, degrees);
    await page.waitForTimeout(duration);
  }

  /**
   * Tracking shot - follows an element as it moves.
   */
  static async trackingShot(page: Page, selector: string, duration = 3000): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();
    await engine.track(selector, duration);
  }

  /**
   * Reveal shot - starts zoomed in and pulls back to reveal context.
   */
  static async revealShot(page: Page, selector: string, duration = 2500): Promise<void> {
    const engine = new CameraMovementEngine(page);
    await engine.initialize();

    // Start close up
    await engine.closeUp(selector, 4.0, 0, duration / 2);
    // Pull back
    await engine.pullBack(duration / 2);
  }

  /**
   * Focus-with-blur - simulates shallow depth of field.
   */
  static async focusWithBlur(page: Page, selector: string, blurAmount = 4): Promise<void> {
    await page.evaluate(
      (sel, blur) => {
        const target = document.querySelector(sel);
        if (target) {
          (target as HTMLElement).style.filter = `blur(${blur}px)`;
          (target as HTMLElement).style.transition = 'filter 0.5s ease';
        }
      },
      selector
    );
  }

  /**
   * Split-screen recording - records two regions simultaneously.
   * Requires multiple browser contexts or pages.
   */
  static async splitScreen(
    contexts: [BrowserContext, BrowserContext],
    leftUrl: string,
    rightUrl: string,
    duration = 5000
  ): Promise<void> {
    const [leftCtx, rightCtx] = contexts;

    // Navigate both
    const leftPage = await leftCtx.newPage();
    const rightPage = await rightCtx.newPage();

    await leftPage.goto(leftUrl);
    await rightPage.goto(rightUrl);

    // Resize for side-by-side
    const halfWidth = 1920;
    const height = 1080;
    await leftPage.setViewportSize({ width: halfWidth, height });
    await rightPage.setViewportSize({ width: halfWidth, height });

    // Record both
    await leftPage.screenshot({ path: 'split-left.png' });
    await rightPage.screenshot({ path: 'split-right.png' });

    await leftPage.close();
    await rightPage.close();
  }

  /**
   * Picture-in-picture - small overlay of secondary view.
   */
  static async pictureInPicture(
    mainPage: Page,
    overlayPage: Page,
    overlaySize = { width: 480, height: 270 },
    position = { x: 1520, y: 20 }
  ): Promise<void> {
    // This would be implemented with CSS overlay injection
    // or actual PiP API if supported
    await mainPage.evaluate(
      (size, pos) => {
        const overlay = document.createElement('div');
        overlay.id = 'pip-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: ${pos.y}px;
          left: ${pos.x}px;
          width: ${size.width}px;
          height: ${size.height}px;
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          overflow: hidden;
          z-index: 99999;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(overlay);
      },
      overlaySize,
      position
    );
  }
}

// =============================================================================
// SCENE DIRECTOR
// =============================================================================

export interface Scene {
  id: string;
  name: string;
  duration: number;
  camera: 'wide' | 'medium' | 'close-up' | 'extreme-close-up' | 'dutch' | 'reveal' | 'track';
  cameraDuration?: number;
  selector?: string; // For close-ups
  action?: string; // Action to perform
  overlays?: string[];
  transitions?: {
    in: 'cut' | 'fade' | 'dissolve' | 'zoom';
    out: 'cut' | 'fade' | 'dissolve' | 'zoom';
  };
  onEnter?: () => Promise<void>;
  onExit?: () => Promise<void>;
}

export class SceneDirector {
  private page: Page;
  private camera: CameraMovementEngine;
  private scenes: Scene[] = [];
  private currentSceneIndex = 0;

  constructor(page: Page) {
    this.page = page;
    this.camera = new CameraMovementEngine(page);
  }

  /**
   * Adds a scene to the storyboard.
   */
  addScene(scene: Scene): this {
    this.scenes.push(scene);
    return this;
  }

  /**
   * Loads a storyboard from JSON configuration.
   */
  loadStoryboard(storyboard: { scenes: Scene[] }): this {
    this.scenes = storyboard.scenes;
    return this;
  }

  /**
   * Executes the complete storyboard.
   */
  async shoot(): Promise<void> {
    await this.camera.initialize();
    console.log(`[Director] Starting shoot with ${this.scenes.length} scenes`);

    for (let i = 0; i < this.scenes.length; i++) {
      const scene = this.scenes[i];
      this.currentSceneIndex = i;
      console.log(`[Director] Scene ${i + 1}/${this.scenes.length}: ${scene.name}`);

      await this.shootScene(scene);

      // Brief pause between scenes
      if (i < this.scenes.length - 1) {
        await this.page.waitForTimeout(500);
      }
    }

    console.log('[Director] Shoot complete');
  }

  /**
   * Shoots a single scene.
   */
  private async shootScene(scene: Scene): Promise<void> {
    // Execute onEnter callback
    if (scene.onEnter) {
      await scene.onEnter();
    }

    // Execute camera move
    const cameraDuration = scene.cameraDuration || 1500;
    await this.executeCameraMove(scene.camera, scene.selector, cameraDuration);

    // Execute main action
    if (scene.action) {
      await this.executeAction(scene.action);
    }

    // Wait for scene duration
    await this.page.waitForTimeout(scene.duration);

    // Execute onExit callback
    if (scene.onExit) {
      await scene.onExit();
    }
  }

  /**
   * Executes camera move for a scene.
   */
  private async executeCameraMove(
    cameraType: Scene['camera'],
    selector: string | undefined,
    duration: number
  ): Promise<void> {
    switch (cameraType) {
      case 'wide':
        await CameraAnglePresets.wideShot(this.page, duration);
        break;
      case 'medium':
        if (selector) {
          await CameraAnglePresets.mediumShot(this.page, selector, 1.5, duration);
        }
        break;
      case 'close-up':
        if (selector) {
          await CameraAnglePresets.closeUpShot(this.page, selector, 3.0, duration);
        }
        break;
      case 'extreme-close-up':
        if (selector) {
          await CameraAnglePresets.extremeCloseUp(this.page, selector, duration);
        }
        break;
      case 'dutch':
        await CameraAnglePresets.dutchAngle(this.page, 5, duration);
        break;
      case 'reveal':
        if (selector) {
          await CameraAnglePresets.revealShot(this.page, selector, duration);
        }
        break;
      case 'track':
        if (selector) {
          await CameraAnglePresets.trackingShot(this.page, selector, duration);
        }
        break;
    }
  }

  /**
   * Executes a scene action.
   */
  private async executeAction(action: string): Promise<void> {
    // Action execution logic
    // Could be extended to support custom action handlers
    console.log(`[Director] Action: ${action}`);
  }

  /**
   * Gets current scene index.
   */
  getCurrentSceneIndex(): number {
    return this.currentSceneIndex;
  }

  /**
   * Jumps to a specific scene.
   */
  async goToScene(index: number): Promise<void> {
    if (index >= 0 && index < this.scenes.length) {
      this.currentSceneIndex = index;
      await this.shootScene(this.scenes[index]);
    }
  }

  /**
   * Disposes resources.
   */
  async dispose(): Promise<void> {
    await this.camera.dispose();
  }
}

// =============================================================================
// MULTI-ANGLE RECORDER
// =============================================================================

export interface AngleRecording {
  name: string;
  page: Page;
  context: BrowserContext;
  viewport: { width: number; height: number };
}

export class MultiAngleRecorder {
  private page: Page;
  private angles: Map<string, AngleRecording> = new Map();
  private primaryPage: Page;

  constructor(page: Page) {
    this.page = page;
    this.primaryPage = page;
  }

  /**
   * Adds a camera angle (secondary viewport).
   */
  async addAngle(
    name: string,
    url: string,
    viewport: { width: number; height: number }
  ): Promise<AngleRecording> {
    const context = await this.page.context().browser()!.newContext({
      viewport,
    });

    const newPage = await context.newPage();
    await newPage.goto(url);

    const recording: AngleRecording = {
      name,
      page: newPage,
      context,
      viewport,
    };

    this.angles.set(name, recording);
    return recording;
  }

  /**
   * Records all angles simultaneously.
   */
  async recordAllAngles(duration = 5000): Promise<Map<string, string>> {
    const recordings = new Map<string, string>();

    // Start video recording on all pages
    const videoPaths = new Map<string, string>();
    for (const [name, angle] of this.angles.entries()) {
      const videoPath = `test-results/videos/angle-${name}-${Date.now()}.webm`;
      await angle.page.context().setOptions({
        recordVideo: {
          dir: `test-results/videos/angle-${name}`,
          size: angle.viewport,
        },
      });
      videoPaths.set(name, videoPath);
    }

    // Wait for duration
    await this.page.waitForTimeout(duration);

    // Collect video paths
    for (const [name, angle] of this.angles.entries()) {
      recordings.set(name, videoPaths.get(name)!);
    }

    return recordings;
  }

  /**
   * Creates composite video with all angles.
   */
  async createCompositeVideo(
    layout: 'grid' | 'horizontal' | 'vertical' | 'picture-in-picture',
    outputPath: string
  ): Promise<void> {
    // This would use FFmpeg to composite all angle recordings
    // Implementation depends on FFmpeg availability
    console.log(`[MultiAngle] Creating composite: ${layout} → ${outputPath}`);
  }

  /**
   * Closes all angle contexts.
   */
  async dispose(): Promise<void> {
    for (const angle of this.angles.values()) {
      await angle.context.close();
    }
    this.angles.clear();
  }
}

// =============================================================================
// CAMERA CHOREOGRAPHY
// =============================================================================

export class CameraChoreography {
  private page: Page;
  private camera: CameraMovementEngine;

  constructor(page: Page) {
    this.page = page;
    this.camera = new CameraMovementEngine(page);
  }

  /**
   * Creates a dolly zoom (vertigo) effect - zoom in while pulling back.
   */
  async dollyZoom(zoom: number, duration = 2000): Promise<void> {
    await this.camera.initialize();

    const startZoom = 1.0;
    const startY = 0;

    await this.page.evaluate((state) => {
      const app = document.querySelector('#app') || document.body;
      if (app) {
        (app as HTMLElement).style.transformOrigin = 'center center';
      }
    }, {});

    // Animate zoom in and scroll simultaneously
    await this.camera.executeMove({
      type: 'custom',
      duration,
      handler: async (page) => {
        const startTime = Date.now();
        const startState = { zoom: startZoom, y: startY };

        return new Promise((resolve) => {
          const tick = async () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(elapsed / duration, 1.0);
            const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            const currentZoom = startZoom + (zoom - startZoom) * eased;
            const currentY = startY + (100 * eased); // Pull back slightly

            await page.evaluate(
              (state) => {
                const app = document.querySelector('#app') || document.body;
                if (app) {
                  (app as HTMLElement).style.transform = `scale(${state.zoom})`;
                  window.scrollTo({ left: 0, top: state.y });
                }
              },
              { zoom: currentZoom, y: currentY }
            );

            if (t < 1.0) {
              requestAnimationFrame(tick);
            } else {
              resolve();
            }
          };

          requestAnimationFrame(tick);
        });
      },
    });
  }

  /**
   * Creates a rack focus effect - blur one element, focus another.
   */
  async rackFocus(
    fromSelector: string,
    toSelector: string,
    duration = 1500
  ): Promise<void> {
    await this.page.evaluate(
      (from, to) => {
        const fromEl = document.querySelector(from);
        const toEl = document.querySelector(to);

        if (fromEl) {
          (fromEl as HTMLElement).style.filter = 'blur(0px)';
          (fromEl as HTMLElement).style.transition = `filter ${duration}ms ease`;
        }
        if (toEl) {
          (toEl as HTMLElement).style.filter = `blur(8px)`;
          (toEl as HTMLElement).style.transition = `filter ${duration}ms ease`;
        }
      },
      fromSelector,
      toSelector
    );

    await this.page.waitForTimeout(duration);
  }

  /**
   * Creates a whip pan - fast pan with motion blur.
   */
  async whipPan(direction: 'left' | 'right', distance = 500, duration = 300): Promise<void> {
    await this.page.evaluate((dir, dist) => {
      const app = document.querySelector('#app') || document.body;
      if (app) {
        (app as HTMLElement).style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        (app as HTMLElement).style.filter = 'blur(4px)';
        (app as HTMLElement).style.transform = `translateX(${dir === 'right' ? -dist : dist}px)`;
      }
    }, direction, distance);

    await this.page.waitForTimeout(duration);

    // Remove blur
    await this.page.evaluate(() => {
      const app = document.querySelector('#app') || document.body;
      if (app) {
        (app as HTMLElement).style.filter = 'blur(0px)';
        (app as HTMLElement).style.transform = 'translateX(0)';
      }
    });
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default CameraMovementEngine;
