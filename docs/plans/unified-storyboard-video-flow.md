# Unified Storyboard-to-Video Generation Plan

## Current State Assessment

### What exists today
- **CinemaTemplateStudio**: Template-based video creation with scene timeline, scene builder, and embedded storyboard view
- **StoryboardStudio**: Standalone storyboard tool with Video Intent form, frame generation, and handoff to templates
- **Basic integration**: StoryboardStudio can pass frames to CinemaTemplateStudio via `window.useStoryboardInTemplate()`
- **Scene infrastructure**: 545 scene templates, character registry, environment registry, shot prompt builder, timeline engine

### What's broken/disconnected
- Two separate UI flows that don't feel like one product
- Storyboard image generation is manual and separate from the main flow
- Template form inputs and storyboard Video Intent fields are redundant
- No clear "start here" entry point for users
- Scene Builder and Storyboard are parallel systems instead of one unified planning layer
- Generated images from storyboard frames aren't used in final video generation

## Proposed Unified Architecture

### Single Entry Point
```
User arrives at CinemaTemplateStudio
  ↓
Choose path:
  A) "I have a storyboard" → opens embedded StoryboardStudio
  B) "I'll use a template" → shows template form with scene planning
  ↓
Both paths converge at: Scene Plan → Generate Video
```

### Unified Data Model
```
Project = {
  id, createdAt, updatedAt,
  mode: 'template' | 'storyboard' | 'hybrid',
  
  // Video intent (single source of truth)
  videoIntent: {
    videoType, duration, aspectRatio,
    subject, premise, tone, targetAudience,
    stylePreset, lightingPreset, colorGrade, cta
  },
  
  // Scene plan (from storyboard OR template selector)
  scenePlan: {
    source: 'storyboard' | 'template' | 'manual',
    scenes: [...],
    totalDuration,
    emotionalArc,
    transitions
  },
  
  // Generated assets
  assets: {
    frameImages: {}, // frameIndex → imageUrl
    thumbnails: [],
    referenceImages: []
  },
  
  // Template context (if using template mode)
  templateContext: {
    templateId, templateName,
    brandContext, voice, audience
  },
  
  // Generation result
  output: {
    videoUrl, thumbnail, prompt,
    generationTime, modelUsed
  }
}
```

### Single "Video Intent" Form
Instead of separate forms in StoryboardStudio and CinemaTemplateStudio, there should be **one Video Intent form** that feeds both systems.

**Fields:**
- Video type (commercial, trailer, social, etc.)
- Duration
- Aspect ratio
- Subject / Product
- Premise / Key message
- Tone
- Target audience
- Style preset
- Lighting preset
- Color grade
- Call to action
- Reference images (optional)

This form lives in the **create view** of CinemaTemplateStudio, above the Scene Builder. It replaces the separate Video Intent form in StoryboardStudio.

### Unified Scene Planning
Scene planning is **one component** that can be populated from two sources:

1. **From Storyboard**: User creates frames in StoryboardStudio → frames become scenes
2. **From Template**: Template selector auto-generates scenes based on Video Intent
3. **Manual**: User adds/edits scenes directly in Scene Builder

The Scene Builder UI is the same regardless of source. It shows:
- Scene cards with number, beat, duration, shots
- Edit/delete/reorder controls
- Shot editor modal
- "From storyboard" badge when applicable

### Image Generation Flow
```
Video Intent filled
  ↓
User chooses: "Plan with storyboard" or "Skip to template"
  ↓
[If storyboard path]:
  - Auto-generate frame prompts from Video Intent
  - Show storyboard grid with empty frame slots
  - User can: auto-generate all frames, generate individually, or skip images
  - Each frame shows: prompt, shot type, status (draft/ready/generating/failed)
  ↓
[If template path]:
  - Auto-select scenes from template registry based on Video Intent
  - Show Scene Timeline with proposed scenes
  - User can accept, modify, or rebuild
  ↓
Both paths converge at Scene Builder
  ↓
User reviews/edits scenes
  ↓
Generate Video
```

### Generation Pipeline
```
Scene Plan (from storyboard OR template)
  ↓
For each scene:
  - If storyboard frame has image → use as reference
  - Build scene prompt from: frame data + template metadata + Video Intent
  ↓
Assemble full video prompt:
  - If single scene → monolithic prompt
  - If multi-scene → scene-by-scene prompts with transitions
  ↓
Send to MuAPI for generation
  ↓
Return video + metadata
```

## Implementation Plan

### Phase 1: Unify Video Intent Form (Week 1)
**Goal**: One form that feeds both storyboard and template systems

**Changes:**
1. Move Video Intent form from StoryboardStudio into CinemaTemplateStudio create view
   - Place it above the Scene Builder
   - Make it collapsible
   - Style to match existing UI
2. Remove Video Intent form from StoryboardStudio (or hide when embedded)
3. Create `VideoIntentStore` - shared state that both systems read from
4. Update template form inputs to sync with Video Intent fields
   - Subject ↔ template subject field
   - Tone ↔ template tone field
   - etc.

**Files to modify:**
- `src/components/CinemaTemplateStudio.js` - add Video Intent form
- `src/components/StoryboardStudio.js` - remove/hide Video Intent when embedded
- `src/lib/videoIntentStore.js` - new shared state

### Phase 2: Unify Scene Planning (Week 2)
**Goal**: One Scene Builder that accepts input from both sources

**Changes:**
1. Scene Builder becomes the single source of truth for scene planning
2. Add `scenePlan` object to track:
   - `source`: 'storyboard' | 'template' | 'manual'
   - `scenes`: array of scene objects
   - `metadata`: duration, emotional arc, transitions
