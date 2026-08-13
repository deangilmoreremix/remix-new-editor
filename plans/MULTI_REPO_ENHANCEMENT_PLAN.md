# Multi‑Repo Audit & Enhancement Plan
**Subject:** Integrating 17 open‑source repos (MiniMax H3, Wan 3.0, FLUX 3, Grok Imagine 2, Seedance 2.5, Claude Fable 5, Generative‑Media‑Skills, AI‑Creator‑Academy, and the model‑comparison/prompt libraries) into **remix‑new‑editor / SmartVideo** and all its studios.
**Date:** 2026‑08‑13
**Method:** Full‑content audit of every repo (source files, JSON catalogs, MCP `server_core.py`, SKILL.md packs, curriculum tracks — not just READMEs). Cloned to `/tmp/repo_audit`.

---

## 1. Executive Summary

**The single most important finding: every one of the 17 repos talks to the same backend we already use — MuAPI (`https://api.muapi.ai/api/v1`), authenticated with `x-api-key`, using the async pattern `POST → request_id → GET predictions/{id}/result`.** That means this work is *additive*, not new infrastructure. A single `MUAPI_API_KEY` already unlocks every model below.

What the repos give us, mapped to our product:

| Source cluster | What it provides | How we consume it |
|---|---|---|
| 6 model SDKs (MiniMax H3, Wan 3.0, FLUX 3 Dev, Grok Imagine 2, flux‑3‑video, Seedance 2.5) | **New model endpoints** + exact payload schemas + 5 MCP servers | New entries in `src/lib/models.js` → auto‑rendered controls in every studio |
| 3 prompt/awesome repos (MiniMax H3 prompts, Seedance 2.5 prompts, FLUX 3 prompts) | **Prompt catalogs, use‑case libraries, camera/lighting vocabulary** | In‑app "Prompt Template Gallery" + camera‑movement dropdown |
| 2 model‑comparison repos (awesome‑ai‑video‑models, awesome‑ai‑image‑models) | **Price / speed / quality / resolution data** for ~40 models | "Model Picker" intelligence (cost & quality surfaced at selection) |
| Generative‑Media‑Skills | **70+ agent skills** (prompt→generate→edit→stitch pipeline) | In‑app "Recipe" buttons + automation pipelines |
| ai‑creator‑academy | **15‑track monetization curriculum + pricing/outreach/contract templates** | In‑product "Business / Monetization" hub |
| seedance2.5‑comfyui + seedance‑2/2.5‑mcp | **ComfyUI nodes + 2 MCP servers (6 tools each)** | Backend tool surface for agent mode + reference payload contracts |
| awesome‑claude‑fable‑5 | **94 LLM use‑cases + MuAPI 20%‑off Fable 5 offer** | AI‑assistant presets + cost‑optimized LLM routing |

**Central extension point confirmed:** `src/lib/models.js` (auto‑generated from `models_dump.json` via `scripts/generate-model-catalog.mjs`) feeds a **dynamic control engine** (`src/lib/modelInputExtensions.js` + `buildDynamicControls`) that reads each model's `inputs` schema and auto‑renders sliders/enums/seed fields in **every studio**. So adding a model = adding a data record, not writing UI.

---

## 2. Audit Findings (per repo, source‑only)

### 2.1 Model SDKs — exact MuAPI endpoints & parameters
All POST `https://api.muapi.ai/api/v1/{model-slug}` with `x-api-key`; poll `predictions/{id}/result`.

