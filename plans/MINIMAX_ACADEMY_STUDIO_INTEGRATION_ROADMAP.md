# Minimax + Academy Multimedia Integration — UI/UX Plan & Technical Logic Framework

**Product:** SmartVideo AI Studio (Remix/Vite/React + Node backend)
**Scope:** Integrate the 30 Minimax (Hailuo H3) demo clips and the 15 Academy course asset libraries into the 8 studio environments as interactive, clickable demos with a **"Create This Style"** creation path.
**Status:** Planning / architecture (no production code shipped by this document).

---

## 0. Source-of-Truth Map (verified files)

| Concern | File / location |
|---|---|
| Minimax raw media | `public/media/minimax-h3/videos/*.webm` (30), `public/media/minimax-h3/previews/*` (webp/jpg) |
| Minimax metadata | `public/media/minimax-h3/index.json` (`clips[]`: slug, title, author, url, rights_note) |
| Minimax manifest (SSOT in code) | `src/data/minimaxH3Demos.js` (auto-generated; `MINIMAX_MODEL`, `CATEGORY_ROUTES`, `getCreateUrl`, `openDemoInStudio`) |
| Landing demo UI | `src/components/landing/sections/minimax/{ui.js, DemoPromptModal.js, mediaFrame.js}` |
| Landing sections | `MinimaxWorkflowSection.jsx`, `UGCDemoShowcase.jsx`, `AIVideoGallery.jsx`, `AcademyVideoShowcase.jsx`, `CinematicVideoHero.jsx`, `MadeWithSmartVideo.jsx` |
| In-studio inspiration rail | `src/lib/examplesRail.js`, `src/lib/studioPrefill.js` |
| Academy catalog | `src/data/academy/catalog.js` (`ACADEMY_ASSETS`), `src/data/academy/lessons/*`, `public/academy/01..15-*/{images,gifs,videos,raw}` |
| Academy components | `src/components/academy/{AcademyPage.jsx, InteractiveTemplates.jsx}` |
| Backend | `backend/server.js`, `backend/services/*`, `supabase/migrations/*` (`projects` table) |
| Generation | `src/lib/editor/generationService.js`, `renderQueueStore.js` |
| Long-form pipeline | `apps/vimax/{main_idea2video.py, main_script2video.py, web_app.py}` |

**Key constraint (licensing):** `index.json` and `minimaxH3Demos.js` both state the prompt text is CC-BY-4.0 but the **gallery media is third-party and NOT relicensed** ("keep only if you have permission to redistribute"). The architecture must derive *style*, never redistribute the clip, and surface author credit (`author`, `url`) on any export.

---

## 1. Component 1 — Asset Audit & Mapping

### 1.1 Minimax asset inventory (30 clips)
Single source of truth: `public/media/minimax-h3/index.json` → `src/data/minimaxH3Demos.js`. Each clip has `slug`, `title`, `author`, `category` (from `CATEGORY_ROUTES`), `featured`/`hero` flags, and a poster under `previews/<slug>.webp`.

### 1.2 Academy asset inventory (15 courses)
`public/academy/01..15-*/` each contains `images/`, `gifs/`, `videos/`, `raw/lessons/`, `raw/templates/`. Catalogued in `src/data/academy/catalog.js` (`ACADEMY_ASSETS[]` with `type`, `category`, `src`, `videoSrc`, `gifSrc`, `lesson`). Approx. volume per course (sampled):

| Course | img | gif | vid | lessons | templates |
|---|---|---|---|---|---|
| 01 ai-video-ads-ugc | 4 | 3 | 3 | 6 | 7 |
| 02 ai-filmmaking | 5 | 3 | 3 | 6 | 10 |
| 03 faceless-ai-channels | 4 | 2 | 2 | 6 | 7 |
| 04 ai-content-factories | 6 | 5 | 5 | 7 | 8 |
| 05 ai-avatars-and-influencers | 6 | 5 | 5 | 6 | 5 |
| 06 ai-audio-and-music | 5 | 5 | 5 | 6 | 5 |
| 07 ai-product-photography | 5 | 4 | 4 | 5 | 4 |
| 08 ai-fashion-and-virtual-tryon | 4 | 4 | 4 | 5 | 4 |
| 09 ai-real-estate-staging | 3 | 2 | 2 | 4 | 3 |
| 10 ai-headshots-and-portraits | 3 | 3 | 3 | 5 | 4 |
| 11 ai-print-on-demand-and-merch | 3 | 3 | 3 | 5 | 4 |
| 12 ai-stock-content-and-licensing | 2 | 2 | 2 | 4 | 4 |
| 13 ai-tools-mastery | 2 | 2 | 2 | 5 | 4 |
| 14 ai-freelancing-and-agency-business | 2 | 2 | 2 | 6 | 4 |
| 15 ai-agents-and-vibe-coding | 2 | 2 | 2 | 5 | 4 |

