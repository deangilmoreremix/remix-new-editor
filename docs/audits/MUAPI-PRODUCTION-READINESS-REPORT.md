# MUAPI-PRODUCTION-READINESS-REPORT

**Date:** 2026-10-13 (revised 2026-10-14)
**Repository:** `remix-new-editor`
**Branch:** `main` (original verification at `4522e42dc`; this revision verified at `d8af1ef27`)
**Status:** FIXED — VERIFIED (R1 resolved by `d8af1ef27`)

> **Provenance note.** This document is a **re-created record**. The original audit notes
> were lost when the git worktree `checking-all-features-and-functions-from-each` was
> deleted. Nothing below is copied from the lost notes: every claim was re-verified
> against the current working tree with the commands recorded in
> [Section 5](#5-verification-results). Where reality differs from the originally
> expected state, the actual state is documented instead
> (see [Section 9](#9-residual-findings--known-gaps)).
>
> **Revision note (2026-10-14).** This revision records the outcome of the defect
> originally logged below as R1 (unimported `t2iModels` in
> `src/lib/storyboardEngine.js`) plus five sibling `no-undef` defects: all six were fixed
> by commit `d8af1ef27` — `fix(studios): resolve 6 no-undef ReferenceErrors introduced by
> production-readiness commits`. The new
> [Section 7](#7-defects-introduced-by-the-fix-commits) documents the six defects, the
> root cause (`no-undef` configured as `'warn'` in `eslint.config.js:139`), the fix commit,
> and the regression test; R1 is marked RESOLVED in
> [Section 9](#9-residual-findings--known-gaps), and new finding R6 records the
> `no-undef` debt that commit did not address. Line numbers for the fix sites are cited as
> of `d8af1ef27`; the working tree has since received uncommitted changes (see R6) that
> shift some line numbers by one.

---

## 1. Executive Summary

A production-readiness audit was run across the studio layer (`src/components/*`) and the
muAPI client layer (`src/lib/muapi.js`) plus its Supabase edge proxy
(`supabase/functions/muapi-proxy/index.ts`). The audit found and fixed:

- **3 critical-area defects** — a shadowed `const params` block that silently dropped
  generation parameters in VideoStudio, an undefined `img` reference in Personalizer, and
  a block-scoped (hoisting-fragile) `_safeReturnRoute` helper in Personalizer.
- **4 high-severity hardcodings** — hardcoded Kling/Seedance model fallbacks in
  CinemaStudio, a hardcoded `seedance-v2.0-extend` model id in VideoStudio, a hardcoded
  default image model in the storyboard engine, and hardcoded `https://api.muapi.ai`
  base URLs in the muAPI client.
- **4 medium-severity issues** — `alert()` usage, silently empty `catch` blocks, a
  hardcoded param key array, and a hardcoded model-id allowlist.
- **2 low-severity issues** — Supabase proxy URL/CORS configuration handling and leftover
  `console.*` statements.

Alongside the fixes, the studios were hardened for production UX: loading overlays,
cancel buttons with `AbortController` plumbing, inline error surfacing, and
`container.cleanup` hooks wired into the router's navigation teardown.

**Final status: all 13 targeted verification checks pass, and the four vitest suites
touched by the audit and fix commits pass (61/61).** The live defect originally recorded
here as R1 (an unimported `t2iModels` reference in `src/lib/storyboardEngine.js`) — plus
five sibling `no-undef` defects — was **fixed by `d8af1ef27`** and is re-verified GREEN in
this revision; see [Section 7](#7-defects-introduced-by-the-fix-commits). Five residual
findings remain open (R2-R6, [Section 9](#9-residual-findings--known-gaps)); R6 is new and
records the remaining `no-undef` debt the fix commit did not address.

---

## 2. Audit Scope

35 unique files were modified across the three audit commits. They group as follows.

### Studio components (`src/components/`)

| Studio / Page | Commits touching it |
|---|---|
| `AudioStudio.js` | `8e6f50c49`, `c0611edcb`, `0e5f2228d` |
| `AnimatePage.js` | `8e6f50c49`, `c0611edcb`, `0e5f2228d` |
| `CinemaStudio.js` | `8e6f50c49`, `c0611edcb`, `0e5f2228d` |
| `VideoStudio.js` | `8e6f50c49`, `c0611edcb`, `0e5f2228d` |
| `PhotoStudioPage.js` | `8e6f50c49`, `c0611edcb` |
| `EffectsStudio.js` | `8e6f50c49` |
| `StoryboardStudio.js` | `8e6f50c49` |
| `Personalizer.js` | `8e6f50c49` |
| `ImageStudio.js`, `EditStudio.js` | `8e6f50c49` |
| `AvatarStudio.js`, `ChatStudio.js`, `CharacterStudio.js`, `CommercialStudio.js`, `InfluencerStudio.js`, `LipSyncStudio.js`, `TrainingStudio.js`, `UpscaleStudio.js`, `VideoToolsStudio.js`, `VideoAgentPage.js`, `AppsHub.js`, `CampaignWizard.js` | `8e6f50c49` |
| `BrandDnaEditor.js`, `BrandStudioIframe.js`, `Header.js`, `Sidebar.js` | `8e6f50c49` |

### Libraries and routing

| File | Commits touching it |
|---|---|
| `src/lib/muapi.js` | `8e6f50c49`, `c0611edcb`, `0e5f2228d` |
| `src/lib/storyboardEngine.js` | `8e6f50c49`, `d8af1ef27` |
| `src/lib/router.js`, `src/lib/studioRoutes.js` | `8e6f50c49` |

### Backend / tests / config

| File | Commits touching it |
|---|---|
| `supabase/functions/muapi-proxy/index.ts` | `8e6f50c49`, `c0611edcb`, `0e5f2228d` |
| `src/test/muapi-fixes.test.js`, `src/test/edit-studio-integration.test.js`, `src/test/personalizer.test.js` | `8e6f50c49` (test timeouts raised to 30s for these suites) |
| `src/test/storyboard-panel.test.js` | `d8af1ef27` (regression test for the `t2iModels` fix — see [Section 7](#7-defects-introduced-by-the-fix-commits)) |
| `package.json` | `8e6f50c49` (added `caniuse-lite`) |

Verification method: `grep` counts and pattern searches against the working tree,
`git show` / `git log -S` against commit history, `eslint` for undefined-reference
detection, and a `vitest run` of the suites touched by the audit and fix commits (four
suites; the fourth was added by `d8af1ef27`).

---

## 3. Issues Found & Fixed

### 3.1 Critical

**C1 — Duplicate `const params` in VideoStudio (`8e6f50c49`)**

`src/components/VideoStudio.js` declared `const params` twice in the same generation
handler: once for the extend path and again inside the `else` branch. The inner
declaration shadowed the already-populated outer object, so every parameter assigned
before the branch (`thumbnail_url`, `prompt`, `negative_prompt`, `seed`,
`guidance_scale`, advanced-control payload, …) was discarded and the request was sent
with a bare `{ model, signal }`. Fixed by removing the inner block and reusing the
outer `params`, with `isExtendMode` only adding `request_id`.

**C2 — Undefined `img` in Personalizer (`8e6f50c49`)**

In the token-replacement handler, `img.src` was assigned from a variable (`img`) that was
never in scope, throwing a `ReferenceError` on every token re-render of an image element.
Fixed by resolving the element from the DOM instead:
`const imgEl = wrapper.querySelector('img')` then `if (imgEl && safe) imgEl.src = safe;`
(`src/components/Personalizer.js:1488-1490`).

**C3 — `_safeReturnRoute` declared inside a conditional block in Personalizer (`8e6f50c49`)**

`_safeReturnRoute` was declared **inside** the `if (sourceHandoff.returnRoute) { … }`
block in `Personalizer()` (pre-commit `src/components/Personalizer.js:1038`, inside a block
that closed at line 1062). Under ES-module / strict-mode semantics a function declaration
in a block is *block-scoped* and hoisted only to the top of that block, so the helper was
invisible to the rest of the studio closure — any second call site (present or future)
outside that `if` would throw `ReferenceError`. The commit moved the declaration to the
enclosing `Personalizer()` closure scope, alongside the other sanitizers
(`src/components/Personalizer.js:1423`), with the call site at `:1045`.

Honest scoping note: the pre-commit file had exactly one call site and it sat inside the
same block, so the original placement was reachable and I could not reproduce a runtime
crash from it. This is best characterised as **hoisting/scoping fragility** (a latent
trap) rather than a confirmed defect — the "hoisting bug" label used in the original
working notes overstates the runtime impact.

### 3.2 High

**H1 — CinemaStudio hardcoded Kling/Seedance fallbacks (`c0611edcb`)**

`src/components/CinemaStudio.js` fell back to hardcoded ids when the catalog lookup
missed — `'kling-v2.6-pro-t2v'` for the default model, `'seedance-2.5-first-last-frame'`
for frame-to-frame, `'kling-v2.6-pro-i2v'` for reference-image mode — so a renamed or
removed model silently degraded to a different model than the user picked. Replaced with
catalog lookup + fail-fast (`showToast(...)` + `throw`) for each branch. The default model
is now `t2vModels[0].id` from the catalog, and an empty catalog throws
`'No text-to-video models available in catalog'` instead of silently defaulting.

**H2 — VideoStudio hardcoded `seedance-v2.0-extend` (`c0611edcb`)**

The Extend button hardcoded `selectedModel = 'seedance-v2.0-extend'` /
`selectedModelName = 'Seedance 2.0 Extend'`. It is now resolved dynamically: the button
handler is `async`, fetches the catalog via `muapi.getModelCatalog()`, and selects the
first entry with `requiresRequestId === true` or an id ending in `-extend`. If no such
model exists it toasts `'Extend model not found in catalog'` and returns; a catalog fetch
failure toasts `'Failed to load model catalog: …'` and returns.

**H3 — Hardcoded default image model in the storyboard engine (`8e6f50c49`)**

`src/lib/storyboardEngine.js` defaulted `generateStoryboardFromIntent` to
`model = 'flux-pro'`. It is now `model = t2iModels[0]?.id` (first text-to-image model in
the catalog). Note for the record: the string removed here was **`'flux-pro'`**.
`flux-2-pro` does not appear anywhere in this file's history on any branch
(`git log --all -S "flux-2-pro" -- src/lib/storyboardEngine.js` returns nothing), so the
check `grep -c "flux-2-pro" src/lib/storyboardEngine.js` → `0` is satisfied trivially.

**H4 — Hardcoded muAPI base URLs in the client (`c0611edcb`, `0e5f2228d`)**

`src/lib/muapi.js` built three URLs from the literal `https://api.muapi.ai`: the model
schema endpoint, the model catalog endpoint, and `MUAPI_UPLOAD_URL`. All three now derive
from `this.muapiBaseUrl`, which is built from `import.meta.env.VITE_MUAPI_URL`:

```js
const muapiUrl = import.meta.env.VITE_MUAPI_URL;
if (!muapiUrl) {
  console.warn('VITE_MUAPI_URL is not configured. Falling back to default muAPI URL.');
  this.muapiBaseUrl = 'https://api.muapi.ai/api/v1';
} else {
  this.muapiBaseUrl = `${muapiUrl}/api/v1`;
}
```

(`c0611edcb` introduced the env read; `0e5f2228d` added the missing-config guard above —
before that, an unset `VITE_MUAPI_URL` produced the literal string `"undefined/api/v1"`.)

### 3.3 Medium

**M1 — `alert()` usage**

Native `alert()` calls were replaced with the studio toast/inline-error conventions:

| File | Change | Commit |
|---|---|---|
| `src/components/EffectsStudio.js` | `alert('Select an effect first')` → `showToast('Select an effect first', 'error')`; same for `'Upload an image or video first'` | `8e6f50c49` |
| `src/components/StoryboardStudio.js` | `alert('Enter a scene description')` → `showToast(…, 'error')` | `8e6f50c49` |
| `src/components/VideoStudio.js` | `alert()` in the video-upload and Render-open failure paths → `showInlineError(container, …)` | `8e6f50c49` |
| `src/components/AvatarStudio.js` | `alert(\`Error: ${err.message}\`)` → `showToast(…, 'error')` | `8e6f50c49` |

**M2 — Empty catch blocks**

In `8e6f50c49` the `console.*` calls inside catch blocks were stripped, which left
several blocks silently swallowing failures (for example AudioStudio's localStorage
persistence read/write and the Personalizer bootstrap/interact.js guards).
`0e5f2228d` restored user-visible feedback where the failure matters:

```js
} catch (err) {
  console.error('AudioStudio: failed to load persisted state', err);
  showToast('Could not restore previous session. Starting fresh.', 'error');
}
```

(`src/components/AudioStudio.js:585` for load, `:604` for save.)

**M3 — `hardcodedKeys` array in AudioStudio (`c0611edcb`)**

`renderSchemaControls` skipped schema keys by hardcoded name:
`const hardcodedKeys = ['prompt','style','duration','voice','tone','emotion','speed','pitch']`.
The array was removed so schema-driven controls are rendered for whatever the model's
`inputs` actually declare.

**M4 — PhotoStudioPage hardcoded model filter (`c0611edcb`)**

The edit-model dropdown filtered the catalog to a hardcoded id allowlist
(`['gpt-image-2-image-to-image','nano-banana-2-edit','bytedance-seedream-5.0-pro-edit']`).
It now builds the option list dynamically from `[...i2iModels, ...v2vModels]`, de-duped by
`id`, filtered on the model's own capabilities (`m.imageField === 'images_list' && m.hasPrompt`).
`v2vModels` was added to the import for this.

### 3.4 Low

**L1 — Supabase proxy URL / CORS configuration**

- `src/lib/muapi.js`: the constructor still builds `proxyUrl` from
  `VITE_SUPABASE_URL` with the relative-path fallback `'/functions/v1/muapi-proxy'`;
  `c0611edcb` removed the stale "Validate that Supabase URL is configured" comment that
  no longer described the code. The warn-and-fallback behaviour is intentional (the
  relative path works behind the dev proxy).
- `supabase/functions/muapi-proxy/index.ts` (`8e6f50c49`): CORS now fails fast. In any
  environment where `ENVIRONMENT !== 'development'` and `ALLOWED_ORIGINS` is unset,
  `getCorsHeaders()` throws instead of returning `Access-Control-Allow-Origin: *`, and
  both the `OPTIONS` preflight handler and the main handler's catch block translate that
  into an HTTP 500 so the misconfiguration is loud.

**L2 — Console statements**

`8e6f50c49` removed `console.info/error/log/warn` from the audited studio files and
replaced promise-rejection logging with `.catch(() => {})` where no user action was
possible. Current counts in the audited studios: `AudioStudio.js` 2 (both intentional —
persistence failures, see M2), `CinemaStudio.js` 0, `VideoStudio.js` 0,
`EffectsStudio.js` 0, `StoryboardStudio.js` 0, `PhotoStudioPage.js` 0,
`AnimatePage.js` 0, `Personalizer.js` 0. `AudioStudio`'s two remaining calls are paired
with user-visible toasts, matching the M2 decision.

---

## 4. Production Hardening

### 4.1 Loading overlays

`CinemaStudio` gained the full overlay + progress treatment on generate
(`0e5f2228d`): `createLoadingOverlay('Generating cinema shot...')` with an appended
`createProgressBar(0)`, driven by `startGenerationProgress`, plus a simulated-progress
interval that caps at 90% and honours `abortController.signal.aborted`.
`createLoadingOverlay` is also used in `VideoStudio.js`, `PhotoStudioPage.js`,
`AnimatePage.js`, `ImageStudio.js`, `BrandStudio.js`, `CampaignWizard.js`.

### 4.2 Cancel buttons

`CinemaStudio` uses `createAbortAwareGenerateButton(generateBtn)` from
`src/lib/studioHelpers.js`, which supplies `{ controller, showCancel, reset }`; the
controller is stored in `abortController` and its `signal` is passed to every generation
call (`src/components/CinemaStudio.js:1371-1384, 1459, 1472, 1487, 1518-1529`). An
`isLoading` guard prevents concurrent generate clicks. `VideoStudio` uses the sibling
helper `createAbortAwareGenerate(generateBtn)` with the same
`{ controller, showCancel, reset }` contract (`src/components/VideoStudio.js:1972-1985,
2129-2140`), and `AudioStudio` carries its own `audioAbortController`
(`src/components/AudioStudio.js:558, 1340, 1348, 1414`) — so all three audited studios
thread a cancel signal; CinemaStudio and VideoStudio also render the explicit cancel
affordance through the helper.

### 4.3 Error surfacing

`showInlineError` / `hideInlineError` usage per audited studio:

| File | `showInlineError` occurrences |
|---|---|
| `src/components/VideoStudio.js` | 8 |
| `src/components/CinemaStudio.js` | 2 |
| `src/components/AudioStudio.js` | 0 (uses `formatErrorMessage` + `showToast`) |
| `src/components/EffectsStudio.js` | 0 (uses `showToast`) |
| `src/components/StoryboardStudio.js` | 0 (uses `showToast`) |

### 4.4 Memory leak fixes

`container.cleanup` hooks were added to the three heaviest studios so the router can
detach window-level listeners when a studio unmounts:

| File | Cleanup body |
|---|---|
| `src/components/AudioStudio.js` | `window.removeEventListener('click', closeEnhanceMenu)` |
| `src/components/VideoStudio.js` | removes `closeEnhanceMenu` and clears `_videoStudioOutsideClickHandler` (nulls the reference) |
| `src/components/CinemaStudio.js` | `container.cleanup` present (1 occurrence) |

The hook is genuinely wired: `src/lib/router.js` calls `currentPageEl?.cleanup?.()` at
`src/lib/router.js:150` before tearing down the page on every `navigate()` and again at
`src/lib/router.js:183` in the load-error path. Studios that return a container are
assigned to `currentPageEl`, so switching studios now detaches their window listeners
instead of accumulating one set per visit.

---

## 5. Verification Results

All checks were run on `main` at `4522e42dc`, working tree clean for these paths.

### 5.1 Targeted checks (13)

| # | Command | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | `grep -c "alert(" src/components/EffectsStudio.js` | 0 | `0` | PASS |
| 2 | `grep -c "alert(" src/components/StoryboardStudio.js` | 0 | `0` | PASS |
| 3 | `grep -c "flux-2-pro" src/lib/storyboardEngine.js` | 0 | `0` | PASS (see H3 — the removed string was `'flux-pro'`) |
| 4 | `grep -n "Select an effect first" src/components/EffectsStudio.js` | shows `showToast` | `1150: if (!selectedEffect) { showToast('Select an effect first', 'error'); return; }` | PASS |
| 5 | `grep -c "showInlineError" src/components/VideoStudio.js` | > 0 | `8` | PASS |
| 6 | `grep -c "createLoadingOverlay" src/components/CinemaStudio.js` | > 0 | `2` | PASS |
| 7 | `grep -c "container.cleanup" src/components/{AudioStudio,VideoStudio,CinemaStudio}.js` | 1 each | `1` / `1` / `1` | PASS |
| 8 | `grep -n "VITE_MUAPI_URL" src/lib/muapi.js` | validation present | `95: const muapiUrl = import.meta.env.VITE_MUAPI_URL;` and `97: console.warn('VITE_MUAPI_URL is not configured. Falling back to default muAPI URL.');` | PASS (guard is warn + fallback, not a throw) |
| 9 | `grep -n "MUAPI_BASE_URL" supabase/functions/muapi-proxy/index.ts` | env-driven | `41-44: const MUAPI_BASE_URL = (() => { const configured = Deno.env.get('MUAPI_BASE_URL'); … warn + fallback … })()`, used at `:566` and `:760` | PASS |
| 10 | `grep -c "hardcodedKeys" src/components/AudioStudio.js` | 0 | `0` | PASS |
| 11 | `git show 8e6f50c49 --stat \| tail -5` | scope of changes | `35 files changed, 1933 insertions(+), 927 deletions(-)` | PASS |
| 12 | `git show c0611edcb --stat \| tail -5` | scope of changes | `7 files changed, 63 insertions(+), 24 deletions(-)` | PASS |
| 13 | `git show 0e5f2228d --stat \| tail -5` | scope of changes | `6 files changed, 145 insertions(+), 104 deletions(-)` | PASS |

Post-fix checks (commit `d8af1ef27`, run 2026-10-14) are recorded in
[Section 5.5](#55-post-fix-verification--commit-d8af1ef27).

### 5.2 Hardcoded values — absence confirmed

```text
$ grep -n "kling\|seedance" src/components/CinemaStudio.js
(no matches)

$ grep -n "seedance-v2.0-extend" src/components/VideoStudio.js
(no matches)

$ grep -rln "flux-2-pro" src/
src/lib/modelDescriptions.js
src/lib/fal/models.js
src/lib/muapi/model-mapping.js
src/lib/muapi/catalog.js
src/lib/models.js
src/lib/modelFamilies.js
```

The remaining `flux-2-pro` hits are **catalog definitions** in `src/lib/*` (legitimate —
that is the model catalog the studios now read from), not studio-level fallbacks.

### 5.3 Lint

The state at `4522e42dc` failed this check:

```text
$ npx eslint src/lib/storyboardEngine.js
  68:13  warning  't2iModels' is not defined  no-undef

✖ 1 problem (0 errors, 1 warning)
```

Re-run 2026-10-14 at `d8af1ef27` — clean:

```text
$ npx eslint src/lib/storyboardEngine.js
(no output; exit code 0)
```

Root cause, verified at the commit that fixed it:

```text
$ git show d8af1ef27:eslint.config.js | grep -n "no-undef"
139:      'no-undef': 'warn',
```

`no-undef` is `'warn'` in `eslint.config.js:139` (identical at `HEAD`), and eslint exits 0
on warnings — which is why all six defects in
[Section 7](#7-defects-introduced-by-the-fix-commits) passed CI's `npm run lint`
(`.github/workflows/ci.yml:56`) unnoticed. Confirmed by temporarily downgrading the rule:

```text
$ npx eslint --rule '{"no-undef":"warn"}' src/components/VideoStudio.js
(29 no-undef findings; exit code 0)
```

Observed during this revision but **not** part of `d8af1ef27`: the working tree carries
uncommitted changes that upgrade `no-undef` to `'error'` and add file-level
`/* eslint-disable no-undef -- PRE-EXISTING DEBT: ... */` comments to 39 files, naming this
report as their record. See R6 in
[Section 9](#9-residual-findings--known-gaps).

### 5.4 Tests

```text
$ npx vitest run src/test/muapi-fixes.test.js src/test/personalizer.test.js \
    src/test/edit-studio-integration.test.js src/test/storyboard-panel.test.js

 Test Files  4 passed (4)
       Tests  61 passed (61)
    Duration  33.37s
```

The three original suites were modified by `8e6f50c49` (the commit raised their timeouts to
30s, since mounting the studios dynamically imports the full model catalog).
`src/test/storyboard-panel.test.js` is the regression suite added by `d8af1ef27`
(58 → 61 tests). Run twice during this revision (2026-10-14 20:15:36 and 20:31:15) —
61/61 both times; the second run included the uncommitted working-tree changes described
in R6.

### 5.5 Post-fix verification — commit `d8af1ef27`

Run 2026-10-14 to confirm the six fixes are present in the tree. Line numbers as of
`d8af1ef27` (broken parent `d8af1ef27^` positions in brackets where they differ).

| # | Command | Expected | Actual | Verdict |
|---|---|---|---|---|
| 1 | `grep -n "t2iModels" src/lib/storyboardEngine.js` | import + usage | `4:import { t2iModels } from './models.js';`<br>`69:    model = t2iModels[0]?.id,` | PASS |
| 2 | `grep -c "startGenerationProgress" src/components/CinemaStudio.js` | 2 | `2` | PASS |
| 3 | `grep -c "const finalPrompt" src/components/CinemaStudio.js` | 1 | `1` | PASS |
| 4 | `grep -c "const enhanceMenu" src/components/AvatarStudio.js` | 1 | `1` | PASS |
| 5 | `grep -c "openPromptGallery" src/components/TrainingStudio.js` | 2 | `2` | PASS |
| 6 | `grep -c "let _videoStudioOutsideClickHandler" src/components/VideoStudio.js` | 1 | `1` | PASS |
| 7 | `git show d8af1ef27 --stat \| tail -3` | 6 files changed | `6 files changed, 53 insertions(+), 1 deletion(-)` | PASS |
| 8 | `npx vitest run` — the four suites in [5.4](#54-tests) | 61/61 | `61 passed (61)` | PASS |

Fix sites, verified at `d8af1ef27` (positions in the broken parent in brackets):

- `src/lib/storyboardEngine.js:4` — added `import { t2iModels } from './models.js';`
  (use was `:68`, now `:69`).
- `src/components/CinemaStudio.js:19` — `startGenerationProgress` added to the
  `../lib/studioHelpers.js` import (use was `:1379`, now `:1403`).
- `src/components/CinemaStudio.js:1377` — `const finalPrompt = [...]` restored verbatim
  from `0e5f2228d^` (uses were `:1454`, `:1467`, `:1482`; now `:1478`, `:1491`, `:1506`).
- `src/components/AvatarStudio.js:267` — `const enhanceMenu = document.createElement('div');`
  restored in component scope (12 occurrences in the file).
- `src/components/TrainingStudio.js:12` — added
  `import { openPromptGallery } from '../lib/promptGalleryIntegration.js';`
  (use was `:343`, now `:344`).
- `src/components/VideoStudio.js:59` — added `let _videoStudioOutsideClickHandler = null;`
  (the new `container.cleanup` block uses it at `:2163-2165`; the 8 pre-existing
  registration/removal sites at `:1400-1402` and `:1413-1418` now resolve too).

Also re-confirmed for the record:
`git log --all -S "flux-2-pro" -- src/lib/storyboardEngine.js` returns nothing (see H3 —
the removed hardcode was `'flux-pro'`), and `_safeReturnRoute` is declared at
`src/components/Personalizer.js:1423` with its single call site at `:1045` (see C3 —
scoping fragility, not a reproduced crash).

---

## 6. Commit Reference

All four commits are on `main`. The three audit commits are ancestors of the merge
`4522e42dc` (2026-10-09); the fix commit `d8af1ef27` (2026-10-13) is HEAD.

| Commit | Date | Scope |
|---|---|---|
| `8e6f50c49855dd3c99f3a56755578eb9c076e64c`<br>`chore: finalize production-readiness fixes across studios and muapi layer` | 2026-10-03 | The bulk pass — 35 files, +1933/−927. Critical bug fixes (VideoStudio duplicate `params`, Personalizer `img` + `_safeReturnRoute`), `alert()` → toast/inline error, `console.*` removal, storyboard engine default model from catalog, muAPI client base URL from `VITE_MUAPI_URL`, Supabase proxy CORS fail-fast, `saveGeneration` bookkeeping in Effects/Avatar studios, plus routing/icon additions in `router.js` / `studioRoutes.js` / `Header.js` / `Sidebar.js`. |
| `c0611edcb2f38f9dbb5d5846656d8dbfadd82335`<br>`chore: remove remaining hardcoded API values and use muapi catalog dynamically` | 2026-10-07 | The hardcoding pass — 7 files, +63/−24. CinemaStudio Kling/Seedance fallbacks → catalog lookup + fail-fast, VideoStudio Extend model from the remote catalog, AudioStudio `hardcodedKeys` removal, PhotoStudioPage dynamic edit-model list, AnimatePage default model from `i2vModels`, muAPI proxy `MUAPI_BASE_URL` env. |
| `0e5f2228d934b99b4c30aa76bf59325713dbd754`<br>`chore: finalize production-readiness hardening across studios and muapi layer` | 2026-10-07 | The hardening pass — 6 files, +145/−104. CinemaStudio loading overlay + progress + cancel button + `isLoading` guard, AudioStudio persistence catch blocks surfacing toasts, `container.cleanup` hooks in AudioStudio/VideoStudio, `VITE_MUAPI_URL` missing-config guard, `MUAPI_BASE_URL` warn-and-fallback. |
| `d8af1ef27388fd1e249515bf100e0d55e2524ea2`<br>`fix(studios): resolve 6 no-undef ReferenceErrors introduced by production-readiness commits` | 2026-10-13 | The regression-repair pass — 6 files, +53/−1. Restores the missing `t2iModels` import (storyboardEngine), the `startGenerationProgress` import and `finalPrompt` declaration (CinemaStudio), the `const enhanceMenu` declaration (AvatarStudio), the `openPromptGallery` import (TrainingStudio), and declares `_videoStudioOutsideClickHandler` (VideoStudio), plus the `storyboard-panel` regression test. Full details in [Section 7](#7-defects-introduced-by-the-fix-commits). |

---

## 7. Defects Introduced by the Fix Commits

The three audit commits in Section 6 introduced six `no-undef` defects of their own —
identifiers used but never imported or declared. All six are live `ReferenceError` paths,
not theoretical lint noise: each is reachable from a user interaction. All six were fixed
by commit `d8af1ef27` (2026-10-13).

### 7.1 Root cause — `no-undef` was never a failure

`no-undef` is configured as `'warn'` in `eslint.config.js:139` — verified at `d8af1ef27`
and at `HEAD` via `git show <rev>:eslint.config.js`. eslint exits 0 on warnings, so
`npm run lint`, which CI runs at `.github/workflows/ci.yml:56`, stayed green while these
defects shipped. Verified directly: with the rule temporarily downgraded to `'warn'`,
`npx eslint src/components/VideoStudio.js` reports 29 `no-undef` findings and still exits
`0`. The repository already carries a large volume of warn-level noise, so six more
warnings were invisible.

### 7.2 The six defects

Numbered as fixed by `d8af1ef27` (6 files changed, 53 insertions, 1 deletion).

**D1 — `t2iModels` never imported (`src/lib/storyboardEngine.js`).**
`8e6f50c49` replaced the hardcoded `'flux-pro'` default with
`model = t2iModels[0]?.id` without importing `t2iModels`. The reference sits in a
destructuring default, so it only fires when a caller omits `model` — which
`src/components/StoryboardStudio.js:424` does
(`generateStoryboardFromIntent(intent, { generateImages: true })`), throwing
`ReferenceError: t2iModels is not defined` at `storyboardEngine.js:68:13`. **This is the
defect originally recorded in this report as R1.** Fixed by adding
`import { t2iModels } from './models.js';` at line 4; the usage is now at `:69`.

**D2 — `startGenerationProgress` never imported (`src/components/CinemaStudio.js`).**
Used at `:1379` after `0e5f2228d` added the loading-overlay/progress treatment, but absent
from the `../lib/studioHelpers.js` import at `:19`. Fixed by adding it to that import
(use now at `:1403`).

**D3 — `finalPrompt` declaration deleted (`src/components/CinemaStudio.js`).**
`0e5f2228d` removed the `const finalPrompt = [...]` declaration while leaving its three
use sites (`:1454`, `:1467`, `:1482` in the broken tree). Fixed by restoring the
declaration verbatim from `0e5f2228d^` at `:1377` (uses now at `:1478`, `:1491`, `:1506`).

**D4 — `const enhanceMenu` declaration deleted (`src/components/AvatarStudio.js`).**
`8e6f50c49` deleted `const enhanceMenu = document.createElement('div');` while 10 usage
sites remained, breaking the AvatarStudio mount path. Restored in component scope at `:267`
(12 occurrences in the file now).

**D5 — `openPromptGallery` never imported (`src/components/TrainingStudio.js`).**
Used at `:343`, never imported. Fixed by adding
`import { openPromptGallery } from '../lib/promptGalleryIntegration.js';` at line 12 (use
now at `:344`).

**D6 — `_videoStudioOutsideClickHandler` never declared (`src/components/VideoStudio.js`).**
The `container.cleanup` block added by `0e5f2228d` referenced an identifier that was never
declared (`:2162-2164` in the broken tree), so every route change away from VideoStudio
threw `ReferenceError`. Fixed by declaring `let _videoStudioOutsideClickHandler = null;` at
`:59`, which also resolves the 8 pre-existing registration/removal sites for the same
identifier (`:1400-1402`, `:1413-1418`).

### 7.3 Regression test

`src/test/storyboard-panel.test.js` gained
`'generateStoryboardFromIntent does not throw ReferenceError when called without a model argument'`
(24 lines). Per the `d8af1ef27` commit message, it was verified **RED** before the import
fix (threw exactly `ReferenceError: t2iModels is not defined` at `storyboardEngine.js:68:13`)
and **GREEN** after. Re-verified GREEN in this revision: the four-suite run passes 61/61
([Section 5.4](#54-tests)).

### 7.4 What `d8af1ef27` did not fix

The commit repaired six specific instances; the same `no-undef` class has further instances
in the tree (AvatarStudio, TrainingStudio, VideoStudio — including the identical
`_modelSelectorOutsideClickHandler` dropdown pattern that D6 fixed only for VideoStudio).
Those are recorded as **R6** in [Section 9](#9-residual-findings--known-gaps) and are not
covered by this commit.

---

## 8. API Wiring Standard

The pattern established by this work, and the one new code must follow:

**1. Resolve models through the catalog, never by literal id.**

```js
const catalogModel = getI2VModelById(currentSettings.model);
if (!catalogModel) {
  showToast(`I2V model "${currentSettings.model}" not found in catalog`, 'error');
  throw new Error(`I2V model "${currentSettings.model}" not found in catalog`);
}
resolvedModel = catalogModel.id;
```

Defaults come from the catalog too (`t2vModels[0].id`, `i2vModels[0]?.id`,
`t2iModels[0]?.id`) rather than a literal provider model name, and capability-based
filters replace id allowlists (`m.imageField === 'images_list' && m.hasPrompt`,
`m.inputs?.first_frame_url && m.inputs?.last_frame_url`).

**2. Fail fast, visibly.**

A catalog miss is never silently swallowed and never quietly falls back to a different
model. The failure path is `showToast(<human readable>, 'error')` followed by a `throw`
so the generation aborts. In-flight failures surface through `showInlineError` /
`formatErrorMessage` + `showToast` rather than disappearing.

**3. Base URLs are environment-driven on both sides of the wire.**

- Browser (`src/lib/muapi.js`): `import.meta.env.VITE_MUAPI_URL` → `this.muapiBaseUrl`,
  consumed by the model-schema, model-catalog and upload endpoints. Unset means a
  `console.warn` plus the documented default `https://api.muapi.ai/api/v1`.
- Edge function (`supabase/functions/muapi-proxy/index.ts`): `Deno.env.get('MUAPI_BASE_URL')`
  wrapped in an IIFE that warns and falls back to `https://api.muapi.ai`; every outbound
  URL is built from it (`${MUAPI_BASE_URL}/api/v1/${normalizedEndpoint}`).

The only remaining `api.muapi.ai` literals are the two documented fallback defaults and
one explanatory comment — verified by
`grep -rn "api\.muapi\.ai" src/lib/muapi.js src/components/*.js` (1 hit:
`src/lib/muapi.js:98`) and `grep -n "api\.muapi\.ai" supabase/functions/muapi-proxy/index.ts`
(hits only at `:3` comment, `:44` warn message, `:45` fallback). No request path builds a
URL from a literal host.

**4. Long-running generation is cancellable and observable.**

`AbortController` created per generation, `signal` threaded into the muAPI client
params, a loading overlay with progress, and an explicit cancel button where the studio
exposes one.

---

## 9. Residual Findings & Known Gaps

Verified during re-verification; **not** fixed by this audit — except R1, which was
resolved afterwards by `d8af1ef27` and is recorded here as RESOLVED.

**R1 — `t2iModels` was used but never imported in the storyboard engine — RESOLVED.**
Originally recorded here as an open defect: `src/lib/storyboardEngine.js:68` read
`model = t2iModels[0]?.id` while the file imported only `muapi`, `openaiService`, and
`apiKeyManager`, so the `StoryboardStudio.js:424` call path
(`generateStoryboardFromIntent(intent, { generateImages: true })`) threw
`ReferenceError: t2iModels is not defined` at runtime. **Fixed by `d8af1ef27`**, which
added `import { t2iModels } from './models.js';` at line 4 (usage now at `:69`), together
with five sibling fixes documented in
[Section 7](#7-defects-introduced-by-the-fix-commits). Re-verified in this revision:
`npx eslint src/lib/storyboardEngine.js` is clean (exit 0), and the regression test
`'generateStoryboardFromIntent does not throw ReferenceError when called without a model argument'`
in `src/test/storyboard-panel.test.js` passes (four-suite run 61/61). Check #3 in Section
5.1 passes only because it greps for a string that was never in this file — the hardcode
removed by `8e6f50c49` was `'flux-pro'`, not `'flux-2-pro'` (see H3).

**R2 — `alert()` still present outside the audited studios.**
`grep -c "alert(" src/components/*.js` shows remaining native alerts in
`ContactImporterModal.js` (4), `PersonalizePage.js` (5), `VideoEditorPage.js` (5),
`SettingsModal.js` (1), `ContentLibraryPage.js` (1). The studio audit did not cover these.

**R3 — Extend-model lookup depends on the remote catalog shape.**
VideoStudio's Extend button now requires the muAPI catalog response to carry
`requiresRequestId === true` or an id ending in `-extend`. The local catalog mirror in
`src/lib/models.js` does define `seedance-v2.0-extend` with `requiresRequestId: true`
(id at `src/lib/models.js:2146`, flag at `:2150`), so the fields are expected to be
present — but the code
reads the **remote** `muapi.getModelCatalog()`, so a catalog response that omits those
fields degrades Extend to the `'Extend model not found in catalog'` toast instead of a
fallback model.

**R4 — `MUAPI_BASE_URL` / `VITE_MUAPI_URL` guards warn rather than throw.**
Both layers fall back to the default production muAPI URL when unset, so a misconfigured
environment still talks to `api.muapi.ai` silently. This matches the intent recorded in
the commits, but if fail-fast is preferred for the base URL, the guard should throw like
`getCorsHeaders()` does for `ALLOWED_ORIGINS`.

**R5 — Only three studios have `container.cleanup` hooks.**
`AudioStudio`, `VideoStudio`, and `CinemaStudio` detach their window listeners on
navigation. Other studios that register `window` listeners still rely on the listener
being harmless, since the router (`src/lib/router.js:150`) will call `cleanup?.()` for
any container that defines one.

**R6 — Remaining `no-undef` debt not covered by `d8af1ef27` (NEW).**
The fix commit repaired six specific instances, but the same defect class survives
elsewhere. Counts measured 2026-10-14 with eslint at `no-undef: 'error'` severity against
the committed studio files (line numbers as of `d8af1ef27`; the current working tree
shifts them by +1 in the affected files — see the note below):

| File | Undeclared identifiers (use sites) | eslint findings |
|---|---|---|
| `src/components/VideoStudio.js` | `btnRect`, `containerRect` (model-selector dropdown positioning, `:1392`); `generationError`, `isLoading`, `abortController`, `loadingOverlay`, `progressHandle` (async generate handler, `:1747-2142`) | 29 |
| `src/components/AvatarStudio.js` | `renderProviderLogoImg` (`:67`); `_modelSelectorOutsideClickHandler` (model-selector dropdown, `:85-121`) | 9 |
| `src/components/TrainingStudio.js` | `renderProviderLogoImg` (`:53`); `_modelSelectorOutsideClickHandler` (`:71-149`); `apiKeyManager` (`:411`) | 10 |

Notes:

- These are **pre-existing**, not introduced by the audit commits: the AvatarStudio and
  VideoStudio occurrences are already present at `8e6f50c49^` (the pre-audit tree), and
  none of the identifiers has a declaration anywhere in its file.
- `_videoStudioOutsideClickHandler` (D6) and `_modelSelectorOutsideClickHandler`
  (Avatar/Training) are the same pattern; only the VideoStudio one was repaired.
- VideoStudio loads as a strict-mode ES module (`src/lib/router.js:58`), so the
  assignments to undeclared `abortController` / `isLoading` / `loadingOverlay` /
  `progressHandle` / `generationError` inside the generate handler are live
  `ReferenceError`s on that path, not merely lint noise.
- **Working-tree state, uncommitted (observed 2026-10-14):** a concurrent change upgraded
  `no-undef` to `'error'` in `eslint.config.js` and added file-level
  `/* eslint-disable no-undef -- PRE-EXISTING DEBT: documented in
  docs/audits/MUAPI-PRODUCTION-READINESS-REPORT.md */` comments to 39 files — this report
  is the designated record for that debt. Those changes are **not** part of `d8af1ef27`
  and were still uncommitted when this revision was written. The suppression silences lint
  but does not declare the identifiers, so the runtime exposure above remains until the
  declarations are added.

---

*Report re-created 2026-10-13 from re-verification of commits `8e6f50c49`, `c0611edcb`,
and `0e5f2228d` on `main`; revised 2026-10-14 to record the resolution of R1 and its five
sibling defects by `d8af1ef27` (new Section 7, R1 marked RESOLVED, R6 added).
Documentation only — no code changes, nothing committed. Line numbers cited for fix sites
are as of `d8af1ef27`; the working tree was concurrently receiving uncommitted changes
while this revision was written (see R6).*