| Repo | Endpoint slug(s) (`model`) | Type | Key params (defaults) | Audio |
|---|---|---|---|---|
| **MiniMax‑H3** | `minimax-h3-text-to-video`, `minimax-h3-image-to-video` (with `last_image_url`), `minimax-h3-reference-to-video` | t2v / i2v / ref→v | prompt, aspect_ratio=16:9, resolution=2k, duration=5; refs: images/videos/audios | via refs |
| **Wan‑3.0** | `wan-3.0-t2v`, `wan-3.0-i2v`, `wan-3.0-reference-to-video` | t2v / i2v / ref→v | + seed, resolution=720p, `audio=false` (native audio toggle) | ✅ |
| **FLUX 3 Dev** | `flux-3-dev`, `flux-3-text-to-image`, `flux-3-image-to-image` (≤4 refs), `flux-3-text-to-video`, `flux-3-image-to-video` | t2i / i2i / t2v / i2v | resolution 1k/2k/4k (img) or 480p/720p/1080p (vid); duration 4–10; `generate_audio=true` | ✅ |
| **Grok Imagine 2** | `grok-imagine-image-2` | t2i / i2i | aspect_ratio ∈ 9 ratios; `images_list` 1–5 (multi‑ref edit) | — |
| **flux‑3‑video** | `flux-3-text-to-video`, `flux-3-image-to-video` | t2v / i2v | *identical slugs to FLUX 3 Dev* (video‑only wrapper) | ✅ |
| **Seedance 2.5** | `seedance-2.5-{variant}{family}{res}` → **72 combos** (6 families × standard/intl/spicy × 480p/720p/1080p/4k) + `seedance-2-character`, watermark‑remover(+pro), legacy 2.0 edit/extend | t2v/i2v/flf/omni/edit/extend | prompt, aspect_ratio, duration 4–30, seed, `generate_audio` (edit/extend), variant, resolution; `first_last_frame` = exactly 2 images; `omni_reference` = ≤20 images + ≤6 video + ≤6 audio | ✅ (edit/extend) |

**Notable capabilities to harvest:** first/last‑frame control (MiniMax `last_image_url`, Seedance `first-last-frame`), multimodal references (MiniMax/Wan/Seedance omni), **character consistency** (Seedance 2‑step: `create_character` → `omni_reference` with `sheet_url`), **native synchronized audio** (Wan `audio`, FLUX 3 `generate_audio`, Seedance edit/extend).

**Gotcha:** Our `lib/muapi.js` currently POSTs to `/api/v1/generate` with `{model, ...}`. The SDKs POST to `/api/v1/{slug}` directly. The existing `supabase/functions/muapi-proxy` (referenced by `scripts/check-endpoint-coverage.mjs`) and the per‑model `endpoint` field in `models.js` already bridge this — new models must set their `endpoint` to the slug and the proxy normalizes. **Action: verify proxy maps `endpoint` → `/api/v1/{endpoint}` for the new slugs.**

### 2.2 Prompt / camera libraries
- **awesome‑minimax‑h3‑prompts** — richest: `prompts/catalog.json` (21 entries) + `gallery.json` (30) with a clean schema (`slug, title, category, mode[t2v|first-frame|first-last-frame|reference|regeneration], duration_seconds, ratio, prompt, references[], tags[]`). `docs/prompting-guide.md` defines a camera vocabulary (locked‑off, slow push‑in, lateral track, gentle orbit, handheld follow, rack focus, whip pan, crane, dolly). 5 use‑case index tables.
- **awesome‑seedance‑2.5‑api‑prompts** — 1172‑line README: 72 routes, full price/sec table ($0.17–$1.70), **camera‑movement keyword table** (push/dolly, pull back, tracking, crane, steadicam, orbit/360, whip pan, locked‑off, bird's‑eye, worm's‑eye, handheld, gimbal, rack focus, FPV) + **lighting keyword table** (golden hour, chiaroscuro, neon, soft‑box three‑point, volumetric, butterfly, etc.), 30‑prompt library across 10 categories.
- **awesome‑flux‑3‑api‑prompts** — 5 planned endpoints, 5‑part image / 6‑part video prompt formulas, 14 example prompts.
- **Unified prompt grammar** (shared): `SUBJECT + ACTION + ENVIRONMENT + CAMERA + [LIGHTING] + [STYLE] + [CONSTRAINTS]`. Maps 1:1 to a studio "starter preset" panel.