### 1.3 Tagging schema (shared)
Extend each `minimaxH3Demos.js` entry and `ACADEMY_ASSETS` entry with a uniform shape:

```ts
{
  id, slug, title,
  mediaType: 'image' | 'gif' | 'video',
  source: 'minimax' | 'academy',
  genre: 'ugc-ad' | 'product-film' | 'anime' | 'cinematic'
        | 'loop' | 'music-video' | 'fashion' | 'gameplay'
        | 'comedy' | 'beauty' | 'vfx',
  studioAffinity: StudioName[],   // ['VideoStudio', 'CinemaStudio', ...]
  rights: { author, sourceUrl, license: 'CC-BY-4.0', redistributable: boolean },
  ratio, durationMs, featured, hero
}
```

### 1.4 Studio → asset mapping (every Minimax clip placed)
`VideoStudio` is the universal generation surface (`DEFAULT_CREATE_ROUTE = 'video'`). Per-clip primary + secondary studio assignment:

| # | slug | title | primary studio | also surfaces in |
|---|---|---|---|---|
| 1 | modern-warfare-fps-gameplay | Modern warfare FPS gameplay | VideoStudio | ImageStudio (still frames), EditStudio |
| 2 | luxury-perfume-commercial | Luxury perfume commercial | ImageStudio | TemplateStudio (featured), CommercialStudio |
| 3 | 1980s-open-source-family-comedy | 1980s open-source family comedy | CharacterStudio | VideoStudio |
| 4 | radio-operator-evacuation-bridge | Radio operator evacuation bridge | CinemaStudio | VideoStudio |
| 5 | giant-koi-park-incident | Giant koi park incident | VideoStudio | AvatarStudio (creature host), EditStudio |
| 6 | greenhouse-tea-isekai-anime | Greenhouse tea isekai anime | CinemaStudio | CharacterStudio, Animation |
| 7 | low-angle-fashion-tracking-film | Low-Angle Fashion Tracking Film | ImageStudio | VideoStudio, Fashion |
| 8 | storm-lit-pirate-galleon-battle | Storm-Lit Pirate Galleon Battle | CinemaStudio | VideoStudio (action) |
| 9 | stormy-claymation-whale-breach | Stormy Claymation Whale Breach | CinemaStudio | VFX/EditStudio |
| 10 | blue-haired-hero-and-spirit-fox-escape | Blue-Haired Hero and Spirit Fox Escape | CharacterStudio | VideoStudio |
| 11 | kintsugi-sword-seamless-loop | Kintsugi Sword Seamless Loop | EditStudio | VFX, TemplateStudio |
| 12 | ramen-bowl-ugc-taste-test | Ramen Bowl UGC Taste Test | AvatarStudio | UGCDemoShowcase, VideoStudio |
| 13 | gourmet-burger-ugc-taste-test | Gourmet Burger UGC Taste Test | AvatarStudio | UGCDemoShowcase, VideoStudio |
| 14 | luxury-skincare-storyboard-commercial | Luxury Skincare Storyboard Commercial | ImageStudio | TemplateStudio (featured), Beauty |
| 15 | surreal-blue-studio-dance-with-a-horse | Surreal Blue Studio Dance with a Horse | ImageStudio | VideoStudio, Fashion |
| 16 | nighttime-motorcycle-chase-synced-to-music | Nighttime Motorcycle Chase Synced to Music | AudioStudio | CinemaStudio (music-synced) |
| 17 | y2k-k-pop-candy-typography-music-video | Y2K K-Pop Candy Typography Music Video | AudioStudio | EditStudio (typography cut) |
| 18 | yellow-sunglasses-in-a-black-studio | Yellow Sunglasses in a Black Studio | ImageStudio | TemplateStudio (featured), CommercialStudio |
| 19 | theme-park-memory-montage | Theme Park Memory Montage | EditStudio | VideoStudio (montage) |
| 20 | cyber-warrior-vs-primordial-fighter | Cyber Warrior vs. Primordial Fighter | CharacterStudio | CinemaStudio (action) |
| 21 | strawberry-drink-transformation-commercial | Strawberry Drink Transformation Commercial | ImageStudio | TemplateStudio (featured), CommercialStudio |
| 22 | ice-gunslinger-interactive-web-loop | Ice Gunslinger Interactive Web Loop | EditStudio | TemplateStudio (hero), MinimaxWorkflowSection |
| 23 | porto-francesinha-comedy-recipe | Porto Francesinha Comedy Recipe | AudioStudio | VideoStudio (voiceover) |
| 24 | macaw-scream-in-extreme-slow-motion | Macaw Scream in Extreme Slow Motion | VideoStudio | AvatarStudio, EditStudio (slow-mo) |
| 25 | blackberry-vanilla-soda-ugc-vlog | Blackberry Vanilla Soda UGC Vlog | AvatarStudio | UGCDemoShowcase, AudioStudio |
| 26 | bamboo-forest-wuxia-mystery | Bamboo Forest Wuxia Mystery | CinemaStudio | CharacterStudio |
| 27 | golden-guardian-web-hero-loop | Golden Guardian Web Hero Loop | EditStudio | TemplateStudio (hero), MinimaxWorkflowSection |
| 28 | emerald-bio-serum-product-film | Emerald Bio-Serum Product Film | ImageStudio | TemplateStudio (featured), Beauty |
| 29 | black-and-gold-perfume-commercial | Black-and-Gold Perfume Commercial | ImageStudio | TemplateStudio (featured), CommercialStudio |
| 30 | morning-lip-oil-ugc-testimonial | Morning Lip Oil UGC Testimonial | AvatarStudio | UGCDemoShowcase, VideoStudio |

