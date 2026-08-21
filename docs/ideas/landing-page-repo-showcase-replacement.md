# Landing Page Showcase Replacement — 3 Repo Integration

## Problem Statement

Replace the existing Seedance 2.5 showcase (15 Anil-matcha demos) with a unified video showcase drawing from three upstream repos that ship actual playable videos: `BeatAPI/awesome-seedance-2-5-prompts` (300 Seedance 2.5 videos), `BeatAPI/awesome-minimax-h3-prompts` (300 MiniMax H3 videos), and `ZeroLu/awesome-seedance` (17 Seedance 2.0 reference videos). All entries are filtered to English prompts only and normalized to the same data structure as the existing `minimaxH3Demos.js` showcase.

## Two Sections Being Replaced

| Existing Component | Section on Landing | What Replaces It |
|---|---|---|
| `SeedanceShowcase.jsx` | "Seedance 2.5 Prompt Examples" (15-demo filtered grid, category pills, lazy video frames, prompt modal) | Unified `RepoVideoShowcase.jsx` — merged content from all 3 repos, same UI shell |
| `RepoShowcase.jsx` | "Ecosystem — Prompt Libraries, SDKs, and Workflow Templates" (card grid of GitHub repo links) | Updated `RepoShowcase.jsx` — 3 repos as featured "Prompt Libraries" cards + same supporting categories |

## Video Inventory (verified live — 3 repos, English-only)

**English-only filtering** — the generator scripts filter out entries whose `prompt` field is predominantly non-English (CJK character ratio > 30%). This is necessary because the BeatAPI repos contain bilingual entries:

| `BeatAPI/awesome-minimax-h3-prompts` | 300 JSON (254 English / 46 Chinese-filtered) | **254** | `media.beatapi.io` CDN (`.webm`) | ✅ 5/5 tested URLs HTTP 200; `title`/`description` bilingual `{en,zh}` dicts, `video`/`thumbnail` direct fields, 17 subcategories |
| `BeatAPI/awesome-seedance-2-5-prompts` | 300 JSON (250 English / 50 Chinese-filtered) | **250** | `media.beatapi.io` CDN (`.webm`) | ✅ 10/10 tested URLs HTTP 200; `title`/`description` bilingual `{en,zh}` dicts, `media` nested object, 13 categories + 5 workflow modes |
| `ZeroLu/awesome-seedance` | README (9 EN use-case categories) + 1 CN prompt `.md` + 17 MP4s | **17** | committed `videos/*.mp4` in repo (excl. test.mp4) | ✅ 17 MP4s via GitHub API (74 MB); README.md has English prompts in code blocks; `prompts/commercial-use-cases.md` is Chinese-only (skipped) |

**Total English video entries available: 521** (254 + 250 + 17).

## Data Structure: Normalize to Existing Showcase Format

Every entry from all 3 repos is normalized to the exact field schema used by both existing data files — `src/data/minimasesH3Demos.js` (lines 21-480, consumed by `AIVideoGallery.jsx`) and `src/data/seedanceDemos.js` (consumed by `SeedanceShowcase.jsx`). Both files share this schema:

```js
{
  id: 1,
  slug: "descriptive-kebab-case-slug",
  title: "Readable English Title",          // auto-generated when upstream title is poor
  category: "Cinema",                       // mapped from raw category to 12-label MiniMax vocab
  useCase: "Short description of what this prompt demonstrates",
  duration: 15,                             // integer seconds (parsed from "15s" strings)
  aspectRatio: "16:9",
  videoSrc: "/media/seedance-2.5/videos/slug.webm",  // local path after download
  posterSrc: "/media/seedance-2.5/previews/slug.webp", // local path after download
  tags: ["keyword", "style", "genre"],
  upstreamCategory: "cinematic-story",      // original raw category preserved
  sourceAuthor: "@creator_handle",
  sourceUrl: "https://x.com/creator/status/12345",
  workflow: "t2v",                        // "t2v" or "i2v" (mapped from BeatAPI mode)
  featured: true,                         // optional: marked as featured
}
```

### Category Mapping (3 repos → 12-label MiniMax vocab)

