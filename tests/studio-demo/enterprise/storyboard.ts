/**
 * Storyboard & Narrative Engine
 *
 * Professional demo storytelling through scene scripting:
 * - Sequential scene management
 * - Camera direction and movement
 * - Timing and pacing control
 * - Narration and overlay synchronization
 * - Export to multiple formats
 */

import { type Page } from '@playwright/test';
import { CameraMovementEngine, type Scene, type CameraMove } from './camera-movement-engine';

// =============================================================================
// STORYBOARD CONFIGURATION
// =============================================================================

export interface StoryboardConfig {
  title: string;
  description?: string;
  duration: number; // Total duration in seconds
  scenes: SceneConfig[];
  postProduction?: {
    colorGrade?: string;
    music?: string;
    voiceover?: string;
    lowerThirds?: boolean;
    intro?: string;
    outro?: string;
  };
}

export interface SceneConfig {
  id: string;
  name: string;
  duration: number; // seconds
  description?: string;
  camera: CameraDirection;
  actions: SceneAction[];
  overlays?: OverlayConfig[];
  audio?: {
    music?: string;
    voiceover?: string;
    sfx?: string[];
  };
  onEnter?: () => Promise<void>;
  onExit?: () => Promise<void>;
}

export type CameraDirection =
  | 'wide'
  | 'medium'
  | 'close-up'
  | 'extreme-close-up'
  | 'dutch'
  | 'reveal'
  | 'track'
  | 'crane'
  | 'dolly-in'
  | 'dolly-out'
  | 'pan-left'
  | 'pan-right'
  | 'tilt-up'
  | 'tilt-down';

export interface SceneAction {
  type: 'click' | 'fill' | 'scroll' | 'wait' | 'hover' | 'press' | 'evaluate';
  selector?: string;
  value?: string;
  duration?: number;
  delay?: number; // Wait before action
  description?: string;
}

export interface OverlayConfig {
  type: 'text' | 'image' | 'progress' | 'parameter';
  content: string;
  position: { x: number; y: number };
  duration?: { start: number; end: number };
  style?: Record<string, any>;
}

// =============================================================================
// STORYBOARD ENGINE
// =============================================================================

export class StoryboardEngine {
  private page: Page;
  private camera: CameraMovementEngine;
  private storyboard: StoryboardConfig | null = null;
  private currentSceneIndex = 0;
  private isPlaying = false;

  constructor(page: Page) {
    this.page = page;
    this.camera = new CameraMovementEngine(page);
  }

  /**
   * Loads a storyboard from configuration.
   */
  loadStoryboard(config: StoryboardConfig): this {
    this.storyboard = config;
    console.log(`[Storyboard] Loaded: "${config.title}" (${config.scenes.length} scenes)`);
    return this;
  }

