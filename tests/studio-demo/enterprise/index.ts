/**
 * Enterprise Enhancement Layer
 *
 * Million-dollar demo production capabilities for Playwright.
 *
 * Modules:
 * - cinematic-recorder: Broadcast-quality video recording
 * - camera-movement-engine: Cinematic camera movements and angles
 * - ai-interaction-engine: AI-specific interaction patterns
 * - post-production: FFmpeg-based multi-track compositing
 * - storyboard: Narrative and scene management
 * - deterministic-output: Seed control and reproducibility
 */

export { CinematicRecorder, type RecordingConfig, type RecordingSession, type RecordingRegion, BROADCAST_CONFIG, WEB_OPTIMIZED_CONFIG, SOCIAL_MEDIA_CONFIG } from './cinematic-recorder';
export { CameraMovementEngine, CameraAnglePresets, CameraChoreography, SceneDirector, type Scene, type CameraState, type CameraMove, type CameraMoveType, DEFAULT_CAMERA, CINEMATIC_CAMERA } from './camera-movement-engine';
export { AIInteractionEngine, PromptEngine, MidjourneyEngine, RunwayEngine, StableDiffusionEngine, type GenerationParams, type GenerationProgress, type DeterministicGenConfig } from './ai-interaction-engine';
export { PostProductionPipeline, PresetPipelines, ColorGrader, type VideoTrack, type TextOverlay, type Transition, type PipelineConfig, CINEMATIC_GRADE, TEAL_AND_ORANGE } from './post-production';
export { StoryboardEngine, NarrationEngine, DemoTemplates, type StoryboardConfig, type SceneConfig, type CameraDirection, type SceneAction, type OverlayConfig, type NarrationScript } from './storyboard';
export { MultiAngleRecorder, type AngleRecording } from './multi-angle-recorder';
