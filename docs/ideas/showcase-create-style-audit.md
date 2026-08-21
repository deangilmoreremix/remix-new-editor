# "Create This Style" Button — Full Audit Plan

## Executive Summary

**Current state: broken for 507 of 512 demos.**

When a user clicks **"Create This Style"**, the button navigates to a studio page with a `template` URL parameter. The studio then calls `getMinimaxTemplateById(templateParam)` to pre-populate the prompt, model, aspect ratio, and duration. **This lookup only works for 5 of 253 MiniMax H3 demos** (the ones whose slugs happen to match the old `minimaxH3Demos.js`). It **never works for Seedance 2.5 or ZeroLu** because those template systems don't exist at all.

---

## 1. Current Button → Studio Flow

```
User clicks "Create This Style"
  │
  ▼
createStyleLink(demo, { getTarget: adapter.getCreateTarget })
  │  ui.js line 158-161
  │
  ▼
getCreateTarget(demo)  [from beatapiMinimaxH3Demos.js / beatapiSeedance25Demos.js / zeroLuDemos.js]
  │  Returns: { route, params: { template: "minimax-h3-{slug}", ref: "minimax-h3" }, href }
  │
  ▼
goToRoute(target.route, target.params)
  │  ui.js line 138 — calls router.navigate(route, params)
  │  Produces URL: /?template=minimax-h3-cinematic-wide-shot-735905&ref=minimax-h3#/cinema
  │
  ▼
Router loads studio page (CinemaStudio.js, VideoStudio.js, etc.)
  │
  ▼
Studio reads URL params:
  const urlParams = new URLSearchParams(window.location.search);
  const templateParam = urlParams.get('template');
  │
  ▼
getMinimaxTemplateById(templateParam)
  │  minimaxTemplates.js line 24
  │  Looks up in: minimaxH3Templates[] (built from OLD minimaxH3Demos.js — 30 demos)
  │
  ▼
IF found: pre-populates model, aspectRatio, duration, basePrompt
IF NOT found: studio opens blank — no prompt, no settings
```

---

## 2. Root Cause Analysis

### 2a. Template system only covers old MiniMax H3 data

`src/lib/minimaxTemplates.js` imports from `src/data/minimaxH3Demos.js` (the **old** 30-demo Anil-matcha file):

```js
import { minimaxH3Demos, MINIMAX_MODEL } from '../data/minimaxH3Demos.js';

export const minimaxH3Templates = minimaxH3Demos.map((demo) => ({
  id: `minimax-h3-${demo.slug}`,   // e.g., "minimax-h3-modern-warfare-fps-gameplay"
  name: demo.title,
  model: MINIMAX_MODEL,
  aspectRatio: demo.aspectRatio,
  duration: demo.duration,
  basePrompt: null,
  // ...
}));
```

The new `beatapiMinimaxH3Demos.js` has **253 demos** with completely different slugs. Only **5 slugs overlap** with the old data:

| Overlapping Slug | Old Demo | New Demo |
|---|---|---|
| `modern-warfare-fps-gameplay` | ✅ | ✅ |
| `luxury-perfume-commercial` | ✅ | ✅ |
| `1980s-open-source-family-comedy` | ✅ | ✅ |
| `radio-operator-evacuation-bridge` | ✅ | ✅ |
| `giant-koi-park-incident` | ✅ | ✅ |

**Result:** 5 of 253 MiniMax H3 demos resolve. 248 fail.

### 2b. No template system exists for Seedance 2.5 or ZeroLu

The `getCreateTarget` function in `beatapiSeedance25Demos.js` and `zeroLuDemos.js` generates template IDs like:
- `seedance-2.5-{slug}`
- `seedance-2.0-{slug}`

But there is **no corresponding template resolver** for these prefixes. `getMinimaxTemplateById()` only knows about `minimax-h3-*` IDs.

**Result:** 0 of 242 Seedance 2.5 demos resolve. 0 of 17 ZeroLu demos resolve.

### 2c. Studios only call one resolver