### 2.3 Model‑comparison data (→ Model Picker)
- **awesome‑ai‑video‑models:** 8 commercial (Veo 3.1, Sora 2, Kling 3.0, Runway Gen‑4.5, Seedance 2.0, Hailuo 2.3, Luma Ray 3, Pika 2.2) + 9 OSS (Wan 2.2, HunyuanVideo 1.5, LTX‑2.3, CogVideoX, Mochi 1, Open‑Sora 2.0, SkyReels‑V3, Cosmos, AnimateDiff) with price/sec, max res/length, latency, aggregator (MuAPI/Fal/Replicate).
- **awesome‑ai‑image‑models:** 8 commercial (Nano Banana Pro, GPT Image 1.5, FLUX.2 pro, Seedream 4.5, Imagen 4, Ideogram v3, Recraft V3, Midjourney v7) + 6 OSS with price/image, quality, VRAM.
- **Note:** Sora 2 API sunsets **Sept 24 2026**; Midjourney v7 has *no official API*. Useful caveats for the picker.

### 2.4 Generative‑Media‑Skills (70+ skills, one MuAPI backend)
- **Core primitives** (11 shell scripts): `generate-image/video`, `image-to-video` (with `--last-image-url`), `create-music`, `upload`, `edit-image`, `enhance-image`, `lipsync`, `video-effects`, `check-result`. Flow: resolve key → build payload from `schema_data.json` → POST → poll → return URL.
- **57 library skills** (motion/social/visual/edit/workflow) e.g. `ugc-video-factory`, `product-video-ad-maker`, `ai-clipping`, `youtube-shorts`, `social-media-video`, `ad-creative`, `youtube-thumbnail`, `cinema-director`.
- **13 `.opencode` MuAPI‑native recipes** — the integration‑ready ones: `muapi-seedance-2`, `muapi-ugc-video-factory`, `muapi-ai-clipping`, `muapi-social-media-video`, `muapi-youtube-shorts`, `muapi-product-video-ad-maker`, `muapi-nano-banana`, `muapi-ad-creative`, `muapi-youtube-thumbnail`.

### 2.5 ai‑creator‑academy (monetization curriculum)
15 tracks / ~67 lessons / ~50 templates. Monetization layer includes: **value‑based pricing ×0.30 formula**, retainer tiers ($3k/$6k/$12k mo), MSA/SOW contracts (50% deposit / 25% watermarked / 25% final; prompt libraries retained as Background IP), cold‑outreach & discovery scripts, and calculators (channel RPM, POD, realtor $99/$199/$399, micro‑tool MRR, bulk content $600–$2,800). Directly maps to a "Business Hub" feature.

### 2.6 ComfyUI + MCP servers
- **seedance2.5‑comfyui:** 10 nodes (T2V/I2V/First‑Last/Spicy×2/Omni/Character/ConsistentVideo/Extend/APIKey) — payload contract reference only (Python/ComfyUI, not JS).
- **seedance‑2‑mcp** & **seedance‑2.5‑mcp:** each **6 tools** (text_to_video, image_to_video, first_last_frame, omni_reference, predict_result, account_balance). 2.5 adds `seed` + resolution 720p/480p + dur 4–30 + larger omni limits.

### 2.7 awesome‑claude‑fable‑5
94 LLM use‑cases (8 categories) + documents **MuAPI 20% off Fable 5** (`POST /api/v1/claude-fable-5` with `{prompt, image_url, system_prompt}`). Reusable coding‑agent first‑prompt template → in‑app AI‑assistant presets; cost‑optimized LLM routing.

---

## 3. Integration Architecture (how it plugs into our app)

