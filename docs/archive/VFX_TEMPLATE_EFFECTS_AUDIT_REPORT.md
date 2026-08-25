# Templates / VFX / Effects Studio — Image & Video Creation Audit

**Date:** 2026-07-09
**Auditor key scope:** sandbox muapi key `cb79860…bd89` (live `https://api.muapi.ai/api/v1`)
**Method:** Real generation roundtrips (submit → poll `predictions/<id>/result` → verify output URL), mirroring the Supabase `muapi-proxy` (`supabase/functions/muapi-proxy/index.ts`).
**Evidence artifacts:** `.audit/e2e-results.json`, `.audit/name-audit-results.json`, `.audit/enum-check-results.json`

---

## 1. Verdict

| Studio | Image creation | Video creation | Notes |
|--------|---------------|----------------|-------|
| **Templates** (`src/lib/templates.js` via `src/components/TemplateStudio.js`) | ✅ Working | ✅ Working | All routed effect `name`s resolve to valid endpoints |
| **VFX** (`apps/ai-vfx/`) | ✅ Working | ✅ Working (for valid presets) | 🔴 **10 of 36 effect buttons send `name` values the live API rejects (HTTP 400)** |
| **Effects Studio** (`src/components/EffectsStudio.js`) | ✅ Working | ✅ Working | All 152 tab `enum` names validated against the API — 0 invalid |

**Summary:** Image and video creation across all three studios is functional for valid presets. The single concrete defect is in the **ai-vfx app**, where 10 hardcoded effect names are no longer accepted by the current `generate_wan_ai_effects` endpoint (legacy names from the upstream `SamurAIGPT/AI-VFX` repo).

---

## 2. Endpoint mapping per studio

| Studio | Image path | Video path |
|--------|-----------|-----------|
| Templates | `nano-banana` (t2i); `flux-kontext-effects` / `image-effects` / `nano-banana-effects` (i2i) | `generate_wan_ai_effects` (models `vfx`, `ai-video-effects`, `motion-controls`); `video-effects` endpoint (model `video-effects`) |
| VFX (`apps/ai-vfx`) | `nano-banana` (t2i) | `generate_wan_ai_effects` (applyVFX/applyMotion/applyAIEffects); `seedance-lite-t2v` / `seedance-lite-i2v` |
| Effects Studio | `nano-banana`, `nano-banana-effects`, `flux-kontext-effects`, `image-effects` (i2i) | `generate_wan_ai_effects` (tabs ai-video-effects, motion-controls), `video-effects` endpoint (tab Video FX v2) |

---

## 3. End-to-end proof (live sandbox, all returned `completed` + real output URL)

| Studio | Kind | Endpoint | Request | Output |
|--------|------|----------|---------|--------|
| Templates | image | `nano-banana` | `req 6ddf4b85…` | `…/google-nano-banana.avif` |
| Templates | video | `generate_wan_ai_effects` (name=`Building Explosion`) | `req 9682dded…` | `…/videos/186/224655648893/08b5cfa6-….mp4` |
| VFX | image | `nano-banana` | `req 0616fd9d…` | `…/google-nano-banana.avif` |
| VFX | video | `generate_wan_ai_effects` (name=`Fire`) | `req 67b345d9…` | `…/08b5cfa6-….mp4` |
| VFX | video | `seedance-lite-t2v` | `req 88f5290a…` | `…/videos/186/954281813717/a521eb80-….mp4` |
| Effects | image | `flux-kontext-effects` (i2i) | `req bc48daa9…` | `…/flux-kontext-default.avif` |
| Effects | video | `generate_wan_ai_effects` (name=`Matrix Shot`) | `req dfd68a3d…` | `…/videos/186/682836289527/23490425-….mp4` |

> Observation (non-blocking): the `Building Explosion` and `Fire` generations returned the *same* CDN object. The sandbox reuses a demo asset for bonus-credit requests; both still completed with a valid MP4. Not a code defect.

---

## 4. Defects (by impact)

### 🔴 HIGH — `apps/ai-vfx/src/App.jsx`: 10 invalid effect `name` values → HTTP 400

`generate_wan_ai_effects` **requires** a `name` from its accepted preset set. The ai-vfx app hardcodes effect lists and passes `selectedEffect.name` straight to the endpoint (`apps/ai-vfx/src/App.jsx:152, 156, 160` → `applyVFX`/`applyMotion`/`applyAIEffects` in `apps/ai-vfx/src/lib/muapi.js:101,123,145`, all hitting `generate_wan_ai_effects`). 10 of 36 names are rejected:

