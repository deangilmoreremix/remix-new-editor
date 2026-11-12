# Template Generator — 2026 redesign plan

Goal: give the 4-step wizard (Video → Script → Overlay → Preview) the same look as the timeline
editor and its modals (Personalize, Lead Generator …) without touching behaviour.

## Design language (taken from `styles/timeline-tokens.css`)
- Surfaces: near-black glass (`--bg`, `--surface-1..3`), hairline borders, 22px shell radius, soft cyan ambient glow.
- Accent: cyan → emerald gradient for the single primary action; cyan for selection / focus.
- Type: tiny uppercase tracked labels for meta (steps, pills, field labels); bold sentence-case titles.
- Track colours reused from the editor: video `--type-video`, text `--type-text`, fx `--type-fx`, audio `--type-audio`.

## What changed
1. **Header** — cyan icon badge, title + one-line description, close button (replaces the generic modal title bar).
2. **Step rail** — numbered nodes joined by a line that fills cyan→emerald as steps complete (replaces flat tabs). Steps stay clickable and keep the same guards.
3. **Footer action bar** — Back, live summary pills (Clips n/5 · Length · Transition · Script), step counter, one primary button (Next → / Add to Timeline). Replaces the floating Next button.
4. **Video** — provider rail as a glass panel with an accent bar on the active source; rounded media tiles that lift on hover; selected clips get a cyan ring + glow and a **numbered badge showing clip order**; the tray below doubles as the storyboard.
5. **Script** — script editor panel with uppercase field labels; AI actions styled as accent chips; template cards with glow on selection.
6. **Overlay** — transition cards with a violet (fx) hover state and a small icon animation.
7. **Preview** — cinematic player with gradient scrubber, plus **read-only track lanes** (Video / Text / FX) in the editor's colours so the result looks like what lands on the timeline.
8. **Motion** — 280 ms step-in, tile lift, shimmer while loading; all disabled under `prefers-reduced-motion`.

## Not changed
Wizard rules (5 clips max, Overlay needs 2+, guards), Pexels / Pixabay / Upload / Remote / AI sources,
builder output and `onConfirm` payload, class names and `data-act` hooks.

## Ideas for a later pass
- Drag-to-reorder clips in the tray and lanes; trim handles per clip.
- Animated transition thumbnails (real mini previews) instead of emoji.
- ⌘K command bar for sources / search; AI "suggest footage for this script".
- Per-scene media slots driven by the script's scenes (storyboard mode).

## Reusable templates (added)
The generator's purpose is to *make templates that are saved and reused*, so it is named **Template Generator** everywhere
(the old "Video Automation Creator" wording is gone from the modal and the toolbar).
- **Start screen**: Create a template · My templates (count) · Close.
- **Save as template** (Preview step): name + description; when a saved template was opened, choose *Update* or *Save as new*; or *Save & add to timeline*.
- **My templates**: searchable grid with thumbnail, niche, clips · length, transition, uses and date; Use template · Duplicate · Delete (two-step).
- **Use template** reopens the wizard on the Video step with its footage, script, transition and text so footage can be swapped.
- Storage: `localStorage` (`remix.templateGenerator.templates.v1`) behind `createTemplateStore()`; the record is plain JSON
  (`template-generator/templates.js`) so it can move to Supabase for cross-device sync without changing shape.
- Local files / unfinished uploads (`blob:` links) can't survive a reload and are left out, with a warning.
