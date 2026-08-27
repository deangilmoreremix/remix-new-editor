/**
 * @smartvideo/ai-timeline-editor
 *
 * AI-enhanced timeline editor package that extends the base @higgsfield/timeline-editor
 * with AI-powered features including:
 * - AI gap fill generation
 * - AI clip extension
 * - AI music generation
 * - SAM3 masking integration
 * - Performance-aware moment retrieval
 * - Humanize cut suggestions
 * - Auto scene detection
 * - Smart transitions
 */

// Re-export all base timeline-editor functionality
export { timelineMachine } from './services/timelineMachine';
export { useTimeline } from './hooks/useTimeline';
export { useTimelineContext, TimelineProvider } from './hooks/useTimelineContext';
export { effectsCache } from './services/effectsCache';
export { timelinePlayerSync } from './services/timelinePlayerSync';
export { batchOperationsService } from './services/batchOperationsService';
export { slipSlideService } from './services/slipSlideService';
export { transitionCollisionDetector } from './services/transitionCollisionDetector';
export { keyframeAnimationService } from './services/keyframeAnimationService';

// Re-export adapters
export { MCPClient } from './adapters/mcpClient';
export { PlayerAdapter } from './adapters/playerAdapter';
export { MediaAdapter } from './adapters/mediaAdapter';
export { AppStateAdapter } from './adapters/appStateAdapter';
export { TauriShim } from './adapters/tauriShim';

// Re-export types
export type { TimelineState, TimelineClip, Track, Keyframe, Transition, Marker } from './types/timeline';

// AI-specific exports
export { AIGapFillService } from './services/aiGapFillService';
export { AIClipExtensionService } from './services/aiClipExtensionService';
export { AIMusicGenerationService } from './services/aiMusicGenerationService';
export { SAM3MaskingService } from './services/sam3MaskingService';
export { PerformanceAnalysisService } from './services/performanceAnalysisService';
export { HumanizeCutService } from './services/humanizeCutService';
export { AutoSceneDetectionService } from './services/autoSceneDetectionService';
export { SmartTransitionService } from './services/smartTransitionService';