**Academy course → studio support:**
- 01, 12 → VideoStudio / CommercialStudio
- 02 → CinemaStudio
- 03 → VideoStudio
- 04, 14 → TemplateStudio
- 05 → AvatarStudio
- 06 → AudioStudio
- 07, 08, 09, 10, 11 → ImageStudio
- 13, 15 → all studios (tooling/mastery)

### 1.5 Placement roadmap (concrete)
- **`CinematicVideoHero.jsx`** — hero background = `kintsugi-sword-seamless-loop` (`HERO_SLUG`).
- **`MinimaxWorkflowSection.jsx`** — centrepiece = `ice-gunslinger-interactive-web-loop` (EditStudio/Effects demo).
- **`UGCDemoShowcase.jsx`** — 4 UGC cards (12, 13, 25, 30) with "View Prompt" + "Create This Type of Video".
- **`AIVideoGallery.jsx`** — full 30-clip gallery + `MINIMAX_CATEGORIES` filter bar; each card's "Create This Style" → `getCreateUrl` → `CATEGORY_ROUTES`.
- **`MadeWithSmartVideo.jsx`** — `REEL_SLUGS` = 6 featured (2, 14, 18, 21, 28, 29).
- **`AcademyVideoShowcase.jsx`** — `ACADEMY_ASSETS` filtered to `video`/`gif`, grouped by track, rendered via `mediaFrame.js`.
- **In-studio examples rail** (`src/lib/examplesRail.js` + `studioPrefill.js`): `openDemoInStudio()` stages prefill (`__route`, `__model`, ratio) so a clip opens in its mapped studio.
- **TemplateStudio** — `featured` (2,14,18,21,28,29) + `hero` (22,27) feed "Create This Style" cards (`TEMPLATE_PREFIX='minimax-h3-'`).