The existing `AIVideoGallery.jsx` (MiniMax H3) uses 12 categories: `Action, Animation, Beauty, Characters, Cinema, Commercial, Fashion, Food, Social, UGC, VFX, Web / UI`. The user requested matching this exactly for all 3 repos. The existing `seedanceDemos.js` (Anil-matcha) uses a different 9-label system (`Cinematic, Commercial, Cultural, Fashion, Nature, Product, Sci-Fi, VFX, Animation`) — these will be consolidated into the 12-label MiniMax vocab in the unified showcase.

**Seedance 2.5 categories (13 raw → 12-label):**

| Raw category | Count | Mapped label |
|---|---|---|
| cinematic-story | 61 | Cinema |
| cinematic-action | 54 | Action |
| brand-film | 49 | Commercial |
| music-video | 46 | Social |
| vlog | 28 | Social |
| animation | 26 | Animation |
| fantasy | 13 | Cinema |
| documentary | 7 | Cinema |
| comedy | 5 | Social |
| horror | 4 | Cinema |
| dance | 3 | Fashion |
| performance | 2 | Social |
| dialogue | 2 | Social |

**MiniMax H3 categories (17 raw → 12-label):**

| Raw category | Count | Mapped label |
|---|---|---|
| cinematic-story | 76 | Cinema |
| product-commercial | 68 | Commercial |
| music-video | 47 | Social |
| anime | 21 | Animation |
| action | 15 | Action |
| cinematic-travel | 15 | Cinema |
| fashion | 14 | Fashion |
| horror | 9 | Cinema |
| gameplay | 7 | Action |
| motion-graphics | 6 | VFX |
| comedy | 5 | Social |
| vlog | 5 | Social |
| animation | 5 | Animation |
| brand-film | 3 | Commercial |
| viral-short | 2 | Social |
| title-sequence | 1 | VFX |
| product-demo | 1 | Commercial |

### English-Only Filtering

**If the prompt is in Chinese, skip the entry entirely.** The BeatAPI repos contain bilingual entries — some prompts are predominantly CJK characters. The generator filters using `ascii_ratio(prompt) >= 0.7`: if fewer than 70% of the prompt text is ASCII, the entry is skipped entirely (no video card is created). This removes 50 Chinese entries from Seedance 2.5 (250 retained) and 46 from MiniMax H3 (254 retained).

### Auto-Titling Algorithm

The BeatAPI repos use auto-generated slugs as titles for some entries (e.g., `seedance-2-5-312407`, `first-storyboard-image-to-video-using-s-minimax-h3-on-995928`). The generator assigns readable titles using this priority:

1. **If `title.en` passes usability check** (4+ words, no Chinese chars, no trailing numeric ID, not just the slug, no generic phrases like "this video was", "duration:", "create a 15 second"): use it
2. **Otherwise, extract from prompt content**:
   - Skip format/structure header lines (`Duration:`, `Format:`, `Camera:`, `[0-5s]`, etc.)
   - Find first substantial English sentence describing the creative concept
   - Clean and truncate to 80 chars
3. **Fallback**: derive from slug words (e.g., `flying-robot-cyberpunk` → "Flying Robot Cyberpunk")

### Workflow Mode Mapping

BeatAPI `mode` field → existing `workflow` field:

| BeatAPI `mode` | Existing `workflow` |
|---|---|
| `text-to-video` | `t2v` |
| `reference-to-video` | `i2v` |
| `image-to-video` | `i2v` |
| `multimodal` | `i2v` |
| `video-to-video` | `i2v` |

### ZeroLu Title Derivation

The 17 MP4 files in `videos/` are named generically (`adam_video.mp4`, `john1_video.mp4`, etc.). Five filenames appear in the README (`adam`, `bootoshi`, `guizang`, `lucy_love_ai`, `mollick`, `nachos2d`, `vicky`). The 10 "john*" files are sourced from X posts by `@johnAGI168` but don't have README section headings. Auto-titles will be generated from available metadata (README section headings where matchable, filename-derived otherwise like "Adam Reference Clip").

