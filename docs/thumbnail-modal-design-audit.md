# Thumbnail Modal — Design Update Audit

**Date:** 2026-08-17
**Auditor:** Kilo
**Subject:** Why the running dev server does not show the unified "new" thumbnail modal (OpenAI Image API v2 + the clickable 20/30 thumbnail designs), and what needs to happen to finish it.

---

## 1. Executive Summary

The "new" thumbnail modal work (OpenAI Images API v2 controls + the clickable thumbnail **designs** catalog) **was implemented**, but it landed in **two separate, divergent modal implementations that were never unified into one**. Every studio opens `StudioThumbnailModal` (a side-panel subclass), while only the template pages open `TemplateThumbnailModal` (a centered modal). Each implements a *subset* of the desired feature set with different markup, CSS, and override paths.

The dev server **does** serve the current, feature-complete code (verified live — see §4). The reason it *appears* "not updated to the new design" is a combination of:

1. **Three dev servers are running, rooted in different checkouts** — one is in a Kilo **worktree** (`coral-cemetery`), two are in the **main working directory**, which is **mid-merge with unresolved conflicts**. Editing in the main dir will not show up on the worktree server (and vice-versa).
2. **The two modal classes render differently**, so depending on which entry point / server you hit, you see a different-looking modal — easy to read as "the old/incomplete one."
3. **Plan drift**: the 2026-07-08 plan prescribed an inline-`THUMB_STYLES` + `renderSidebar()` grid design. The actual implementation is a later "GTM design system" rewrite (CSS variables + `thumb-preset-card` + a separate SCSS file that is **never imported**). So neither the plan nor a single canonical design is what shipped.

**Required fix (the actual "finish"):** merge `TemplateThumbnailModal` and `StudioThumbnailModal` into **one** modal that contains the newest features, all OpenAI Image API v2 controls, and the clickable 20/30-design catalog, and point every studio at that single component.

---

## 2. Plans / Specifications Inventory

| Plan / Doc | Path | Status | What it covers |
|---|---|---|---|
| Original creation plan | `.kilo/plans/1783521837256-template-thumbnail-modal.md` | Superseded | 5-step vanilla modal scaffold |
| Redesign plan | `.kilo/plans/thumbnail-studio-redesign-plan.md` | Superseded | Replace `<select>` with dropdown, restyle |
| **OpenAI v2 full-feature plan** | `docs/superpowers/plans/2026-07-08-thumbnail-modal-full-features.md` | **Implemented, but split** | 14 tasks: quality/style/background/format/compression, aspect override, partial streaming, store/include, structured output, revised-prompt, reference images, preset library, `template_thumbnail_jobs` table. Task 14 = this audit. |
| Parity audit | `plans/modal-feature-parity-audit.md` | Done | Confirms `TemplateThumbnailModal` is NOT a stub; lists features |
| SDD reviews | `sdd/review-tasks-10-13-report.md`, `sdd/task-13-report.md` | APPROVE (for then-current state) | Static review of Tasks 10–13 |
| Production fixes | `docs/adr/0001-template-studio-production-fixes.md`, `docs/TEMPLATE_STUDIO_PRODUCTION_CHECKLIST.md` | Done | Brief-length guard, etc. |

**Gap:** none of these plans account for the *second* modal (`StudioThumbnailModal`). The OpenAI v2 + preset work was applied to `TemplateThumbnailModal`, but the studios mount `StudioThumbnailModal`, which grew organically as a side-panel subclass with its own overrides. The two were never reconciled.

---

## 3. Current Implementation State

### 3.1 Two modal classes (the core problem)