Only 3 studios read the `template` URL parameter:
- `CinemaStudio.js` — calls `getMinimaxTemplateById(templateParam)`
- `VideoStudio.js` — calls `getMinimaxTemplateById(templateParam)`
- `ImageStudio.js` — calls `getMinimaxTemplateById(templateParam)`

All other studios (`CommercialStudio`, `InfluencerStudio`, `CharacterStudio`, `AIVFXPage`, etc.) don't read the `template` param at all, so the `template` query string is silently ignored.

---

## 3. Impact Matrix

| Source | Total Demos | Template Resolves | % Broken | User Experience |
|---|---|---|---|---|
| MiniMax H3 | 253 | 5 | 98% | Blank studio, no prompt |
| Seedance 2.5 | 242 | 0 | 100% | Blank studio, no prompt |
| ZeroLu | 17 | 0 | 100% | Blank studio, no prompt |
| **Total** | **512** | **5** | **99%** | **Broken** |

---

## 4. What "Create This Style" Should Do

When a user clicks the button, the expected behavior is:

1. **Navigate to the correct studio** based on category (e.g., Cinema → `#/cinema`, Commercial → `#/commercial`)
2. **Pre-populate the prompt** with the demo's full prompt text
3. **Set the model** to the correct AI model (MiniMax H3 / Seedance 2.5 / Seedance 2.0)
4. **Set aspect ratio** from the demo metadata
5. **Set duration** from the demo metadata
6. **Optionally load the reference video/image** if the demo is image-to-video

Currently, only step 1 works reliably. Steps 2-6 fail for 99% of demos.

---

## 5. Fix Options

### Option A: Unified template resolver (recommended)

Create a single `resolveTemplate(templateId)` function that:
1. Strips the source prefix (`minimax-h3-`, `seedance-2.5-`, `seedance-2.0-`)
2. Looks up the slug in the appropriate data module
3. Returns a unified template object `{ model, aspectRatio, duration, basePrompt, ... }`

Changes required:
1. **New file `src/lib/showcaseTemplateResolver.js`** — unified resolver for all 3 sources
2. **Update `minimaxTemplates.js`** — import from `beatapiMinimaxH3Demos.js` instead of old `minimaxH3Demos.js`
3. **Update studios** — replace `getMinimaxTemplateById()` calls with `resolveTemplate()`
4. **Update `getCreateTarget`** — ensure template IDs include source prefix (already done)

### Option B: Per-source template modules

Create 3 separate template modules:
- `src/lib/minimaxH3Templates.js` — reads from `beatapiMinimaxH3Demos.js`
- `src/lib/seedance25Templates.js` — reads from `beatapiSeedance25Demos.js`
- `src/lib/zeroLuTemplates.js` — reads from `zeroLuDemos.js`

Update each studio to try all 3 resolvers in sequence.

### Option C: Pass prompt directly via URL

Instead of relying on template lookup, pass the full prompt as a URL parameter:
```
/?prompt={encoded-prompt}&model=MiniMax+Hailuo+3&aspect_ratio=16:9&duration=10#/cinema
```

Changes required:
1. Update `getCreateTarget` to include `prompt` param
2. Update studios to read `prompt` param directly
3. No template system needed

**Trade-off:** URL length limits for long prompts (~2KB max for some browsers).

---

## 6. Recommended Fix (Option A)

### Step 1: Create unified resolver

```js
// src/lib/showcaseTemplateResolver.js
import { minimaxH3Demos, MINIMAX_MODEL } from '../data/beatapiMinimaxH3Demos.js';
import { seedance25Demos, SEEDANCE_MODEL } from '../data/beatapiSeedance25Demos.js';
import { zeroLuDemos, ZERO_LU_MODEL } from '../data/zeroLuDemos.js';

const TEMPLATE_MAP = new Map();
minimaxH3Demos.forEach(d => TEMPLATE_MAP.set(`minimax-h3-${d.slug}`, { ...d, source: 'minimaxh3', model: MINIMAX_MODEL }));
seedance25Demos.forEach(d => TEMPLATE_MAP.set(`seedance-2.5-${d.slug}`, { ...d, source: 'seedance25', model: SEEDANCE_MODEL }));
zeroLuDemos.filter(d => d.videoSrc).forEach(d => TEMPLATE_MAP.set(`seedance-2.0-${d.slug}`, { ...d, source: 'zeroLu', model: ZERO_LU_MODEL }));

export function resolveTemplate(templateId) {
  return TEMPLATE_MAP.get(templateId) || null;
}
```

