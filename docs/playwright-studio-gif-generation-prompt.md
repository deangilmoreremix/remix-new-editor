# PLAYWRIGHT STUDIO INTERFACE — ANIMATED GIF GENERATION PROMPT
## Comprehensive Guide for AI-Driven GIF Demo Production

---

## 0. PRODUCTION OVERVIEW & DESIGN PHILOSOPHY

You are a senior motion designer and technical illustrator specializing in product demo animation. Your mission is to produce a series of high-fidelity animated GIFs that document the end-to-end user workflow of every Playwright Studio interface in this application. The GIFs must feel like a professional product walkthrough: polished, smooth, technically accurate, and immediately compelling to a developer evaluating Playwright Studio for the first time.

**Visual Philosophy:**
- Dark UI chrome: `#0a0a0b` background, `#111` panels, `rgba(255,255,255,0.1)` borders, `backdrop-blur-xl` glass panels
- Primary accent: `#d9ff00` (acid yellow) — used on active states, hover glows, the Generate button gradient, active sidebar icon, filter chips
- Typography: Inter or system sans-serif, clean, crisp, anti-aliased
- Code/editor surfaces: JetBrains Mono or Fira Code at 13–14px, syntax-highlighted
- Cursor: standard system pointer (not custom), smooth bezier interpolation, 200ms–400ms travel time for cross-element moves
- Transitions: cubic-bezier(0.4, 0, 0.2, 1) for all UI state changes (dropdown open/close, panel slide, modal fade)
- Frame rate target: 30fps playback in GIF, rendered at 60fps source for smoothness
- GIF dimensions: 1280×720 (720p) minimum, 1920×1080 preferred for code-heavy studios
- Color palette in hex:
  - `#0a0a0b` — app background
  - `#111111` — panel/card background
  - `#1a1a1c` — elevated surface (hover states)
  - `rgba(255,255,255,0.08)` — panel border
  - `#d9ff00` — primary accent / generate button
  - `#ffffff` — primary text
  - `#a0a0a0` — secondary text / labels
  - `#3b82f6` — info/status indicators
  - `#22c55e` — success states
  - `#ef4444` — error/cancel states
  - `#f97316` — warning/progress

**Application Load Requirement:**
Before recording any GIF, the application must be given sufficient time to fully load. This includes:
- All lazy-loaded studio components and their dynamic imports
- Studio chrome (top bar, sidebar, drawer)
- Hero sections, prompt bars, model selectors, example galleries
- Any external iframes (AI VFX, OpenThorn, etc.)
- Network requests for assets, models, and media
- Auth state initialization (Clerk)
Wait until all network activity has settled and the studio is in a fully interactive idle state before beginning the GIF recording. Do not start recording until `networkidle` is reached and all visible elements are rendered at their final positions. This idle-state verification is part of Phase 1.

**Interaction Coverage:**
The GIF must demonstrate the complete user interaction model for each studio. Every GIF must include explicit, clearly visible sequences for both content entry and button activation:

**Entering Content (Phase 2 emphasis):**
Before any button is pressed, every available input in the studio must be populated with realistic data. This is non-negotiable — an empty form followed by a Generate button press does not demonstrate the studio's value.
- **Prompt textareas:** Must contain a full, realistic prompt (2–4 sentences, studio-specific). The prompt must be typed character-by-character with an 80ms stagger and a visible blinking caret. The textarea must show a soft glow (`shadow-glow`) as content is entered. The final prompt must be fully visible and readable before moving to the next step.
- **Dropdowns / Model selectors:** Must be opened (200ms slide-down), a selection must be highlighted with `#d9ff00` background, and the dropdown must close (150ms reverse slide). The selected value must remain visible in the trigger button after closing.
- **Sliders:** Must be dragged from their default position to a new value. Show the slider handle moving smoothly (300ms drag) and the numeric value updating in real time. Examples: Guidance Scale dragged from 7.5 to 8.5, Motion Strength from 50 to 70, Effect Strength from 0.6 to 0.9.
- **Chips / Toggles / Radio buttons:** Must be clicked. Active state must be clearly visible (background shift to `#d9ff00]/20`, border to `#d9ff00`, text color change). Multiple chips in a group may be toggled in sequence with 100ms stagger.
- **Upload zones:** Must be clicked (or dragged onto) to trigger the file picker. A file thumbnail must animate into the zone with a 300ms scale-up + fade-in. The upload zone must show a checkmark or file name after upload.
- **Form fields (non-prompt):** LoRA name, trigger word, epochs, script text, voice selector, contact name — all must be filled. Each keystroke follows the same 80ms stagger rule.
- **Tabs:** Must be clicked to switch views. The active tab indicator (underline) must slide with a 200ms transition. Tab content must crossfade (200ms) rather than snap.

**Pressing Buttons (Phase 3 emphasis):**
After all content is entered, the primary action button must be pressed. The button press sequence must be fully animated and unambiguous:
- **Hover:** Cursor hovers over the button for 200ms minimum. The button must respond with a visible hover state (brightness increase, subtle scale 1.02, glow expansion).
- **Click:** Cursor clicks the button. A ripple/pulse animation plays on the button surface (150ms). The cursor must not leave the button until the loading state is confirmed.
- **Loading state transition:** Within 100ms of the click, the button must transition from its default appearance to the loading state. This includes: background color shifting to a muted/dimmed state, a CSS spinner appearing (800ms rotation, `border-color: #d9ff00 transparent transparent transparent`), and the button text changing to "Generating...", "Processing...", "Training...", "Uploading...", or studio-appropriate equivalent. A Cancel button (`#ef4444` text) must appear as a sibling element with a 200ms fade-in.
- **Progress feedback:** A progress bar (2px height, `#d9ff00` fill) must animate from 0% to 100% over the duration appropriate to the studio (images: ~1.2s, videos: ~1.5–2s, training: longer with epoch steps). The progress bar must be smooth and linear. If the studio has a progress overlay or status text, it must update in real time (e.g., "Generating... 45%" → "75%" → "100%").
- **Abort/Cancel (optional but recommended):** If time permits within the 10s budget, show the Cancel button being clicked → progress resets → button returns to default state. Then click Generate again to show the full successful flow. If time does not permit, omit the cancel demonstration and proceed directly to the successful result.

**Button coverage by studio type:**
- **Generate studios (Image, Video, Cinema, etc.):** Must press the primary `button[aria-label="Generate ..."]` button.
- **Edit/Process studios (Edit, Upscale, Video Tools, etc.):** Must press the `button.btn-primary-modern` or equivalent action button.
- **Training studio:** Must press `button[aria-label="Train LoRA"]` and show epoch-by-epoch progress.
- **Chat studio:** Must press `button[aria-label="Send message"]` and show streaming response.
- **Director:** Must press `#send-command-btn` and show agent processing.
- **Timeline/Render:** Must press the primary action button (Render, Export, Create Shorts, etc.).
- **Navigation buttons:** Back button (`[data-studio-back]`), menu button (`[data-studio-menu]`), "Open in Studio" buttons must each be clicked and show their respective animations (drawer slide, page transition, toast notification).

---

## 1. CORE GIF SPECIFICATION (Every GIF Must Follow This Template)

Each GIF must be structured as a **4-phase continuous loop**:

### Phase 1 — IDENTIFY (0–1.5s)
**Goal:** Orient the viewer to the studio environment.
- Frame 1: Studio is in its resting idle state. The full chrome is visible: top bar with hamburger menu button (`[data-studio-menu]`), back arrow (`[data-studio-back]`), studio title centered, active sidebar icon highlighted in `#d9ff00`. The main prompt area is empty and inviting.
- Subtle ambient motion: a gentle 0.3s fade-in on load (opacity 0→1).
- No cursor movement in this phase; let the UI breathe.