### 1.6 Audit gaps & risks
- **Licensing:** third-party media NOT relicensed — legal review before production; tag `rights.redistributable` per clip; export must carry author credit.
- **Poster fallback:** 29/30 have `.webp`; add `.jpg` fallbacks (Safari/older clients) or standardize on `.webp`. `giant-koi-park-incident` lacks `.jpg`.
- **Aspect honesty:** several clips are non-16:9 (`ramen` 40:17, `gourmet-burger` 92:39, `ice-gunslinger` 959:540, `emerald-bio-serum` 9:16). Render true 9:16/vertical frames rather than force-stretch.
- **Route holes:** `CATEGORY_ROUTES` has no direct ImageStudio/AudioStudio/AvatarStudio/TemplateStudio/EditStudio entry — `getCreateUrl` currently lands in Commercial/Influencer/Cinema/etc. Add explicit route mappings for those studios.
- **Academy wiring:** some `raw/templates` (~165 files) are not yet surfaced in `InteractiveTemplates.jsx`; verify every course registers its templates.

---

## 2. Component 2 — UI/UX Integration

### 2.1 Reusable `<DemoCard>` atom
Promote `renderCard()` in `src/lib/examplesRail.js` into `src/components/demos/DemoCard.jsx`, backed by the existing media engine `src/components/landing/sections/minimax/mediaFrame.js` (`createMediaFrame`) so lazy `.webm` hydration, the playback governor, and `prefers-reduced-motion` stay consistent.

```jsx
<DemoCard
  asset={demo}                  // minimaxH3Demos entry OR academy asset
  source="minimax" | "academy"  // drives the source badge color
  variant="rail" | "grid" | "hero"
  onOpen={openDetail}
  onUse={createThisStyle}
/>
```

- **Play-on-hover/click:** delegate to `createMediaFrame(demo, { mode: 'hover' })`. Poster renders first; `<video>` created only when near viewport (IntersectionObserver, `rootMargin: 200px`). Muted autoplay on `pointerenter`/`focusin`, pause on leave.
- **Content:** title, author, source badge (`categoryBadge()`), ratio `metaPill()`.
- **Accessibility:** `<article tabindex=0 role=button>`; `aria-label` on poster/video; keyboard playback parity; `REDUCED_MOTION_QUERY` → static poster.
- **States:** `load()` + `loadeddata` fade-in; poster 404 → "Preview pending" gradient; video `error` → keep poster + `data-mmxVideoFailed`.

### 2.2 Per-studio placement
| Studio | Panel | Source filter |
|---|---|---|
| VideoStudio | Footer rail after `inlineInstructions` (`VideoStudio.js:702`) | `CATEGORY_ROUTES[demo.category]==='video'` |
| CinemaStudio | `createExamplesRail` mount (`CinemaStudio.js:104`) + hero loop row | `cinema` |
| EditStudio | New "Style Library" slide-over drawer (toolbar chip) | mixed (loops/montage) |
| CommercialStudio | Rail under form (`CommercialStudio.js:339`) | `commercial` |
| AudioStudio | New "Sound Style" tab → demos mapped to `audio` route | `audio` |
| AvatarStudio | "Inspiration" column beside canvas | `avatar`/`ugc` |
| CharacterStudio | Rail via `consumeAndApply` pattern | `character` |
| ImageStudio | Detail-modal + "Try a style" on empty canvas | `image` |

All rails are driven by the existing `getMiniMaxDemosWithTargets()` (`minimaxH3Demos.js`) which resolves `category → route + model`; each studio filters by `__route`.

### 2.3 Clickable demo → detail modal
`src/components/demos/DemoDetailModal.jsx` built on `DemoPromptModal.js` (focus trap, scroll lock, Esc, `aria-modal`, lazy `loadDemoPrompt`):
- **Full-bleed player:** `createMediaFrame(demo, { mode: 'inview', priority: true })`.
- **Extracted style params:** render `useCase`, `aspectRatio`, `duration`, `category`, derived motion params.
- **Remix affordance:** "Tweak prompt" textarea pre-filled with `loadDemoPrompt(slug)`.
- Footer primary CTA = `createStyleLink(demo)`.

### 2.4 "Create This Style" interaction
CTA from `createStyleLink()` (`ui.js:157`), an `<a data-mmx-cta>`:
1. **Idle→hover:** `hover:bg-cyan-300 shadow-cyan-300/30`; press `active:scale-[0.98]`.
2. **On click:** `preventDefault()` → `openDemoInStudio(demo)` (`minimaxH3Demos.js:651`) → `stageStudioPrefill({ route, model, params:{aspect_ratio,_sourceSlug,_sourceTitle} })` (`studioPrefill.js`) → `navigate(route)`.
3. **Loading state:** spinner + "Spinning up {Studio}…"; destination studio calls `consumeAndApply(route, apply)` at mount to pre-select model/aspect and inject the prompt.
4. **Empty vs pre-filled:** studios branch on `consumeStudioPrefill()` returning `null` (empty canvas) vs payload (pre-filled controls + dismissible "Remixed from: {title}" chip).