## Architecture: Replace, Don't Duplicate

### Shared UI engine (parameterize only)

`src/components/landing/sections/minimax/{mediaFrame.js, ui.js, DemoPromptModal.js}` — already handles lazy video loading, poster-first, playback governor, reveal-on-scroll, prompt modal with copy + attribution, and CTA routing. Two call sites have MiniMax-specific imports that must be parameterized so any repo manifest can plug in:

**`ui.js`** — `createStyleLink` imports `getCreateTarget` from `minimaxH3Demos.js` directly (line 8). Parameterize:

```js
export function createStyleLink(demo, options = {}) {
  const { getTarget } = options;
  const target = getTarget ? getTarget(demo) : getCreateTarget(demo);
  // rest unchanged — uses target.href, target.route, target.params
}
```

**`DemoPromptModal.js`** — `openDemoPromptModal(demo, trigger, options)` already accepts `options.loadPrompt` and `options.model`. The footer's "Create This Style" button (line 161) calls `createStyleLink(demo, { label, variant: 'primary' })` without forwarding `getTarget`. Add `getTarget: options.getTarget` to that call so the modal's CTA routes to the correct studio per repo.

Both changes are **backward-compatible** — existing components call without options and get identical current behavior.

### Per-repo data layer (new — mirrors existing pattern)

Each repo gets: one generator script → one eager data manifest → one lazy prompt JSON. Exactly like the existing `generate-seedance-manifest.mjs` → `seedanceDemos.js` + `seedancePrompts.json`.

```
scripts/
  generate-minimaxh3-manifest.mjs      → src/data/minimaxesH3Demos.js     + src/data/minimaxesH3Prompts.{json,js}
  generate-seedance25-manifest.mjs      → src/data/seedance25Demos.js      + src/data/seedance25Prompts.{json,js}
  scripts/generate-seedance-manifest.mjs  → src/data/awesomeSeedanceDemos.js   + src/data/awesomeSeedancePrompts.{json,js}

public/media/
  minimaxes-h3/{videos/, previews/}      — 30 curated BeatAPI clips + 30 posters (downloads from media.beatapi.io CDN)
  seedance-2.5/{videos/, previews/}      — 30 curated BeatAPI clips + 30 posters (downloads from media.beatapi.io CDN)
  awesome-seedance/{videos/, previews/}   — 17 ZeroLu MP4s + 17 posters (downloads from GitHub repo)
```

**Generator script responsibilities:**
- Fetch raw JSON/markdown from GitHub
- **Skip entries entirely if the prompt is in Chinese** (ASCII ratio < 0.7)
- Auto-generate readable titles where upstream `title.en` is poor
- Map categories to the 12-label vocab
- Map `mode` to `workflow` (`t2v`/`i2v`)
- Download curated video clips + generate/download posters to `public/media/`
- Write normalized demo manifest + lazy prompt JSON

### Showcase component (new — replaces SeedanceShowcase.jsx)

`ShowcaseRepoVideo.jsx` — a single component that merges all 3 repo manifests into one `ALL_REPO_DEMOS` array and renders the same filtered grid UI as `AIVideoGallery.jsx`. Same category filter bar, same lazy video frames, same prompt modal.

Key reuse: imports `minimax/ui.js` (`sectionHeading`, `metaPill`, `escapeHtml`, `createViewPromptButton`, `createStyleLink`) and `minimax/mediaFrame.js` (`createMediaFrame`, `cleanupFrames`, `revealOnScroll`). Passes repo-specific `getTarget`, `loadPrompt`, and `model` via the parameterized options.

### RepoShowcase component (updates existing)

Update `REPO_CATEGORIES` in `RepoShowcase.jsx` — **Prompt Libraries** section replaces the Anil-matcha repos:

1. `awesome-seedance-2-5-prompts` (BeatAPI) — "250 Seedance 2.5 prompt templates (English-filtered from 300) with camera controls and cinematic examples."
2. `awesome-minimax-h3-prompts` (BeatAPI) — "254 MiniMax H3 prompt templates (English-filtered from 300) across 17 subcategories."
3. `awesome-seedance` (ZeroLu) — "17 Seedance 2.0 reference videos + 9 use-case categories of prompts."