| | `TemplateThumbnailModal` | `StudioThumbnailModal` |
|---|---|---|
| File | `src/components/modals/TemplateThumbnailModal.jsx` | `src/components/modals/StudioThumbnailPanel.jsx` |
| Layout | Centered modal (`.thumb-modal__*`) | Right-side **drawer/panel** (`.studio-thumb-panel`, `.thumb-form`) |
| Mounted by | `CinemaTemplateStudio`, `TemplateStudio`, `TemplatesPage` (3 places) | **15+ studios**: Audio, Avatar, Character, Chat, Commercial, Edit, Effects (×2), Image, Influencer, LipSync, Storyboard, Training, Upscale, Video, VideoTools |
| Preset chips (`thumb-preset-card`) | Yes (6 presets) | No (uses Explore Ideas instead) |
| Explore Ideas / 20–30 designs | Yes (imports `ThumbnailExploreIdeas`) | Yes (imports `ThumbnailExploreIdeas`) |
| OpenAI v2 controls | Yes | Yes (richer: brand kit, video thumbnails, conversational refine, multi-reference) |

Both import `ThumbnailExploreIdeas`, which renders `THUMBNAIL_TEMPLATES` (the clickable designs catalog) from `src/lib/thumbnailTemplateRegistry.js`.

### 3.2 The "20 designs" exist — as a registry of 30

