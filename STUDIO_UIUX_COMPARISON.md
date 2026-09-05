# STUDIO UI/UX COMPARISON — SmartVideo AI
**Current App vs. Historical (afad812a)**

---

## Studio: Image Studio
### Current
- Hero banner + prompt bar (upload + textarea + GTM Boost)
- Bottom controls row: Model | AR | Quality | Thumbnail | Advanced | Tools | Personalize | Generate
- Advanced Options: 9 style presets, negative prompt, guidance scale, steps, seed, batch count, width/height, reference strength, LoRA model + weight
- Canvas area with Regenerate | Download | New
- History sidebar (right, slide-in)
- Quick Tools Panel (collapsible): Quick Starters + Prompt Enhancer

### Historical
- All of the above PLUS:
- Sidebar navigation (`Sidebar.js`) with 24 icon-based nav items
- Dedicated Thumbnail Studio (`ThumbnailStudio.js`) with 5-step flow
- 6-tab Settings Modal (General, API, Audio, Video, Keyboard, Export)
- Template Gallery integration
- 12 curated prompts library (ExplorePage)
- `openaiConfig.js` per-studio color schemes
- `thumbnailPresets.js` preset system
- `models_dump.json` model catalog
- Brand kit integration in thumbnail flow
- Skeleton loaders for thumbnails

### Missing Controls
- Dedicated Thumbnail Studio (5-step: Brief → Generate → Refine → Text Overlay → Saved)
- Settings Modal with Audio/Video/Keyboard/Export tabs
- Brand kit (name, colors, logo) for thumbnails
- Template Gallery with niche-based grouping + search
- Curated prompt library (12 prompts)
- Skeleton loaders for thumbnails
- Per-studio color scheme configuration

### Missing UX
- Sidebar icon navigation (24-item persistent rail)
- Template-driven generation flow
- Thumbnail candidate grid with selection
- Chat-based thumbnail refinement
- Fullscreen preview with backdrop blur
- Streaming generation in GTM Boost modal
- Error state UI (historical: red error message + button reset after 3s; current: bare `alert()`)
- Keyboard shortcuts panel

### Missing Workflows
- Thumbnail generation → refine → text overlay → save workflow
- Template-based image generation
- Template search + filter
- Prompt library "Try this" → prefill + navigate
- Brand kit → thumbnail generation pipeline

### Missing Content
- 12 curated prompts across Cinematic, Sci-Fi, Art, Lifestyle, Fashion, Fantasy, Commercial, Nature, Style
- Template gallery with category sections and count badges
- Template niche presets (restaurant, med-spa, fitness, real-estate, etc.)
- Template cinematic wizard
- 1,695 static assets in `public/static/`

### Implementation Notes
- Historical ThumbnailStudio.js had full 5-step modal flow; current has inline thumbnail generation only
- Current SettingsModal.js (vanilla) exists but lacks Audio/Video/Keyboard/Export tabs
- Sidebar.js exists in current but may not be wired; historical had 24 nav items with active state

---

## Studio: Video Studio
### Current
- Hero banner + prompt bar
- Modes: T2V, I2V, V2V (auto-switch)
- Controls: Model | AR | Duration | Resolution | Quality | Advanced | Personalize | Thumbnail | Generate
- Advanced: negative prompt, seed
- Canvas: result video with Regenerate | Extend (seedance) | Download | Open in Render | New
- History sidebar

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Template Studio integration for cinematic templates
- Extend mode with `request_id` storage for continuation
- 6-tab Settings Modal (Audio/Video tabs with device selection, GPU acceleration, hardware decoding)
- Multiple video editor workflows
- Thumbnail Studio integration
- `openaiConfig.js` video studio color scheme (emerald/green)
- More extensive model catalog (1,429 lines vs ~1100)
- Template gallery access
- Demo HTML files (`timeline-standalone.html`, etc.)
- Video-to-Video as a full functional studio (not a placeholder)

### Missing Controls
- Video Editor inline tools (trim, split, transitions, subtitles)
- Audio input/output device selectors (from Settings Modal)
- Hardware decoding toggle
- GPU acceleration toggle
- Preview/render quality selectors
- Template-driven video generation
- Video personalization hub
- Extend mode with request_id persistence

### Missing UX
- 24-icon sidebar navigation
- Full Settings Modal with Audio/Video/Keyboard/Export tabs
- Template-driven cinematic generation
- Video personalization hub modal
- Streaming generation feedback
- Skeleton loaders for video thumbnails
- Professional error state UI (red message + auto-reset)

### Missing Workflows
- Template → form inputs → AI enhancer → GTM Boost → generate → output tabs → preview
- Extend with request_id continuation
- Video personalization flow
- Video-to-Video style transfer flow (currently a placeholder page)
- Render queue management

### Missing Content
- Template gallery with cinematic templates
- Video personalization demo HTML files
- 12 curated prompts
- 1,695 static assets

### Implementation Notes
- Current VideoToVideoPage.js is a static showcase (149 lines); historical had full v2v generation
- Current VideoStudio.js lacks inline timeline editor; historical had VideoEditorPage.js (1,429 lines)
- Extend mode exists but request_id persistence is limited

---