| Tab (function) | Invalid `name` (line in `App.jsx`) |
|----------------|-------------------------------------|
| VFX (`applyVFX`, lines 30–41) | `Lightning` (33), `Invisibility` (40), `Tentacles` (41) |
| Motion (`applyMotion`, lines 15–26) | `Vertigo Effect` (26) |
| AI Effects (`applyAIEffects`, lines 45–56) | `Kiss Me AI` (45), `Venom` (46), `Hulk` (47), `Muscle Surge` (48), `Tiger Touch` (49), `Turning Metal` (52) |

These are legacy names from the upstream `SamurAIGPT/AI-VFX` README (same names), but the **current** API only accepts a 33-name subset. Selecting any of these buttons produces a raw `400 Invalid input` error.

**Recommended fix (one of):**
1. Reconcile the ai-vfx effect lists against the live accepted names (the valid set proven this audit: `360 Orbit, Arc Shot, Building Explosion, Cakeify, Car Chase, Car Explosion, Crane Down, Crane Up, Crash Zoom In, Crash Zoom Out, Decay Time-Lapse, Disintegration, Dolly In, Dolly Out, Film Noir, Fire, Flying, Hero Run, Inflate It, Levitate, Matrix Shot, Robotic Face Reveal, Samurai It, Tornado, Tsunami, VHS Footage, Dolly Zoom In, Electricity, FPV Drone Cam, Glamor, Lego, Younger Self Selfie`). Remove or relabel the 10 unsupported entries.
2. Defensive guard in `apps/ai-vfx/src/lib/muapi.js` `applyVFX/applyMotion/applyAIEffects`: validate `name` against an allowlist before submit; on 400, surface a friendly “This effect is currently unavailable” message instead of a raw error.

### 🟡 MEDIUM — `generate_wan_ai_effects` input contract not enforced client-side

The endpoint enforces: `image_url` required, `name` required, `resolution` ∈ `{480p, 720p}` (else `422 literal_error`). `src/lib/muapi.js:571` `generateVideoEffect` forwards `name`/`resolution` but does **no** validation. Any caller that omits `name` (or sends a bad resolution) gets a 400/422. Templates mitigate this by collecting `name` via a dropdown (`src/components/TemplateStudio.js:631` spreads `defaultParams`), but a missing `name` (e.g. templates with no default `name` and no user selection) would 422.

**Recommended fix:** add pre-submit validation in `generateVideoEffect` (and the ai-vfx helpers) for `name` presence and `resolution` ∈ {480p,720p}; return a typed error. This makes failures explicit and prevents silent 400s across all three studios.

### 🟢 LOW — `video-effects` vs `generate_wan_ai_effects` are distinct name spaces

Templates that use `model: 'video-effects'` (e.g. `squid-game`, `gender-swap`, `fashion-stride`) route to the **separate** `video-effects` endpoint, which has its **own** accepted `name` set (`Squid Game`, `Gender Swap`, `Fashion Stride` all return `200` there — see `.audit/enum-check-results.json`). This is correct, but worth documenting so future template/effect additions are routed to the matching endpoint+name space.

---

## 5. What was verified as healthy

- Sandbox key authenticates (`x-api-key` accepted; all valid endpoints return `200 + request_id`).
- `upload_file` works (`https://cdn.muapi.ai/outputs/...`) — the i2i/video paths that need an input image function correctly.
- **Effects Studio**: all 64 (`ai-video-effects`) + 47 (`motion-controls`) + 41 (`video-effects`) tab `enum` names validated against their endpoints → **0 invalid**. Image tabs (i2i) accept requests without `name`.
- **Templates**: every `defaultParams.name` that routes to `generate_wan_ai_effects` or `video-effects` was validated and is accepted by the corresponding endpoint.
- Polling/credit flow: all generations returned `status: completed` with real `.avif`/`.mp4` URLs (cost 0 on the sandbox key).

---

## 6. Next step (recommended)

Apply the **HIGH** fix: prune/relabel the 10 unsupported effect names in `apps/ai-vfx/src/App.jsx` (and mirror the allowlist into `apps/ai-vfx/src/lib/muapi.js` for a defensive guard). This makes the VFX studio's effect buttons 100% functional. The other two studios (Templates, Effects Studio) require no code changes — they are fully working.
