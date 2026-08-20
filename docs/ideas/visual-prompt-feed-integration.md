# Integrating the External Prompt Library

A unified plan for turning four external, community-curated prompt repositories into
one-click "Create This Style" launches across SmartVideo's studios.

## Problem Statement

> **How might we let users browse and build videos from four high-quality,
> externally-maintained prompt repos — the structured `visual-prompt-feed` dataset,
> the `awesome-seedance-2-5` catalog with playable previews, the `awesome-seedance`
> use-case library, and the `ai-shortfilm` cinematic templates — without duplicating
> the example-gallery plumbing that already exists for MiniMax H3 and Seedance demos?**

SmartVideo already ingests external prompt repos through a proven pattern:

- `scripts/generate-*-manifest.mjs` — build-time fetch + normalize into committed data
- `src/data/*Demos.js` / `*.js` — normalized asset arrays (large prompt text code-split,
  mirroring `seedancePrompts.js`)
- `src/lib/exampleGalleryBridge.js` — `handleCreateThisStyle(asset)` / `handleViewPrompt(asset)`
  route a gallery card into a studio via `navigate(route, params)`
- `src/data/exampleGalleryAssets.js` — merges every source into `EXAMPLE_ASSETS`;
  every studio calls `getAssetsForStudio(studioId)` so the gallery auto-populates
- `src/components/studios/ExampleGallery.js` — renders cards (thumbnail + title +
  "View Prompt" / "Create This Style") and is unchanged

The four repos just need their own fetchers/normalizers that emit the **same** asset
shape, then they drop into `EXAMPLE_ASSETS` and work end-to-end.

## The Four Sources

| # | Repo | Format | Records | Model | License | Key fields |
|---|---|---|---|---|---|---|
| 1 | `Hanyuyu/visual-prompt-feed` (+ deangilmorememix fork) | `data/prompts.json` (8.5 MB, structured JSON, daily refresh) | 1,658 (786 video / 872 image) | `seedance`,`gptimage`,`nanobanana` | CC-BY-4.0 curation + NOASSERTION source | `recommendedModel`, `categories`, `tags`, `recommended{aspectRatio,durationSeconds,generateAudio,quality}`, `source{author,url,license,rightsHolder}`, `media[].previewUrl` |
| 2 | `BeatAPI/awesome-seedance-2-5-prompts` (+ deangilmorememix fork) | `prompts/catalog.json` (1.6 MB, structured JSON) | 300 | Seedance 2.5 | source-verified X posts | `mode` (text-to-video / reference-to-video), `workflowMode`, `ingredients`, `duration`, `aspectRatio`, `source`, `media`, `rightsStatus`, `prompt` |
| 3 | `ZeroLu/awesome-seedance` | Markdown (`prompts/*.md` + README use-case sections) + `videos/*.mp4` | ~24 use-case groups | Seedance 2.0 | MIT | `Prompt:` blocks, `@handle` + X link sources, durations, `.mp4` result files |
| 4 | `deangilmoreremix/ai-shortfilm-prompts` (jnMetaCode) | `prompts/index.json` (metadata) + `prompts/*.md` (prompt text) + `templates/*.md` (21 genre templates) | 6 prompts + 21 templates | model-agnostic (Sora/Kling/Veo/Seedance) | MIT (code) + Mx-Shell CC (original prompts) | `type`, `duration`, `variants`, `ipSafe`, `reroll`, `tags`, 5-stage template structure |

## Unified Asset Schema

All manifest scripts emit this normalized shape (the extension of
`EXAMPLE_ASSETS` already used by `exampleGalleryAssets.js`):

```js
{
  id: string,                  // '<repo>:<slug>'  — globally unique
  source: string,              // 'visual-prompt-feed' | 'awesome-seedance-2.5' | 'awesome-seedance' | 'ai-shortfilm'
  studio: string,              // 'video' | 'image' | 'cinema' | 'commercial' | 'influencer' | ...
  title: string,
  category: string,            // mapped to the app's category vocab
  tags: string[],
  useCase: string,             // human-readable descriptor

  prompt: string,              // FULL text — lazy-loaded at gallery click (see below)
  model: string,               // resolved SmartVideo model ID, e.g. 'seedance-v2.0-t2v'
  modelType: 't2v' | 'i2v' | 'flf', // drives VideoStudio mode toggle
  workflowMode: string,        // 'text-to-video' | 'reference-to-video' | 'text-to-image'

  aspectRatio: string | null,  // e.g. '16:9'
  duration: number | null,     // seconds — mapped to VideoStudio `duration` param
  generateAudio: boolean | null,
  quality: string | null,

  thumbnail: string,           // poster image URL (always present)
  previewVideo: string | null, // optional .webm/.mp4 result (Seedance 2.5 / ZeroLu)

  // ai-shortfilm only
  stylePreset: string | null,
  ipSafe: boolean | null,
  rerollHint: string | null,

  // VPF ranking signal (likes/reposts/replies)
  engagement: { likes, reposts, replies } | null,

  attribution: {
    author: string,            // handle, e.g. '@Naiknelofar788'
    authorName: string | null,
    sourceUrl: string,         // X post permalink
    license: string,           // 'NOASSERTION' | 'CC-BY-4.0' | 'MIT' | etc.
    rightsHolder: string,      // original author or repo curator
    curator: string | null,    // 'ImgLume' / 'BeatAPI' / null
  },
}
```