## Studio: Cinema Studio
### Current
- Hero banner ("What would you shoot with infinite budget?")
- Cinema Prompt Builder (collapsible): scene description, camera select, lens select, live preview, "Use in Prompt"
- Camera Controls Overlay: camera movement, film look, focal length, aperture, generated prompt, "Send to Video Studio"
- Inline instructions

### Historical
- All of the above PLUS:
- Cinema Template Studio (`CinemaTemplateStudio.js`) — cinematic template variants
- Sidebar navigation (24-icon nav)
- Template Studio integration with cinematic wizard
- Thumbnail Studio integration
- Settings Modal with theme color (emerald/green)
- More extensive film looks library
- Shot sequence/storyboard integration
- `templateEngine.js` for cinematic prompt enrichment
- `templateSpecs.js` with `sceneBlueprint`, `cinematography`, `visualStyle`, `enhancerKeywords`
- Prompt library (12 curated cinematic prompts)

### Missing Controls
- Cinema Template Studio (template-driven cinematic variants)
- Template Gallery access
- Thumbnail generation from cinematic prompt
- Brand kit integration
- Scene beats editor (part of Template Studio)
- Voiceover input
- Negative prompt for cinematic style
- Cinematic wizard flow

### Missing UX
- 24-icon sidebar navigation
- Template-driven generation with cinematic wizard
- Shot sequence/storyboard integration
- Streaming GTM Boost with cinematic theming
- Full Settings Modal tabs
- Skeleton loaders

### Missing Workflows
- Template → cinematic wizard → enhanced specs → generate
- Cinematic prompt → Video Studio direct generation
- Thumbnail → cinematic prompt pipeline
- Shot timing/duration controls
- Scene blueprint generation

### Missing Content
- Cinema Template variants
- 12 curated cinematic prompts
- Template gallery with cinematic sections
- `templateEngine.js` cinematic intelligence
- 1,695 static assets

### Implementation Notes
- Current CinemaStudio.js routes to Video Studio; historical had direct generation capability
- Cinema Template Studio (`CinemaTemplateStudio.js`) is completely missing from current

---

## Studio: Storyboard Studio
### Current
- Hero banner
- Control bar: Layout selector (Horizontal/Grid/Story) | Preset selector (7 shot presets)
- Fullscreen preview overlay
- 3 default frames (Wide, Medium, Close-Up)
- Per-frame: shot type, prompt, narration, notes, reference images
- Batch retry with exponential backoff (max 3)
- Generation progress tracking

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- 10 style options (vs current unclear count)
- 9 lighting options
- 8 color options
- More extensive preset library
- Template Studio integration
- Thumbnail generation per frame
- GTM Boost per frame
- Full Settings Modal
- Export to PDF/image
- Frame reordering via drag-and-drop
- `storyboardStore` with pub/sub state management

### Missing Controls
- Drag-to-reorder frames
- Frame duplication
- Frame deletion (only 3 hardcoded default frames)
- Export to PDF/image
- 10 style options (current count unclear)
- 9 lighting options
- 8 color options
- Thumbnail generation per frame
- GTM Boost per frame prompt
- Narration audio recording
- Transition effects between frames
- Shot timing/duration controls
- More than 3 default frames

### Missing UX
- 24-icon sidebar navigation
- Drag-and-drop frame reordering
- Export dialog
- Audio recording UI for narration
- Transition editor between frames
- Full Settings Modal
- Skeleton loaders for frame generation

### Missing Workflows
- Drag frames to reorder
- Duplicate/delete frames
- Export storyboard as PDF/image
- Audio narration recording + sync
- Transition effects between frames
- Shot timing/duration per frame

### Missing Content
- More than 3 default frames (hardcoded limit)
- 10 style presets
- 9 lighting options
- 8 color options
- 7 shot presets (may be same)

### Implementation Notes
- Current hardcodes 3 frames; historical had dynamic frame management
- No drag-and-drop implementation found in current
- `storyboardStore` may exist but not fully utilized

---

## Studio: Effects Studio
### Current
- Hero banner
- 6 tabs: Image Effects | Nano Banana | Kontext Effects | AI Video Effects | Motion Controls | Video FX v2
- Split panel: Left (search + effects grid 2-col) | Right (input preview + output preview + prompt + thumbnail)
- Fullscreen preview
- 350+ effects from model enum

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Effect intensity/strength slider
- Effect chaining (apply multiple effects sequentially)
- Effect favorites/recent
- Before/after comparison slider
- Batch apply to multiple images
- Save effect presets
- Effect descriptions/details shown
- Advanced Options panel persisted to localStorage (`effects_studio_advanced_settings`)
- Guidance scale, steps, seed, negative prompt in advanced
- Denoise strength, effect strength, cfg scale
- Undo/redo for effect chain
- More effect metadata (descriptions, categories)
- Full Settings Modal
- 6-tab Settings Modal with theme color (violet/indigo)

### Missing Controls
- Effect intensity/strength slider
- Effect chaining controls (add/remove/reorder effects)
- Before/after comparison slider
- Batch apply to multiple images
- Save/load effect preset
- Effect favorites/recent list
- Effect detail descriptions on hover/select
- Advanced Options persisted to localStorage
- Denoise strength, cfg scale sliders
- Undo/redo buttons