### 2.5 Academy integration
`InteractiveTemplates.jsx` already exposes `AssetGallery`/`Lightbox` (LEARN→SEE→CREATE). Wire Academy into demos:
- `getAssetsForLesson()` assets become `DemoCard` items via `normalizeItem()`'s academy branch.
- Add "Try this in Studio" linking to `openStyleInStudio` with `route` resolved from the asset's `__route` (extend `academyAssets.ts` to carry `route`/`model` like `MODEL_FOR_TARGET`).
- Add a `DemoCard` rail in the SEE tab so the referenced gif/image/video is clickable/remixable.

### 2.6 Design system
- **Source badge** = single signal: Minimax = cyan (`border-cyan-400/25 bg-cyan-400/10 text-cyan-300`), Academy = purple (`border-[--color-accent]/25 bg-[--color-accent]/10 text-[--color-accent]`). Reuse `categoryBadge()` with a `tone` arg.
- **In-studio CTA** uses studio tokens: `bg-[--color-primary] text-black hover:shadow-glow` (`studio.css:116`); cyan only on landing surfaces.
- **Spacing/radii:** `radius-lg 16px`, `radius-md 10px` (`variables.css`); cards `gap-3`, rail `pb-3 snap-x`; hover lift `translateY(-2px)` (`.style-card:hover`).
- **Motion:** gate all behind `prefers-reduced-motion`; reuse `--transition-normal: 300ms cubic-bezier(0.4,0,0.2,1)`.

---

## 3. Component 3 — "Create This Style" Logic

### 3.1 Demo → Template extraction model (curated presets)
Automated analysis of 6s webms cannot recover *intent* (prompt/motion). Author a hand-curated preset per slug, mirroring `src/lib/recipes/registry.js` and `gen_templates.js`.

**`StyleTemplate` schema** (also emitted by the backend action):
```ts
interface StyleTemplate {
  slug: string;
  title: string;
  author: string;
  sourceClipUrl: string;        // /media/minimax-h3/videos/<slug>.webm
  thumbnail: string;            // /media/minimax-h3/previews/<slug>.webp
  prompt: string;               // hand-authored reproduction prompt
  negativePrompt: string;
  model: string;                // "minimax/hailuo-02" (src/lib/models.js)
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationMs: number;
  motionProfile: {
    camera: string[];            // ["slow dolly in","static framing"]
    motion: string[];
    strength: number;            // 0–100 → VideoStudio motion slider
  };
  styleTags: string[];
  palette: string[];             // dominant hex
  audioProfile: { music: string; sfx: string; voiceover: boolean };
  targetStudio: string;          // navigation target
  rightsNote: string;            // copied verbatim from index.json
}
```
**Location:** `src/data/minimax/presets.js` (frontend + build validator) mirrored to `public/media/minimax-h3/presets.json` (server/Supabase Edge read). CI validator (`scripts/validate-minimax-presets.js`) asserts all 30 slugs present and each resolves to an existing `videos/<slug>.webm`.

### 3.2 Backend logic
Add to `backend/server.js`:
```
POST /api/templates/from-demo
Body:  { slug: string, studio?: string }
Auth:  optionalAuth (req.user?.id for ownership; anonymous → ephemeral draft)
→ 200 { styleTemplate: StyleTemplate, draftId: string, owned: boolean }
→ 404 { error: "unknown_slug" }
```
`backend/services/templateService.js` loads `presets.json`, looks up `slug`, deep-clones the template, and seeds a `projects` row (`supabase/migrations/...create_projects_and_new_generations.sql`: `id, tenant_id, created_by, name, status, metadata JSONB, tags`) with `metadata.styleTemplate` and `status='draft'`.
- **Idempotency/ownership:** `created_by = req.user.id` (RLS gates by tenant+owner). Anonymous → `draftId` held client-side only. Re-click reconnects or versions via `generation_versions`.
- **Rights:** always echo `rightsNote`; if no redistribution permission, still allow style derivation but set `metadata.derivativeOnly=true` so export watermarks source credit.

