# ADR-0001: Template Studio Production Fixes

**Date:** 2026-07-30
**Status:** Accepted
**Authors:** Kilo Code Audit

## Context

The Template Studio feature allows users to create AI-generated images and videos from pre-defined templates. During a production-readiness audit, 10 bugs were identified across the generation path, prompt building, and security/infrastructure layers. All bugs produced the same user-visible symptom: **"when I try to create a template, it comes back with a placeholder image instead of creating the template from the prompts."**

## Bugs Identified

### Bug 1: `generateImage` sent `image_url: null`
`src/lib/muapi.js` `generateImage()` explicitly set `finalPayload.image_url = null` when no image was uploaded. All other generation functions only include `image_url` when truthy. Sending `null` caused the muapi API to return a placeholder image instead of generating from the text prompt.

**Fix:** Removed the `else { finalPayload.image_url = null }` branch.

### Bug 2: `generateI2V` did not forward `name`
Effect endpoints like `generate_wan_ai_effects` require a `name` parameter to select the effect. `generateI2I` forwarded `name` but `generateI2V` did not, causing 422 errors or placeholders for i2v templates.

**Fix:** Added `if (params.name) finalPayload.name = params.name` to `generateI2V`.

### Bug 3: `generateVideo` did not forward `name`
Same as Bug 2 but for `generateVideo`.

**Fix:** Added `if (params.name) finalPayload.name = params.name` to `generateVideo`.

### Bug 4: Enhancer keywords gated on undefined `userPrompt`
`buildEnrichedPrompt()` only added enhancer keywords when `userPrompt` was truthy. But `userPrompt` is `params.prompt` at the time of the call, which is `undefined` (the function is *setting* `params.prompt`, not reading it). This meant cinematic/4K keywords were never applied.

**Fix:** Removed `&& userPrompt` check from the enhancer keywords condition.

### Bug 5: CinematicTemplateWizard used non-existent `template.kind`
The wizard routed using `template.kind === 'image'` (field doesn't exist on templates) and a regex on `template.name`. This meant i2v/i2i templates were always routed to `generateVideo`/`generateImage` incorrectly.

**Fix:** Replaced with `template.modelType`-based routing consistent with TemplateStudio.

### Bug 6: `generateVideoEffect` accidentally modified
During edits, `generateVideoEffect` was changed to use `generationType: 'video'` and `studioType: params.studioType || 'video'`, which is the wrong contract for the effects studio.

**Fix:** Restored to `generationType: 'video-effect'`, `studioType: 'video-tools'`.

### Bug 7: `{prompt}` replacement edge case in basePrompt
When `userPrompt` was empty, `basePrompt.replace('{prompt}', '')` left a leading `, ` in the prompt.

**Fix:** Added `.replace(/^,\s*/, '').trim()` after the substitution, and changed to global replace `/\{prompt\}/g` to handle multiple occurrences.

### Bug 8: Enhancer keyword duplication
`specs.enhancerKeywords` and `template.promptDirection` could both contain similar terms, producing repetitive prompts.

**Fix:** Added a regex-based dedup step in the join/cleanup section.

### Bug 9: Empty `basePrompt` templates
29 of 52 templates had no `basePrompt`. If no advanced fields were filled, the prompt could be weak.

**Fix:** Added a default quality prompt fallback in `buildEnrichedPrompt` when both `basePrompt` and `userPrompt` are empty, with category-specific defaults.

### Bug 10: supabase.js placeholder fallback
`src/lib/supabase.js` fell back to `https://placeholder.supabase.co` with key `placeholder` if env vars were missing, and had a catch block that installed a mock client that silently rejected uploads.

**Fix:** Removed the mock client fallback (now throws), and added a `supabase-misconfigured` event for the UI to show a blocking banner.

## Additional Hardening

- **Dev bypass guard (§4.4):** `isDevBypass` is now disabled in production builds (`import.meta.env.MODE === 'production'`).
- **CORS restriction (§4.6):** Proxy no longer falls back to `*` in production when `ALLOWED_ORIGINS` is empty.
- **Cancel button (§7.1):** Generate button now shows "Cancel" during generation and aborts the request via `AbortController`.
- **Error panel (§7.2):** Errors now show in a visible red panel below the button instead of just the button text.
- **Empty state (§7.3):** Preview area now shows "Click Generate to create an image" for t2i templates instead of the misleading "Upload an image".
- **aria-labels (§7.5):** Wand and Thumbnail buttons now have `aria-label` attributes.
- **Prompt length limit (§6.4):** `buildEnrichedPrompt` caps output at 2000 characters and truncates cleanly.
- **Placeholder-regression detection (§8.4):** `showResult` now checks for `placeholder|sample|mock|test/` patterns in the result URL and shows a red warning.
- **Brief length guard (§10.3):** `TemplateThumbnailModal.goGenerate()` requires at least 10 characters before generating.
- **Empty prompt guard (§3.10):** Generate handler rejects prompts shorter than 10 characters with a visible error message.

## Verification

- Syntax check: pass for all modified files.
- Lint: 0 new errors; only pre-existing `outputTabValues` prefer-const and `preserve-caught-error` warnings remain.
- Runtime path verified: proxy hardcodes `https://api.muapi.ai/api/v1/...`, requires real `MUAPI_API_KEY`, no mock/placeholder fallbacks.
- No `nock`, `msw`, `sinon`, or `jest.mock` usage found in `src/` or `backend/`.

## Consequences

- All Template Studio generation paths now use real APIs.
- No mock/placeholder content is returned to users.
- The supabase.js fallback is hardened to fail loudly instead of silently.
- Dev bypass is disabled in production builds.
- CORS is restricted to allowlisted origins in production.