### Step 2: Update studios

In `CinemaStudio.js`, `VideoStudio.js`, `ImageStudio.js`:
```js
// Before:
const tpl = getMinimaxTemplateById(templateParam);

// After:
import { resolveTemplate } from '../lib/showcaseTemplateResolver.js';
const tpl = resolveTemplate(templateParam);
```

### Step 3: Update minimaxTemplates.js

Either delete it (if nothing else uses it) or update it to point to the new data.

### Step 4: Verify all 512 demos resolve

```bash
node -e "
const { resolveTemplate } = require('./src/lib/showcaseTemplateResolver.js');
const { minimaxH3Demos } = require('./src/data/beatapiMinimaxH3Demos.js');
const { seedance25Demos } = require('./src/data/beatapiSeedance25Demos.js');
const { zeroLuDemos } = require('./src/data/zeroLuDemos.js');

let resolved = 0, failed = 0;
minimaxH3Demos.forEach(d => { if (resolveTemplate('minimax-h3-' + d.slug)) resolved++; else failed++; });
seedance25Demos.forEach(d => { if (resolveTemplate('seedance-2.5-' + d.slug)) resolved++; else failed++; });
zeroLuDemos.filter(d => d.videoSrc).forEach(d => { if (resolveTemplate('seedance-2.0-' + d.slug)) resolved++; else failed++; });
console.log('Resolved:', resolved, 'Failed:', failed);
"
```

### Step 5: Test the full flow

1. Click "Create This Style" on a MiniMax H3 demo → should land on CinemaStudio with prompt pre-filled
2. Click "Create This Style" on a Seedance 2.5 demo → should land on VideoStudio with prompt pre-filled
3. Click "Create This Style" on a ZeroLu demo → should land on CinemaStudio with prompt pre-filled
4. Verify model, aspect ratio, and duration are set correctly

---

## 7. Additional Findings

### Old data files still on disk
- `src/data/minimaxH3Demos.js` — 30 old demos (replaced by `beatapiMinimaxH3Demos.js`)
- `src/data/seedanceDemos.js` — 15 old demos (replaced by `beatapiSeedance25Demos.js`)
- These are still imported by `minimaxTemplates.js` and possibly other components

### Studios that don't read template param at all
- `CommercialStudio.js`
- `InfluencerStudio.js`
- `CharacterStudio.js`
- `AIVFXPage.js`
- `EffectsStudio.js`
- `StoryboardStudio.js`

These studios will receive the `template` query param but ignore it completely. The user will land on a blank studio regardless of whether the template resolves.

### Missing template for Seedance/ZeroLu
Even if we fix the resolver, there's no `seedanceTemplates.js` or `zeroLuTemplates.js`. The unified resolver (Option A) fixes this by mapping directly from the data modules.

---

## 8. Action Items

| # | Action | File(s) | Priority |
|---|---|---|---|
| 1 | Create `src/lib/showcaseTemplateResolver.js` | New file | **HIGH** |
| 2 | Update `CinemaStudio.js` to use resolver | `src/components/CinemaStudio.js` | **HIGH** |
| 3 | Update `VideoStudio.js` to use resolver | `src/components/VideoStudio.js` | **HIGH** |
| 4 | Update `ImageStudio.js` to use resolver | `src/components/ImageStudio.js` | **HIGH** |
| 5 | Delete or redirect `minimaxTemplates.js` | `src/lib/minimaxTemplates.js` | MEDIUM |
| 6 | Delete old data files `minimaxH3Demos.js`, `seedanceDemos.js` | `src/data/` | MEDIUM |
| 7 | Add template resolution to remaining studios | CommercialStudio, InfluencerStudio, etc. | LOW |
| 8 | Add E2E test for "Create This Style" flow | Test suite | MEDIUM |
| 9 | Verify all 512 template IDs resolve | Script | **HIGH** |
