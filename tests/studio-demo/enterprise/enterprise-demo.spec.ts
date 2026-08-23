/**
 * Enterprise Demo Example: AI Image Generation Studio
 *
 * This example demonstrates how to use the enterprise enhancement layer
 * to create a million-dollar quality demo video for an AI image generation application.
 *
 * Usage:
 *   npx playwright test enterprise-demo.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  CinematicRecorder,
  CameraMovementEngine,
  CameraAnglePresets,
  CameraChoreography,
  SceneDirector,
  StoryboardEngine,
  DemoTemplates,
  AIInteractionEngine,
  PostProductionPipeline,
  PresetPipelines,
  type RecordingConfig,
  type Scene,
} from './enterprise';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEMO_CONFIG = {
  // Studio URLs to test
  studios: [
    {
      id: 'ai-studio',
      name: 'AI Image Studio',
      url: 'https://your-ai-app.com/studio',
      features: ['text-to-image', 'image-editing', 'style-transfer']
    }
  ],
  
  // Recording settings
  recording: {
    resolution: { width: 3840, height: 2160 }, // 4K
    frameRate: 60,
    codec: 'h265' as const,
    preset: 'slow' as const,
    crf: 18,
  },
  
  // Demo timing
  sceneDuration: 3000, // ms per scene
};

// =============================================================================
// TEST SUITE
// =============================================================================

test.describe('Enterprise AI Studio Demo', () => {
  let recorder: CinematicRecorder;
  let camera: CameraMovementEngine;
  let director: SceneDirector;
  let aiEngine: AIInteractionEngine;
  let pipeline: PostProductionPipeline;

  test.beforeEach(async ({ page }) => {
    // Initialize components
    recorder = new CinematicRecorder(page, DEMO_CONFIG.recording);
    camera = new CameraMovementEngine(page);
    director = new SceneDirector(page);
    aiEngine = new AIInteractionEngine(page);
    pipeline = PresetPipelines.createYouTubePipeline();
  });

  test.afterEach(async () => {
    await recorder.dispose();
    await director.dispose();
  });

  // ===========================================================================
  // EXAMPLE 1: BASIC CAMERA MOVEMENTS
  // ===========================================================================

  test('demonstrates basic camera movements', async ({ page }) => {
    await page.goto(DEMO_CONFIG.studios[0].url);
    await page.waitForLoadState('networkidle');

    // Start recording
    const session = await recorder.startSession('camera-movements');
    
    // Wide establishing shot
    console.log('[Demo] Starting wide shot...');
    await CameraAnglePresets.wideShot(page, 2000);
    
    // Dolly in to medium shot
    console.log('[Demo] Dolly in to medium shot...');
    await camera.dollyIn(1500);
    
    // Pan across the interface
    console.log('[Demo] Panning right...');
    await camera.pan(400, 1500);
    
    // Close-up on a specific element
    console.log('[Demo] Close-up on generation panel...');
    await camera.closeUp('[data-testid="generation-panel"]', 3.0, 100, 1200);
    
    // Pull back to show context
    console.log('[Demo] Pulling back...');
    await camera.pullBack(1500);
    
    // Stop recording
    const videoPath = await recorder.stopSession(session);
    console.log(`[Demo] Video saved: ${videoPath}`);
  });

  // ===========================================================================
  // EXAMPLE 2: AI INTERACTION WITH DETERMINISTIC OUTPUT
  // ===========================================================================

  test('demonstrates AI generation with camera choreography', async ({ page }) => {
    await page.goto(DEMO_CONFIG.studios[0].url);
    await page.waitForLoadState('networkidle');

    const session = await recorder.startSession('ai-generation');

    // Start with wide shot
    await CameraAnglePresets.wideShot(page, 1500);

    // Move to prompt input area
    await camera.closeUp('[data-testid="prompt-input"]', 2.0, 200, 1000);

    // Type a deterministic prompt
    const prompt = 'A majestic lion in the style of Van Gogh';
    await aiEngine.setPrompt(prompt);
    
    // Show prompt overlay
    await page.evaluate((text) => {
      const overlay = document.createElement('div');
      overlay.id = 'prompt-overlay';
      overlay.style.cssText = `
        position: fixed;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 16px 32px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 18px;
        z-index: 999999;
      `;
      overlay.textContent = `"${text}"`;
      document.body.appendChild(overlay);
    }, prompt);

    // Zoom in on generate button
    await camera.closeUp('[data-testid="generate-btn"]', 3.0, 50, 800);
    
    // Generate with deterministic seed
    console.log('[Demo] Generating with seed: 12345');
    await aiEngine.setSeed(12345);
    await aiEngine.setSteps(30);
    await aiEngine.setSampler('DPM++ 2M Karras');
    
    // Click generate
    await page.click('[data-testid="generate-btn"]');

    // Track generation progress
    await camera.track('[data-testid="generation-panel"]', 10000);

    // Wait for result
    await page.waitForSelector('.generated-image', { timeout: 120000 });

    // Reveal shot - pull back to show full result
    await CameraAnglePresets.revealShot(page, '.generated-image', 2500);

    // Clean up overlay
    await page.evaluate(() => {
      const overlay = document.getElementById('prompt-overlay');
      if (overlay) overlay.remove();
    });

    const videoPath = await recorder.stopSession(session);
    console.log(`[Demo] AI generation video: ${videoPath}`);
  });

  // ===========================================================================
  // EXAMPLE 3: CINEMATIC CHOREOGRAPHY
  // ===========================================================================

  test('demonstrates advanced camera choreography', async ({ page }) => {
    await page.goto(DEMO_CONFIG.studios[0].url);
    await page.waitForLoadState('networkidle');

    const choreography = new CameraChoreography(page);
    const session = await recorder.startSession('choreography');

    // Dolly zoom (vertigo) effect
    console.log('[Demo] Dolly zoom effect...');
    await choreography.dollyZoom(2.0, 2000);

    await page.waitForTimeout(1000);

    // Rack focus between two elements
    console.log('[Demo] Rack focus...');
    await choreography.rackFocus('#sidebar', '#main-content', 1500);

    await page.waitForTimeout(1000);

    // Whip pan
    console.log('[Demo] Whip pan...');
    await choreography.whipPan('right', 600, 300);

    await page.waitForTimeout(1000);

    const videoPath = await recorder.stopSession(session);
    console.log(`[Demo] Choreography video: ${videoPath}`);
  });

  // ===========================================================================
  // EXAMPLE 4: MULTI-ANGLE RECORDING
  // ===========================================================================

  test('demonstrates multi-angle recording', async ({ page }) => {
    await page.goto(DEMO_CONFIG.studios[0].url);
    await page.waitForLoadState('networkidle');

    const multiAngle = new (await import('./enterprise/multi-angle-recorder')).MultiAngleRecorder(page);

    // Add secondary angle (e.g., result preview)
    await multiAngle.addAngle('preview', DEMO_CONFIG.studios[0].url, {
      width: 480,
      height: 270
    });

    // Record all angles
    const recordings = await multiAngle.recordAllAngles(10000);
    
    console.log('[Demo] Recorded angles:', recordings);
    
    // Create composite video
    await multiAngle.createCompositeVideo('picture-in-picture', 'test-results/composite.mp4');
    
    await multiAngle.dispose();
  });

  // ===========================================================================
  // EXAMPLE 5: FULL STORYBOARD EXECUTION
  // ===========================================================================

  test('demonstrates complete storyboard execution', async ({ page }) => {
    await page.goto(DEMO_CONFIG.studios[0].url);
    await page.waitForLoadState('networkidle');

    // Create storyboard from template
    const storyboardConfig = DemoTemplates.aiImageGenerationDemo();
    
    // Customize for our app
    storyboardConfig.scenes.forEach(scene => {
      scene.actions = scene.actions.map(action => ({
        ...action,
        selector: action.selector?.replace('#prompt-input', '[data-testid="prompt-input"]')
      }));
    });

    // Load and play storyboard
    const storyboard = new StoryboardEngine(page);
    storyboard.loadStoryboard(storyboardConfig);

    const session = await recorder.startSession('storyboard');
    await storyboard.play();
    const videoPath = await recorder.stopSession(session);

    console.log(`[Demo] Storyboard video: ${videoPath}`);
  });

  // ===========================================================================
  // EXAMPLE 6: POST-PRODUCTION PIPELINE
  // ===========================================================================

  test('demonstrates post-production pipeline', async ({ page }) => {
    // This would typically run after recording is complete
    const inputVideo = 'test-results/cinematic/raw/video.webm';
    
    // Create pipeline
    const pipeline = PresetPipelines.createYouTubePipeline();
    
    // Add tracks
    pipeline.addVideoTrack(inputVideo);
    
    // Add audio
    // pipeline.addAudioTrack('assets/audio/narration.mp3', 0, 0.8);
    // pipeline.addAudioTrack('assets/audio/music.mp3', 0, 0.2, true); // duck
    
    // Add lower thirds
    pipeline.addTextOverlay({
      text: 'AI Image Generation',
      start: 0,
      duration: 5,
      position: { x: 50, y: 50 },
      style: {
        fontFamily: 'Inter-Bold',
        fontSize: 48,
        color: '#FFFFFF'
      }
    });
    
    // Render final video
    const finalOutput = await pipeline.render('test-results/final/demo-final.mp4');
    console.log(`[Demo] Final video: ${finalOutput}`);
  });

  // ===========================================================================
  // EXAMPLE 7: BATCH PROCESSING MULTIPLE STUDIOS
  // ===========================================================================

  test('demonstrates batch processing', async ({ page }) => {
    const results = [];

    for (const studio of DEMO_CONFIG.studios) {
      await page.goto(studio.url);
      await page.waitForLoadState('networkidle');

      const session = await recorder.startSession(studio.id);
      
      // Run demo sequence for this studio
      await CameraAnglePresets.wideShot(page, 2000);
      
      // Feature 1
      await camera.closeUp('[data-testid="feature-1"]', 2.5, 100, 1200);
      await page.waitForTimeout(2000);
      
      // Feature 2
      await camera.dollyOut(1000);
      await camera.closeUp('[data-testid="feature-2"]', 2.5, 100, 1200);
      await page.waitForTimeout(2000);
      
      // Feature 3
      await camera.pullBack(1500);
      
      const videoPath = await recorder.stopSession(session);
      
      results.push({
        studio: studio.name,
        videoPath,
        passed: true
      });
    }

    console.log('[Demo] Batch results:', results);
  });
});

// =============================================================================
// HELPER: QUICK DEMO SETUP
// =============================================================================

/**
 * Quick setup function for running a demo with minimal configuration.
 */
export async function runQuickDemo(page: Page, config: {
  url: string;
  title: string;
  features: Array<{ name: string; selector?: string }>;
  outputDir?: string;
}) => {
  // Navigate to app
  await page.goto(config.url);
  await page.waitForLoadState('networkidle');

  // Set up recorder
  const recorder = new CinematicRecorder(page, {}, config.outputDir);
  const session = await recorder.startSession(config.title);

  // Create simple storyboard
  const storyboard = StoryboardEngine.createDemoStoryboard(config.title, config.features);
  const director = new StoryboardEngine(page);
  director.loadStoryboard(storyboard);

  // Play demo
  await director.play();

  // Stop recording
  const videoPath = await recorder.stopSession(session);
  
  console.log(`[QuickDemo] Video saved: ${videoPath}`);
  
  await recorder.dispose();
  await director.dispose();
  
  return videoPath;
}