**Code-splitting for prompt text:** the manifest script writes two files per repo
— a small index (titles, thumbnails, tags, attribution, params — no full prompt)
committed eagerly, and a lazy companion (full prompt text) loaded on demand, exactly
as `seedanceDemos.js` + `seedancePrompts.js` already do. VPF alone is 8.5 MB; the
full text must never ship on the critical path.

## Per-Repo Wiring

### 1. visual-prompt-feed (structured JSON — MVP priority)
- **Script:** `scripts/generate-vpf-manifest.mjs` fetches
  `https://raw.githubusercontent.com/Hanyuyu/visual-prompt-feed/main/data/prompts.json`.
- **Model map:** `seedance`→`seedance-v2.0-t2v` (t2v); `nanobanana`→`nano-banana-2`
  (image); `gptimage`→fallback `nano-banana-2` (OpenAI gpt-image not yet in `t2iModels`).
- **Studio map:** `mediaType === 'video'` → `video` studio; `mediaType === 'image'`
  → `image` studio. Category→studio refinement (cinematic→`cinema`) is v2.
- **Params:** `recommended.aspectRatio`→`aspect_ratio`, `recommended.durationSeconds`→`duration`,
  `recommended.generateAudio`→`generate_audio`.
- **Media:** `media[0].previewUrl`→`thumbnail`.
- **Attribution:** `source.author.handle`, `source.url`, `source.license`,
  `source.rightsHolder`, `source.engagement` preserved verbatim (the feed's
  DATA-LICENSE.md *requires* keeping these fields).

### 2. awesome-seedance-2.5 (catalog.json — richest video source)
- **Script:** `scripts/generate-seedance25-manifest.mjs` fetches `catalog.json`
  (single 1.6 MB request — far cheaper than 300 individual files).