`src/lib/thumbnailTemplateRegistry.js` → `THUMBNAIL_TEMPLATES` has **30** entries (the user's "20 designs"). They are surfaced through the **Explore Ideas** screen in both modals (click a card → `applyTemplate` → generates in that design). They are **not** shown as a primary clickable grid on the modal's main view; they sit behind the "✨ Explore Ideas" button. If the expectation is a visible clickable design grid on the main modal, that is a UX gap, not missing data.

`src/lib/thumbnailPresets.js` has only **6** presets (`cinematic`, `productCutout`, `lifestyle`, `boldText`, `minimal`, `vertical`) — these are the niche auto-select presets, distinct from the 30-template design catalog.

### 3.3 Styling is fragmented / partially dead

- Plan said: styles via inline `THUMB_STYLES` constant. **Not done.**
- Actual: `src/components/modals/modal-styles.css` carries the real `.thumb-modal*` / `.studio-thumb-panel*` / `.thumb-form*` rules (imported in `main.js`).
- `styles/components/modals/TemplateThumbnailModal.scss` (**1,545 lines**) is **never imported** by any JS or SCSS in the build (`_index.scss` imports it, but `styles/index.scss` is not imported into the app). It is **dead/duplicate CSS**.
- CSS variables (`--app-primary`, `--bg-panel`, `--border-color`, …) resolve via `main.js` → `style.css` → `variables.css`, so the modal *is* correctly styled.

### 3.4 openaiConfig is consistent

`openaiConfig.getThumbnailOutputSettings()` (and the `defaultConfig.thumbnail*` keys) supplies every field both modals consume (`nOptions`, `responsesModelOptions`, `models`, `customSizes`, `maxReferenceImages`, `quickEdits`, `partialImagesOptions`, `inputFidelityOptions`, etc.). No config mismatch.

---

## 4. Verification — the dev server *is* serving the new design

I opened the running server and exercised the modal:

- **Server inventory (live):**
  - `:3000` → CWD `.kilo/worktrees/coral-cemetery` (branch `merge-ts-fix`) — a **separate git checkout**
  - `:4321` → CWD main working dir
  - `:5180` → CWD main working dir
- **Live test on `:3000`** (`/#/image` → "🖼 Thumbnail"): the panel rendered **Explore Ideas**, **Quality** + **Style** selects, **Advanced (model, size, format, streaming)**, **Target Platform**, **Brand kit**, **Generate animated video thumbnail**, and **"Generate 3 Thumbnails"** — i.e., the complete OpenAI v2 + designs UI.
- Fetched the transformed `TemplateThumbnailModal.jsx` module from `:3000`: **30 feature markers** present (presets, compression, reference images, revised prompt, advanced). The code is current.

**Conclusion:** the code is not stale. The perception of "old/incomplete" comes from *which server/checkout* is being viewed and *which of the two modals* opens.

---

## 5. Root-Cause — Why it "hasn't updated to the new design"

### RC-1 (primary): Dev server is bound to a Kilo worktree, not your working copy
The server you are most likely looking at (`:3000`) runs from `.kilo/worktrees/coral-cemetery`, a **detached git worktree** on branch `merge-ts-fix`. Any edit you make in the **main working directory** will **not** appear there, because Vite watches the worktree's files. Conversely, edits made inside the worktree won't be in your main branch. This is the single most common reason "my changes didn't show up."

### RC-2: Main working tree is mid-merge with unresolved conflicts
`git status` shows `Unmerged paths` — `both modified`: `EditStudio.js`, `EffectsStudio.js`, `TimelineEditorPage.jsx`, `UpscaleStudio.js`, `VideoToolsStudio.js`, `HeaderAuth.jsx`, `lib/constants/modals.js`. The tree is not in a clean, runnable state, so a dev server started from it is serving conflicted/partial files. The modal file itself is not conflicted, but the surrounding studios are.

### RC-3: Two modal implementations, never unified
`TemplateThumbnailModal` (centered) and `StudioThumbnailModal` (side panel, extends it) diverge in layout, preset UI, and overrides. Work applied to one is not automatically in the other. Users hitting a studio see the side panel; users hitting a template page see the centered modal. Neither is a strict superset → both look "incomplete" relative to the intended single design.

### RC-4: Plan drift + dead CSS
The shipped design doesn't match the 2026-07-08 plan (inline `THUMB_STYLES`/`renderSidebar`), and `TemplateThumbnailModal.scss` (1,545 lines) is unused. There is no single canonical stylesheet or design to point at.

---

## 6. Required Remediation — Unify into ONE modal

To "finish" the design update, collapse the two classes into a single `TemplateThumbnailModal` (keep the richer `StudioThumbnailModal` feature set) and have **every** studio mount it:

1. **Pick one canonical component.** Recommend keeping `TemplateThumbnailModal` as the base and folding `StudioThumbnailModal`'s unique features (Explore Ideas grid on main view, brand kit, video-thumbnail frames, conversational refine, multi-reference) into it — or vice-versa. Remove the subclass.
2. **Single mount path.** Replace all `new StudioThumbnailModal({...})` + `mountStudioThumbnailModal(...)` (15+ studios) and the 3 `TemplateThumbnailModal` mounts with the one component + one mount helper.
3. **Promote the 20/30 designs to a visible clickable grid** on the modal's main view (not hidden behind "Explore Ideas"), so "click a design → generate in that design" is the primary flow.
4. **Collapse styling** into `modal-styles.css`; delete the dead `TemplateThumbnailModal.scss` and the unused `styles/index.scss` modal chain.
5. **Clean the environment:** resolve the in-progress merge in the main dir, stop the orphaned `:3000` worktree server (or restart it pointed at your working copy), and run a single dev server so edits are observable.

### Suggested task list
- [ ] Decide canonical modal (base class) and delete the other.
- [ ] Merge `StudioThumbnailModal` feature set into the canonical modal.
- [ ] Replace all 18 mount sites with the single component + helper.
- [ ] Surface `THUMBNAIL_TEMPLATES` as a primary clickable design grid.
- [ ] Remove dead `TemplateThumbnailModal.scss` / unused SCSS chain; consolidate into `modal-styles.css`.
- [ ] Resolve the main-dir merge; run one dev server from the working copy.
- [ ] Re-run this audit (Task 14 of the 2026-07-08 plan) as a final smoke test.

---

## 7. Evidence Index

- `src/components/modals/TemplateThumbnailModal.jsx` (1697 lines, centered modal)
- `src/components/modals/StudioThumbnailPanel.jsx` (`StudioThumbnailModal`, side panel, `extends TemplateThumbnailModal`)
- `src/lib/thumbnailPresets.js` (6 presets)
- `src/lib/thumbnailTemplateRegistry.js` (`THUMBNAIL_TEMPLATES`, 30 designs)
- `src/lib/thumbnailService.js`, `src/lib/config/openaiConfig.js` (controls/config — consistent)
- `src/components/modals/modal-styles.css` (active modal CSS); `styles/components/modals/TemplateThumbnailModal.scss` (dead)
- `src/main.js` (imports `style.css` + `modal-styles.css`)
- Live server check: `:3000` (worktree `coral-cemetery`), `:4321`/`:5180` (main dir, mid-merge)
- `docs/superpowers/plans/2026-07-08-thumbnail-modal-full-features.md` (Task 14 = this audit)