```
Studio UI (src/components/*.js)
   │  picks model + fills dynamic controls (auto-rendered from model.inputs)
   ▼
src/lib/models.js  ◄── generated from models_dump.json (add NEW model records here)
   │  endpoint slug + inputs schema
   ▼
src/lib/modelInputExtensions.js  (dynamic control engine: slider/enum/seed)
   ▼
lib/muapi.js  →  supabase/functions/muapi-proxy  →  https://api.muapi.ai/api/v1/{endpoint}
   │                                                  (x-api-key, async request_id → poll)
   ▼
Prompt Template Gallery (new) · Model Picker (new) · Recipe buttons (new) · Business Hub (new)
   └─ fed by: prompt JSON catalogs · comparison tables · Generative-Media-Skills · ai-creator-academy
```

**Confirmed extension points:**
1. `models_dump.json` → `src/lib/models.js` (t2i/i2i/t2v/i2v/v2v/lipsync/audio/avatar/training/videoTools/text arrays). New models = new JSON records with `id, name, provider, provider_name, endpoint, inputs{...}`.
2. Dynamic control engine reads `inputs` → auto UI. New params (e.g. `generate_audio`, `variant`, `seed`, `reference_images`) render automatically.
3. `lib/muapi.js` + `supabase/functions/muapi-proxy` normalize `endpoint` → MuAPI route. We must extend proxy to support the *new slug shapes* and the `reference_images/videos/audios`, `last_image_url`, `images_list`, `sheet_url` payloads.

---

## 4. Enhancement Plan (phased)

### Phase 0 — Unify the MuAPI contract (foundation, do first)
- **Goal:** make new endpoint slugs + payload shapes first‑class.
- Add to `muapi-proxy`: route mapping for `minimax-h3-*`, `wan-3.0-*`, `flux-3-*`, `grok-imagine-image-2`, `seedance-2.5-*` and the utility routes (`seedance-2-character`, watermark removers, legacy edit/extend).
- Ensure proxy passes through multimodal ref arrays (`reference_images/videos/audios`, `images_list`, `last_image_url`, `video`, `audios_list`, `sheet_url`) and optional fields (`webhook_url`, `generate_audio`, `variant`, `seed`).
- Add `generateReferenceToVideo` / `generateFirstLastFrame` / `generateOmniReference` / `createCharacter` / `consistentVideo` methods to `lib/muapi.js` (mirroring the SDKs) so studios can call them directly.

### Phase 1 — Add the new model families to the registry
- Add records to `models_dump.json` (then `npm run build` regenerates `models.js`):
  - **Image:** `flux-3-dev`, `flux-3-text-to-image`, `flux-3-image-to-image`, `grok-imagine-image-2`, plus their `inputs` (aspect_ratio enums, `images_list` 1–5 for Grok, ≤4 for FLUX i2i).
  - **Video (t2v/i2v):** `minimax-h3-text-to-video`, `minimax-h3-image-to-video`, `wan-3.0-t2v/i2v`, `flux-3-text-to-video`, `flux-3-image-to-video`, `seedance-2.5-*` (start with standard 720p/1080p t2v/i2v/first-last/omni).
  - **Utility:** `seedance-2-character` (character consistency), `seedance-2.0-watermark-remover`(+pro).
- Dedup: `flux-3-text-to-video`/`flux-3-image-to-video` exist in **both** Flux‑3‑Dev‑API and flux‑3‑video‑api with identical slugs — register **once**.
- Tag each with `provider` + `provider_name` + a `capabilities` array (`audio`, `references`, `first_last_frame`, `character`) for picker/UI logic.

### Phase 2 — Prompt Template Gallery + Camera/Lighting vocabulary
- Import `prompts/catalog.json` (MiniMax, 21) + parsed Seedance (30) + FLUX (14) prompts → a `promptTemplates` dataset (`{slug, model, mode, category, duration, aspect_ratio, resolution, prompt, references, tags, source, rights_note}`).
- Build a **browseable gallery** (thumbnail grid using `gallery.json` preview assets) inside Image/Video/Cinema studios with one‑click "Load into studio".
- Add a **camera‑movement dropdown** + **lighting dropdown** (union of vocabularies from §2.2) that injects keywords into the prompt field.
- Add a **structured prompt builder** (Subject / Action / Environment / Camera / Lighting / Style / Constraints) that compiles to the model grammar.