### Missing UX
- 24-icon sidebar navigation
- Effect chain editor (visual pipeline)
- Before/after comparison view
- Batch gallery view
- Favorites/recent effects panel
- Full Settings Modal (violet/indigo theme)
- Skeleton loaders

### Missing Workflows
- Chain multiple effects: Effect A → Effect B → Effect C → Apply
- Save custom effect preset → reuse
- Compare before/after with slider
- Batch apply same effect to image set
- Undo/redo effect chain

### Missing Content
- Effect descriptions/details (only names shown currently)
- Saved effect presets
- Recent/favorites effects list

### Implementation Notes
- Current has 350+ effects but no chaining; historical had effect pipeline
- Advanced settings not persisted in current (localStorage key `effects_studio_advanced_settings` missing)
- No comparison slider in current

---

## Studio: Edit Studio
### Current
- Hero banner
- Tool grid (2-5 cols responsive): 13 tools
  - Remove Object, Remove Background, Extend Image, AI Edit, Reframe, Change Dress, Enhance Skin, Colorize, Add Watermark, Upscale, Face Swap, Product Shot, Ghibli Style
- Work area (hidden until tool selected): tool title, upload, conditional prompt, thumbnail, apply button, result area
- Personalize trigger row

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Tool-specific parameter panels (aspect ratio, quality, watermark params per tool)
- Adjustment sliders (strength, blend mode)
- Layer/mask support
- Edit history stack
- Comparison view (before/after)
- Batch processing
- Save/edit stack
- Undo/redo
- More tool metadata (icons, descriptions, hasPrompt, promptPlaceholder)
- Full Settings Modal
- Template Studio integration for edit workflows

### Missing Controls
- Tool-specific parameter panels (each tool had unique controls)
- Adjustment sliders (strength, blend mode per tool)
- Layer/mask controls
- Undo/redo buttons
- Batch processing controls
- Edit history panel
- Comparison view toggle

### Missing UX
- 24-icon sidebar navigation
- Tool parameter panel (context-sensitive per tool)
- Before/after comparison slider
- Edit history stack with undo/redo
- Layer/mask editor
- Full Settings Modal
- Skeleton loaders for tool thumbnails

### Missing Workflows
- Select tool → tool-specific params → upload → adjust sliders → apply → compare → undo/redo
- Batch process multiple images through same tool
- Layer/mask workflow
- Save edit stack → reapply later

### Missing Content
- Tool-specific metadata (promptPlaceholder, custom controls per tool)
- Edit history stack (persisted)

### Implementation Notes
- Current EditStudio.js is 262 lines; historical had richer tool metadata system
- Tool-specific controls are missing (e.g., watermark text/position, face swap target selection)

---

## Studio: Upscale Suite
### Current
- Hero banner
- Method selector: AI Upscaler | Topaz Upscale | Seed Upscale
- Factor row (AI Upscaler only): 2x | 4x
- Form: Upload + Thumbnail + Upscale button
- Result area

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Denoise level control
- Face enhancement toggle
- Color correction options
- Batch upscale
- Before/after comparison
- Save presets for different content types
- More upscale methods/models
- Full Settings Modal with Video tab (preview/render quality)
- Template integration

### Missing Controls
- Denoise level slider
- Face enhancement toggle
- Color correction options
- Before/after comparison slider
- Batch upscale (multi-file)
- Save preset for content type
- More upscale factor options

### Missing UX
- 24-icon sidebar navigation
- Before/after comparison view
- Batch progress indicator
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Upscale → denoise → face enhance → color correct → compare → download
- Batch upscale multiple images
- Save preset for photos/videos/art

### Missing Content
- Upscale method presets
- Before/after comparison view

### Implementation Notes
- Current is very minimal (~184 lines); historical had richer parameter set
- No denoise/face enhancement despite being common in upscaling tools

---

## Studio: Character Studio
### Current
- Hero banner
- Model selector: Flux PuLID | Subject Reference
- Form: Upload reference face | Character description | GTM Boost | Personalize | Thumbnail | Generate
- Expression Presets: 5 buttons (Happy, Sad, Angry, Surprised, Neutral)

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Expression strength/intensity control
- Multiple reference images support
- Character consistency controls (seed lock)
- Character library/saved characters
- Pose/angle controls
- Outfit/style reference upload
- Age/gender controls
- Full Settings Modal
- Template Studio integration
- More character models

### Missing Controls
- Expression strength/intensity slider
- Multiple reference images upload
- Seed lock for consistency
- Character library panel (saved characters)
- Pose/angle controls
- Outfit/style reference upload
- Age/gender selectors
- Character consistency score display

### Missing UX
- 24-icon sidebar navigation
- Character library sidebar
- Pose/angle visual selector
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Save character → library → reuse with new prompts
- Multiple references → blended character
- Lock seed → consistent character across generations

### Missing Content
- Character library (saved characters)
- Pose/angle presets
- More expression presets

### Implementation Notes
- Current has 5 expression presets but no intensity control
- No seed lock mechanism for character consistency

---

