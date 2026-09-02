# Enterprise Demo Production Layer

Million-dollar quality demo video production for AI image/video applications.

## What This Is

This transforms Playwright from a testing tool into a **demo production studio**. It adds:

- **Cinematic camera movements** (dolly, pan, tilt, crane, close-up)
- **4K 60fps recording** with hardware-accelerated encoding
- **AI-specific interactions** (seed control, generation monitoring)
- **Storyboard engine** for professional demo narratives
- **Multi-angle recording** (picture-in-picture, split-screen)
- **Post-production pipeline** (FFmpeg, color grading, audio mixing)
- **Deterministic outputs** (100% reproducible demo footage)

## Quick Start

```typescript
import { test } from '@playwright/test';
import {
  CinematicRecorder,
  CameraAnglePresets,
  AIInteractionEngine,
  StoryboardEngine,
  DemoTemplates
} from './enterprise';

test('million dollar demo', async ({ page }) => {
  // Initialize
  const recorder = new CinematicRecorder(page);
  const camera = new CameraMovementEngine(page);
  const aiEngine = new AIInteractionEngine(page);

  // Start recording
  const session = await recorder.startSession('my-demo');

  // Wide establishing shot
  await CameraAnglePresets.wideShot(page, 2000);

  // Close-up on feature
  await camera.closeUp('[data-testid="generation-panel"]', 3.0, 100, 1200);

  // AI generation with deterministic seed
  await aiEngine.setSeed(12345);
  await aiEngine.setPrompt('A majestic lion in Van Gogh style');
  await aiEngine.generate();

  // Reveal shot
  await CameraAnglePresets.revealShot(page, '.generated-image', 2500);

  // Stop recording
  await recorder.stopSession(session);
});
```

## Camera Movements

| Movement | Description | Use Case |
|----------|-------------|----------|
| `wideShot` | Full application view | Establishing shots |
| `mediumShot` | 1.5x zoom on element | Feature overviews |
| `closeUp` | 3x zoom with padding | Detailed feature focus |
| `extremeCloseUp` | 5x zoom, tight framing | UI element details |
| `dollyIn` | Smooth zoom in | Pulling viewer into action |
| `dollyOut` | Smooth zoom out | Revealing context |
| `pan` | Horizontal scroll | Showing multiple elements |
| `tilt` | Vertical scroll | Scrolling through content |
| `track` | Follow moving element | Drag interactions |
| `crane` | Zoom + pan combined | Dynamic reveals |
| `dutchAngle` | Tilted perspective | Dramatic effect |
| `revealShot` | Close-up to wide | Feature to context |
| `dollyZoom` | Zoom in, pull back | Vertigo/emphasis effect |
| `rackFocus` | Blur/focus between elements | Guiding attention |
| `whipPan` | Fast pan with motion blur | Energy/transition |

## AI Interaction

```typescript
const aiEngine = new AIInteractionEngine(page);

// Set deterministic parameters
await aiEngine.setSeed(12345);
await aiEngine.setSteps(30);
await aiEngine.setSampler('DPM++ 2M Karras');

// Generate with monitoring
const outputs = await aiEngine.generate(
  { prompt: 'A serene garden', seed: 12345 },
  {
    timeout: 120000,
    onProgress: (progress) => {
      console.log(`${progress.stage}: ${progress.progress}%`);
    },
    captureIntermediate: true
  }
);
```

## Storyboard

```typescript
const storyboard = StoryboardEngine.createDemoStoryboard('My Demo', [
  { name: 'Introduction', selector: '#hero' },
  { name: 'Feature 1', selector: '#feature-1' },
  { name: 'Feature 2', selector: '#feature-2' },
]);

const director = new StoryboardEngine(page);
director.loadStoryboard(storyboard);
await director.play();
```

## Multi-Angle Recording