  /**
   * Loads storyboard from JSON file.
   */
  async loadFromFile(filePath: string): Promise<this> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as StoryboardConfig;
    return this.loadStoryboard(config);
  }

  /**
   * Plays the entire storyboard.
   */
  async play(): Promise<void> {
    if (!this.storyboard) {
      throw new Error('No storyboard loaded');
    }

    console.log(`[Storyboard] Playing: ${this.storyboard.title}`);
    this.isPlaying = true;
    await this.camera.initialize();

    // Play intro if configured
    if (this.storyboard.postProduction?.intro) {
      await this.playIntro();
    }

    // Play each scene
    for (let i = 0; i < this.storyboard.scenes.length; i++) {
      if (!this.isPlaying) break;
      
      this.currentSceneIndex = i;
      const scene = this.storyboard.scenes[i];
      
      console.log(`[Storyboard] Scene ${i + 1}/${this.storyboard.scenes.length}: ${scene.name}`);
      await this.playScene(scene);
    }

    // Play outro if configured
    if (this.storyboard.postProduction?.outro && this.isPlaying) {
      await this.playOutro();
    }

    this.isPlaying = false;
    console.log('[Storyboard] Playback complete');
  }

  /**
   * Plays a single scene.
   */
  private async playScene(scene: SceneConfig): Promise<void> {
    // Execute onEnter callback
    if (scene.onEnter) {
      await scene.onEnter();
    }

    // Execute camera movement
    await this.executeCameraDirection(scene.camera);

    // Execute actions
    for (const action of scene.actions) {
      if (!this.isPlaying) break;

      // Wait for action delay
      if (action.delay) {
        await this.page.waitForTimeout(action.delay);
      }

      await this.executeAction(action);

      // Wait for action duration
      if (action.duration) {
        await this.page.waitForTimeout(action.duration);
      }
    }

    // Show overlays
    if (scene.overlays) {
      await this.showOverlays(scene.overlays);
    }

    // Wait for scene duration
    await this.page.waitForTimeout(scene.duration);

    // Hide overlays
    if (scene.overlays) {
      await this.hideOverlays(scene.overlays);
    }

    // Execute onExit callback
    if (scene.onExit) {
      await scene.onExit();
    }
  }

  /**
   * Executes camera direction.
   */
  private async executeCameraDirection(direction: CameraDirection): Promise<void> {
    const moveMap: Record<CameraDirection, () => Promise<void>> = {
      'wide': async () => await this.camera.reset(1500),
      'medium': async () => await this.camera.dollyIn(1200, 1.5),
      'close-up': async () => await this.camera.dollyIn(1000, 2.5),
      'extreme-close-up': async () => await this.camera.dollyIn(800, 4.0),
      'dutch': async () => await this.camera.executeMove({
        type: 'custom',
        duration: 1000,
        handler: async (page) => {
          await page.evaluate(() => {
            const app = document.querySelector('#app') || document.body;
            if (app) {
              (app as HTMLElement).style.transform = 'rotate(3deg)';
            }
          });
        }
      }),
      'reveal': async () => await this.camera.dollyOut(2000),
      'track': async () => {}, // Requires element selector
      'crane': async () => await this.camera.crane({ zoom: 2.0, x: 100, y: 100, duration: 2000 }),
      'dolly-in': async () => await this.camera.dollyIn(1500),
      'dolly-out': async () => await this.camera.dollyOut(1500),
      'pan-left': async () => await this.camera.pan(-400, 1500),
      'pan-right': async () => await this.camera.pan(400, 1500),
      'tilt-up': async () => await this.camera.tilt(-400, 1500),
      'tilt-down': async () => await this.camera.tilt(400, 1500),
    };

    await moveMap[direction]();
  }

  /**
   * Executes a scene action.
   */
  private async executeAction(action: SceneAction): Promise<void> {
    console.log(`[Storyboard] Action: ${action.type}${action.selector ? ` on ${action.selector}` : ''}`);

    switch (action.type) {
      case 'click':
        if (action.selector) {
          await this.page.click(action.selector);
        }
        break;
      
      case 'fill':
        if (action.selector && action.value) {
          await this.page.fill(action.selector, action.value);
        }
        break;
      
      case 'scroll':
        await this.page.evaluate((direction) => {
          window.scrollBy({
            top: direction === 'down' ? 300 : -300,
            behavior: 'smooth'
          });
        }, action.value || 'down');
        break;
      
      case 'wait':
        await this.page.waitForTimeout(action.duration || 1000);
        break;
      
      case 'hover':
        if (action.selector) {
          await this.page.hover(action.selector);
        }
        break;
      
      case 'press':
        if (action.value) {
          await this.page.keyboard.press(action.value);
        }
        break;
      
      case 'evaluate':
        if (action.value) {
          await this.page.evaluate(action.value);
        }
        break;
    }
  }

  /**
   * Shows overlays on the page.
   */
  private async showOverlays(overlays: OverlayConfig[]): Promise<void> {
    for (const overlay of overlays) {
      await this.page.evaluate((config) => {
        const el = document.createElement('div');
        el.id = `overlay-${Date.now()}`;
        el.style.cssText = `
          position: fixed;
          left: ${config.position.x}px;
          top: ${config.position.y}px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          font-family: system-ui;
          font-size: 14px;
          z-index: 999999;
          pointer-events: none;
        `;
        el.textContent = config.content;
        document.body.appendChild(el);
      }, overlay);
    }
  }

  /**
   * Hides overlays.
   */
  private async hideOverlays(overlays: OverlayConfig[]): Promise<void> {
    await this.page.evaluate(() => {
      document.querySelectorAll('[id^="overlay-"]').forEach(el => el.remove());
    });
  }

  /**
   * Plays intro sequence.
   */
  private async playIntro(): Promise<void> {
    // Fade in from black
    await this.page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.id = 'intro-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: black;
        z-index: 999999;
        transition: opacity 1s ease;
      `;
      document.body.appendChild(overlay);
    });

    await this.page.waitForTimeout(500);

    await this.page.evaluate(() => {
      const overlay = document.getElementById('intro-overlay') as HTMLElement;
      if (overlay) {
        overlay.style.opacity = '0';
      }
    });

    await this.page.waitForTimeout(1000);

    await this.page.evaluate(() => {
      const overlay = document.getElementById('intro-overlay');
      if (overlay) overlay.remove();
    });
  }

  /**
   * Plays outro sequence.
   */
  private async playOutro(): Promise<void> {
    // Fade to black
    await this.page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.id = 'outro-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: black;
        z-index: 999999;
        opacity: 0;
        transition: opacity 1s ease;
      `;
      document.body.appendChild(overlay);
    });

    await this.page.waitForTimeout(500);

    await this.page.evaluate(() => {
      const overlay = document.getElementById('outro-overlay') as HTMLElement;
      if (overlay) {
        overlay.style.opacity = '1';
      }
    });

    await this.page.waitForTimeout(1500);
  }

  /**
   * Stops playback.
   */
  stop(): void {
    this.isPlaying = false;
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
    if (this.storyboard && index >= 0 && index < this.storyboard.scenes.length) {
      this.currentSceneIndex = index;
      await this.playScene(this.storyboard.scenes[index]);
    }
  }

  /**
   * Exports storyboard to JSON.
   */
  exportToJson(outputPath: string): void {
    if (!this.storyboard) {
      throw new Error('No storyboard loaded');
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(this.storyboard, null, 2));
    console.log(`[Storyboard] Exported to: ${outputPath}`);
  }

  /**
   * Creates a demo storyboard from a simple list of features.
   */
  static createDemoStoryboard(
    title: string,
    features: Array<{ name: string; selector?: string; description?: string }>
  ): StoryboardConfig {
    const scenes: SceneConfig[] = features.map((feature, index) => ({
      id: `scene-${index + 1}`,
      name: feature.name,
      duration: 3.0,
      description: feature.description,
      camera: 'medium',
      actions: feature.selector ? [
        { type: 'click', selector: feature.selector }
      ] : [],
      overlays: feature.description ? [
        {
          type: 'text',
          content: feature.description,
          position: { x: 50, y: 50 }
        }
      ] : undefined,
    }));

    return {
      title,
      scenes,
      duration: scenes.length * 3.0,
      postProduction: {
        lowerThirds: true,
      }
    };
  }
}