## Studio: Commercial Studio
### Current
- Hero banner
- Model selector: Product Shot | Product Photography
- Form: Product Media upload | Scene Preset (9 options) | Output Format (4 options) | GTM Boost | Personalize | Thumbnail | Generate

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Background replacement controls
- Lighting controls
- Angle/composition controls
- Text overlay on product
- Brand color input
- Multi-product composition
- A/B variant generation
- Full Settings Modal
- Template Studio integration

### Missing Controls
- Background replacement controls
- Lighting controls (studio lighting presets)
- Angle/composition controls
- Text overlay on product
- Brand color input
- Multi-product composition
- A/B variant generation
- More scene presets

### Missing UX
- 24-icon sidebar navigation
- Background replacement UI
- Lighting preset selector
- Brand kit integration
- A/B comparison view
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Product → background replace → lighting → text overlay → generate
- Multi-product composition
- A/B variant generation + comparison

### Missing Content
- More scene presets
- Brand kit (colors, logo)
- Lighting presets library

### Implementation Notes
- Current has 9 scene presets and 4 format presets; historical had richer controls
- No brand color or text overlay despite being commercial-focused

---

## Studio: Audio Studio
### Current
- Hero banner
- Model selector row (audioModels)
- Form: Prompt textarea | GTM Boost | Personalize | Style selector (conditional) | Duration selector (15s/30s/60s/120s) | Thumbnail | Generate

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Waveform preview
- Audio editor (trim, fade)
- Lyrics input for singing
- Voice cloning controls
- BGM mixing
- Stem separation
- Audio effects (reverb, EQ)
- Full Settings Modal with Audio tab (input/output devices, sample rate, normalization, noise reduction, echo cancellation)
- More audio models

### Missing Controls
- Waveform preview
- Audio editor (trim start/end, fade in/out)
- Lyrics input
- Voice cloning controls
- BGM mixing controls
- Stem separation
- Audio effects (reverb, EQ, compression)
- Sample rate selector
- Input/output device selectors
- Normalization toggle
- Noise reduction toggle
- Echo cancellation toggle

### Missing UX
- 24-icon sidebar navigation
- Waveform visualization
- Audio timeline editor
- Full Settings Modal with Audio tab
- Skeleton loaders

### Missing Workflows
- Generate music → waveform → trim/fade → add BGM → export
- Lyrics → singing voice generation
- Voice clone → generate speech with cloned voice

### Missing Content
- Audio effect presets
- Voice library

### Implementation Notes
- Current is minimal (~272 lines); historical had full audio editing suite
- Settings Modal Audio tab is completely missing

---

## Studio: Avatar Studio
### Current
- Hero banner
- Model selector (avatarModels)
- Form: Source Video/Image upload | Conditional audio upload | Conditional prompt | GTM Boost | Personalize | Thumbnail | Generate

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Avatar customization (hair, clothes, etc.)
- Background replacement
- Expression controls
- Voice selection beyond upload
- Avatar library
- Multi-speaker support
- Full Settings Modal
- Template Studio integration

### Missing Controls
- Avatar customization controls (hair, clothes, accessories)
- Background replacement controls
- Expression controls (beyond text prompt)
- Voice selection dropdown
- Multi-speaker support
- Avatar library panel

### Missing UX
- 24-icon sidebar navigation
- Avatar customization panel
- Background replacement UI
- Voice selection UI
- Avatar library sidebar
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Customize avatar → background → voice → generate
- Save avatar to library → reuse
- Multi-speaker dialogue generation

### Missing Content
- Avatar library (saved avatars)
- Voice presets library
- Customization presets

### Implementation Notes
- Current is minimal (~262 lines); historical had richer avatar customization
- No avatar persistence/library

---

## Studio: Training Studio
### Current
- Hero banner
- Model selector (trainingModels)
- Form: LoRA Name | Trigger Word | Training Epochs (5/10/20/30) | Training Images upload (10-20 recommended) | Thumbnail | Train LoRA

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Learning rate control
- Batch size control
- Training preview/progress
- Dataset preview/gallery
- Validation split
- Resume training
- LoRA metadata output
- Full Settings Modal

### Missing Controls
- Learning rate slider
- Batch size selector
- Validation split slider
- Resume training button
- Dataset preview gallery
- Training progress indicator
- LoRA metadata display

### Missing UX
- 24-icon sidebar navigation
- Training progress dashboard
- Dataset gallery view
- Resume training dialog
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Upload dataset → preview → configure LR/batch/epochs → train → monitor progress → export LoRA
- Resume interrupted training
- Validate LoRA quality before export

### Missing Content
- Training presets (different model types)
- LoRA metadata output format

### Implementation Notes
- Current is minimal (~267 lines); historical had richer training configuration
- No training progress monitoring

---

## Studio: Video Tools Studio
### Current
- Hero banner
- Model selector (videoToolsModels)
- Form: Source Video upload | Conditional prompt | GTM Boost | Personalize | Thumbnail | Process Video

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Tool-specific parameter panels
- Processing progress/status
- Output format selection
- Quality/bitrate controls
- Batch processing
- Full Settings Modal with Video tab
- More video tool models

### Missing Controls
- Tool-specific parameter panels
- Output format selector
- Quality/bitrate controls
- Processing progress indicator
- Batch processing controls