3. Update `selectScenes()` to write to Scene Builder instead of separate `selectedScenes`
4. Update `ingestStoryboardIntoBuilder()` to write to same Scene Builder
5. Scene Timeline reads from Scene Builder (no more parallel arrays)
6. Add "Rebuild from storyboard" / "Rebuild from template" buttons

**Files to modify:**
- `src/components/CinemaTemplateStudio.js` - unify scene data flow
- `src/lib/sceneSelector.js` - output to scene builder
- `src/lib/cinematicTemplates.js` - SceneBuilder becomes primary scene store

### Phase 3: Auto-Generate Storyboard Images (Week 3)
**Goal**: Automatic image generation for storyboard frames

**Changes:**
1. Add "Generate All Frames" to the unified flow
   - Triggered automatically after storyboard creation, or manually
   - Uses MuAPI image generation with retry/backoff
   - Shows progress bar
2. Per-frame status: draft → generating → ready/failed
3. Failed frames show retry button
4. Generated images stored in `assets.frameImages`
5. Images used as references in final video generation

**Files to modify:**
- `src/components/StoryboardStudio.js` - add auto-generate on creation
- `src/lib/muapi.js` - ensure image generation works with sandbox key
- `src/lib/storyboardEngine.js` - add image generation step

### Phase 4: Unified Generation Pipeline (Week 4)
**Goal**: One "Generate Video" button that works for both paths

**Changes:**
1. Single **Generate Video** button in create view
2. Before generation:
   - If storyboard path: ensure all frames have images (or skip missing)
   - Build prompts from Scene Builder + Video Intent + Template context
3. Prompt assembly logic:
   ```javascript
   if (scenePlan.source === 'storyboard' && hasFrameImages) {
     // Use storyboard frame images as references
     prompt = buildPromptFromStoryboardFrames(scenes, frameImages, videoIntent);
   } else if (scenePlan.source === 'template') {
     // Use template metadata
     prompt = buildPromptFromTemplate(scenes, template, videoIntent);
   } else {
     // Manual scenes
     prompt = buildPromptFromScenes(scenes, videoIntent);
   }
   ```
4. Show generation progress
5. Return to preview view with result

**Files to modify:**
- `src/components/CinemaTemplateStudio.js` - unify generate button logic
- `src/lib/promptUtils.js` - add storyboard-aware prompt building
- `src/lib/muapi.js` - support reference images in generation

### Phase 5: Polish & UX Improvements (Week 5)
**Goal**: Make it feel like one cohesive product

**Changes:**
1. **Onboarding flow**:
   - First-time user sees: "What would you like to create?"
   - Options: "Start with storyboard" / "Start with template" / "Start blank"
   - Each path guides through Video Intent → Scene Planning → Generation
2. **Project save/load**:
   - Save entire project state (Video Intent + Scene Plan + Assets)
   - Resume from any point
3. **Comparison view**:
   - Side-by-side: storyboard frames vs final video
   - Shows how storyboard translated to final output
4. **Export options**:
   - Export storyboard as PDF/PPT
   - Export final video
   - Share project link
5. **Undo/redo across entire flow**
6. **Keyboard shortcuts**
7. **Auto-save**

## Technical Requirements

### New Files
- `src/lib/videoIntentStore.js` - shared Video Intent state
- `src/lib/projectStore.js` - project save/load/export
- `src/lib/storyboardImageGenerator.js` - batch frame generation with progress

### Modified Files
- `src/components/CinemaTemplateStudio.js` - main unified UI
- `src/components/StoryboardStudio.js` - simplified, embedded-only
- `src/lib/cinematicTemplates.js` - SceneBuilder as primary scene store
- `src/lib/sceneSelector.js` - output to SceneBuilder
- `src/lib/promptUtils.js` - storyboard-aware prompts
- `src/lib/muapi.js` - reference image support
- `src/lib/router.js` - new project-based routing

### API Requirements
- MuAPI image generation (per frame)
- MuAPI video generation (with reference images)
- Project persistence (localStorage + optional Supabase)

## Success Criteria

1. **One-click storyboard to video**: User fills Video Intent → generates storyboard → generates video in < 3 clicks
2. < 30 second storyboard generation for 6 frames
3. < 2 minute full video generation from storyboard
4. Zero context switching between "storyboard mode" and "template mode"
5. All existing templates and storyboards continue to work
6. Mobile-responsive UI

## Not Doing (Scope Boundaries)

- **NOT** rebuilding the entire AI video generation stack
- **NOT** adding video editing capabilities (trim, cut, etc.)
- **NOT** supporting video-to-video generation in this phase
- **NOT** building a full asset library/manager
- **NOT** adding team collaboration features

## Open Questions

1. Should we keep the standalone `#/storyboard` route, or is it always embedded in CinemaTemplateStudio?
2. Should template selection happen before or after storyboard creation?
3. Do we support mixing storyboard frames with template-generated scenes?
4. What's the max storyboard frame count before performance degrades?
5. Should we cache generated frame images across sessions?

## Rollout Strategy

1. **Week 1-2**: Unified Video Intent + Scene Builder (internal testing)
2. **Week 3**: Auto-generate storyboard images (beta)
3. **Week 4**: Unified generation pipeline (beta)
4. **Week 5**: Polish + user testing
5. **Week 6**: Production rollout with feature flag

## Risk Mitigation

- **Risk**: Breaking existing template flow
  - **Mitigation**: Keep template path fully functional, add storyboard as opt-in enhancement
- **Risk**: Image generation too slow
  - **Mitigation**: Show progress, allow skip, generate in background
- **Risk**: Sandbox key limitations
  - **Mitigation**: Test with production key before rollout, graceful degradation
- **Risk**: UI complexity
  - **Mitigation**: User testing, progressive disclosure, clear defaults