### Phase 3 — Intelligent Model Picker
- Seed a `modelComparison` dataset from the two awesome‑*‑models repos (name, maker, price, speed, quality, maxRes, maxLen, api: MuAPI/Fal/Replicate, caveats).
- Enhance the existing model dropdown (used across studios via `getModelsByType`) to show **price/sec, speed, quality badges** and a "best for" hint. Flag sunset models (Sora 2) and no‑API models (Midjourney v7).
- Surface **MuAPI 20%‑off Fable 5** routing where an LLM is needed (ChatStudio, Director).

### Phase 4 — Agent Skills → in‑app "Recipe" buttons & pipelines
- Port the 13 `.opencode` MuAPI recipes as **Recipe presets**: a Recipe = a named multi‑step job (e.g. "UGC Video Factory": upload selfie+product → Nano‑Banana hero → Seedance 2.5 i2v 9:16 w/ audio → download).
- Highest‑value first: `muapi-ugc-video-factory`, `muapi-product-video-ad-maker`, `muapi-ai-clipping` (clip extraction), `muapi-youtube-shorts`, `muapi-social-media-video`, `muapi-ad-creative`, `muapi-youtube-thumbnail`, `muapi-nano-banana`.
- Implement as a **job/orchestration layer** in the backend that chains MuAPI calls and lands results on the timeline (the skills stop at URLs; our timeline does the "stitch").

### Phase 5 — MCP servers → backend tool surface / Agent Mode
- Deploy `seedance-2.5-mcp` (and `seedance-2-mcp`) as a backend service; expose its 6 tools behind our API for an **Agent Mode** (ChatStudio/Director) that can drive generation via tool calls.
- The 5 SDK MCP servers (Wan, FLUX 3, Grok) can be aggregated the same way if we want external‑agent access.

### Phase 6 — Business / Monetization Hub (ai‑creator‑academy)
- Ship the 15 tracks as a read‑only, in‑product **knowledge panel** (markdown → rendered articles). No code execution needed.
- Convert high‑value templates into usable features: **Quote Builder** (value‑based pricing ×0.30, retainer tiers), **Outreach/Contract export** (MSA/SOW), and the calculators (RPM, POD, realtor, micro‑tool MRR).
- Contextual surfacing: show the relevant academy track inside each studio (e.g. UGC studio → Track 01; Real‑estate staging → Track 09; Avatars/Influencers → Track 05).

### Phase 7 — Character Consistency workflow (Seedance)
- Add a **"Character" asset type**: `create_character` (1–3 photos → `sheet_url`) stored in the asset library; `consistent_video` reuses `sheet_url` as `images_list[0]` for series shots. Wire into StoryboardStudio / CinemaStudio / CommercialStudio.

### Phase 8 — Native audio toggle across video studios
- Add `generate_audio` / `audio` controls (already in dynamic engine via `inputs`) to VideoStudio, ImageStudio(i2v), StoryboardStudio, CommercialStudio, InfluencerStudio, UpscaleStudio — gated by the model `capabilities` flag.

---

## 5. Studio‑by‑Studio Mapping