### Missing UX
- 24-icon sidebar navigation
- Tool parameter panel (context-sensitive)
- Processing progress dashboard
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Select tool → tool params → upload video → process → preview → download
- Batch process multiple videos

### Missing Content
- Tool-specific metadata and presets

### Implementation Notes
- Current is minimal (~230 lines); historical had richer tool system
- Tool-specific parameters not implemented

---

## Studio: Chat Studio
### Current
- Hero banner
- Model selector (textModels)
- Chat container: scrollable message list, empty state "Start a conversation"
- Input: System prompt | Textarea + Send + Thumbnail | Advanced Options toggle (Temperature 0-2, Max Tokens 1-4096)

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Conversation history persistence (not just in-memory)
- Conversation rename/delete
- Streaming response indicator
- Markdown rendering
- Code highlighting
- Copy message button
- Export conversation
- Stop generation button
- Full Settings Modal
- Conversation sidebar/list

### Missing Controls
- Conversation list sidebar
- Rename conversation
- Delete conversation
- Stop generation button
- Export conversation button
- Copy message button
- Markdown toggle
- Code highlighting toggle

### Missing UX
- 24-icon sidebar navigation
- Conversation list with history
- Streaming response indicator (typing effect)
- Markdown rendering in messages
- Code syntax highlighting
- Copy-to-clipboard on messages
- Full Settings Modal
- Skeleton loaders for responses

### Missing Workflows
- New conversation → chat → rename → export
- Stream response → stop mid-generation
- Markdown/code rendering → copy code block

### Missing Content
- Conversation history (server-side)
- System prompt presets

### Implementation Notes
- Current ChatStudio.js is 304 lines; historical had richer chat UX
- No streaming in current (fire-and-forget)
- No conversation persistence beyond page refresh

---

## Studio: Lip Sync Studio
### Current
- Hero banner
- Mode toggle: Portrait Image | Video
- Uploads row: Image (64x64) | Video (64x64, hidden in image mode) | Audio (64x64) | Textarea | GTM Boost
- Status labels: No image / No audio / No video
- Model selector + Resolution selector
- Generate button

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Audio waveform preview
- Lip sync timing adjustment
- Phoneme-level editing
- Multiple voice selection
- Background replacement for portrait
- Expression controls beyond text prompt
- Full Settings Modal with Audio tab
- Thumbnail generation

### Missing Controls
- Audio waveform preview
- Lip sync timing adjustment slider
- Phoneme-level editor
- Multiple voice selection (dropdown/library)
- Background replacement controls
- Expression controls (beyond text prompt)
- Voice library

### Missing UX
- 24-icon sidebar navigation
- Waveform visualization
- Phoneme timeline editor
- Background replacement UI
- Full Settings Modal with Audio tab
- Skeleton loaders

### Missing Workflows
- Upload portrait → select voice → adjust timing → generate lip sync
- Phoneme-level editing → precise mouth sync
- Background replacement → lip sync → composite

### Missing Content
- Voice library/presets
- Phoneme presets

### Implementation Notes
- Current is 848 lines; historical had richer audio integration
- No waveform or timing controls

---

## Studio: AI Influencer Studio
### Current
- Hero banner
- Form: Upload reference photo/video | Style Preset (20 options) | Output Format (4 options) | Additional instructions | GTM Boost | Personalize | Thumbnail | Generate

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Style intensity/blend control
- Pose/angle controls
- Outfit customization
- Background swap
- Batch style variations
- Style favorites
- Full Settings Modal
- Template Studio integration
- More output format options

### Missing Controls
- Style intensity/blend slider
- Pose/angle controls
- Outfit customization
- Background swap controls
- Batch variations
- Style favorites

### Missing UX
- 24-icon sidebar navigation
- Style preview/comparison
- Pose/angle visual selector
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Upload reference → select style → adjust intensity → pose → outfit → generate
- Batch generate style variations → compare → select best

### Missing Content
- Style favorites system
- Pose/angle presets
- Outfit presets

### Implementation Notes
- Current has 20 style presets and 4 format presets; historical had richer controls
- No style blending or variation system

---

## Studio: Timeline
### Current
- Top toolbar: Tool group | Zoom out/in | Add Video/Audio/Text/B-Roll track buttons | Pill row
- Timeline shell: Header (Tracks | Timeline) | Body (Playhead layer + Track rows)
- Playhead (line + knob)
- Tracks: Video, Audio, Text, B-Roll (default)
- Per track: mute, solo, lock toggles
- Clips with left position and width

### Historical
- All of the above PLUS:
- Full Timeline Editor (`TimelineEditorPage.jsx`, 6,946 lines)
- Clip dragging/resizing
- Clip splitting/trimming
- Clip properties editor
- Timeline scrolling
- Snap-to-grid
- Keyboard shortcuts
- Undo/redo
- Media import to timeline
- Export/render from timeline
- Multi-camera, PiP, split-screen, subtitles, transitions
- `useTimelineStore.jsx` with React state + localStorage persistence
- `editor/TimelineState.js` (26KB)
- `editor/dragDrop.js` (47KB)
- `editor/animationControls.jsx` (32KB)
- `editor/colorCorrectionSystem.jsx` (50KB)
- `editor/subtitleTimeline.js`
- `editor/transitionEditor.js`
- `editor/keyframeSystem.jsx`
- Sidebar navigation
- Full Settings Modal with Keyboard/Export tabs