### 3.3 Frontend flow
1. `onClick` → `fetch('/api/templates/from-demo', { slug })` → `styleTemplate` + `draftId`.
2. Hydrate a new `styleTemplateStore` (fills the `preset.store.js` gap noted in `STATE_MANAGEMENT_AUDIT.md`), built on `src/stores/base/Store.js`.
3. Seed target studio editor state via the existing `staged`/`prefill_prompt` channel (`VideoStudio.js` already reads `localStorage.getItem('prefill_prompt')` and `staged.model`): write `prefill_prompt`, `staged.model`, `staged.aspectRatio`, `staged.motionStrength = motionProfile.strength`, `staged.negativePrompt`. New studios get a thin `hydrateStudioFromTemplate(studio, t)` adapter.
4. **Navigate** to `styleTemplate.targetStudio` (mapping mirrors recipe `target` in `registry.js`): `video`→VideoStudio, `image`→ImageStudio, `edit`→EditStudio, `cinema`→CinemaStudio, `template`→TemplateStudio, `commercial`→CommercialStudio, `character`→CharacterStudio, `avatar`→AvatarStudio. On mount the studio consumes `staged`/store and clears `prefill_prompt`.

---

## 4. Component 4 — Studio Workflow & Creation Logic

End-to-end for a user building a new video from a template:
1. **Load preset** — §3 hydrates editor state.
2. **Edit prompt/assets** — `generationService.js` `GenerationRequest` (`{mode:'text-to-video', prompt, negativePrompt, duration, aspectRatio, fps, references}`) is the canonical shape.
3. **Configure motion/audio** — `motionProfile.strength` → VideoStudio motion slider; `audioProfile` → AudioStudio hand-off.
4. **Queue generation** — `src/lib/editor/generationService.js` POSTs to `/api/generate` (t2v) or `/api/i2v`, returning `GenerationResult` (`generationId`, `status`).
5. **Poll status** — `renderQueueStore.js` (`enqueueRender`, `patchJob`) holds the job list; registered `setRenderExecutor` polls `generationId` until `completed`.
6. **Preview/render/export** — completed `assetIds` persisted to `assets` table; export via Render Studio proxy (`/api/videodb`).
7. **Save-as-Style loop** — "Save as Style" serializes effective params (final prompt, model, ratios, motion, palette via `/api/scene-detection`, audio) into a user `StyleTemplate` (`sourceClipUrl=null, userCreated=true`), re-entering §3 as a first-class template.

**Vimax relation:** `apps/vimax/main_idea2video.py` / `main_script2video.py` are the long-form pipelines; for multi-shot scripts derived from a template, the studio POSTs the `StyleTemplate` as a scene spec to the Vimax `web_app.py` pipeline, reusing the same `motionProfile`/`palette` fields.

**Risks/guardrails:** licensing (derive style, watermark credit); cost/quota (gate behind `agentActionsLimiter` + `usage` table); caching (`presets.json` CDN-cacheable + in-memory backend cache + client `styleTemplateStore`); migration (validator fails build if any of the 30 `videos/*.webm` lacks a preset; `scripts/sync-minimax-presets.js` scaffolds stubs from `index.json`).

---

## 5. Component 5 — Sub-Agent Execution Strategy

The plan was produced by fanning out **three parallel workstream sub-agents** (this document is their synthesis). For implementation, organize the build the same way: each workstream is owned by a dedicated agent with explicit inputs, outputs, and handoffs.

### 5.1 Agent roster & responsibilities
| Agent | Workstream | Inputs | Deliverable | Depends on |
|---|---|---|---|---|
| **A — Asset Audit** | Mapping & tagging | `index.json`, `minimaxH3Demos.js`, `public/academy/*`, `catalog.js` | `src/data/minimax/presets.stub.js` (30 slug shells), `academyAssetMap.ts`, tagging schema | — |
| **B — UI/UX** | DemoCard + modal + placement | Agent A's mapping, `mediaFrame.js`, `examplesRail.js`, `studioPrefill.js`, `studio.css`, `variables.css` | `<DemoCard>`, `<DemoDetailModal>`, per-studio rail mounts, design tokens | A (mapping) |
| **C — Tech/Arch** | Presets + backend + flow | Agent A's stub, `backend/server.js`, `templateService`, `generationService`, `projects` migration, `Store.js` | `presets.js` (filled), `/api/templates/from-demo`, `styleTemplateStore`, `hydrateStudioFromTemplate` | A (schema) |
| **D — Academy Wiring** | Lessons→studio | `AcademyPage.jsx`, `InteractiveTemplates.jsx`, `catalog.js` | Academy `DemoCard` rails, `route`/`model` on `academyAssets.ts` | A, B |
| **E — QA/Validation** | Guards | all outputs | `validate-minimax-presets.js`, E2E (Playwright) for "Create This Style" across 8 studios, licensing compliance check | B, C, D |