Keep the remaining categories (SDKs, Workflows, Comparisons, Curriculum) unchanged.

## Landing Page Wiring (replacement, not addition)

In `LandingPage.jsx`, swap two import lines:

```js
// BEFORE (remove this):
const seedanceShowcase = createLazySection(() => import('./sections/SeedanceShowcase.jsx'), 'seedance', {}, 8);

// AFTER (replace with):
const repoVideoShowcase = createLazySection(() => import('./sections/ShowcaseRepoVideo.jsx'), 'repo-video', {}, 8);
```

No new section is added to the scroll order — `SeedanceShowcase` is directly replaced by `ShowcaseRepoVideo` in the same slot.

## MVP Scope (Week 1)

**In:**
- Parameterize `ui.js` `createStyleLink` and `DemoPromptModal.js` `openDemoPromptModal` to accept `getTarget` / `loadPrompt` / `model` via options (backward-compatible)
- `scripts/generate-minimaxh3-manifest.mjs` — fetches `BeatAPI/awesome-minimax-h3-prompts` individual JSONs (254 English), auto-titles poor slugs, maps 17 categories to 12-label vocab, downloads 30 curated `.webm` clips + posters from `media.beatapi.io`, writes `minimaxesH3Demos.js` (254 entries) + `minimasesH3Prompts.json`/`minimasesH3Prompts.js`
- `scripts/generate-seedance25-manifest.mjs` — fetches `BeatAPI/awesome-seedance-2-5-prompts` catalog.json (250 English), auto-titles poor slugs, maps 13 categories + 5 workflow modes, downloads 30 curated `.webm` clips + posters, writes `seedance25Demos.js` (250 entries) + `seedance25Prompts.json`/`seedance25Prompts.js`
- `scripts/generate-seedance-manifest.mjs` — fetches ZeroLu README.md (9 use-case categories, English prompts in code blocks), downloads 17 `videos/*.mp4` (excl. test.mp4) + generates WebP posters, writes `awesomeSeedanceDemos.js` (17 entries) + `awesomeSeedancePrompts.json`/`awesomeSeedancePrompts.js`
- `src/components/landing/sections/ShowcaseRepoVideo.jsx` — unified merged showcase, mirrors `AIVideoGallery.jsx` grid + filter UI, parameterized per-repo
- `src/components/landing/sections/RepoShowcase.jsx` — update `REPO_CATEGORIES` Prompt Libraries to the 3 target repos
- `LandingPage.jsx` — swap `SeedanceShowcase` import → `ShowcaseRepoVideo` import
- `public/media/minimaxes-h3/` — 30 curated BeatAPI clips + 30 posters
- `public/media/seedance-2.5/` — 30 curated BeatAPI clips + 30 posters
- `public/media/awesome-seedance/` — 17 ZeroLu MP4s + 17 posters

**Total MVP media files: 77** (30 + 30 + 17 videos + 77 posters = 154 files)

**Total showcase entries: 521** (254 + 250 + 17 — all English videos, with 77 downloaded locally and 444 hotlinked from CDN)

**Out (v2):**
- Full 300 BeatAPI videos downloaded locally (MVP ships 30 curated each; remaining 444 entries hotlink directly from `media.beatapi.io` CDN, swapped to local on daily sync PR)
- Category auto-mapping refinement (initial mapping is heuristic via prompt keyword extraction; v2 adds LLM-assisted category tagging for higher precision)

## Not Doing (and Why)