```typescript
const multiAngle = new MultiAngleRecorder(page);

// Add secondary viewport
await multiAngle.addAngle('preview', 'https://app.com', {
  width: 480,
  height: 270
});

// Record all angles
const recordings = await multiAngle.recordAllAngles(10000);

// Create picture-in-picture composite
await multiAngle.createCompositeVideo('picture-in-picture', 'final.mp4');
```

## Post-Production

```typescript
const pipeline = PresetPipelines.createYouTubePipeline();

pipeline
  .addVideoTrack('main.webm')
  .addAudioTrack('narration.mp3', 0, 0.8)
  .addAudioTrack('music.mp3', 0, 0.2, true) // duck
  .addTextOverlay({
    text: 'AI Image Generation',
    start: 0,
    duration: 5,
    position: { x: 50, y: 50 },
    style: { fontFamily: 'Inter-Bold', fontSize: 48, color: '#FFFFFF' }
  });

await pipeline.render('final.mp4');
```

## Deterministic Outputs

```typescript
const manager = new DeterministicOutputManager();

// Create locked config
const config = manager.createLockedConfig({
  seed: 12345,
  prompt: 'A majestic lion',
  model: 'stable-diffusion-xl',
  steps: 30,
  sampler: 'DPM++ 2M Karras',
  width: 1024,
  height: 1024
});

// Validate reproducibility
const validator = new ReproducibilityValidator(manager);
const isDeterministic = await validator.validateDeterminism(generateFn, 12345);
```

## Recording Presets

| Preset | Resolution | FPS | Codec | Use Case |
|--------|-----------|-----|-------|----------|
| `BROADCAST_CONFIG` | 4K (3840x2160) | 60 | H.265 | TV, film |
| `WEB_OPTIMIZED_CONFIG` | 1080p (1920x1080) | 30 | H.264 | YouTube, web |
| `SOCIAL_MEDIA_CONFIG` | 1080x1920 | 30 | H.264 | Instagram, TikTok |

## Directory Structure

```
enterprise/
├── cinematic-recorder.ts      # 4K recording engine
├── camera-movement-engine.ts   # Camera movements & angles
├── ai-interaction-engine.ts    # AI-specific interactions
├── post-production.ts          # FFmpeg pipeline
├── storyboard.ts               # Narrative engine
├── multi-angle-recorder.ts     # Multi-viewport recording
├── deterministic-output.ts     # Seed management
├── enterprise-demo.spec.ts     # Examples
└── index.ts                    # Exports
```

## Dependencies

```bash
npm install @ffmpeg/ffmpeg fluent-ffmpeg sharp
brew install ffmpeg  # macOS
```

## Million-Dollar Features Included

1. ✅ Cinematic camera movements (dolly, pan, crane, rack focus)
2. ✅ 4K 60fps recording with hardware encoding
3. ✅ AI-specific interaction patterns (seed control, monitoring)
4. ✅ Storyboard engine for professional narratives
5. ✅ Multi-angle recording (PiP, split-screen, grid)
6. ✅ Post-production pipeline (color grading, audio mixing)
7. ✅ Deterministic output for reproducible demos
8. ✅ Responsive demo recording across devices
9. ✅ Before/after comparison recording
10. ✅ Cursor effects and motion trails

## Production Workflow

```
1. Write storyboard (JSON or code)
   ↓
2. Record raw footage (4K 60fps)
   ↓
3. Post-process (color grade, audio, overlays)
   ↓
4. Render final delivery formats
   ↓
5. Automated QA and validation
```

## Example: Full AI Demo

```typescript
// 1. Set up recording
const recorder = new CinematicRecorder(page);
const session = await recorder.startSession('ai-demo');

// 2. Load storyboard
const storyboard = DemoTemplates.aiImageGenerationDemo();
const director = new StoryboardEngine(page);
director.loadStoryboard(storyboard);

// 3. Play with camera movements
await CameraAnglePresets.wideShot(page, 2000);
await director.play();

// 4. Post-process
const pipeline = PresetPipelines.createYouTubePipeline();
await pipeline.render('final-demo.mp4');
```