### Missing Controls
- Clip dragging/resizing
- Clip splitting/trimming
- Clip properties editor
- Timeline scrolling
- Snap-to-grid
- Keyboard shortcuts (Playback, Editing, Timeline, Export)
- Undo/redo
- Media import to timeline
- Export/render from timeline
- Multi-camera toggle
- PiP toggle
- Split-screen toggle
- Subtitles toggle
- Transitions

### Missing UX
- 24-icon sidebar navigation
- Clip selection + properties panel
- Drag handles on clips
- Resize handles on clips
- Split cursor on clip hover
- Timeline scroll/zoom
- Full Settings Modal with Keyboard/Export tabs
- Skeleton loaders

### Missing Workflows
- Import media → add to timeline → drag clips → resize → split → add transitions → export
- Multi-camera editing
- PiP/split-screen composition
- Subtitle editing
- Keyframe animation

### Missing Content
- Transition presets
- Keyboard shortcut presets
- Export format presets

### Implementation Notes
- Current Timeline.js is 344 lines; historical TimelineEditorPage.jsx was 6,946 lines
- Major regression — current is skeletal, historical was a full NLE
- All editor libraries (dragDrop, animationControls, colorCorrection, etc.) missing

---

## Studio: Director Page
### Current
- 45 agent cards in grid
- Categories: Analysis, Search, Extract, Translate, Accessibility, Enhance, Audio, Edit, Create, Social
- Each agent: icon, name, description, category badge
- Backend wiring: VideoDB, VideoAgent, FFmpeg agents
- Retry logic with exponential backoff
- Job polling (10-min timeout)
- Progress callbacks

### Historical
- All of the above PLUS:
- Sidebar navigation (24-icon nav)
- Agent detail page/configuration
- Agent chaining/workflows
- Saved agent presets
- Agent history
- Custom agent creation
- Full Settings Modal
- Agent execution with richer progress UI
- `src/lib/agents/` — baseAgent.js, directorAgent.js, editorAgent.js, cameraOperatorAgent.js, screenwriterAgent.js, characterExtractorAgent.js

### Missing Controls
- Agent detail/configuration panel
- Agent chain builder (connect agents in sequence)
- Save agent preset
- Create custom agent
- Agent history list
- Agent execution settings

### Missing UX
- 24-icon sidebar navigation
- Agent detail page
- Agent chain visual editor
- Saved presets panel
- Agent history sidebar
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Select agent → configure → execute → view result → chain to next agent
- Save agent sequence as preset
- Create custom agent with parameters

### Missing Content
- Agent presets
- Agent history
- Agent configuration templates

### Implementation Notes
- Current has 45 agents but no configuration UI; historical had agent system with detailed configuration
- `src/lib/agents/` directory missing from current

---

## Studio: Video-to-Video
### Current
- Hero banner
- Features section (4 cards: Style Transfer, Speed Control, Professional Grading, Real-time Preview)
- Tools section (4 cards: Style Transfer, Color Grading, Slow Motion, Speed Ramping)
- Example Prompts (3 cards with "Try this" buttons)
- Static page — no actual generation controls

### Historical
- Full functional video-to-video generation studio
- Upload video → select style → adjust parameters → generate
- Sidebar navigation (24-icon nav)
- Template integration
- Style transfer controls
- Speed control parameters
- Color grading controls
- Full Settings Modal with Video tab
- Model selector for v2v models
- Advanced options (denoise, strength, cfg scale)

### Missing Controls
- Video upload
- Prompt input
- Model selector
- Style transfer strength
- Speed control (slow motion, speed ramp)
- Color grading controls
- Advanced options (denoise, cfg scale)
- Generate button
- Result area with download

### Missing UX
- 24-icon sidebar navigation
- Generation flow
- Result preview
- History sidebar
- Full Settings Modal
- Skeleton loaders

### Missing Workflows
- Upload video → select style → adjust params → generate → preview → download
- Color grade → speed adjust → export

### Missing Content
- Style transfer presets
- Color grading presets
- Speed ramp presets

### Implementation Notes
- Current is a static showcase page; historical had full v2v generation
- Major regression — needs full studio rebuild

---

## Studio: Template Studio (MISSING FROM CURRENT)
### Current
- NOT PRESENT in current app

### Historical
- Full Template Studio (`TemplateStudio.js`)
- Template-driven cinematic video/image generation
- Template Gallery with category sections, niche-based grouping, search + filter chips
- Enhanced template specs: `sceneBlueprint`, `cinematography`, `visualStyle`, `enhancerKeywords`
- Cinematic wizard for `cinematic: true` templates
- Form inputs: template type, niche, business type, audience, subject, setting, visual style, CTA, extra instructions
- AI Enhancer toggle
- GTM Boost integration
- Advanced options
- Output tabs (Enhanced Prompt, Scene Beats, Voiceover, Negative Prompt)
- Thumbnail generation
- Full Settings Modal