- **Model:** Seedance 2.5 → `seedance-v2.0-t2v`. When `mode === 'reference-to-video'`
  or `ingredients` includes an image reference → `seedance-v2.0-i2v` + `modelType: 'i2v'`
  (drives VideoStudio's I2V mode on launch).
- **Params:** `duration` (strip the `s` suffix → number), `aspectRatio` → `aspect_ratio`.
- **Media:** `media` array (if present) → `previewVideo` + `thumbnail` poster.
- **Attribution:** `source.name` + `source.url` + `rightsStatus` preserved.

### 3. awesome-seedance — ZeroLu (markdown parser)
- **Script:** `scripts/generate-seedance-manifest.mjs` (reuse the name of the
  *existing* seedance demo generator — note: it currently serves the **Minimax H3**
  seedance demos under `/media/seedance-2.5/`; disambiguate by fetching the ZeroLu
  repo, not the Anil-matcha one).
- **Parser:** read `prompts/*.md` + README use-case `### N.x` sections; extract the
  `Prompt:` block (or fenced code) and the `Source:` / `@handle` + X permalink;
  read `duration`/`aspect ratio` from the prose; map `videos/*.mp4` → `previewVideo`.
- **Model:** Seedance 2.0 → `seedance-v2.0-t2v`.
- This is the most fragile source (markdown scraping). Defer to v2 if the 1.6 MB
  catalog.json (source #2) already covers the use cases at better fidelity.

### 4. ai-shortfilm-prompts (templates — CinemaStudio v2)
- **Script:** `scripts/generate-shortfilm-manifest.mjs` fetches
  `prompts/index.json`, then lazy-loads each `prompts/*.md` for full prompt text.
- **Templates:** the 21 `templates/*.md` files describe a **5-stage cinematic
  structure** (Core theme · Character & scene · Atmosphere & quality · Camera rules ·
  Storyboard) that maps directly onto CinemaStudio's `buildNanoBananaPrompt` +
  `CameraControls` + motion/style controls. Emit these as
  `stylePreset`-flagged assets targeting `studio: 'cinema'`.
- **Metadata:** `ipSafe` (flags IP-heavy prompts like Kai'Sa/Kamen Rider — route to
  ImageStudio or hide behind an IP-warning), `reroll` (effort hint shown as a "ⓘ"
  cost badge), `tags`.
- **Model:** model-agnostic; default to `seedance-v2.0-t2v` for VideoStudio.

## Model Mapping Master Table

| Source repo | Feed model / mode | SmartVideo model ID | Studio | Mode |
|---|---|---|---|---|
| visual-prompt-feed | `seedance` (video) | `seedance-v2.0-t2v` | `video` | t2v |
| visual-prompt-feed | `nanobanana` (image) | `nano-banana-2` | `image` | t2i |
| visual-prompt-feed | `gptimage` (image) | `nano-banana-2` ⚠ fallback | `image` | t2i |
| awesome-seedance-2.5 | `mode: text-to-video` | `seedance-v2.0-t2v` | `video` | t2v |
| awesome-seedance-2.5 | `reference-to-video` / image ingredient | `seedance-v2.0-i2v` | `video` | i2v |
| awesome-seedance (ZeroLu) | Seedance 2.0 | `seedance-v2.0-t2v` | `video` | t2v |
| ai-shortfilm templates | genre templates | `seedance-v2.0-t2v` | `cinema` | t2v |

## Studio-Layer Changes (minimal, non-protected)

1. **`src/lib/exampleGalleryBridge.js`** — add a unified branch for
   `source` in `handleCreateThisStyle` / `handleViewPrompt`:
   - `handleCreateThisStyle`: `navigate(asset.studio, { prompt: asset.prompt,
     model: asset.model, aspect_ratio: asset.aspectRatio, duration: asset.duration,
     generate_audio: asset.generateAudio, ...(asset.modelType ? { model_type: asset.modelType } : {}),
     ref: asset.source })`.
   - `handleViewPrompt`: reuse the existing `showPromptModal`, but enrich it to also
     render `attribution.author` + `attribution.sourceUrl` + `previewVideo` if present.
2. **`src/components/VideoStudio.js`** — add `model` + `generate_audio` +
   `model_type` URL-param reads (mirror the existing `aspect_ratio`/`duration` reads
   at lines 103-114). `model` pre-selects via `selectedModel`; `model_type: 'i2v'`
   toggles `imageMode`; `generate_audio` flips the seedance audio flag.
3. **`src/components/ImageStudio.js`** — add `model` param read (so nanobanaba
   `nano-banana-2` pre-selects).
4. **`src/components/studios/ExampleGallery.js`** — render `previewVideo` (play on
   hover/mousedown) when present, else fall back to `thumbnail`. Small additive change.
5. Attribution banner in each studio chrome when `ref` matches an external source
   (a thin "Prompt via @author on X · View source" bar under the prompt textarea).

`VideoStudio.js`, `ImageStudio.js`, `exampleGalleryBridge.js`, and
`studios/ExampleGallery.js` are **not** in the protected-systems list
(Director / VideoAgent / Timeline / Render / apps/ai-vfx are). Safe to edit.

## Data-Sync Strategy

All four repos use **build-time manifest scripts** — the same precedent as
`generate-minimax-h3-manifest.mjs` / `generate-seedance-manifest.mjs`. Each writes a
small committed index + code-split prompt companion:

```
src/data/
  visualPromptFeedAssets.js        + visualPromptFeedPrompts.js  (lazy)
  seedance25Assets.js              + seedance25Prompts.js        (lazy)
  aiShortfilmAssets.js             + aiShortfilmPrompts.js       (lazy)
  awesomeSeedanceAssets.js         + awesomeSeedancePrompts.js    (lazy, v2)
```

A single daily **`sync-external-prompt-repos.yml`** GitHub Action fetches all four
upstream sources, runs all four generators, and opens a PR on `deangilmoreremix/`
when any manifest diffs — so the studio gallery refreshes without manual deploys.
The `visual-prompt-feed` fork already publishes a daily refresh badge; mirror that.

**Runtime/edge-function proxy is deferred** — build-time covers the "continuously
refreshed" need via the daily PR, with zero infra and zero bundle cost (large prompt
text stays code-split, identical to the existing `seedancePrompts` pattern).

## Key Assumptions to Validate

- [ ] **Feed fetch reliability (build-time):** `prompts.json` is 8.5 MB. If the
  GitHub raw fetch rate-limits the build runner, the script falls back to
  `git clone --depth 1` of the fork. Validate in CI before relying on it.
- [ ] **Seedance 2.5 mode mapping:** `mode: reference-to-video` + image ingredients
  must wire to VideoStudio's I2V flow. Confirm `seedance-v2.0-i2v` exists in
  `i2vModels` and that pre-selecting it flips the mode toggle correctly (VideoStudio
  line 117). Seedance 2.5 first-last-frame (`seedance-2.5-first-last-frame`) is a
  v2 refinement for the reference-image prompts.
- [ ] **Thumbnail safety:** VPF `media.previewUrl` and Seedance 2.5 `media` URLs
  are NOASSERTION third-party images. The app proxies/fetches them client-side
  (`createSafeImage`/`createSafeVideo` in `lib/security.js`). Confirm no hotlink
  blocking on the ImgLume CDN.
- [ ] **Attribution is mandatory, not cosmetic:** the feed and ai-shortfilm both
  require preserving source author + permalink. The studio banner must render it, or
  we breach the rights grant.
- [ ] **Gallery ordering:** VPF's `source.engagement` (likes/reposts/replies) is a
  strong recency+popularity signal. Validate product wants "most-liked X posts"
  ranked into the gallery vs. pure newest-first.
- [ ] **`gptimage` gap:** the feed tags 798 image prompts with `recommendedModel:
  gptimage`, but `gptimage` has no entry in the app's `t2iModels` (only OpenAI's
  `gpt-image-1.5`/`gpt-image-2` in `openaiService.js`, which isn't a muapi model).
  Confirm whether to (a) fall back to `nano-banana-2` for MVP or (b) wire OpenAI
  image gen into ImageStudio.
- [ ] **ZeroLu markdown parser durability:** the `Prompt:` extraction regex must
  survive fenced-code-vs-indented variations across the 24 use-case files. Validate
  against a sample before committing the generator.

## MVP Scope (Week 1)

**In:**
- `scripts/generate-vpf-manifest.mjs` + `scripts/generate-seedance25-manifest.mjs`
  (the two structured-JSON sources — highest signal, lowest parsing risk).
- `src/data/visualPromptFeedAssets.js` + `visualPromptFeedPrompts.js` (lazy),
  `src/data/seedance25Assets.js` + `seedance25Prompts.js` (lazy).
- `src/data/exampleGalleryAssets.js` — spread both new arrays into `EXAMPLE_ASSETS`.
- `src/lib/exampleGalleryBridge.js` — unified external-source branch in both
  `handleCreateThisStyle` and `handleViewPrompt`.
- `src/components/VideoStudio.js` — `model` + `generate_audio` + `model_type` param
  reads; seedance i2v toggle.
- `src/components/studios/ExampleGallery.js` — optional `previewVideo` hover play.
- `.github/workflows/sync-external-prompt-repos.yml` — daily manifest regen + PR.

**Out:**
- ZeroLu `awesome-seedance` markdown parser (v2 — same content family as the
  catalog.json source above; redundant until the catalog is exhausted).
- ai-shortfilm `templates/*.md` → CinemaStudio 5-stage wiring (v2 — bigger
  studio-surface change, not the "build a video from a prompt" core ask).
- Runtime edge-function proxy for live fetching (build-time + daily PR suffices).
- Category→studio routing beyond `mediaType` (cinematic→cinema) — defer to v2.
- Image prompts opening ImageStudio with native OpenAI gpt-image — defer (gptimage
  gap); MVP maps image prompts to `nano-banana-2` and routes them to ImageStudio.
- Using feed `media[].sourceUrl` as I2V reference inputs (NOASSERTION copyright
  surface — must not pass third-party media into generation in MVP).

## Open Questions

- Should the per-studio gallery show a "source" badge distinguishing VPF vs Seedance
  2.5 vs MiniMax H3? It helps attribution transparency but adds UI density.
- Does `ai-shortfilm`'s `ipSafe: false` (Kai'Sa, Kamen Rider) mean those prompts
  should be **excluded** from the gallery for end-user compliance, or shown behind a
  warning? The repo itself flags this — decide a policy.
- Should the daily sync PR also regenerate the MiniMax H3 / Seedance demo manifests
  (consolidate into one workflow), or keep them separate?

## Relationship to existing docs

- `docs/VIDEO_PROMPT_INTEGRATION_PLAN.md` — the broader roadmap
  (seedance/minimax/flux/wan/grok studio mapping). This doc is the **ingestion layer**
  for the four specific repos you just added; it plugs into that same template
  schema and studio-map.
- `docs/ideas/content-library.md` — the user-upload Content Library studio.
  Separate concern (user uploads vs. external curated prompts), but the two share
  the `EXAMPLE_ASSETS` → `ExampleGallery` → `exampleGalleryBridge.js` pipeline once
  a generated video is saved back to the user's library.