### Phase 2 — INTERACT: ENTER CONTENT (1.5–4s)
**Goal:** Populate every input, dropdown, slider, and upload zone with realistic data before any button is pressed. The viewer must see the form being filled out completely.
- Cursor enters from the left or top of the viewport with a smooth ease-out bezier curve.
- **Prompt textarea (priority #1):** Cursor travels to the main prompt textarea, pauses for 200ms, clicks (border pulses `#d9ff00` over 150ms), then types the full realistic prompt character-by-character with 80ms stagger and a visible blinking caret. The textarea shows a soft glow (`shadow-glow`) as content is entered. The prompt must be 2–4 sentences, studio-specific, and fully readable before moving on.
- **Secondary inputs:** After the prompt, cursor moves to each remaining input in a logical top-to-bottom, left-to-right flow. For each: hover 200ms → click/focus → enter value → confirm. This includes: model selector dropdowns, aspect ratio/duration/quality chips, advanced parameter sliders, negative prompt textareas, style preset chips, upload zones (click → simulated file picker → thumbnail animates in with 300ms scale-up + fade-in), and any studio-specific form fields.
- **Selection feedback:** Every selection must be visually confirmed. Dropdowns close with a 150ms reverse slide and the selected value remains visible. Sliders show numeric values updating in real time. Chips show active state (`bg-[#d9ff00]/20 border-[#d9ff00]`). Upload zones show checkmark or file name.
- **Tabs:** If the studio uses tabs, click each tab in sequence. Active tab indicator slides with 200ms transition. Content crossfades (200ms).
- **No button pressing in this phase.** The cursor must not approach any Generate/Process/Train/Send button until all content entry is complete.

### Phase 3 — INTERACT: PRESS BUTTONS (4–7s)
**Goal:** Activate the primary action button and show the complete loading → progress → result sequence. This is the climax of the GIF.
- Cursor moves from the last filled input to the primary action button (Generate, Process, Train, Send, Render, Export, etc.). Travel time: 200–400ms with bezier curve. Hover over the button for 200ms minimum. Button responds with visible hover state (brightness increase, subtle scale 1.02, glow expansion).
- **Button press:** Cursor clicks the button. A ripple/pulse animation plays on the button surface (150ms). The cursor stays on the button until the loading state is confirmed (within 100ms).
- **Loading state:** Button background shifts to a muted/dimmed state. A CSS spinner appears (800ms rotation, `border-color: #d9ff00 transparent transparent transparent`). Button text changes to "Generating...", "Processing...", "Training...", "Uploading...", or studio-appropriate equivalent. A Cancel button (`#ef4444` text) appears as a sibling with a 200ms fade-in.
- **Progress indicator:** A slim progress bar (2px height, `#d9ff00` fill) animates from 0% to 100% over the duration appropriate to the studio (images: ~1.2s, videos: ~1.5–2s, training: longer with epoch steps). Status text updates in real time: "Generating... 0%" → "45%" → "100%". If the studio has a progress overlay, it slides in from the bottom with `backdrop-blur`.
- **Result reveal:** The output area animates in. For images: shimmer skeleton for 600–800ms, then the result image fades in with scale 0.98→1.00 over 500ms. For videos: video thumbnail with play button overlay appears. For code/text: character-by-character typewriter effect (40ms per character).

### Phase 4 — COMPLETE (7–10s)
**Goal:** Seal the moment — the user sees their creation.
- The generated result is centered and fully visible with a subtle glow effect (`box-shadow: 0 0 30px rgba(217,255,0,0.15)`).
- Action buttons appear: Download (icon + label), Share (icon + label), "Create This Style" (if in ExampleGallery context). Each button fades in with a 100ms stagger.
- The cursor moves to hover over the Download button (100ms hover, slight scale-up on the button).
- Final frame holds for 500ms, then the GIF loops seamlessly back to Phase 1.

**GIF Loop Design:** The final frame must match Phase 1's first frame exactly so the loop is seamless. Use a 200ms crossfade between the last frame of Phase 4 and the first frame of Phase 1 to mask any jank.

**Duration Constraints:**
- **Minimum:** 8 seconds per loop cycle.
- **Maximum:** 12 seconds per loop cycle.
- **Target:** 10 seconds per loop cycle (the structured 4-phase template above is designed for exactly 10 seconds).
- GIFs shorter than 8 seconds do not provide enough time to demonstrate the full workflow. GIFs longer than 12 seconds become tedious to watch and load. All GIFs must fall within the 8–12 second range, with 10 seconds as the ideal target. If a studio's workflow cannot be comfortably demonstrated in 10 seconds, trim non-essential interactions or speed up the typing/transition timing — do not exceed 12 seconds.

---

## 2. STUDIO-SPECIFIC PROMPTS

Generate one GIF per studio using the appropriate prompt below. Each prompt must be treated as a standalone, self-contained directive.

**Mandatory structure for every studio prompt:**
Every studio-specific prompt below follows this enforced sequence:
1. **Wait for full load** (networkidle, all elements rendered, idle state confirmed)
2. **Enter content** — fill every visible input with realistic data: prompt textarea (priority), model selector, aspect ratio/duration/quality chips, advanced sliders, negative prompt, upload zones, style presets, and any studio-specific form fields. Each action must show typewriter effect, dropdown slide, slider drag, chip toggle, or upload thumbnail animation.
3. **Press button** — move to the primary action button, hover 200ms with glow feedback, click with ripple/pulse, transition to loading state (spinner + text change + Cancel button), progress bar fills 0→100%, result animates in.
4. **Complete** — result is visible with glow, secondary action buttons appear, cursor hovers one, loop.

Do not skip step 2 (content entry). A GIF that shows an empty form immediately followed by a Generate button press fails to demonstrate the studio's workflow and is unacceptable.

---

### 2.1 IMAGE STUDIO (`src/components/ImageStudio.js`)

**GIF Title:** "Image Studio — Text-to-Image Generation"

**Workflow:**
1. (0–1.5s) The Image Studio loads. The hero banner fades in at the top ("Image Studio" in large type). Below it, the prompt bar card (`backdrop-blur-xl bg-[#111]/90 border border-white/10 rounded-xl`) is centered and empty. The model selector dropdown shows "Flux" as the default. The Example Gallery is visible at the bottom of the viewport.
2. (1.5–3s) Cursor smoothly enters and clicks the `#i-prompt-textarea` textarea. The textarea border pulses `#d9ff00`. The prompt "A majestic lion wearing a golden crown, cinematic lighting, 8K ultra-detailed" is typed in with 80ms per-character stagger. The caret blinks at the end of each word.
3. (3–4s) Cursor moves to the "Aspect Ratio" chip group and clicks "16:9". The chip transitions from `bg-white/5 border-white/10` to `bg-[#d9ff00]/20 border-[#d9ff00] text-[#d9ff00]` over 150ms. Then cursor clicks the "Quality" dropdown and selects "HD".
4. (4–5.5s) Cursor moves to the "Advanced" toggle and clicks it. The advanced panel slides down with a 200ms ease-out, revealing Negative Prompt, Guidance Scale (slider set to 7.5), Steps (25), Seed (-1). Cursor fills the negative prompt textarea with "blurry, low quality, deformed".
5. (5.5–7s) Cursor moves to the **Generate** button (`button[aria-label="Generate image"]`). The button is a gradient from `#d9ff00` to `#a8cc00` with a subtle glow. On click, the button enters loading state: spinner + "Generating..." text. A progress bar fills from 0→100% over 1.2s.
6. (7–9s) The result panel animates in: shimmer skeleton for 800ms, then the generated image fades in with a scale-up from 0.98 to 1.00 over 500ms. The image shows a majestic lion with golden crown. Below the image, the Download and Share buttons fade in. The history sidebar slides in from the right.
7. (9–10s) Cursor hovers over the Download button (100ms), then the GIF loops.

**Key selectors to visualize:** `#i-prompt-textarea`, model selector dropdown, aspect-ratio chips, advanced toggle, `button[aria-label="Generate image"]`, result image panel, `#history-sidebar`.

---

### 2.2 VIDEO STUDIO (`src/components/VideoStudio.js`)

**GIF Title:** "Video Studio — Text-to-Video Generation"

**Workflow:**
1. (0–1.5s) Video Studio loads. Hero banner "Video Studio" fades in. The central prompt card shows: image/video upload zone (empty, dashed border), Pexels browse button, `#v-prompt-textarea` (empty), model selector showing t2v models, aspect ratio selector (default 16:9), duration selector (default 5s), resolution selector.
2. (1.5–3s) Cursor clicks `#v-prompt-textarea`. Types "A futuristic city at sunset, flying cars, neon lights, cyberpunk style" with 80ms stagger. Negative prompt: "blurry, low fps".
3. (3–4s) Cursor clicks the model selector dropdown. A provider sidebar slides in from the left (MiniMax, Runway, Pika, etc.). Cursor selects a t2v model (e.g., "MiniMax H3"). The dropdown closes with a 150ms reverse slide.
4. (4–4.5s) Cursor clicks "Advanced" toggle → panel slides down revealing Camera Movement dropdown (selects "Dolly In"), Motion Strength slider (set to 65), Motion Speed (set to 7), Style Presets dropdown (selects "Cinematic"), CFG Scale (7.5).
5. (4.5–6s) Cursor moves to the Generate button (`button[aria-label="Generate video"]`). Button enters loading state with spinner. A progress overlay appears at the bottom of the viewport with a progress bar. "Processing... 0%" → "100%" over 1.5s (longer than image to show video processing time).
6. (6–8.5s) The video preview area animates in: a shimmer skeleton for 1s, then a video thumbnail with a centered play button (triangle icon, `#d9ff00` color) fades in. The video thumbnail has a subtle vignette and a "00:05" duration badge in the bottom-right corner. The progress overlay transitions to "Complete!" in green.
7. (8.5–10s) Action buttons appear below the video: Play, Download, Share, Add to Timeline. Cursor hovers Play button → button scales to 1.05 over 100ms. Loop.

**Key selectors to visualize:** `#v-prompt-textarea`, model selector (provider sidebar), camera movement dropdown, motion strength slider, `button[aria-label="Generate video"]`, video preview with play button, progress overlay.

---

### 2.3 CINEMA STUDIO (`src/components/CinemaStudio.js`)

**GIF Title:** "Cinema Studio 2.0 — Cinematic Shot Generation"

**Workflow:**
1. (0–1.5s) Cinema Studio loads with a cinematic hero banner: "Cinema Studio 2.0" in large display type, subtitle "What would you shoot with infinite budget?" Below, a collapsible "Cinema Prompt Builder" panel is visible, showing camera controls (Static, Dolly In, Crane Up, Orbit, FPV Drone, Handheld, Pan, Tilt, Dolly Zoom), Lens type dropdown, Focal Length selector, Aperture selector, Film Look dropdown (Natural, Anamorphic, Teal & Orange, Moody Noir, Vintage, Neon Nights, Documentary, Golden Hour).
2. (1.5–3s) Cursor clicks into the prompt textarea. Types "A lone astronaut standing on a cliff edge on Mars, dust storm approaching, epic scale" with 80ms stagger.
3. (3–3.5s) Cursor opens Camera Movement dropdown → selects "Orbit". Lens dropdown → selects "Anamorphic". Focal Length → "35mm". Aperture → "f/2.8". Film Look → "Teal & Orange". Each selection animates the dropdown close (150ms).
4. (3.5–4s) Cursor clicks "Reference Image" upload button. A simulated image picker opens. Cursor selects a reference image of Mars landscape. The reference thumbnail animates into a small square preview next to the upload button (scale 0→1 over 300ms).
5. (4–5.5s) Cursor opens model selector → selects "Cinema Model v2". Cursor selects Aspect Ratio "2.39:1" (anamorphic widescreen). Duration "10s".
6. (5.5–7s) Cursor clicks `button[aria-label="Generate cinema shot"]`. Button enters loading state. A cinematic progress overlay appears: dark translucent bar at bottom with a subtle film-grain texture. Progress bar fills `#d9ff00` from 0→100% over 1.4s.
7. (7–9.5s) Result reveal: shimmer skeleton for 800ms, then the cinematic shot fades in. The image has letterboxing (black bars top and bottom) to match the 2.39:1 aspect ratio. Film grain overlay subtly animates. Below the shot, metadata badges appear: "Anamorphic • 35mm • f/2.8 • Orbit • Teal & Orange".
8. (9.5–10s) Download and Share buttons fade in. Cursor hovers Share → a share modal previews briefly. Loop.

**Key selectors to visualize:** prompt textarea, Camera Movement dropdown, Lens/Focal/Aperture selects, Film Look dropdown, reference image upload, model selector, `button[aria-label="Generate cinema shot"]`, cinematic result with letterboxing and grain overlay.

---

### 2.4 CHAT STUDIO (`src/components/chat/ChatStudio.jsx`)

**GIF Title:** "Chat Studio — Conversational AI Session"

**Workflow:**
1. (0–1.5s) Chat Studio loads (the only React-based studio, rendered with `createRoot`). The sidebar is open on the left, showing a "New Conversation" button and an empty conversation list. The main chat area shows an empty state: "Welcome to Chat Studio" with a large illustration and the "New Conversation" button (`button[aria-label="New conversation"]`). The input textarea (`textarea[aria-label="Message"]`) at the bottom is empty.
2. (1.5–2.5s) Cursor clicks "New Conversation". The sidebar collapses to icons-only (desktop behavior). The empty state fades out. A new conversation bubble appears in the message list.
3. (2.5–4s) Cursor focuses the `textarea[aria-label="Message"]`. Types "Write a Python function that scrapes a website and extracts all article titles" with 80ms stagger. The Send button (`button[aria-label="Send message"]`) transitions from disabled (opacity 0.4) to enabled (opacity 1.0, `#d9ff00` background).
4. (4–4.5s) Cursor clicks Send. The user's message appears as a right-aligned bubble (`bg-[#d9ff00]/20 border border-[#d9ff00]/30`) with a 300ms slide-up + fade-in. The input clears. A "Stop generation" button (`button[aria-label="Stop generation"]`) appears in the input area.
5. (4.5–7.5s) AI response streams in: left-aligned bubble (`bg-white/5 border border-white/10`) appears. Text appears character-by-character with a typewriter effect (30ms per character), simulating streaming. The response includes a syntax-highlighted Python code block with a dark background (`#0d0d0f`), line numbers, and colored syntax (keywords in blue, strings in green, functions in yellow). A "Copy code" button appears in the top-right of the code block after typing completes.
6. (7.5–9s) Cursor clicks "Stop generation" → button disappears. Cursor hovers over the code block → a subtle border glow (`#d9ff00` at 0.3 opacity) appears. Cursor clicks the "Copy" button → a tooltip "Copied!" appears for 1s.
7. (9–10s) Cursor moves to the sidebar and clicks to open the conversation list. Loop.

**Key selectors to visualize:** `button[aria-label="New conversation"]`, `textarea[aria-label="Message"]`, `button[aria-label="Send message"]`, `button[aria-label="Stop generation"]`, message bubbles (user/AI), code block with syntax highlighting, sidebar collapse.

---

### 2.5 STORYBOARD STUDIO (`src/components/StoryboardStudio.js`)

**GIF Title:** "Storyboard Studio — Shot Planning Workflow"

**Workflow:**
1. (0–1.5s) Storyboard Studio loads. Hero banner "Storyboard Studio" fades in. Controls bar shows model selector (default: Flux), aspect ratio chips (default 16:9), style presets (Cinematic, Photoreal, Anime, etc.), lighting dropdown, color presets dropdown. Below, a large empty frame grid panel (`backdrop-blur-xl bg-[#111]/90`) is visible.
2. (1.5–3s) Cursor clicks into the `#vi-premise` textarea (labeled "Premise / Script Description"). Types "Scene 1: Wide establishing shot of a coastal lighthouse at golden hour. Scene 2: Close-up of the lighthouse keeper's weathered hands adjusting the lens. Scene 3: Overhead drone shot of waves crashing against the rocks below." with 80ms stagger.
3. (3–3.5s) Cursor clicks shot type preset chips in sequence: "Wide" → "Close-Up" → "Overhead". Each chip toggles with a 100ms scale animation. Three shot slots appear in the frame grid, each with the selected shot type labeled.
4. (3.5–5s) Cursor clicks "Generate All" button. The button enters a loading state. Three progress indicators appear under each shot slot, filling from 0→100% sequentially (staggered by 400ms each).
5. (5–7.5s) Shimmer skeletons appear in each frame slot for 600ms. Then three generated frames fade in sequentially (100ms stagger between each). Each frame shows: the coastal lighthouse scene, the keeper's hands, the drone wave shot. Each frame has a small badge with the shot type in the corner.
6. (7.5–9s) Cursor hovers over the first frame → frame border glows `#d9ff00`. Cursor clicks the frame → a detail modal opens showing the full-resolution frame, the generated prompt, and model info. The modal has a dark backdrop (`bg-black/60 backdrop-blur`) and slides up from the bottom with a 200ms transition.
7. (9–10s) Cursor clicks "Export Storyboard" button (appears at bottom of the grid). Export options modal shows: PDF, PNG Sequence, JSON. Loop.

**Key selectors to visualize:** `#vi-premise` textarea, shot type preset chips, model selector, aspect ratio chips, Generate All button, frame grid slots, progress indicators, frame detail modal, Export button.

---

### 2.6 EFFECTS STUDIO (`src/components/EffectsStudio.js`)

**GIF Title:** "Effects Studio — AI Visual Effect Application"

**Workflow:**
1. (0–1.5s) Effects Studio loads. Tab bar is visible: "Image Effects", "Nano Banana", "Kontext Effects", "AI Video Effects", "Motion Controls", "Video FX v2". The "Image Effects" tab is active (underlined in `#d9ff00`). Below, the prompt input (`#fx-prompt-input`) is visible, plus a model picker button ("AI Pick").
2. (1.5–2.5s) A sample image is already loaded in the comparison viewport (left side: original, right side: effect applied). Cursor clicks `#fx-prompt-input`. Types "glowing neon circuit board pattern, cyberpunk aesthetic, electric blue and purple highlights" with 80ms stagger.
3. (2.5–3s) Cursor clicks "AI Pick" button → model selector dropdown appears → cursor selects a model. Dropdown closes.
4. (3–3.5s) Cursor clicks "Advanced" toggle → panel slides down showing Guidance Scale (slider at 7.5), Steps (30), Seed (-1), Negative Prompt, Denoise Strength (slider at 0.8), Effect Strength (slider at 0.6). Cursor adjusts Effect Strength slider to 0.9 by dragging the handle.
5. (3.5–5s) Cursor clicks "Apply Effect" button (`button[aria-label="Apply effect"]`). Button enters loading state. A comparison viewport shows the original on the left with a "BEFORE" label and the effect-applied result on the right with an "AFTER" label. A vertical divider between them can be dragged (demonstrate a subtle 50px drag to the right to reveal more of the AFTER side).
6. (5–7s) The AFTER panel shows the neon circuit effect being applied in real-time: a shimmer animation plays on the image surface (like a glow being painted on). The effect builds from 0% to 100% opacity over 1.5s. The original panel stays static.
7. (7–8.5s) Comparison mode toggle appears at the top of the viewport. Cursor clicks "Side by Side" → the viewport transitions from split-screen to a swipeable comparison slider (drag handle appears in the center). Cursor drags the slider from left to right, revealing the effect progressively.
8. (8.5–10s) Download button for the result appears. Cursor hovers → button scales up. Loop.

**Key selectors to visualize:** tab bar (Image Effects active), `#fx-prompt-input`, "AI Pick" button, model selector dropdown, Advanced toggle, sliders (Guidance, Steps, Effect Strength), `button[aria-label="Apply effect"]`, comparison viewport (BEFORE/AFTER), comparison mode toggle, download button.

---

### 2.7 EDIT STUDIO (`src/components/EditStudio.js`)

**GIF Title:** "Edit Studio — AI-Powered Image Editing"

**Workflow:**
1. (0–1.5s) Edit Studio loads. A tool grid is displayed: 13 tool cards in a responsive grid layout: "Remove Object", "Remove Background", "Extend Image", "AI Edit", "Reframe", "Change Dress", "Enhance Skin", "Colorize", "Add Watermark", "Upscale", "Face Swap", "Product Shot", "Ghibli Style". Each card has an icon, name, and subtle border. "AI Edit" card is highlighted with a `#d9ff00` border glow.
2. (1.5–2s) Cursor hovers over "AI Edit" card → card lifts slightly (`translateY(-4px)`) and border glows. Cursor clicks it. The tool grid fades to opacity 0.3. The AI Edit workspace appears: upload area (dashed border, "Drop image or click to upload"), mask/garment upload inputs, prompt textarea (`textarea[aria-label="Edit prompt"]`).
3. (2–3s) Cursor clicks the upload area → simulated file picker → selects an image. The image thumbnail animates into the upload zone (scale 0→1, 300ms). A preview of the uploaded image appears below the upload area.
4. (3–3.5s) Cursor clicks into `textarea[aria-label="Edit prompt"]`. Types "Replace the red car in the background with a vintage bicycle" with 80ms stagger.
5. (3.5–4.5s) Cursor clicks the mask upload button → selects a mask image (showing the area to edit). The mask overlays the image preview with 50% opacity, showing the red car area highlighted.
6. (4.5–6s) Cursor clicks `button.btn-primary-modern` (Generate/Edit button). Button enters loading state with spinner. A progress bar appears below the image preview. "Editing... 45%" → "100%" over 1s.
7. (6–8s) Result fades in: the image now shows the vintage bicycle instead of the red car. A "Before/After" toggle appears. Cursor clicks "After" → the edited version is highlighted. Cursor clicks "Before" → original is shown. The toggle animates with a 200ms crossfade.
8. (8–10s) Download, Share, and "Edit Again" buttons appear. Cursor hovers Download → tooltip "Save as PNG" appears. Loop.

**Key selectors to visualize:** tool grid (13 tool cards), AI Edit card selection, upload area, image preview, `textarea[aria-label="Edit prompt"]`, mask upload, `button.btn-primary-modern`, progress bar, Before/After toggle, result display.

---

### 2.8 CINEMA TEMPLATE STUDIO (`src/components/CinemaTemplateStudio.js`)

**GIF Title:** "Cinema Template Studio — Template-to-Cinema Workflow"

**Workflow:**
1. (0–1.5s) Cinema Template Studio loads in "Browse" view. A template grid is displayed with filter chips at top: "Favorites", "Recent", "Custom". Templates show as cards with thumbnails, titles, and category badges. The "Create" view button is in the top-right.
2. (1.5–2.5s) Cursor clicks the "Create" button (top navigation). The view transitions: Browse grid slides out to the left, Create view slides in from the right with a 300ms slide transition.
3. (2.5–4s) Create view shows: template name input (pre-filled with "My Cinematic Short"), model selector, GTM Boost button, scene builder area. Cursor clicks into the prompt textarea. Types "A time-lapse of a blooming flower in a sunlit meadow, macro lens, shallow depth of field" with 80ms stagger.
4. (4–4.5s) Cursor clicks "Storyboard" button (top navigation). The view transitions to an embedded StoryboardStudio. Three shot slots appear. Cursor types a premise into `#vi-premise`: "Opening: Time-lapse flower bloom. Middle: Bee pollinating close-up. Closing: Sunset over meadow."
5. (4.5–6.5s) Cursor clicks "Generate All" in the storyboard. Three frames generate sequentially with staggered progress. Each frame fades in with the shot type label.
6. (6.5–7.5s) Cursor clicks "Preview" button (top navigation). The assembled cinematic output plays in a video preview player. The player shows the three storyboard frames as keyframes in a timeline scrubber. Cursor drags the scrubber playhead across the timeline.
7. (7.5–9s) Cursor clicks "Export" button. Export options modal appears: Export as Video, Export Storyboard PDF, Share Template. Cursor selects "Export as Video". A progress overlay shows rendering progress.
8. (9–10s) Download button appears. Loop.

**Key selectors to visualize:** view navigation tabs (Browse → Create → Storyboard → Preview), template grid, Create view form, embedded StoryboardStudio, `#vi-premise`, storyboard frame slots, video preview player with timeline scrubber, Export modal.

---

### 2.9 TEXT-TO-IMAGE LANDING PAGE (`src/components/TextToImagePage.js`)

**GIF Title:** "Text to Image — Landing Page to Generation"

**Workflow:**
1. (0–1.5s) Text-to-Image landing page loads. A hero section with large "Text to Image" heading and subtitle "Generate stunning images from text descriptions". Below, a grid of model cards (`.model-card`) is displayed: Flux, SDXL, Ideogram, DALL-E 3, Midjourney, Stable Diffusion. Each card has a thumbnail, model name, and a "Use This Model" button.
2. (1.5–2.5s) Cursor hovers over the "Flux" model card → card lifts and border glows `#d9ff00`. Cursor clicks "Use This Model" button. The page transitions: a smooth scroll or fade transition brings the Image Studio into view, pre-filled with the Flux model selected and a starter prompt "A serene mountain lake at dawn, mist rising from the water, pine trees reflected perfectly".
3. (2.5–4s) In the Image Studio view, the prompt is pre-filled. Cursor adjusts the aspect ratio to "3:2". Cursor clicks the Generate button.
4. (4–6s) Generation progress: shimmer skeleton → image result fades in. The image shows a mountain lake scene.
5. (6–7.5s) The Example Gallery at the bottom of the studio is visible. Cursor scrolls down smoothly (scroll animation 500ms). Gallery cards appear with hover effects.
6. (7.5–9s) Cursor clicks "Create This Style" on a gallery card → navigates back to Image Studio with the template prompt pre-filled. The prompt textarea animates the new text in (character-by-character, 40ms stagger).
7. (9–10s) Cursor clicks Generate again → progress bar fills. Loop.

**Key selectors to visualize:** model card grid, "Use This Model" buttons, page transition, pre-filled prompt, Image Studio form, Generate button, Example Gallery, "Create This Style" button.

---

### 2.10 DIRECTOR (`src/components/DirectorPage.js`)

**GIF Title:** "Director — AI Video Agent Command Center"

**Workflow:**
1. (0–1.5s) Director page loads. Top section shows 45 agent cards (`.agent-btn[data-agent]`) in a responsive grid, each with an icon, agent name (e.g., "Summarizer", "Clipper", "Dubbing", "B-Roll", "Voiceover"), and a category badge. Category filter bar at top: Analysis, Search, Extract, Translate, Accessibility, Enhance, Audio, Edit, Create, Social. "All" is active (highlighted in `#d9ff00`).
2. (1.5–2.5s) Cursor clicks the "B-Roll" category filter chip. Other categories dim (opacity 0.4). B-Roll agent cards remain at full opacity with a subtle scale-up (1.0→1.02). Cursor hovers over the "B-Roll Generator" agent card → card lifts, border glows `#d9ff00`. Cursor clicks it. The card gets a selected ring (`ring-2 ring-[#d9ff00]`).
3. (2.5–3.5s) The chat panel (`#chat-messages`) appears on the right side of the viewport (or below on mobile). It shows the selected agent's description and a welcome message. The command input (`#command-input`) at the bottom is empty with placeholder "Describe what you want to create...".
4. (3.5–5s) Cursor clicks `#command-input`. Types "Find 3 B-roll clips of ocean waves at sunset, 10 seconds each, cinematic quality" with 80ms stagger. The Send button (`#send-command-btn`) transitions from disabled to enabled (`#d9ff00` background).
5. (5–5.5s) Cursor clicks Send. The user's command appears as a message bubble in `#chat-messages`. A processing indicator (three animated dots, `animate-bounce` with 200ms stagger) appears below.
6. (5.5–7.5s) Agent response streams in: a list of 3 B-roll clips with thumbnails, titles, durations, and "Add to Timeline" buttons. Each thumbnail animates in with a 200ms stagger. A status badge shows "Processing • Job #4821 • ~30s".
7. (7.5–9s) Cursor clicks "Add to Timeline" on the first clip → a confirmation toast appears ("Added to Timeline") at the bottom-right, sliding up with a 200ms animation, then auto-dismissing after 2s.
8. (9–10s) Cursor clicks a different agent category (e.g., "Audio") → agent grid re-filters. Loop.

**Key selectors to visualize:** category filter chips, agent card grid, `#command-input`, `#send-command-btn`, `#chat-messages` panel, processing indicator, agent response with thumbnails, "Add to Timeline" buttons, toast notifications.

---

### 2.11 SMART VIDEO VIRAL (`src/components/SmartVideoViral.js`)

**GIF Title:** "Smart Video Viral — Prompt Discovery & Remix"

**Workflow:**
1. (0–1.5s) Smart Video Viral loads. A horizontal category rail is at the top with scroll-snap behavior: "All", "Animation", "Architecture", "Camera Moves", "Character", "Cinematic", "Food & Drink", etc. The "All" chip is active (`bg-[#d9ff00] text-black`). Below, a feed grid of `.smart-card` cards is displayed: each card has a thumbnail, category badge, title, and action icons (play, copy prompt, open in studio).
2. (1.5–2.5s) Cursor scrolls the category rail horizontally (scroll-snap animation 300ms). Stops on "Cinematic". Cards filter: non-cinematic cards fade out (opacity 0, 200ms), cinematic cards remain with a subtle scale pulse.
3. (2.5–4s) Cursor hovers over a cinematic card → border glows `#d9ff00`, shadow expands (`shadow-glow`). A bottom sheet starts to peek up from the bottom of the viewport (translateY from 100% to 60%, 300ms). The card thumbnail has a subtle zoom effect (scale 1→1.05 over 500ms).
4. (4–4.5s) Cursor clicks the card. The bottom sheet animates fully into view (translateY 60%→0%, 200ms). The sheet shows: large thumbnail/video preview, title, full prompt text, model badge, duration, author credit, source URL. A "Play" button and "Copy Prompt" button are visible.
5. (4.5–5.5s) Cursor clicks "Copy Prompt". A tooltip "Prompt copied to clipboard" appears at the cursor position for 1.5s. The bottom sheet's prompt text area briefly highlights (`bg-[#d9ff00]/10`).
6. (5.5–6.5s) Cursor clicks "Open in Studio" button. The bottom sheet animates out (translateY 0%→100%, 200ms). The page navigates to Video Studio with the prompt pre-filled. A toast "Opening Video Studio..." appears.
7. (6.5–8s) In Video Studio (brief transition), the prompt is visible in the textarea. Cursor adjusts aspect ratio to "21:9" (cinemascope). Cursor clicks Generate.
8. (8–9.5s) Progress bar fills. Result video thumbnail appears. Cursor hovers over the play button. Loop.

**Key selectors to visualize:** category rail with scroll-snap, `.smart-card` grid, card hover effects, bottom sheet (`.viral-modal-panel`), card detail view with prompt, "Copy Prompt" button, "Open in Studio" button, toast notifications.

---

### 2.12 DOM PERSONALIZATION STUDIO (`src/components/Personalizer.js`)

**GIF Title:** "DOM Personalization — Drag-and-Drop Page Builder"

**Workflow:**
1. (0–1.5s) DOM Personalization Studio loads. The viewport shows a free-form absolute-positioned canvas (white/light gray page preview area in the center). On the left, an element palette is visible: Text, Heading, Image, Button, Form, Video, Spacer, Container — each as a draggable chip/icon. On the right, a properties panel. At the top, canvas preset chips: "Blank", "Landing Page", "Email", "Social Post", "Story", "Banner". A contact switcher dropdown shows "Contact: John Doe".
2. (1.5–3s) Cursor drags a "Heading" element from the left palette onto the canvas (drag: 300ms, drop: element scales in at drop point with a 200ms bounce). The heading element appears with placeholder text "Your Headline Here". Cursor double-clicks the heading → it enters edit mode, text becomes editable. Types "Welcome, {{firstName}}!" with 80ms stagger. The `{{firstName}}` token is highlighted in `#d9ff00` with a subtle pulse animation.
3. (3–4s) Cursor drags an "Image" element below the heading. Drops it → image placeholder appears with a mountain icon. Cursor clicks the image element → properties panel on the right updates to show image URL input, alt text, width, height. Cursor pastes an image URL into the properties panel.
4. (4–4.5s) Cursor drags a "Button" element to the right of the image. Drops it → button appears with "Click Me" text. Cursor double-clicks → edits text to "Get Started". In properties panel, cursor sets href to `https://example.com/signup`.
5. (4.5–5.5s) Cursor opens the contact switcher dropdown at the top. Selects "Contact: Jane Smith". The canvas re-renders: the `{{firstName}}` token in the heading is replaced with "Jane" (200ms fade transition). The button URL remains the same.
6. (5.5–7s) Cursor opens canvas preset dropdown → selects "Landing Page". A pre-built layout animates in: hero section with background image, headline, subtext, CTA button, feature grid — each element animates in with a 100ms stagger (fade + slide up).
7. (7–8.5s) Cursor rearranges elements by dragging: moves the CTA button below the feature grid (400ms drag with smooth path). Elements re-flow naturally.
8. (8.5–10s) Cursor clicks "Preview" button (top-right). A preview modal opens showing the personalized page rendered in an iframe-like viewport. The page shows the live personalized content. Cursor clicks "Close Preview". Loop.

**Key selectors to visualize:** element palette (left), canvas area, drag-and-drop interactions, element selection, properties panel (right), contact switcher, canvas preset chips, token highlighting (`{{firstName}}`), preview modal.

---

### 2.13 LIP SYNC STUDIO (`src/components/LipSyncStudio.js`)

**GIF Title:** "Lip Sync Studio — Audio-Driven Lip Synchronization"

**Workflow:**
1. (0–1.5s) Lip Sync Studio loads. Mode toggle at top: "Portrait Image" (active) / "Video". Below, three upload zones in a row: Portrait upload (with Pexels browse button), Video upload, Audio upload. Model selector, resolution selector at the bottom.
2. (1.5–2.5s) Cursor clicks the Portrait upload zone → selects a portrait image. The thumbnail animates in (scale 0→1, 300ms) with a checkmark badge.
3. (2.5–3.5s) Cursor clicks the Video upload zone → selects a short source video. Video thumbnail with play button overlay appears.
4. (3.5–4.5s) Cursor clicks the Audio upload zone → selects an MP3 voice track. Audio waveform visualization appears (animated bars, 50ms per bar stagger).
5. (4.5–5.5s) Cursor clicks into the optional prompt textarea. Types "Subtle head movement, natural blinking, warm expression" with 80ms stagger.
6. (5.5–6.5s) Cursor selects model from dropdown ("Wav2Lip-HD"). Resolution → "1080p". Cursor clicks Generate button.
7. (6.5–9s) Generation progress: progress bar fills over 2s. Result video preview appears: a video showing the portrait with lip-synced audio. The video has a play button overlay and a "00:15" duration badge.
8. (9–10s) Download and Share buttons appear. Cursor hovers Download → tooltip. Loop.

**Key selectors to visualize:** mode toggle (Portrait Image/Video), three upload zones (portrait, video, audio), audio waveform visualization, prompt textarea, model selector, resolution selector, Generate button, progress bar, lip-synced video result.

---

### 2.14 INFLUENCER STUDIO (`src/components/InfluencerStudio.js`)

**GIF Title:** "Influencer Studio — AI Influencer Character Generation"

**Workflow:**
1. (0–1.5s) Influencer Studio loads. Three main tabs at top: "Face", "Body", "Style". The "Face" tab is active. Below, extensive sub-category pickers are displayed in a collapsible accordion: Character Type (dropdown), Gender (chips: Male, Female, Non-binary), Ethnicity (chips with small avatar thumbnails), Eye Color (color swatches), Mouth Shape (dropdown), Ear Style (dropdown), Skin Conditions (toggle chips: None, Freckles, Tattoos, Scars). Each picker section has a label and is wrapped in a `backdrop-blur-xl` panel.
2. (1.5–3s) Cursor clicks "Character Type" dropdown → selects "Young Adult". Gender chips: clicks "Female". Ethnicity: clicks "East Asian" chip (chip animates: bg `#d9ff00]/20`, border `#d9ff00`). Eye Color: clicks a brown swatch.
3. (3–4s) Cursor clicks "Body" tab. The view transitions (200ms crossfade). Body pickers appear: Body Type (dropdown: Slim, Athletic, Curvy, Plus-size), Height slider, Skin Tone swatches, Additional Features (horns, wings, tail toggle chips).
4. (4–4.5s) Cursor clicks "Style" tab. Style presets appear as a grid of visual thumbnails: "Realistic", "DigitalCam", "Quiet Luxury", "FashionShow", "90s Grain", "Neon Nights". Format presets below: "Instagram Post (1:1)", "Story/Reel (9:16)", "YouTube Thumb (16:9)", "Pinterest Pin (2:3)".
5. (4.5–5.5s) Cursor clicks "FashionShow" style preset → card lifts and glows. Format preset: clicks "Instagram Post (1:1)". Aspect ratio chip activates.
6. (5.5–6.5s) Cursor clicks into the prompt textarea (`textarea[aria-label="Influencer prompt"]`). Types "Fashion influencer at Paris Fashion Week, front row, elegant pose, designer outfit, studio lighting" with 80ms stagger.
7. (6.5–8s) Cursor clicks `button[aria-label="Generate content"]`. Button enters loading state with spinner. Progress bar fills over 1.5s. Result image fades in: a fashion influencer image at 1:1 aspect ratio, styled in the "FashionShow" preset.
8. (8–10s) Result has metadata badges: "Female • East Asian • FashionShow • 1:1". Download, Share, and "Remix Style" buttons appear. Cursor hovers "Remix Style" → button pulses. Loop.

**Key selectors to visualize:** Face/Body/Style tabs, Character Type dropdown, Gender/Ethnicity/Eye Color chips, Body Type pickers, Style preset grid, Format preset chips, `textarea[aria-label="Influencer prompt"]`, `button[aria-label="Generate content"]`, result with metadata badges.

---

### 2.15 TIMELINE EDITOR (`src/components/TimelineEditorPage.jsx`)

**GIF Title:** "Timeline Editor — Multi-Track Video Editing"

**Workflow:**
1. (0–1.5s) Timeline Editor loads. Hero banner at top. Below, a full NLE-style interface: media library panel on the left (grid of uploaded video clips with thumbnails), central preview viewport with a video player, and a multi-track timeline at the bottom. Timeline has tracks: Video 1, Video 2 (PIP), Audio 1, Subtitles. A toolbar above the timeline shows: cut, split, trim, keyframe, transition, PIP, split-screen, multi-camera icons.
2. (1.5–2.5s) Cursor drags a video clip from the media library (left panel) onto the "Video 1" track on the timeline. The clip thumbnail animates into the track (scale 0→1, 200ms). The timeline scrubber playhead moves to the clip's start position.
3. (2.5–3.5s) Cursor drags a second clip onto "Video 2" track (PIP track). The clip appears as a smaller thumbnail overlaid on Video 1 at the bottom-right of the preview viewport. Cursor adjusts the PIP size by dragging the corner handle (resize from 20% to 35% of viewport width, 300ms drag).
4. (3.5–4.5s) Cursor clicks the split-screen icon in the toolbar. The preview viewport transitions: left half shows Video 1, right half shows Video 2, with a draggable vertical divider. Cursor drags the divider from 50% to 70% (300ms).
5. (4.5–5.5s) Cursor clicks the transition icon → a transition picker dropdown appears (Fade, Dissolve, Wipe, Slide, Zoom). Cursor selects "Cross Dissolve". A 1-second transition indicator appears between the two clips on the timeline (a blue bar with "Cross Dissolve" label).
6. (5.5–6.5s) Cursor clicks the subtitle icon → Whisper subtitle bar appears at the bottom of the preview viewport with auto-generated captions timed to the video. Cursor edits a subtitle by double-clicking → text becomes editable.
7. (6.5–7.5s) Cursor drags the timeline scrubber across the full duration. The preview viewport updates in real-time showing the video playback, PIP overlay, and subtitles synced to the playhead position.
8. (7.5–9s) Cursor clicks "Export" button (top-right). Export modal appears: Format (MP4, MOV, WebM), Resolution (1080p, 4K), Quality (High, Medium). Cursor selects "MP4 • 1080p • High". Progress bar appears with estimated time.
9. (9–10s) "Export Complete!" success state. Download button appears. Loop.

**Key selectors to visualize:** media library panel, central preview viewport, multi-track timeline (Video 1, Video 2/PIP, Audio, Subtitles), toolbar icons (cut, split, trim, keyframe, transition, PIP), drag-and-drop clips onto tracks, PIP resize handle, split-screen divider, transition picker, subtitle bar, timeline scrubber, Export modal.

---

### 2.16 SMART VIDEO ACADEMY (`src/components/academy/AcademyPage.jsx`)

**GIF Title:** "Smart Video Academy — Guided Learning Path"

**Workflow:**
1. (0–1.5s) Academy page loads. A sidebar shows lesson modules organized in a tree: Module 1: Getting Started (3 lessons), Module 2: Prompt Engineering (5 lessons), Module 3: Advanced Techniques (4 lessons). Each lesson has a completion indicator (checkmark for completed, circle for incomplete). The main content area shows the current lesson: title, video player placeholder, lesson description, and a "Next Lesson" button.
2. (1.5–3s) Cursor clicks on "Module 2: Prompt Engineering" in the sidebar to expand it (accordion opens with 200ms slide). Five lessons appear: "Writing Effective Prompts", "Negative Prompting", "Style Reference", "Seed Control", "Batch Generation". Cursor clicks "Writing Effective Prompts" lesson. The main content area crossfades (300ms) to show the new lesson content.
3. (3–4s) The lesson content shows: a video player with a lesson thumbnail, text content explaining prompt structure, an interactive prompt builder exercise. Cursor clicks into the exercise prompt textarea. Types "A photorealistic portrait of an elderly carpenter in his workshop, surrounded by wood shavings and tools, warm window light, shallow depth of field, shot on 85mm f/1.4" with 80ms stagger.
4. (4–5s) Cursor clicks "Submit Exercise" button. The exercise panel shows a "Checking..." state (spinner for 1s), then a success state: "Great prompt! You included: subject, setting, lighting, lens specs. Score: 9/10" with a green checkmark and a breakdown of prompt elements highlighted in different colors.
5. (5–6s) Cursor clicks "Next Lesson" button. Content crossfades to the next lesson. The sidebar updates: the current lesson gets a checkmark.
6. (6–7s) Cursor clicks the progress tracker at the top of the sidebar (a circular progress indicator: 2/12 lessons completed, 17%). The tracker expands to show a detailed breakdown.
7. (7–8s) Cursor clicks a "Continue Learning" CTA button at the bottom of the main content. Navigates to the Image Studio with the lesson's recommended prompt pre-filled.
8. (8–10s) In Image Studio, the Generate button pulses gently. Loop.

**Key selectors to visualize:** lesson sidebar (tree structure), module accordion, lesson list with completion indicators, main content area with video player, exercise prompt textarea, "Submit Exercise" button, success state with score breakdown, progress tracker, "Next Lesson" button, navigation to Image Studio.

---

### 2.17 PEXELS MEDIA BROWSER (`src/components/PexelsBrowser.js`)

**GIF Title:** "Pexels Browser — Stock Media Search & Selection"

**Workflow:**
1. (0–1.5s) The Pexels Browser overlay opens as a full-screen modal (`[data-pexels-browser]`). A dark backdrop (`bg-black/60 backdrop-blur`) covers the app behind. The modal has a header: "Stock Media" title, tabs (Search, Curated, Popular, Collections, My Collections), a search input, and filter dropdowns (Type: All/Photo/Video, Orientation, Size, Color). The "Search" tab is active.
2. (1.5–2.5s) Cursor clicks the search input. Types "ocean sunset waves" with 80ms stagger. Presses Enter. A shimmer loading state appears in the media grid for 800ms.
3. (2.5–4s) Media grid populates with image thumbnails (4-column grid). Each thumbnail has a hover overlay with a "+ Select" button. Cursor hovers over the first image → overlay fades in (opacity 0→1, 200ms), showing image title, photographer credit, and a circular "Select" button. Cursor clicks "Select".
4. (4–4.5s) The selected image gets a `#d9ff00` border and a checkmark badge in the top-right corner. A selection counter at the bottom of the modal shows "1 selected". A "Use Selected" button appears.
5. (4.5–5.5s) Cursor clicks the "Popular" tab. The grid crossfades (300ms) to show popular media. Cursor clicks a video thumbnail → video preview with a play button overlay appears in a detail panel on the right side of the modal (or a lightbox).
6. (5.5–6.5s) Cursor clicks "Collections" tab. Shows user's saved collections or creates a new one. Cursor clicks "New Collection" → a small inline form appears: collection name input. Types "Ocean Footage" → clicks "Create". Collection card animates in.
7. (6.5–7.5s) Cursor clicks "Use Selected" button. The Pexels Browser modal animates out (opacity 1→0, 200ms, backdrop blur fades). The selected image is now in the Image Studio's upload zone as a thumbnail.
8. (7.5–9s) In Image Studio, the uploaded image is visible in the upload area. Cursor adjusts the prompt to incorporate the selected image context. Cursor clicks Generate.
9. (9–10s) Generation starts. Loop.

**Key selectors to visualize:** full-screen modal overlay, tab bar, search input, filter dropdowns, media grid, hover overlays with Select button, selected state (border + checkmark), selection counter, "Use Selected" button, detail panel/lightbox, Collections tab, "New Collection" form, modal close animation.

---

### 2.18 VIDEO AGENT / OPENMONTAGE (`src/components/OpenMontagePage.js`)

**GIF Title:** "Video Agent — End-to-End Automated Video Production"

**Workflow:**
1. (0–1.5s) Video Agent loads. A vertical stage tracker is displayed on the left side: 9 stages in a timeline-like layout — "Brief", "Research", "Script", "Scene Plan", "The Gate", "Narration", "Music", "Compose", "Render". The "Brief" stage is active (highlighted in `#d9ff00`, connected by a vertical line to the next stages). On the right, a brief card shows: prompt textarea, audience dropdown, duration input, key messages textarea, "Generate Video" button. Below, pipeline selector chips: "Animated Explainer", "Documentary Montage", "Cinematic", "Animation", "Avatar Spokesperson", "Hybrid", "Localization/Dub", "Podcast Repurpose", "Screen Demo", "Talking Head". Output profile selector: "YouTube Landscape", "Shorts", "Instagram Reels", "TikTok", "Cinematic".
2. (1.5–3s) Cursor clicks the prompt textarea in the Brief card. Types "A 2-minute explainer video about how solar panels work, targeting homeowners, key message: save money and help the environment" with 80ms stagger. Cursor fills Audience dropdown → "Homeowners, 30–55". Duration → "2 min". Key Messages → "Cost savings, environmental impact, easy installation".
3. (3–3.5s) Cursor clicks "Animated Explainer" pipeline chip → chip activates with `#d9ff00` border. Output profile → "YouTube Landscape (16:9)".
4. (3.5–4.5s) Cursor clicks "Generate Video" button. Button enters loading state. The stage tracker begins to animate: "Brief" stage gets a green checkmark. "Research" stage starts pulsing (animated indicator). A timeline progress bar at the bottom shows "Stage 2/9 • Research • ~15s".
5. (4.5–7.5s) Each stage completes sequentially with a 700ms stagger:
   - Research: checkmark appears, script generation indicator
   - Script: checkmark, scene plan indicator
   - Scene Plan: checkmark, The Gate (decision log with confidence scores animates in: "Script quality: 92% • Scene pacing: 88%")
   - The Gate: "Approved ✓" badge appears, Narration indicator
   - Narration: voiceover waveform animates in
   - Music: background music track appears
   - Compose: scenes assemble into a timeline preview
   - Render: final video renders with progress bar
6. (7.5–9s) "Render Complete!" success state. The stage tracker shows all 9 stages with green checkmarks. A video preview appears in the Compose stage panel showing the final animated explainer. Download and Share buttons appear.
7. (9–10s) Cursor hovers over the video preview → play button appears. Loop.

**Key selectors to visualize:** stage tracker (9 stages), Brief card with form fields, pipeline selector chips, output profile selector, "Generate Video" button, stage progress animation, confidence scores at The Gate, narration waveform, music track, compose timeline, final video preview, download/share buttons.

---

### 2.19 ASSIST (`src/components/AssistPage.js`)

**GIF Title:** "Assist — AI Assistant Panel"

**Workflow:**
1. (0–1.5s) Assist page loads. A floating assistant panel is anchored to the bottom-right of the viewport (or as a side panel). The panel has a header: "Assist" title, minimize/close buttons. The main area shows a welcome message: "Hi, I'm your AI assistant. How can I help you today?" with suggested action chips: "Generate an image", "Edit a video", "Write a script", "Analyze content".
2. (1.5–2.5s) Cursor clicks "Generate an image" chip. The chip animates (scale 1→0.95→1, 200ms). The assistant panel expands slightly (height increases by 30%, 300ms). A follow-up message appears: "Sure! What would you like to create? Describe your image idea."
3. (2.5–4s) Cursor types into the chat input: "A cozy coffee shop interior with rain on the windows, warm lighting, bookshelves" with 80ms stagger. Cursor clicks Send. The user's message appears as a right-aligned bubble.
4. (4–5.5s) AI response streams in: "I'll generate that for you in Image Studio. Setting up..." A loading indicator appears (three dots). Then: "Your image is being generated. Here's a preview of your prompt: [prompt text]". A "Open in Image Studio" button appears in the response.
5. (5.5–6.5s) Cursor clicks "Open in Image Studio". The Assist panel minimizes (200ms slide down). The app navigates to Image Studio with the prompt pre-filled.
6. (6.5–8s) In Image Studio, the Generate button is visible. Cursor hovers over it → tooltip "Generate your image". Cursor clicks Generate.
7. (8–9.5s) Progress bar fills. Result image fades in. The Assist panel (minimized) shows a notification badge "1" → cursor clicks to expand → shows "Your image is ready!" message.
8. (9.5–10s) Cursor clicks a suggested follow-up in Assist: "Add more details" → panel expands with enhanced prompt suggestion. Loop.

**Key selectors to visualize:** floating assist panel, welcome message with suggestion chips, chat input, message bubbles, "Open in Image Studio" button, panel minimize/expand animation, notification badge, Image Studio navigation.

---

### 2.20 APPS HUB (`src/components/AppsHub.js`)

**GIF Title:** "Apps Hub — Central Navigation Dashboard"

**Workflow:**
1. (0–1.5s) Apps Hub loads. Search input at top ("Search tools, templates, studios..."). Below, "Recently Used" row with app icons (Image Studio, Video Studio, Cinema Studio, Chat Studio, Director). Below that, sections: "Core Studios" (Image, Video, Cinema, Edit, Storyboard), "Tools & Editors" (Upscale, Character, Commercial, Viral, Effects), "AI Apps" (Audio, Avatar, Training, Video Tools, Chat, Lip Sync, Render). Each section has a "View All" link. Cards show thumbnail hero, icon, name, description, and badges (e.g., "Pro", "New").
2. (1.5–2.5s) Cursor types "video" into the search input. The app grid filters in real-time (200ms fade): non-matching cards fade out, matching cards (Video Studio, Text to Video, Image to Video, Video to Video, Video Watermark, Video Tools, Render, Director) remain highlighted with a subtle `#d9ff00` border glow.
3. (2.5–3.5s) Cursor clears the search (select all + delete). All cards fade back in. Cursor hovers over "Video Studio" card → card lifts (`translateY(-8px)`), shadow expands, a "Open" button appears on the card.
4. (3.5–4s) Cursor clicks "Video Studio" card. The Apps Hub transitions out (opacity 1→0, 300ms). Video Studio fades in (opacity 0→1, 300ms).
5. (4–5s) In Video Studio, the interface is ready. Cursor types a prompt and selects a model.
6. (5–7s) Cursor clicks Generate. Progress bar fills. Result video appears.
7. (7–8s) Cursor clicks the back button (`[data-studio-back]`) → returns to Apps Hub. The Apps Hub shows "Video Studio" in the Recently Used row at the top (newly added with a 300ms slide-in animation).
8. (8–10s) Cursor clicks "Cinema Studio" card → navigates to Cinema Studio. Loop.

**Key selectors to visualize:** search input, Recently Used row, app sections with cards, card hover effects (lift + shadow), filter animation, navigation transition to Video Studio, back button, Recently Used update animation.

---

### 2.21 DIRECTOR PAGE (Alternative Agent-Centric View)

**GIF Title:** "Director — Multi-Agent Video Production Pipeline"

*(Note: This is a higher-level view of the Director, distinct from the Chat-focused prompt in 2.10)*

**Workflow:**
1. (0–1.5s) Director page loads with a production pipeline view. A horizontal pipeline bar shows stages: "Input" → "Analysis" → "Search" → "Extract" → "Translate" → "Edit" → "Create" → "Output". Each stage has a node with an icon and label. The pipeline is currently empty (no active job). Below, an asset upload area and a command input bar.
2. (1.5–3s) Cursor drags a video file onto the upload area (or clicks the upload button). A progress bar shows the upload completing (0→100%, 1s). The uploaded video thumbnail appears in the asset panel.
3. (3–4s) Cursor clicks the "Summarizer" agent node on the pipeline. A configuration panel slides out from the right: agent name, description, input/output specs, parameters (summary length, tone). Cursor sets summary length to "30 seconds", tone to "Professional".
4. (4–5s) Cursor clicks "Add to Pipeline" button. The Summarizer node connects to the Input node with an animated SVG path (dash-offset animation, 500ms). The pipeline is now: Input → Summarizer → [next stages dimmed].
5. (5–5.5s) Cursor clicks "Clipper" agent → adds to pipeline after Summarizer. Connection path animates in. Then adds "Subtitler" → connects after Clipper. The pipeline now shows: Input → Summarizer → Clipper → Subtitler → Output.
6. (5.5–7s) Cursor clicks "Run Pipeline" button (top-right, `#d9ff00`). Each stage begins processing sequentially: Summarizer node pulses blue (processing), then green (complete) with a checkmark. Clipper processes next (clip thumbnails appear), then Subtitler (subtitle preview appears). A job status bar at the bottom shows: "Job #5032 • Processing... 60%".
7. (7–8.5s) All stages complete. The Output node shows a video preview. Cursor clicks the Output node → a detail panel shows the final video with options: Download, Share, Send to Timeline.
8. (8.5–10s) Cursor clicks "Send to Timeline" → a toast confirms "Sent to Timeline Editor". The Director pipeline resets (nodes fade out). Loop.

**Key selectors to visualize:** pipeline bar with agent nodes, SVG connection paths, asset upload area, agent configuration panel, "Add to Pipeline" button, "Run Pipeline" button, processing indicators per stage, job status bar, Output node with video preview, "Send to Timeline" button.

---

### 2.22 OPENMONTAGE / VIDEO AGENT STAGE TRACKER

**GIF Title:** "OpenMontage — Multi-Stage Agentic Video Pipeline"

*(Detailed alternate view focusing on the stage tracker and gate decision workflow)*

**Workflow:**
1. (0–1.5s) OpenMontage loads. The stage tracker is a prominent vertical or horizontal stepper: Brief → Research → Script → Scene Plan → The Gate → Narration → Music → Compose → Render. The "Brief" stage is active with a form on the right. Pipeline selector chips and output profile selector are visible.
2. (1.5–3s) Cursor fills the Brief form: prompt, audience, duration, key messages. Cursor clicks "Generate Video". The stage tracker activates: Brief stage completes with a checkmark. Research stage begins with a loading spinner.
3. (3–5s) Research completes → Script stage begins. A generated script appears in a text panel with character-by-character typewriter effect. Scene Plan stage begins → a visual storyboard grid appears with 4 scene thumbnails.
4. (5–6s) "The Gate" stage activates. A decision log panel appears showing: "Script Quality Score: 94/100", "Scene Pacing: 91/100", "Visual Consistency: 88/100", "Recommendation: Proceed ✓". Cursor clicks "Approve & Continue".
5. (6–7.5s) Narration stage: a voice waveform animates in. Music stage: background music track is selected from a library. Compose stage: scenes assemble into a timeline. Render stage: final video renders with a progress counter.
6. (7.5–9s) "Render Complete!" All stages show green checkmarks. A final video player appears. Cursor clicks Play → video plays.
7. (9–10s) Download and Share options appear. Cursor clicks Share → share modal opens with platform options. Loop.

**Key selectors to visualize:** stage tracker stepper, Brief form, pipeline/output selectors, script text panel, storyboard grid, The Gate decision log with scores, narration waveform, music track selector, compose timeline, render progress, final video player.

---

### 2.23 REMAINING STUDIOS — QUICK-REFERENCE PROMPTS

For studios not detailed above, use the following condensed prompts. Each follows the same 4-phase structure (Identify → Interact → Generate → Complete) with studio-specific UI elements:

---

#### 2.23.1 TEMPLATE STUDIO (`src/components/TemplateStudio.js`)

**GIF Title:** "Template Studio — Template-Driven Content Creation"

**Workflow:**
1. Load Template Studio with hero thumbnail, template name, description. Tabs: Enhanced Prompt, Negative Prompt, Advanced.
2. Cursor clicks "Enhanced Prompt" tab → fills the primary prompt textarea with template-driven content. Selects model from dropdown. Sets aspect ratio and duration chips.
3. Cursor clicks "Advanced" tab → fills negative prompt. Toggles GTM Boost. Cursor clicks Generate button.
4. Progress bar fills. Result image/video fades in. History sidebar slides in. Cursor clicks "Retry" → generates again with slight variation.

**Key selectors:** template hero, tab bar, prompt textarea, model selector, aspect ratio/duration chips, GTM Boost button, `button[aria-label="Generate image"]`, result panel, history sidebar, Retry button.

---

#### 2.23.2 AUDIO STUDIO (`src/components/AudioStudio.js`)

**GIF Title:** "Audio Studio — Text-to-Speech Generation"

**Workflow:**
1. Audio Studio loads. Script textarea at top. Voice selector dropdown below. Audio file upload zone with progress bar at bottom. Generate button.
2. Cursor types a script into the textarea: "Welcome to our podcast. Today we're discussing the future of AI in creative industries." Opens voice selector → selects "Nova (Female, US English)". Cursor clicks audio file upload → selects an MP3.
3. Upload progress bar animates (0→100%, 1s with "Uploading... 45%" label). Cursor clicks Generate button.
4. Progress bar fills. Audio player appears with waveform visualization, play/pause button, time scrubber (00:00 / 00:12). Cursor clicks Play → waveform animates, scrubber moves.

**Key selectors:** script textarea, voice selector dropdown, audio upload zone, upload progress bar, Generate button, audio player with waveform, play/pause button, time scrubber.

---

#### 2.23.3 AVATAR STUDIO (`src/components/AvatarStudio.js`)

**GIF Title:** "Avatar Studio — AI Talking Avatar Generation"

**Workflow:**
1. Avatar Studio loads. Model selector, source video/image upload, audio upload, prompt textarea, Generate button.
2. Cursor selects an avatar model. Uploads a source video of a person speaking. Uploads an audio file (voiceover). Types a prompt: "Make the avatar gesture naturally while speaking".
3. Cursor clicks Generate. Progress overlay with avatar silhouette animation. Result video preview appears with talking avatar.

**Key selectors:** model selector, source video upload, audio upload, prompt textarea, `button[aria-label="Generate avatar"]`, progress overlay, avatar silhouette animation, result video.

---

#### 2.23.4 TRAINING STUDIO (`src/components/TrainingStudio.js`)

**GIF Title:** "Training Studio — LoRA Model Training"

**Workflow:**
1. Training Studio loads. Model selector, LoRA name input, trigger word input, epochs input, image upload zone (training dataset), Train button (`button[aria-label="Train LoRA"]`), progress indicator.
2. Cursor selects a base model (e.g., "Flux Dev"). Fills LoRA name: "my-custom-style". Trigger word: "xyzstyle". Epochs: "10". Cursor uploads 8–12 training images (drag-drop or click).
3. Thumbnails appear in a grid with remove buttons. Cursor clicks Train button. Button enters loading state with spinner.
4. Training progress: a circular progress indicator or step progress bar shows Epoch 1/10 → 10/10. Each epoch takes ~2s (accelerated for demo). Log output appears: "Epoch 1/10 — Loss: 0.342", etc.
5. "Training Complete!" success badge. Download LoRA button appears. Cursor clicks Download → file saves simulation.

**Key selectors:** model selector, LoRA name input, trigger word input, epochs input, training image upload grid, `button[aria-label="Train LoRA"]`, training progress indicator, epoch log output, success badge, Download LoRA button.

---

#### 2.23.5 VIDEO TOOLS STUDIO (`src/components/VideoToolsStudio.js`)

**GIF Title:** "Video Tools Studio — Video Processing Suite"

**Workflow:**
1. Video Tools Studio loads. Model selector (Upscale 4x, Video Enhance, Translate, Remove Background, etc.), source video upload, optional prompt textarea, Process button.
2. Cursor selects "Upscale 4x" model. Uploads a video. Cursor clicks Process button. Progress bar fills. Result video preview appears with a "4x" badge.

**Key selectors:** model selector, source video upload, prompt textarea, Process button, progress bar, result video with quality badge.

---

#### 2.23.6 UPSCALE STUDIO (`src/components/UpscaleStudio.js`)

**GIF Title:** "Upscale Studio — AI Image Upscaling"

**Workflow:**
1. Upscale Studio loads. Method selector: "AI Upscaler", "Topaz Upscale", "Seed Upscale" (as chips or tabs). Factor buttons: 2x, 4x. Image upload + Pexels browse.
2. Cursor selects "AI Upscaler" method. Clicks "4x" factor button (button glows `#d9ff00`). Uploads an image. Cursor clicks Upscale button.
3. Progress bar: "Upscaling... 100%". Result fades in: side-by-side comparison (original on left, upscaled on right). A zoom loupe shows detail comparison on hover.

**Key selectors:** method selector chips, factor buttons (2x/4x), image upload, Upscale button, progress bar, side-by-side comparison viewport, zoom loupe.

---

#### 2.23.7 CHARACTER STUDIO (`src/components/CharacterStudio.js`)

**GIF Title:** "Character Studio — Consistent Character Generation"

**Workflow:**
1. Character Studio loads. Model selector: "Flux PuLID", "Subject Reference". Reference image upload. Prompt input (`#character-prompt-input`). Generate button.
2. Cursor selects "Flux PuLID" model. Uploads a reference image of a person. Types in `#character-prompt-input`: "Same character, wearing a detective trench coat, standing in a rainy noir city street at night, cigarette smoke".
3. Cursor clicks Generate. Progress bar fills. Result image shows the same character in the new scene with consistent facial features.

**Key selectors:** model selector (Flux PuLID / Subject Reference), reference image upload, `#character-prompt-input`, Generate button, progress bar, consistent character result.

---

#### 2.23.8 COMMERCIAL STUDIO (`src/components/CommercialStudio.js`)

**GIF Title:** "Commercial Studio — Product Photography Generation"

**Workflow:**
1. Commercial Studio loads. Model selector (Product Shot, Product Photography). Scene presets (Studio white, Luxury marble, Outdoor natural, Lifestyle kitchen, Neon tech, etc.) as visual thumbnail chips. Format presets (Ad Banner 16:9, Social Post 1:1, Story 9:16, Billboard 21:9). Product media upload + Pexels browse. Prompt textarea. Generate button.
2. Cursor selects "Product Shot" model. Clicks "Luxury marble" scene preset (chip animates). Clicks "Social Post (1:1)" format. Uploads a product image (e.g., a perfume bottle). Types prompt: "Professional product photography, studio lighting, luxury marble background, dramatic shadows".
3. Cursor clicks Generate. Progress bar fills. Result image: product on marble background, 1:1 aspect ratio, professional commercial quality. Format badge "1:1 • Social Post" appears.

**Key selectors:** model selector, scene preset chips, format preset chips, product media upload, prompt textarea, Generate button, progress bar, commercial product result.

---

#### 2.23.9 TEXT-TO-VIDEO / IMAGE-TO-VIDEO / VIDEO-TO-VIDEO LANDING PAGES

**GIF Title:** "Text to Video — Landing to Video Studio"

**Workflow:**
1. Landing page loads with model cards grid. Cursor hovers over a model card → clicks "Use This Model". Navigates to Video Studio with model pre-selected and starter prompt.
2. In Video Studio: prompt is pre-filled. Cursor adjusts duration to "10s". Clicks Generate. Progress fills. Video result appears.

**Key selectors:** model cards, "Use This Model" buttons, page transition, pre-filled prompt, Video Studio form, Generate button, video result.

---

#### 2.23.10 SMART VIDEO ACADEMY (Detailed)

*(Already covered in 2.16 with full detail)*

---

#### 2.23.11 RENDER PAGE (`src/components/RenderPage.js`)

**GIF Title:** "Video Render — Post-Production Render Pipeline"

**Workflow:**
1. Render Page loads. Asset picker grid (videos from library). Action tiles: Create Shorts, Generate Highlights, Add Subtitles, Dub/Voiceover, Trailer Cut, Social Resize. Preview area with video player and stats. Quick actions bar at bottom. Repository endpoints row (Open Higgsfield, SmartVideo, Director, etc.).
2. Cursor selects a source video from the asset picker (click → video loads in preview). Cursor clicks "Create Shorts" action tile. A configuration panel appears: duration (15s, 30s, 60s), aspect ratio (9:16 for Shorts), start point scrubber.
3. Cursor sets duration to "30s", aspect ratio to "9:16". Clicks "Render" button. Progress bar fills with estimated time. "Rendering... 45%" → "100%". Result: a vertical short-form video preview appears.

**Key selectors:** asset picker grid, action tiles, video preview player, stats display, configuration panel, duration/aspect ratio selectors, start point scrubber, Render button, progress bar, short-form video result.

---

#### 2.23.12 AI VFX (`src/components/AIVFXPage.js`)

**GIF Title:** "AI VFX — Embedded VFX Application"

**Workflow:**
1. AI VFX page loads. A header with title and description. Below, an iframe (`/ai-vfx/`) loads the external Next.js VFX app. The iframe shows the VFX application interface with its own UI.
2. Cursor interacts within the iframe: selects an effect from a sidebar, uploads media, applies the effect. (Note: since this is an iframe, show the outer wrapper and simulate the inner interactions.)
3. The VFX result is visible within the iframe viewport.

**Key selectors:** page header, iframe container, VFX app UI within iframe, effect sidebar, media upload, result preview.

---

#### 2.23.13 OPENTHORN (`src/components/OpenThornStudio.js`)

**GIF Title:** "OpenThorn — AI Website Builder"

**Workflow:**
1. OpenThorn loads. A header with "OpenThorn" branding, GitHub link, and a brief description "AI-powered website builder". Below, an iframe (`/openthorn/`) loads the external app. The iframe shows a website builder interface: a prompt input, generated website preview, and editing tools.
2. Cursor types a prompt into the iframe's input: "Create a landing page for a coffee brand with warm colors, product showcase, and contact form". Clicks "Generate".
3. The website preview animates in: a complete landing page with header, hero section, product grid, contact form. Cursor clicks "Deploy" → Cloudflare deploy simulation.

**Key selectors:** OpenThorn header, GitHub link, iframe container, prompt input within iframe, website preview, editing tools, Deploy button.

---

#### 2.23.14 COMMUNITY / LIBRARY / CONTENT-LIBRARY / EXPLORE PAGES

**GIF Title:** "Community — User Content Hub"

**Workflow:**
1. Community page loads. A feed grid of user-generated content cards. Each card shows a thumbnail, author avatar, title, like/comment/share counts. Filter/sort bar at top. Search input.
2. Cursor scrolls through the feed (smooth scroll animation). Cursor hovers over a card → card lifts, action icons appear (like, save, share, open in studio). Cursor clicks "Open in Studio" → navigates to the appropriate studio with the content loaded.

**Key selectors:** content feed grid, filter/sort bar, search input, user content cards, hover action icons, "Open in Studio" button.

---

#### 2.23.15 CHARACTER PAGE / EFFECTS PAGE / STORYBOARD PAGE / INFLUENCER PAGE / COMMERCIAL PAGE / UPSCALE PAGE / CINEMA PAGE

These are landing pages for their respective studios. Follow the Text-to-Image landing page pattern (Section 2.9): hero section with description, model cards grid, "Open Studio" or "Use This Model" buttons that navigate to the actual studio with pre-filled context.

---

#### 2.23.16 PRODUCT PHOTO STUDIO / FASHION STUDIO (`src/components/studios/`)

**GIF Title:** "Product Photo Studio — AI Product Photography"

**Workflow:**
1. Placeholder card loads (`.rounded-2xl.border.border-white/10.bg-white/[0.03]`). Shows "Coming Soon" or a demo mode. Cursor interacts with the placeholder: clicks "Try Demo" → a simulated product photography generation runs in a modal.
2. Modal shows: product upload, scene selector, model selector. Cursor uploads a product image, selects a scene, clicks Generate. Result image fades in.

**Key selectors:** placeholder card, "Try Demo" button, demo modal, product upload, scene selector, Generate button, result image.

---

## 3. TECHNICAL PRODUCTION SPECIFICATIONS

### 3.1 Cursor Behavior
- **Entry/Exit:** Cursor enters from outside the viewport (left edge for left-side elements, top edge for top-bar elements). Entry uses a smooth ease-out curve. Exit mirrors entry.
- **Movement Between Elements:** Use quadratic bezier curves for natural mouse paths. Add a 50–100ms pause at each target before clicking (simulates human reaction time). Do not use straight-line or teleportation-style movement.
- **Click Feedback:** On every click, show a 150ms ripple/pulse animation on the target element (border-color transition, subtle scale pulse).
- **Hover States:** Cursor hovers for 200–400ms before clicking on interactive elements. Hover should trigger the element's CSS hover state (border glow, background shift, scale transform).

### 3.2 Typography Animation
- **Typing Effect:** Characters appear with 80ms stagger for body text, 40ms stagger for code blocks. Each character triggers a subtle caret blink (300ms on, 300ms off).
- **Text Reveal:** For pre-filled or generated text (e.g., generated script, prompt suggestions), use a typewriter effect with 30–50ms per character.
- **Placeholder Text:** Placeholder text in empty inputs should fade in over 300ms on page load.

### 3.3 UI State Transitions
- **Dropdown Open/Close:** 200ms cubic-bezier(0.4, 0, 0.2, 1). Dropdown slides down from the trigger element.
- **Panel Slide:** 200–300ms ease-out. Panels (advanced controls, properties panel) slide down from their trigger toggle.
- **Modal Fade:** 200ms fade-in for backdrop + modal content. Modal content scales from 0.95 to 1.00 over 200ms.
- **Tab Transition:** 200ms crossfade between tab content. Active tab indicator (underline) slides with 200ms transition.
- **Card Hover:** 150ms ease-out. Card lifts (`translateY(-4px)`), shadow expands, border glows `#d9ff00`.
- **Button State:** 200ms transition for all button states (default → hover → loading → success). Loading spinner uses CSS `animate-spin` (800ms per rotation).

### 3.4 Progress & Loading States
- **Progress Bar:** 2px height, `#d9ff00` fill, smooth linear animation from 0% to 100%. Label above shows percentage (e.g., "Generating... 45%").
- **Shimmer Skeleton:** CSS gradient animation (`@keyframes shimmer: background-position 0%→200% over 1.5s infinite`). Light gray (`#1a1a1c`) to slightly lighter (`#222`) gradient. Used before content loads.
- **Spinner:** CSS-only spinner (border-based, 800ms rotation, `border-color: #d9ff00 transparent transparent transparent`).
- **Cancel Button:** Appears as a sibling to the loading Generate button with a 200ms fade-in. Text in `#ef4444`. On click, generation aborts (simulated: progress resets, button returns to default state).

### 3.5 Code & Content Display
- **Code Blocks:** Dark background (`#0d0d0f`), JetBrains Mono or Fira Code at 13px, syntax highlighting:
  - Keywords: `#c084fc` (purple)
  - Strings: `#86efac` (green)
  - Functions: `#fde047` (yellow)
  - Comments: `#6b7280` (gray)
  - Numbers: `#f97316` (orange)
- **Prompt Text:** White (`#ffffff`) on dark background (`#111`).
- **Generated Content:** Appears with a typewriter effect. Each line animates in with 100ms stagger.

### 3.6 Responsive Behavior
- **Desktop (≥1024px):** Sidebar is 68px icon rail with labels. Drawer slides from left. Main content is centered with max-width constraints.
- **Tablet (768–1023px):** Sidebar collapses to icons-only. Drawer is full-width overlay.
- **Mobile (<768px):** Hamburger menu button triggers full-screen sidebar overlay. Content stacks vertically. Prompt bar is full-width.
- **GIF should be rendered at desktop viewport (1280×720 or 1920×1080) to showcase the full interface.**

### 3.7 GIF Quality & Compression
- **Source FPS:** 60fps for smooth animation rendering.
- **Output FPS:** 30fps (every other frame from source).
- **Color Depth:** 256 colors maximum for GIF (use dithering where necessary, Floyd-Steinberg for gradients).
- **Optimization:** Use `gifsicle` or equivalent for optimization: `--lossy=80 --colors 256 --resize 1280x720`.
- **File Size Target:** < 15MB per GIF for web delivery. If larger, reduce to 24fps or 800×450.
- **Loop:** Seamless loop (last frame matches first frame).

### 3.8 Accessibility & Clarity
- **Focus Indicators:** When cursor clicks an input, show a 2px `#d9ff00` focus ring around it (200ms fade-in).
- **ARIA Labels:** Ensure all interactive elements have visible labels or aria-labels that are readable in the GIF.
- **Contrast:** All text must be legible against the dark background. Minimum contrast ratio: 4.5:1 for body text, 3:1 for UI labels.
- **Loading States:** Always show visual feedback within 100ms of user action. Never show a frozen UI.

---

## 4. GIF SEQUENCING & NAMING CONVENTION

Produce GIFs in the following order (matching user journey from discovery to advanced usage):

| Order | GIF File Name | Studio |
|-------|--------------|--------|
| 1 | `01-apps-hub.gif` | Apps Hub |
| 2 | `02-image-studio.gif` | Image Studio |
| 3 | `03-video-studio.gif` | Video Studio |
| 4 | `04-cinema-studio.gif` | Cinema Studio |
| 5 | `05-cinema-template-studio.gif` | Cinema Template Studio |
| 6 | `06-text-to-image-landing.gif` | Text-to-Image Landing |
| 7 | `07-storyboard-studio.gif` | Storyboard Studio |
| 8 | `08-effects-studio.gif` | Effects Studio |
| 9 | `09-edit-studio.gif` | Edit Studio |
| 10 | `10-upscale-studio.gif` | Upscale Studio |
| 11 | `11-character-studio.gif` | Character Studio |
| 12 | `12-commercial-studio.gif` | Commercial Studio |
| 13 | `13-audio-studio.gif` | Audio Studio |
| 14 | `14-avatar-studio.gif` | Avatar Studio |
| 15 | `15-training-studio.gif` | Training Studio |
| 16 | `16-video-tools-studio.gif` | Video Tools Studio |
| 17 | `17-chat-studio.gif` | Chat Studio |
| 18 | `18-lip-sync-studio.gif` | Lip Sync Studio |
| 19 | `19-influencer-studio.gif` | Influencer Studio |
| 20 | `20-dom-personalization.gif` | DOM Personalization Studio |
| 21 | `21-smart-video-viral.gif` | Smart Video Viral |
| 22 | `22-director.gif` | Director |
| 23 | `23-video-agent.gif` | Video Agent / OpenMontage |
| 24 | `24-academy.gif` | Smart Video Academy |
| 25 | `25-assist.gif` | Assist |
| 26 | `26-pexels-browser.gif` | Pexels Media Browser |
| 27 | `27-timeline-editor.gif` | Timeline Editor |
| 28 | `28-render-page.gif` | Video Render |
| 29 | `29-ai-vfx.gif` | AI VFX |
| 30 | `30-openthorn.gif` | OpenThorn |
| 31 | `31-community.gif` | Community |
| 32 | `32-library.gif` | Library |
| 33 | `33-text-to-video-landing.gif` | Text-to-Video Landing |
| 34 | `34-video-watermark.gif` | Video Watermark Remover |
| 35 | `35-product-photo-studio.gif` | Product Photo Studio |
| 36 | `36-fashion-studio.gif` | Fashion Studio |

---

## 5. OUTPUT FORMAT & DELIVERABLES

For each GIF, produce:
1. **The GIF file** (`.gif`, optimized as specified in 3.7).
2. **A thumbnail** (`.png`, 320×180, first frame of the GIF).
3. **A metadata JSON** with:
   ```json
   {
     "studio": "Image Studio",
     "route": "image",
     "duration": "10s",
     "fps": 30,
     "resolution": "1280x720",
     "fileSize": "8.2MB",
     "keyInteractions": ["prompt input", "model selection", "generate", "result display"],
     "selectors": ["#i-prompt-textarea", "button[aria-label=\"Generate image\"]", "#history-sidebar"]
   }
   ```

---

## 6. ANIMATION STYLE GUIDE — DO's AND DON'Ts

### DO:
- ✅ Use smooth, natural cursor movement (bezier curves, reaction-time pauses)
- ✅ Animate all UI state changes (dropdowns, panels, modals, buttons)
- ✅ Show loading skeletons before content appears
- ✅ Use typewriter effects for generated text and code
- ✅ Include subtle glow effects on primary actions (`#d9ff00`)
- ✅ Maintain consistent dark theme throughout (`#0a0a0b` bg, `#111` panels)
- ✅ Show clear before/after comparisons where applicable
- ✅ Include hover states before every click
- ✅ Use the studio's actual selectors and class names for accuracy
- ✅ Loop seamlessly (last frame = first frame)

### DON'T:
- ❌ Use straight-line or teleporting cursor movement
- ❌ Show instant state changes (all transitions must be animated)
- ❌ Use bright/white backgrounds (maintain dark theme)
- ❌ Skip loading states (always show progress feedback)
- ❌ Make text appear instantly (use typewriter or fade-in)
- ❌ Use generic placeholder text (use realistic, studio-specific prompts)
- ❌ Ignore the studio chrome (top bar, sidebar, drawer)
- ❌ Use emojis in UI text (the codebase doesn't use them)
- ❌ Show broken layouts or misaligned elements
- ❌ Make the GIF shorter than 8s or longer than 12s per loop

---

## 7. EXAMPLE PROMPT FORMAT (How to Use This Document)

When you (the AI) generate a GIF for a specific studio, your internal prompt should look like this:

> "Generate a 10-second animated GIF at 1280×720, 30fps, demonstrating [STUDIO NAME]. The GIF must follow the 4-phase structure: Identify (0–1.5s) — show the studio loading with full chrome (top bar, sidebar, empty prompt area); Interact: Enter Content (1.5–4s) — cursor enters smoothly, fills the [SELECTOR] textarea with '[SAMPLE PROMPT]' using 80ms per-character typewriter effect, opens and selects from [DROPDOWNS], drags [SLIDERS] to new values, clicks [CHIPS/TABS], completes upload zone with file thumbnail animation; Interact: Press Buttons (4–7s) — cursor moves to the [PRIMARY BUTTON], hovers 200ms with glow feedback, clicks with ripple effect, button transitions to loading state with spinner and 'Generating...' text, progress bar fills 0→100%, result animates in with shimmer skeleton → fade-in; Complete (7–10s) — result is centered with glow, action buttons appear, cursor hovers Download, loop seamlessly. Use the dark theme: bg #0a0a0b, panels #111, accent #d9ff00. Cursor moves on bezier curves with 200ms reaction pauses. All transitions use cubic-bezier(0.4, 0, 0.2, 1) at 200ms. Wait for networkidle before recording."

---

## 8. FINAL VALIDATION CHECKLIST

Before finalizing each GIF, verify:
- [ ] Studio chrome (top bar, sidebar, drawer) is visible and accurate
- [ ] Application fully loaded before recording starts (networkidle reached, all elements rendered)
- [ ] All key UI elements use the correct dark theme colors
- [ ] Cursor movement is smooth and natural (no teleporting)
- [ ] Every input/textarea/dropdown/slider/upload zone has been populated with realistic data (no empty fields, no placeholder text visible in final frames)
- [ ] Prompt textarea contains a full, realistic, studio-specific prompt typed with typewriter effect
- [ ] Every click is preceded by a hover state (200ms minimum)
- [ ] All dropdowns open with 200ms slide-down and close with 150ms reverse slide
- [ ] All sliders show smooth drag animation with real-time value updates
- [ ] All chips/toggles show clear active state (`#d9ff00` border/background)
- [ ] Upload zones show file thumbnail animation and checkmark/file name after upload
- [ ] Typing uses a typewriter effect with appropriate stagger (80ms body, 40ms code)
- [ ] The primary action button is pressed with full sequence: hover 200ms → click with ripple → loading state with spinner → progress bar → result
- [ ] Loading states are shown for all generation/process/train/send actions
- [ ] Progress bars animate smoothly from 0→100% with status text updates
- [ ] Results fade/scale in with animation (not instant)
- [ ] The GIF loops seamlessly (frame 1 = last frame)
- [ ] File size is under 15MB
- [ ] All selectors and class names match the actual codebase
- [ ] Code blocks use syntax highlighting with correct colors
- [ ] No white/light backgrounds (strictly dark theme)
- [ ] Primary accent color (#d9ff00) is used consistently for active states

---

*End of Prompt Specification*
