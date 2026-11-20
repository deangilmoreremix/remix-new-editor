# Plan: bring Edit-tab modals and panels onto one CineGen design

Status: proposal, no app code changed. Mockups: `plans/screenshots/timeline-modal-redesign/` (PNG + source HTML).

## Problem
The Edit tab's chrome (top tabs, media pool, inspector, music popup) uses the CineGen tokens in
`src/cinegen/styles/globals.css` + `theme-remix.css`. Many modals and panels were added later and were
hand-styled, so they look flat and dated beside it.

Audit of `src/cinegen/components/edit/` (inline `style={{}}` count; the polished ones use CSS classes):

| Component | Inline styles | Notes |
|---|---|---|
| `stock-media-popup.tsx` | 47 | |
| `template-videos-modal.tsx` | 33 | |
| `add-to-timeline-modal.tsx` | 27 | |
| `overlay-settings-panel.tsx` | 24 | |
| `left-panel.tsx` | 20 | |
| `occ-library-modal.tsx` (Effects / LUTs / Transitions / Extensions) | 19 | hard-coded `#0b1016`, `#d9ff00`, 8px radius, `clip-properties-panel__toggle-btn` reused as tabs |
| `personalized-layouts-panel.tsx` | 18 | |
| `mg-templates-modal.tsx`, `contact-check-panel.tsx`, `sound-library-popup.tsx`, `hyperframes-modal.tsx` | 15-16 each | |
| `music-popup`, `extend-modal`, `fill-gap-modal`, `frame-chat-modal`, sync/batch dialogs | 0 | already class-based; use as the reference |

Also:
- **Two accents.** `globals.css` / `theme-remix.css` define lime `#d9ff00`, but the Edit tab visibly renders cyan `#22d3ee`
  (hard-coded in `theme-remix.css`), and `occ-library-modal` marks its active tab lime. Needs one decision (Phase 0).
- **Legacy catalog modals.** Recipes, Prompt Gallery and Monetization Hub (`src/components/modals/*`, `catalogModalStyles.js`)
  are the old BaseModal look and not the CineGen one. Cinema Studio imports all three but does not expose them.
- **Library modal UX gaps (seen in the screenshots):** the Transitions tab says "select a clip with a next clip" but shows no
  context or duration; cards have no selected/applied state; no search or categories (33 effects); tab counts are plain text;
  the grid is cut off at the bottom with no cue that it scrolls.

## Target design (see screenshots)
One shared modal shell, built from existing tokens (no new palette):
- Surface `--bg-raised`, 1px `--border-medium`, radius `--radius-lg` (16), the music-popup shadow, header gradient.
- Header: icon tile, title + one-line subtitle, context chip (selected clip/track), close button.
- Toolbar: segmented tabs with mono count pills, search (`/` to focus), category chips.
- Body: card grid. Hover = lift + "Preview"; applied = accent ring + check.
- Footer: hint text left, `Esc` key hint right, primary/secondary buttons when the modal has actions.
- Transitions gets a context strip (Clip 1 → Clip 2) with a duration slider.
- Master/detail variant (list left, detail right, steps with a status log) for Recipes, Prompt Gallery, Monetization Hub.

## Catalog modals: current vs proposed
Current (captured from the real components): `current-recipes.png`, `current-prompt-gallery.png`, `current-monetization-hub.png`.
Proposed: `04-recipes-catalog.png`, `05-prompt-gallery.png`, `06-monetization-hub.png`.

What the current ones have in common: grey `#111` panels with a lime accent unrelated to the Edit tab, a plain title bar with no icon or
context, native `<select>` filters, a detail pane that starts empty ("Select a prompt to preview"), and a buttons-without-footer layout.
Monetization Hub also dumps the full multi-hundred-word track description into each list card, so only one card fits on screen.
Proposed: shared shell, search with `/`, tabs and filters as pills, selected-card ring, clamped descriptions, and a sticky footer with
the primary action. The Monetization mockup's lesson list, durations and "Open track" button are illustrative, not from real data.

## Phases
0. **Decide the accent** (cyan as the Edit tab shows now, or lime as the tokens say). Mockups use cyan. Switching is one token
   change: `--acc`, `--acc-dim`, `--acc-line` at the top of `mock.css`.
1. **Shared shell.** Add `cg-modal__*` classes to `src/cinegen/styles/edit-tab.css` (header, toolbar, segmented tabs, chips,
   card grid, footer, kbd) and a small `<ModalShell>` component in `components/ui/`. Reuse `.music-popup` animation and shadow.
2. **Library modal** (`occ-library-modal.tsx`): port to the shell; add search, category chips, selected/applied state, scroll fade,
   transitions context strip + duration; restyle Extensions (install card, pack rows with switches). Keep the existing data and
   handlers (`onPickFx`, `onPickLut`, `onPickTransition`); this is a presentation change.
3. **Inline-style modals**, highest count first: stock-media, template-videos, add-to-timeline, mg-templates, hyperframes,
   sound-library. Then the panels: overlay-settings, personalized-layouts, contact-check, my-presets, landing-pages.
4. **Catalog modals.** Move Recipes, Prompt Gallery and Monetization Hub to the master/detail variant, and add the three missing
   items to Cinema Studio's "More tools" menu.
5. **Guardrails.** An ESLint/grep check that flags hard-coded hex and `style={{` growth in `components/edit/`; Playwright
   visual snapshots per modal (repo already has `playwright.config.visual.ts`).

## Risks and checks
- Behaviour must not change: run existing tests (`src/cinegen/__tests__`, `src/test/catalog-modals.test.js`) and keep the
  `data-testid`s (`library-card-*`, `extensions-panel`, `extension-*`).
- Thumbnail components (`FxThumb`, `TransitionThumb`) draw with their own canvas sizes; confirm they scale into the new card
  size (mockups use gradients as stand-ins).
- Keyboard and a11y: focus trap, `role="dialog"`, Esc, visible focus ring.
- Mockups are static HTML, not the real components; final spacing may shift slightly.
