# Timeline CineGen Enhancement Plan

## Starting State
- Branch: `reconcile/cinegen-timeline-complete`
- Base SHA: `6dfb5810e` (render-studio / fix/template-cinema-production-readiness-v2)
- Timeline files inspected: `src/components/TimelineEditorPage.jsx`, `src/components/timeline/AIChatPanel.js`, `src/lib/cinegenIntegration.js`, `src/lib/cinegen.js`, `src/lib/editor/*`, `netlify/functions/cinegen.js`, `netlify/functions/cinegenProviders.js`, `src/lib/editor/ai-features/advancedTimeline.js`

## Critical Bugs Found
1. `applyCineGenResultToTimeline` referenced 5 times but never defined
2. `AIChatPanel` is fully hardcoded with fake timestamps and fake token counts
3. `providerCompositionPlan` returns static plan with no API call
4. 4 CineGen tools return hardcoded `PROVIDER_NOT_CONFIGURED` errors
5. Fake timestamps in TimelineEditorPage template (`00:12.4`, `00:45.0`, `00:14.4`)

## Task 1: Critical Bug Fixes and Real Provider Wiring
**Files to modify:**
- `src/components/TimelineEditorPage.jsx` — define `applyCineGenResultToTimeline`, fix timestamps
- `netlify/functions/cinegenProviders.js` — fix `providerCompositionPlan`, wire real implementations for disabled tools
- `src/lib/cinegenIntegration.js` — minor cleanup

**Acceptance criteria:**
- `applyCineGenResultToTimeline` is defined and inserts generated media into correct track/time
- `providerCompositionPlan` either makes real API call or returns honest `PROVIDER_NOT_CONFIGURED`
- `providerMaskTool`, `providerAudioSync`, `providerLayerDecompose`, `providerProxyPlayback` have real implementations or honest errors
- Template timestamps are real dynamic values or removed

## Task 2: AIChatPanel Real LLM Integration
**Files to modify:**
- `src/components/timeline/AIChatPanel.js` — connect to real LLM via muapi
- `src/components/TimelineEditorPage.jsx` — wire AIChatPanel callbacks to real actions

**Acceptance criteria:**
- AIChatPanel sends messages to real LLM endpoint
- Responses contain actual AI-generated content
- Token usage reflects real API responses
- Timeline context (clip count, track names, selected clip) is included in prompts
- Hardcoded responses removed

## Task 3: SAM3 UI and Advanced Editing Features
**Files to modify:**
- `src/components/TimelineEditorPage.jsx` — add SAM3 segmentation UI, viewer mode switching, timeline tabs
- `src/lib/editor/ai-features/advancedTimeline.js` — wire into main timeline
- `src/components/timeline/SceneDetector.js` — fix infinite recursion bug

**Acceptance criteria:**
- SAM3 segmentation can be triggered from timeline UI
- Source/Timeline/Split viewer modes work
- Multiple timeline tabs can be created and switched
- SceneDetector.showToast recursion fixed

## Task 4: Export Pipeline Completion
**Files to modify:**
- `src/lib/editor/exportPipeline.js` — wire real export flow
- `src/lib/editor/exportWorker.js` — implement real frame composition
- `src/lib/editor/renderFrameProcessor.js` — ensure real frame processing

**Acceptance criteria:**
- Export produces real playable video/audio output
- Transitions, subtitles, overlays are included
- Progress reporting works
- Cancellation works where supported

## Task 5: Audio Sync and Batch Operations
**Files to modify:**
- `src/lib/editor/audioSync.js` — enhance with batch sync
- `netlify/functions/cinegenProviders.js` — wire real audio sync if provider available
- `src/components/TimelineEditorPage.jsx` — add batch audio sync UI

**Acceptance criteria:**
- Audio sync works on single clip
- Batch audio sync works on multiple clips
- Waveform analysis is visible
- Silence detection works

## Task 6: Elements, Storyboard, and Media Enhancements
**Files to modify:**
- `src/components/TimelineEditorPage.jsx` — wire elements, storyboard to timeline
- `src/lib/mediaIngest.js` — enhance elements system
- `src/components/create/nodes/storyboarder-node.jsx` — ensure timeline import works
- `src/lib/uiIntegration.js` — wire extend/gap fill panels

**Acceptance criteria:**
- Elements can be created and reused
- Storyboard shots can be sent to timeline
- Fill Gap and Extend generate real media and insert into timeline
- Media library supports folders and bulk actions

## Global Constraints
1. Do NOT modify any studio other than Timeline Editor
2. Do NOT remove any existing Timeline feature
3. Do NOT introduce persistent backend (Railway, Render, Fly.io)
4. Keep changes minimal and surgical
5. Preserve all existing imports and exports
6. Use existing Netlify function architecture for AI features
7. No fake success responses — failures must be honest