| Studio | Gains from this audit |
|---|---|
| **ImageStudio** | FLUX 3 (dev/flagship/i2i), Grok Imagine 2 (multi‑ref edit ≤5), prompt gallery, camera/lighting dropdowns |
| **VideoStudio** | MiniMax H3, Wan 3.0, FLUX 3 video (+audio), Seedance 2.5 t2v/i2v, audio toggle, first/last frame |
| **EditStudio** | FLUX 3 i2i, Grok multi‑ref edit, Seedance video‑edit/extend, new dynamic controls auto‑rendered |
| **EffectsStudio** | Seedance video‑edit/extend, Wan effects, prompt‑driven effect recipes |
| **StoryboardStudio / AIStoryboardStudio** | Seedance omni‑reference + character consistency for shot series; storyboard→video recipes |
| **CinemaStudio / CinemaTemplateStudio** | MiniMax H3 cinematic prompts, Seedance 2.5 cinematic library, camera‑vocabulary director mode, clip‑stitch recipes |
| **CommercialStudio** | UGC video factory, product‑video‑ad‑maker, ad‑creative recipes, realtor/agency pricing templates |
| **InfluencerStudio** | UGC‑video‑factory, virtual‑influencer media‑kit (Track 05), talking‑baby/character skills |
| **AvatarStudio / LipSyncStudio** | Native‑audio video models (Wan/FLUX/Seedance) feed talking‑head pipelines |
| **UpscaleStudio** | Seedance upscaled 1080p/4K tiers, watermark‑remover util |
| **CharacterStudio** | Seedance `create_character` + consistent‑video workflow |
| **AudioStudio** | Wan/FLUX/Seedance native audio; Fable 5 LLM for scripts |
| **TrainingStudio** | Academy curriculum surfacing; batch‑delivery templates |
| **VideoToolsStudio** | AI‑clipping (virality‑ranked shorts), Seedance extend, watermark remover |
| **ChatStudio** | Agent Mode via MCP tools; Fable 5 (20% off) presets; recipe orchestration |
| **TemplateStudio** | Prompt‑template gallery as starting templates |

---

## 6. Risks & Gotchas
1. **Endpoint‑pattern mismatch:** our client uses `/api/v1/generate`; SDKs use `/api/v1/{slug}`. Verify the `muapi-proxy` normalizes `endpoint` → slug route for all 72 Seedance combos + new families. *(Phase 0 critical.)*
2. **Endpoint slug collisions:** `flux-3-text-to-video` / `flux-3-image-to-video` appear in two repos — register once.
3. **Early‑access / preview models:** FLUX 3 and Seedance 2.5 are "preview/early access" in these SDKs — gate behind a feature flag + handle 404/quota gracefully.
4. **Pricing volatility:** comparison data is "July 2026 retail"; treat as display hints, not billing source of truth.
5. **Sora 2 sunset (Sept 24 2026)** and **Midjourney v7 no API** — exclude or clearly flag in picker.
6. **ComfyUI nodes are Python** — do **not** port; use only as payload‑contract reference.
7. **Stitch gap:** skills stop at generating URLs; assembly must stay in our timeline editor (don't rebuild editing in the skill layer).

---

## 7. Recommended Sequencing (quick wins → depth)

1. **Week 1 (Phase 0 + 1):** Extend `muapi-proxy` for new slugs; add MiniMax H3 + Wan 3.0 + FLUX 3 + Seedance 2.5 (standard tiers) to `models_dump.json`. *Immediate: every studio gets new models with zero UI work via the dynamic engine.*
2. **Week 2 (Phase 2 + 3):** Prompt Template Gallery + camera/lighting dropdowns + Intelligent Model Picker (price/speed/quality). High visible value.
3. **Week 3 (Phase 4):** Recipe buttons for the top 4 `.opencode` skills (UGC factory, product‑ad, AI‑clipping, YouTube shorts).
4. **Week 4 (Phase 6):** Business/Monetization Hub (academy tracks + Quote Builder).
5. **Phase 5/7/8:** MCP Agent Mode, Character Consistency, native‑audio rollout (can run in parallel after Week 2).

**Net effect:** one backend (MuAPI) we already pay for unlocks ~6 new model families, a prompt/camera intelligence layer, an agent‑driven recipe engine, and an in‑product monetization academy — across all 16 studios — with the bulk of the model work being *data entry*, not new code.
