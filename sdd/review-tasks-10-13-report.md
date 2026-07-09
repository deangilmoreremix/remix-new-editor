# Code Review — Thumbnail Modal Full-Feature, Tasks 10–13

**Reviewer:** Senior code reviewer (automated pass)
**Date:** 2026-07-09
**Plan:** `docs/superpowers/plans/2026-07-08-thumbnail-modal-full-features.md` (Tasks 10–13 + Global Constraints)
**Review package:** `sdd/review-tasks-10-13.diff`

## Summary

Reviewed the client-side implementation of Tasks 10–13 of the Thumbnail Modal plan:

- **Task 10** (`dcf32180`) — `src/lib/thumbnailService.js`: all five actions (`buildPromptVariants`, `generateCandidates`, `refineLastImage`, `inpaint`, `saveToStorage`) converted to accept a full options/control object.
- **Task 11+13** (`92a24773`) — `TemplateThumbnailModal.jsx`: preset chips, output-controls sidebar, reference-image input, and wiring of controls/presetKey/reference image into service calls.
- **Task 12** (`a0a0b991`) — `TemplateThumbnailModal.jsx`: grid layout (`.thumb-modal__layout`), revised-prompt pills, partial-preview overlay, completion metadata on the saved screen.
- **Fix** (`99276a92`) — `TemplateThumbnailModal.jsx` + `src/lib/uiIntegration.js`: aligned all modal/uiIntegration service calls with the options-object contract; fixed a `variants.length` ReferenceError; fixed the opaque `.thumb-modal__partial` overlay.

I read the package diffs first, then cross-checked the **final** state of `thumbnailService.js`, `TemplateThumbnailModal.jsx`, `uiIntegration.js`, `openaiConfig.js`, and `thumbnailPresets.js`. The intermediate bugs introduced in `92a24773` (positional args, `variants.length`) are genuinely resolved by `99276a92` in the final source. No dev server was run; runtime behavior was traced statically.

## Findings

| Severity | File:line | Issue | Suggestion |
|---|---|---|---|
| Medium | `src/lib/thumbnailPresets.js:24,32,40,48,56,64` + `src/components/modals/TemplateThumbnailModal.jsx:205-206` | **Preset control key mismatch.** Presets define `controls.format` / `controls.compression`, but the modal state and service use `outputFormat` / `outputCompression`. `applyPresetToControls` (thumbnailPresets.js:89-91) does a naive spread, so a selected preset's compression/format never overwrite the active `outputCompression`/`outputFormat`; instead stray `format`/`compression` keys are added. Net effect: preset compression values (75/85/90) are silently ignored (always defaults to 80) and the sidebar Compression input keeps showing the default even after selecting a preset. quality/style/background/aspectRatio are unaffected (keys match). Inherited from the plan spec, but real in final behavior. | Normalize preset keys to `outputFormat`/`outputCompression` (or map them inside `applyPresetToControls`). |
| Low | `src/lib/thumbnailService.js:77,101,119` | `refineLastImage(opts)`, `inpaint(opts)`, `saveToStorage(opts)` have no `= {}` default. With an empty object they degrade cleanly, but calling with no argument throws `TypeError` on `opts.prompt`/`opts.imageB64`. Acceptance-check phrasing ("never throw on missing optional opts") is satisfied for missing *fields*, not a missing *object*. | Add `opts = {}` defaults for symmetry with `generateCandidates`. |
| Low | `src/components/modals/TemplateThumbnailModal.jsx:595` + `src/lib/thumbnailService.js:59-75` | `goGenerate` passes `presetKey` inside the `generateCandidates` opts, but the service never forwards `presetKey` for the `generate` action (and the edge `generate` handler does not consume it). Dead parameter — harmless but misleading. | Drop `presetKey` from the generate opts, or document that generate ignores it. |
| Low | `src/components/modals/TemplateThumbnailModal.jsx:361,677,703` | **Partial-preview overlay is inert.** `this.partialPreview` is only ever assigned `null`; the client uses `supabase.functions.invoke` (single request/response), which does not consume the edge function's SSE partial-image stream, so the overlay markup/CSS never renders a real preview. The Task 12 render requirement (overlay element present) is met, but the feature is non-functional end-to-end with the current non-streaming transport. | Either wire a streaming transport for partials or note the overlay as a future/streaming-only affordance. |
| Low | `src/components/modals/TemplateThumbnailModal.jsx:199-216` | `this.revisedPrompt` is not initialized in the constructor (plan Task 11 Step 3 lists it). It is set in `open()` before any render, so no runtime bug, but it deviates from the plan and relies on ordering. | Add `this.revisedPrompt = '';` to the constructor. |
| Low | `src/components/modals/TemplateThumbnailModal.jsx:624-632` | `selectPreset` rebuilds the brief from `buildInitialBrief()`, discarding any user edits typed into the brief textarea before switching presets. Minor UX regression. | Read the current `#thumb-brief` value into `this.brief` before reapplying the preset modifier. |

