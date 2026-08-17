# Storyboarding Studio → Template Integration Plan

## Overview
The Storyboarding Studio is a **pre-production step** that runs before template generation. Users describe the video they want, the studio generates a complete storyboard, and that storyboard is passed into the template engine as scene/shots data so the final cinematic prompt is derived from the planned visual sequence — not from a blank prompt.

## User Flow
```
Storyboard Studio
  ↓ user enters video intent
Storyboard Engine
  ↓ generates full storyboard
Template Studio
  ↓ receives storyboard as scene plan
Prompt Assembly / Generation
  ↓ renders final output
```

## 1. Storyboard Studio Inputs

The studio collects enough information to plan the entire visual story before any generation happens.

| Input | Purpose |
|-------|---------|
| `videoType` | commercial, brand film, trailer, social reel, testimonial, documentary, etc. |
| `duration` | target total length in seconds |
| `aspectRatio` | 16:9, 9:16, 1:1, 4:5 |
| `subject / product` | what the video is about |
| `premise / keyMessage` | the core narrative or value prop |
| `tone` | dramatic, cinematic, upbeat, luxury, gritty, etc. |
| `targetAudience` | who this is for |
| `stylePreset` | photorealistic, cinematic, noir, anime, watercolor, etc. |
| `lightingPreset` | golden hour, neon, studio, dramatic, volumetric |
| `colorGrade` | warm, cool, desaturated, teal & orange, monochrome |
| `cta` | optional call to action and where it lands |
| `referenceImages` | optional visual references |

## 2. Storyboard Engine Output

The engine produces a structured storyboard object, not a flat list of prompts.

```
storyboard = {
  id: string,
  projectName: string,
  createdAt: timestamp,
  videoType: string,
  duration: number,
  aspectRatio: string,
  stylePreset: string,
  lightingPreset: string,
  colorGrade: string,
  frames: [
    {
      order: number,
      sceneNumber: number,
      shotNumber: number,
      duration: number,
      shotType: string,
      cameraMovement: string,
      description: string,
      narration: string,
      directorNotes: string,
      visualNotes: string,
      prompt: string,            // full generation-ready prompt for this frame
      enhancedPrompt: string,    // after GTM/personalization enrichment
      referenceImage: string | null,
      status: 'draft' | 'ready' | 'generating' | 'done' | 'failed',
      generationModel: string,
      aspectRatio: string,
      style: string,
      lighting: string,
      color: string,
    }
  ],
  totalDuration: number,
  transitions: string[],
  emotionalArc: string[],
  cta: { text, timing, frameNumber } | null
}
```

## 3. Storyboard Studio Features

These are the features the standalone StoryboardStudio already has. They belong here because this is a visual planning tool, not a template selector.

### Core
- Frame grid with 3 layout modes: horizontal scroll, grid, story vertical
- Add / remove / reorder frames
- Drag-and-drop reorder with undo/redo (50-state stack)
- Per-frame editor: shot type, description, narration, director notes, reference image upload
- Shot presets: Wide, Medium, Close-Up, Extreme Close-Up, POV, Overhead, Low Angle

### Generation
- **Generate single frame** — builds prompt from frame data + style/lighting/color + nano-banana cinematic prompt
- **Generate all frames** — batch with progress tracking
- **Retry failed frames** — exponential backoff, max 3 retries
- Model selector per frame or global
- Aspect ratio per frame or global

### Enhancement
- Per-frame GTM Boost
- Global GTM Boost
- Personalization trigger per frame
- Nanobanana prompt enrichment per frame

### Organization
- Autosave every 1.5s (local + API + Supabase `timeline_projects`)
- Save / Load by project ID
- Keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+S save, Escape close modal

### Review
- Fullscreen preview per frame
- Comparison modal (side-by-side A/B)
- PDF export (print-formatted frame table)
- Timeline strip at bottom showing frame order, shot abbreviations, durations

## 4. Passing Storyboard to Templates

Once the storyboard is ready, the user chooses a template. The template studio consumes the storyboard as its scene plan.

### Data mapping

| Storyboard frame field | Template scene field |
|------------------------|----------------------|
| `order` | `scene_number` |
| `sceneNumber` | `act / sequence` |
| `duration` | `timing.duration_seconds` |
| `shotType` | `shots[].type` |
| `cameraMovement` | `shots[].movement` |
| `description` | `purpose.description`, `story.beats` |
| `narration` | `audio.voiceover` |
| `directorNotes` | `continuity.notes` |
| `visualNotes` | `continuity.visualNotes` |
| `prompt` / `enhancedPrompt` | scene prompt fragments |
| `stylePreset` | `visualStyle` |
| `lightingPreset` | `lighting` |
| `colorGrade` | `colorPalette` |
| `cta` | `cta` block |
| `referenceImage` | `image_url` if present |
| `transitions` | `transition` between scenes |
| `emotionalArc` | `emotion.primary / secondary / intensity` |

### Integration points

1. **From Storyboard → Template Studio**
   - Storyboard exports a `storyboardProject` object
   - Template Studio receives it as `incomingStoryboard`
   - Scene Builder seeds from `storyboard.frames`, creating one scene per frame cluster
   - Each scene inherits the frame’s shot data, timing, and prompt fragments

2. **Template Studio prompt assembly**
   - If an incoming storyboard exists, `PromptAssemblyEngine` uses `assembleScenePromptsFromSelector(storyboardScenes)`
   - Each frame’s `enhancedPrompt` becomes the base prompt for that scene
   - Template metadata (film family, brand context, technical specs) is layered on top
   - Transition hints are injected between scenes using `storyboard.transitions`

3. **Generation handoff**
   - `RenderHandoff` carries `scenes` derived from the storyboard
   - MuAPI receives either a single cinematic prompt or a per-scene prompt array
   - If the template supports multi-scene video, each scene becomes a generation segment

## 5. Architecture Rules

- **Storyboard Studio is a standalone app/view**, not embedded inside the template selector. It has its own route (`#/storyboard`) and its own data model.
- **Templates are downstream consumers**, not the other way around. A storyboard does not require a template to exist; a template can accept a storyboard or run standalone.
- **Template Studio never modifies the storyboard.** It reads it. Edits to scene planning inside the template studio are local overrides and do not sync back to the storyboard project.
- **The storyboard owns visual planning decisions** (shot types, camera moves, frame durations, style, lighting, color). The template owns narrative structure, brand context, technical specs, and final prompt assembly.

## 6. Not Doing

- Merging StoryboardStudio into CinemaTemplateStudio as a sub-view — they are separate products with separate data models
- Reusing StoryboardStudio’s flat frame list as CinemaTemplateStudio’s Scene Builder — the scene builder stays template-aware and hierarchical (acts → scenes → shots)
- Building image generation inside CinemaTemplateStudio — that belongs in StoryboardStudio
- Auto-converting every storyboard into a template — user chooses when to hand off

## 7. Open Questions

- Should storyboards be selectable inside the template browse view as a starting point, or always via an explicit “Use storyboard” flow?
- Should editing a storyboard after template hand-off re-generate the template prompt automatically, or require manual refresh?
- Do we need versioning if the storyboard is edited after the template has already generated once?