### 5.2 Execution sequence
1. **Phase 0 (parallel):** A produces the 30-clip mapping + tagging schema + preset stubs. B reads A's mapping to design components. C reads A's schema to define `StyleTemplate` + endpoint. (B/C can start from this doc's §1–§3 specs while A finalizes.)
2. **Phase 1:** C fills `presets.js` (30 hand-authored prompts/motion/palette) and ships `/api/templates/from-demo` + `styleTemplateStore`.
3. **Phase 2:** B ships `<DemoCard>` + `<DemoDetailModal>` and mounts rails in all 8 studios; wires `createStyleLink` → `openDemoInStudio`.
4. **Phase 3:** D wires Academy assets into `DemoCard` rails and adds `route`/`model` to `academyAssets.ts`.
5. **Phase 4:** E runs `validate-minimax-presets.js` (CI gate), Playwright E2E of "Create This Style" in each studio, and a licensing audit (every exported derivative carries author `url` + `derivativeOnly` watermark).

### 5.3 Handoffs & contracts
- **A → C:** `StyleTemplate` schema (§3.1) is the contract; C never re-derives mapping.
- **A → B:** `studioAffinity[]` per slug drives rail filters; B consumes `getMiniMaxDemosWithTargets()`.
- **C → B:** `styleTemplateStore` + `staged` channel is the handoff; B's CTA calls `openDemoInStudio` which C's `stageStudioPrefill` satisfies.
- **B/D → E:** every "Create This Style" instance registers a Playwright selector (`data-mmx-cta`, `data-studio`) for E's tests.
- **Shared invariant:** no component hard-codes a slug's studio; all derive from `minimaxH3Demos.js` + `presets.js` so adding clip #31 is a data change, not a code change.

### 5.4 Verification (each agent checks its own work)
- A: `scripts/sync-minimax-presets.js` produces 30 stubs; every `public/academy/<course>/{images,gifs,videos}` entry has a catalog row.
- B: `<DemoCard>` renders in all 8 studios; reduced-motion + keyboard parity pass; no layout regression vs `studio.css`.
- C: `POST /api/templates/from-demo` for all 30 slugs returns 200 with valid `StyleTemplate`; anonymous path returns ephemeral `draftId`; studio mount consumes `staged` and clears `prefill_prompt`.
- D: every Academy course's `raw/templates` surfaces; "Try this in Studio" lands in the correct studio pre-filled.
- E: CI fails if any slug missing a preset; E2E green for 8 studios; export of a non-redistributable clip carries credit.

---

## 6. Summary Roadmap (where each demo lives + how creation works)

- **30 Minimax clips** → catalogued in `minimaxH3Demos.js`, tagged per §1.4, placed via `AIVideoGallery` (all 30), `UGCDemoShowcase` (UGC 4), `CinematicVideoHero` (loop), `MinimaxWorkflowSection` (edit loop), and per-studio `examplesRail` mounts. Featured 6 + hero 2 feed `TemplateStudio`.
- **15 Academy courses** → `catalog.js` assets surfaced in `AcademyVideoShowcase` + `InteractiveTemplates`, with "Try this in Studio" rails.
- **One interaction:** click any demo → `DemoDetailModal` (full player + extracted params) → **"Create This Style"** → `POST /api/templates/from-demo` → `styleTemplateStore` + `stageStudioPrefill` → navigate to the mapped studio, pre-filled (prompt, model, aspect, motion) → user edits → queue → poll → render → export (credit watermarked when derivative).
- **One loop:** generated output can be "Saved as Style" → becomes a user template → re-enters the same path.
- **Delivery via 5 sub-agents** (A audit, B UI, C arch, D academy, E QA) with the contracts and verification above.