## Acceptance-check verification

**1. thumbnailService forwards presetKey/controls and never throws on missing optional opts — PASS (with note).**
- `buildPromptVariants(brief, presetKey)` conditionally attaches `presetKey`, returns `{ variants, responseId }` (thumbnailService.js:38-57). No throw when `presetKey` omitted.
- `generateCandidates(prompt, opts = {})` defaults opts, guards every optional field, returns `{ candidates, params }` (59-75). Safe with no opts.
- `refineLastImage(opts)` (77-99), `inpaint(opts)` (101-117), `saveToStorage(opts)` (119-137) guard optional fields and never throw on missing *fields*. Note (Low finding): they lack an `= {}` default, so a fully-missing argument would throw. All in-repo callers pass an object.

**2. Modal wires preset selection, sidebar controls, and reference-image input (Task 11) — PASS.**
- `selectPreset` / `getPresetForTemplate` used in `open()` (945-948) and chip handler (624-632).
- `updateControl` mutates `this.controls` immutably and mirrors `imageDetail` (634-638); sidebar selects/inputs are wired (425-492).
- `loadReferenceFile` / `clearReference` implemented (640-656); reference stored as `{ source:'b64', value, previewDataUrl }`.

**3. renderBody grid + revised-prompt pills + partial preview (Task 12) — PASS (with note).**
- `renderBody` wraps `main` in `.thumb-modal__layout` with `.thumb-modal__main` + `renderSidebar()` (246-264).
- Revised-prompt pills render per candidate (303-314) and on the saved screen (412), HTML-escaped.
- Partial-preview overlay markup + CSS present (361, 127-131). Overlay is inert at runtime (Low finding) but the render requirement is implemented.

**4. buildPrompts/goGenerate/applyRefine/applyInpaint/goSave pass full controls + presetKey + reference image; `this.lastParams` initialized in constructor — PASS.**
- `buildPrompts` sends `this.presetKey`, destructures `{ variants, responseId }`, uses `this.variants.length` (576-579) — the earlier ReferenceError is fixed.
- `goGenerate` passes the full control set as an opts object (593-602). (`presetKey` is a dead param here — Low finding.)
- `applyRefine` passes controls + `partialImages`/`store`/`include`/`imageDetail` + reference image, guarding missing result fields (680-699). Correctly omits `style` (Responses `image_generation` tool has no style).
- `applyInpaint` passes the full control set as opts (726-735).
- `goSave` passes `presetKey` + `controls`, reads `result.imageUrl` and `result.job.completedAt` (762-771).
- `this.lastParams = null` is initialized in the constructor (215). ✔ pre-flight requirement met.

**5. Fix `99276a92` makes uiIntegration.js and modal calls consistent with the options-object contract — PASS.**
- `defaultGenerateThumbnail` uses `generateCandidates(prompt, { n: 1 })` and destructures `{ candidates }` (uiIntegration.js:25).
- All five modal call sites use the options-object/positional contract matching the service signatures (verified via grep; the only other `saveToStorage` matches are the unrelated `cameraState.js` class).

## Global-constraint verification

- **No model switcher:** none present in the modal. ✔
- **gpt-image-2 `background: transparent` degrades to `auto`:** sidebar backgrounds are `['auto','opaque']` only (openaiConfig.js:30), so `transparent` is unselectable; the service passes background through and the edge handler additionally clamps `transparent → auto` (defense in depth). ✔
- **No new npm deps; `src/` stays `.js`/`.jsx`:** no imports added beyond existing local modules; files remain JS/JSX. ✔
- **`OPENAI_API_KEY` never leaves the server:** client only calls `supabase.functions.invoke`; no key usage in reviewed client files. ✔
- **Modal CSS extends the inline `THUMB_STYLES` constant (no new SCSS):** new rules appended inline (TemplateThumbnailModal.jsx:102-132). ✔

## Final verdict

**APPROVE** (no blockers).

The Tasks 10–13 implementation is functionally coherent, all five acceptance checks pass, and every global constraint is satisfied. The follow-up fix (`99276a92`) correctly repairs the positional-argument and ReferenceError regressions that the intermediate Task 11+13 commit introduced.

One correctness defect worth fixing before relying on presets in production: the **preset control key mismatch** (`format`/`compression` vs `outputFormat`/`outputCompression`, Medium) means preset compression/format values never take effect. It is non-crashing and inherited from the plan spec, so it does not block, but it undermines the preset feature and should be scheduled. The remaining findings are Low (defaults, dead param, inert partial-preview overlay, uninitialized `revisedPrompt`, brief-edit loss on preset switch).