| Item | Reason |
|---|---|
| **Adding a fourth showcase repo (VPF/ai-shortfilm)** | VPF has 0 playable videos (thumbnails only); ai-shortfilm has 0 videos (markdown prompts only). Neither repo ships actual video media. Defer to SmartVideo pipeline + separate showcase. |
| **Adding a third showcase section** | The existing `seedanceShowcase` slot in `LandingPage.jsx` is reused — same scroll position, same stagger index. No layout shift. |
| **Chinese-language entries**: BeatAPI repos contain bilingual entries with Chinese prompts (50 in Seedance 2.5, 46 in MiniMax H3). **These are skipped entirely** — no video card is created, no media is downloaded. The generator uses `ascii_ratio(prompt) < 0.7` as the skip threshold. No UI toggle needed — landing page ships English-only. |
| **Full 300 BeatAPI local downloads** | MVP ships 30 curated clips per BeatAPI repo (77 total video files). Remaining 444 English entries hotlink directly from `media.beatapi.io` CDN (verified HTTP 200). CDN URLs are stable permanent links — safe for production hotlinking. Local downloads swapped in via daily sync PR. |
| **ZeroLu README full parsing** | ZeroLu has 9 English use-case categories in README with embedded prompts, but 10 of the 17 MP4 files (`john1_video.mp4` through `john10_video.mp4`) have no direct README mapping. These get auto-titled from filename (e.g., "John 1 Reference Clip"). The `prompts/commercial-use-cases.md` file is Chinese-only — skipped. |
| **ZeroLu video-to-prompt matching** | The 17 MP4 filenames (`adam_video.mp4`, etc.) don't correspond 1:1 to README section headings. 7 are mentioned in README by creator name; 10 are `john*` (sourced from @johnAGI168 posts). Matching via README embedded GitHub user-attachment URLs is not attempted — the videos are treated as a reference library with filename-derived or README-derived titles. |

## Key Assumptions to Validate

- [ ] **`ui.js` parameterization preserves existing behavior**: MiniMax H3 and Seedance 2.5 components call `createStyleLink(demo)` with no options — the default fallback path must return identical results.
- [ ] **Seedance 2.5 model mapping**: BeatAPI `workflowMode` field values (`reference-to-video`, `text-to-video`, `image-to-video`, `multimodal`, `video-to-video`) map to `workflow: "i2v"` or `"t2v"`. Confirm `i2v` entries (reference-to-video, image-to-video, multimodal, video-to-video) all route to the `seedance-v2.0-i2v` studio route in `CATEGORY_ROUTES`.
- [ ] **CDN hotlink stability**: BeatAPI's `media.beatapi.io` CDN URLs are permanent (no expiry). Verify with multiple `curl HEAD` requests over 24h that URLs remain HTTP 200. If URLs expire, must download all 504 clips locally.
- [ ] **Category vocab alignment**: BeatAPI `mode` + `category` fields map to the 12 existing labels (Action, Animation, Beauty, Characters, Cinema, Commercial, Fashion, Food, Social, UGC, VFX, Web/UI) for unified filtering. "gameplay" → Action and "product-demo" → Commercial mappings are heuristic — verify they produce sensible filter groupings.
- [ ] **Attribution in modal footer**: Parameterized `DemoPromptModal` must render `source.name` + `source.url` for all 3 repos. BeatAPI uses `source = {kind: "x", name: "@handle", url: "..."}`; ZeroLu uses README "Source: Creator ([@handle](url))" pattern.
- [ ] **Poster generation for ZeroLu MP4s**: 17 local MP4s need WebP poster frames generated client-side (no CDN thumbnails available). Confirm `mediaFrame.js` poster loading works with generated posters, not just static images.

## Open Questions

1. **CDN hotlink vs. local download**: MVP ships 30 local clips per BeatAPI repo + 444 CDN hotlinks. Confirm the `mediaFrame.js` lazy video engine handles external CDN URLs identically to local paths (`<video src="https://media.beatapi.io/...">` vs `<video src="/media/...">`).
2. **ZeroLu video-to-category mapping**: The 10 `john*_video.mp4` files have no README category. Should they be assigned to a generic "Reference" category, or should the generator try to match them to README use-case patterns by content?
3. **English filtering threshold**: Current `ascii_ratio >= 0.7` is conservative. Some entries with 60-70% ASCII might be usable. Should the threshold be lowered to 0.6 to capture more entries?
4. **MVP showcase size**: 521 entries is large for initial render. Should the MVP paginate (e.g., 48 per page with "Load More") or render all entries with virtual scrolling via the existing `AIVideoGallery.jsx` lazy-load mechanism?