### Missing Controls
- Template selector with search/filter
- Template type select
- Niche select
- Business type, audience, subject, setting inputs
- Visual style select
- CTA input
- AI Enhancer toggle
- Output tabs (Enhanced Prompt, Scene Beats, Voiceover, Negative Prompt)
- Thumbnail generation

### Missing UX
- Template Gallery with category sections and count badges
- Search + filter chips
- Hover-reveal thumbnail studio button
- Cinematic wizard flow
- Output tabs for different prompt components
- Full Settings Modal

### Missing Workflows
- Browse templates → select → fill form → AI enhance → GTM Boost → generate → preview output tabs
- Cinematic wizard: select template → fill cinematic specs → generate cinematic video

### Missing Content
- Template gallery with niche templates
- Enhanced template specs (`sceneBlueprint`, `cinematography`, etc.)
- Cinematic wizard templates
- 12 curated prompts (ExplorePage)

### Implementation Notes
- Template Studio is completely missing from current app
- Template infrastructure (`templateEngine.js`, `templateSpecs.js`) may still exist in lib
- Template Gallery (`TemplatesPage.js`) exists as route but may be non-functional

---

## Studio: Cinema Template Studio (MISSING FROM CURRENT)
### Current
- NOT PRESENT in current app

### Historical
- Cinema Template Studio (`CinemaTemplateStudio.js`)
- Cinematic template variants
- Integration with Template Studio
- Sidebar navigation
- Thumbnail generation

### Missing Controls
- Cinema template selector
- Cinematic variant controls
- Thumbnail generation

### Missing UX
- Cinema template gallery
- Cinematic variant preview

### Missing Workflows
- Select cinema template → customize → generate

### Implementation Notes
- Completely missing from current app
- May be consolidated into Cinema Studio or Template Studio in historical

---

## Studio: AI VFX (MISSING FROM CURRENT)
### Current
- NOT PRESENT in current app (route may exist but not functional)

### Historical
- AI VFX page (`AIVFXPage.js`)
- AI-powered visual effects
- Sidebar navigation
- Integration with Effects Studio

### Missing Controls
- VFX-specific controls
- Effect application controls

### Missing UX
- VFX studio interface
- Effect application flow

### Missing Workflows
- Apply AI VFX to media

### Implementation Notes
- May be route `/aivfx` or similar
- Not found in current router

---

## Studio: Video Editor (MISSING FROM CURRENT)
### Current
- NOT PRESENT as functional editor (VideoToVideoPage.js is a placeholder)

### Historical
- Full Video Editor (`VideoEditorPage.js`, 1,429 lines)
- Timeline-based video editing
- Multi-track editing
- Import/export
- Effects, transitions, subtitles

### Missing Controls
- Timeline editor controls
- Clip manipulation
- Track management
- Effects application
- Transition controls
- Subtitle editor
- Export controls

### Missing UX
- Full timeline editor
- Multi-track view
- Clip manipulation UI
- Effects panel
- Subtitle editor
- Export dialog

### Missing Workflows
- Import media → timeline → edit → add effects → add subtitles → export

### Implementation Notes
- Current has Timeline.js (344 lines) but it's skeletal
- Historical had full VideoEditorPage.js with timeline integration
- Major regression

---

## Studio: Video Agent (MISSING FROM CURRENT)
### Current
- Route exists (`/video-agent`) but may not be functional

### Historical
- Video Agent Page (`VideoAgentPage.js`)
- AI video agent interface
- Sidebar navigation
- Integration with Director agents

### Missing Controls
- Video agent controls
- Agent execution controls

### Missing UX
- Video agent interface
- Agent execution flow

### Missing Workflows
- Video agent task execution

### Implementation Notes
- Route exists but functionality unclear

---

## Studio: Assist (MISSING FROM CURRENT)
### Current
- Route exists (`/assist`) but may not be functional

### Historical
- Assist Page (`AssistPage.js`)
- AI assistant interface
- Sidebar navigation

### Missing Controls
- Assist controls
- Chat interface

### Missing UX
- Assist interface
- Chat flow

### Missing Workflows
- Assist task execution

### Implementation Notes
- Route exists but functionality unclear

---

## Studio: Render (MISSING FROM CURRENT)
### Current
- Route exists (`/render`) but may not be functional

### Historical
- Render Page (`RenderPage.js`)
- Render queue/management
- Sidebar navigation

### Missing Controls
- Render queue controls
- Job management

### Missing UX
- Render queue interface
- Job status display

### Missing Workflows
- Queue render jobs → monitor → download

### Implementation Notes
- Route exists but functionality unclear

---

## Studio: Thumbnail Studio (MISSING FROM CURRENT)
### Current
- NOT PRESENT as dedicated studio (thumbnail generation is inline per studio)

### Historical
- Thumbnail Studio (`ThumbnailStudio.js`)
- 5-step workflow: Brief → Generate → Refine → Text Overlay → Saved
- Brand kit integration
- Candidate grid with selection
- Chat-based refinement
- Text overlay editor
- Upload to storage + apply