// =============================================================================
// NARRATION ENGINE
// =============================================================================

export interface NarrationScript {
  scenes: Array<{
    sceneId: string;
    text: string;
    startTime: number;
    duration: number;
    voice?: 'male' | 'female' | 'neutral';
    speed?: number; // 0.5 - 2.0
  }>;
}

export class NarrationEngine {
  private page: Page;
  private script: NarrationScript | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Loads narration script from JSON.
   */
  loadScript(script: NarrationScript): this {
    this.script = script;
    return this;
  }

  /**
   * Plays narration for current scene.
   */
  async playSceneNarration(sceneId: string): Promise<void> {
    if (!this.script) return;

    const narration = this.script.scenes.find(s => s.sceneId === sceneId);
    if (!narration) return;

    // Display narration text as subtitle
    await this.page.evaluate((text) => {
      const subtitle = document.createElement('div');
      subtitle.id = 'narration-subtitle';
      subtitle.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 18px;
        z-index: 999999;
        text-align: center;
        max-width: 80%;
      `;
      subtitle.textContent = text;
      document.body.appendChild(subtitle);
    }, narration.text);

    // Wait for narration duration
    await this.page.waitForTimeout(narration.duration * 1000);

    // Remove subtitle
    await this.page.evaluate(() => {
      const subtitle = document.getElementById('narration-subtitle');
      if (subtitle) subtitle.remove();
    });
  }

  /**
   * Generates a narration script from storyboard.
   */
  static generateScript(storyboard: StoryboardConfig): NarrationScript {
    return {
      scenes: storyboard.scenes.map(scene => ({
        sceneId: scene.id,
        text: scene.description || scene.name,
        startTime: 0, // Would be calculated based on scene timing
        duration: scene.duration,
        voice: 'neutral',
        speed: 1.0,
      }))
    };
  }
}

// =============================================================================
// DEMO TEMPLATES
// =============================================================================

export class DemoTemplates {
  /**
   * Creates a standard product demo storyboard.
   */
  static productDemo(title: string, features: string[]): StoryboardConfig {
    return StoryboardEngine.createDemoStoryboard(title, features.map(f => ({ name: f })));
  }

  /**
   * Creates an AI image generation demo.
   */
  static aiImageGenerationDemo(): StoryboardConfig {
    return {
      title: 'AI Image Generation Demo',
      scenes: [
        {
          id: 'intro',
          name: 'Introduction',
          duration: 3.0,
          camera: 'wide',
          actions: [],
          overlays: [
            { type: 'text', content: 'AI Image Generation', position: { x: 50, y: 50 } }
          ]
        },
        {
          id: 'prompt',
          name: 'Enter Prompt',
          duration: 4.0,
          camera: 'medium',
          actions: [
            { type: 'click', selector: '#prompt-input' },
            { type: 'fill', selector: '#prompt-input', value: 'A serene mountain landscape at sunset' }
          ]
        },
        {
          id: 'generate',
          name: 'Generate Image',
          duration: 8.0,
          camera: 'close-up',
          actions: [
            { type: 'click', selector: '#generate-btn' }
          ],
          overlays: [
            { type: 'progress', content: 'Generating...', position: { x: 50, y: 50 } }
          ]
        },
        {
          id: 'result',
          name: 'View Result',
          duration: 5.0,
          camera: 'extreme-close-up',
          actions: [
            { type: 'wait', duration: 2000 }
          ]
        },
        {
          id: 'outro',
          name: 'Outro',
          duration: 3.0,
          camera: 'wide',
          actions: []
        }
      ],
      postProduction: {
        lowerThirds: true,
        music: 'assets/audio/ambient.mp3'
      }
    };
  }

  /**
   * Creates an AI video generation demo.
   */
  static aiVideoGenerationDemo(): StoryboardConfig {
    return {
      title: 'AI Video Generation Demo',
      scenes: [
        {
          id: 'intro',
          name: 'Introduction',
          duration: 3.0,
          camera: 'wide',
          actions: []
        },
        {
          id: 'prompt',
          name: 'Enter Prompt',
          duration: 4.0,
          camera: 'medium',
          actions: [
            { type: 'click', selector: '#prompt-input' },
            { type: 'fill', selector: '#prompt-input', value: 'A cinematic drone shot of a city at night' }
          ]
        },
        {
          id: 'settings',
          name: 'Configure Settings',
          duration: 3.0,
          camera: 'medium',
          actions: [
            { type: 'click', selector: '#duration-select' },
            { type: 'select', selector: '#duration-select', value: '10s' }
          ]
        },
        {
          id: 'generate',
          name: 'Generate Video',
          duration: 15.0,
          camera: 'close-up',
          actions: [
            { type: 'click', selector: '#generate-btn' }
          ],
          overlays: [
            { type: 'progress', content: 'Generating video...', position: { x: 50, y: 50 } }
          ]
        },
        {
          id: 'result',
          name: 'View Result',
          duration: 8.0,
          camera: 'extreme-close-up',
          actions: [
            { type: 'wait', duration: 3000 }
          ]
        },
        {
          id: 'outro',
          name: 'Outro',
          duration: 3.0,
          camera: 'wide',
          actions: []
        }
      ]
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default StoryboardEngine;