### Missing Controls
- Brief input (prompt + quality/style/platform)
- Generate button (3 candidates)
- Refine chat interface
- Text overlay editor
- Save/upload button
- Brand kit (name, colors, logo)

### Missing UX
- 5-step wizard flow
- Candidate grid with selection
- Chat-based refinement
- Text overlay editor
- Full Settings Modal

### Missing Workflows
- Brief → Generate (3 candidates) → Refine (chat) → Text Overlay → Save → Apply

### Implementation Notes
- Current has inline thumbnail generation but not the full 5-step studio
- `TemplateThumbnailModal.jsx` (1,598 lines) exists but is modal-based, not a full studio

---

## Studio: Settings (MISSING FROM CURRENT)
### Current
- `SettingsModal.js` (vanilla) — 3 provider forms: Muapi, OpenAI, VideoDB
- No tabs beyond API key setup

### Historical
- Full Settings Modal (`SettingsModal.jsx`) — 6 tabs:
  - General: Theme (dark/light/system), language, auto-save, tooltips, waveform
  - API: OpenAI key management
  - Audio: Input/output devices, sample rate, normalization, noise reduction, echo cancellation
  - Video: GPU acceleration, hardware decoding, preview/render quality, default resolution
  - Keyboard: Shortcut categories (Playback, Editing, Timeline, Export) with reset
  - Export: Format (MP4/WebM/MOV), quality presets, bitrate

### Missing Controls
- Theme selector (dark/light/system)
- Language selector
- Auto-save toggle
- Tooltips toggle
- Waveform toggle
- Audio input/output device selectors
- Sample rate selector
- Normalization toggle
- Noise reduction toggle
- Echo cancellation toggle
- GPU acceleration toggle
- Hardware decoding toggle
- Preview/render quality selectors
- Default resolution selector
- Keyboard shortcuts (Playback, Editing, Timeline, Export)
- Export format (MP4/WebM/MOV)
- Quality presets
- Bitrate controls

### Missing UX
- 6-tab Settings interface
- Keyboard shortcut categories with reset
- Export format/quality presets
- Audio/Video device selection UI

### Missing Workflows
- Configure audio devices → save → apply to Audio Studio
- Set keyboard shortcuts → reset to defaults
- Choose export format → set quality → save preset

### Implementation Notes
- Current `SettingsModal.js` is vanilla with only API key forms
- Historical `SettingsModal.jsx` had full 6-tab React modal
- Major regression in settings capabilities

---

## CROSS-CUTTING MISSING INFRASTRUCTURE
### Missing from Current (Global)
- Sidebar navigation (`Sidebar.js`) — 24-icon persistent rail
- Template Studio (`TemplateStudio.js`) — template-driven generation
- Cinema Template Studio (`CinemaTemplateStudio.js`)
- AI VFX page (`AIVFXPage.js`)
- Full Video Editor (`VideoEditorPage.js`)
- Video Agent Page (`VideoAgentPage.js`)
- Assist Page (`AssistPage.js`)
- Render Page (`RenderPage.js`)
- Thumbnail Studio (`ThumbnailStudio.js`) — 5-step flow
- Full Settings Modal (`SettingsModal.jsx`) — 6 tabs
- `src/lib/agents/` — agent system (6 agent files)
- `editor/` directory — TimelineState, dragDrop, animationControls, colorCorrection, subtitleTimeline, transitionEditor, keyframeSystem
- `templateEngine.js` — template prompt enrichment
- `templateSpecs.js` — enhanced template specs
- `thumbnailPresets.js` — preset system
- `gtmResponses.js` — GTM prompt generation
- `gtmContentLibrary.js` — roles, industries, methodologies, tonalities
- `models_dump.json` — model catalog
- 1,695 static assets in `public/static/`
- Demo HTML files (timeline, video personalization demos)
- `sample-contacts.csv`
- `DATABASE_SAMPLE_QUERIES.sql`
- 30+ test files in `src/test/`
- E2E tests in `e2e/`
- `styles/_variables.scss` — SCSS variables
- `styles/timeline-editor-page.css` — timeline styles
- `openaiConfig.js` — per-studio color schemes

### Missing UX Patterns (Global)
- 24-icon sidebar navigation
- 6-tab Settings Modal
- Streaming generation feedback
- Skeleton loaders
- Before/after comparison sliders
- Effect chaining UI
- Drag-and-drop (timeline, storyboard frames)
- Keyboard shortcuts
- Undo/redo
- Conversation persistence (Chat)
- Template gallery with search/filter
- Curated prompt library
- Brand kit integration
- Audio waveform visualization
- Video timeline editor

### Missing State Management (Global)
- `useTimelineStore.jsx` — React timeline state
- `storyboardStore` — storyboard pub/sub state
- `effects_studio_advanced_settings` — localStorage persistence
- Template cache in sessionStorage
- GTM context in localStorage
- Video/image history with 30/50 entry limits

### Missing Workflows (Global)
- Template-driven generation
- Thumbnail 5-step workflow
- Agent chaining
- Video personalization
- Cinematic wizard
- Batch processing
- Export/render pipelines
- Audio editing workflows

---

*End of Studio-by-Studio Comparison*
*Generated by SUB-AGENT 3: STUDIO-BY-STUDIO COMPARISON*
