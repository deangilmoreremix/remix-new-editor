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

## Cross-device sync (added)
- **Table** `public.template_generator_templates` (`supabase/migrations/20261112120000_…`): PK `(clerk_user_id, id)`, `record jsonb`,
  `deleted_at` tombstone, `updated_at`. RLS: signed-in owners only (verified Clerk `sub`); `anon` has no access; no TRUNCATE.
  **Applied** to the `VideoRemix Product` project on 2026-11-12 (recorded as version `20261112212041`; the repo file carries the same version). Verified: RLS on, four owner-only policies for `authenticated`, no `anon` grants, guard trigger present, no rows yet.
- **Client** `template-generator/sync.js`: `planSync()` merges local + remote (newest edit wins, a delete wins an exact tie, tombstones stop
  deleted templates coming back); `createSyncedTemplateStore()` keeps the same API as the local store and reconciles in the background
  (on open, and ~1 s after any save/duplicate/delete).
- **Local-first**: everything works offline and signed out. Local copies are kept per signed-in user, so two accounts on one browser never
  mix; templates made while signed out are adopted into the account on its first sync.
- **Status badge**: This device only · Syncing… · Synced across your devices · Sync paused (saved on this device). A missing table or an
  expired session shows a plain-language reason on hover; nothing is ever lost locally.

## Media sources (added)
The Video step now offers every library the editor has, in one place:
- **Stock**: Pixabay and Pexels, each with videos *and* photos (Pixabay also illustrations and vectors; Pexels also collections).
- **My media**: the project's own videos and images (`projectMedia` option), plus Upload, Remote URL and AI Generate.
- **Motion & templates** (when opened inside the Timeline Studio Editor, via the `extraSources` option built by
  `src/cinegen/lib/occ/template-generator-sources.ts`): **Animations** (HyperFrames + RemotionUI catalog, grouped like the Animations
  modal, honouring its on/off switch), **Motion graphics** templates (code-gated like the Motion graphics modal) and **End screens & forms**
  (Connect forms are left to the timeline's own menu because they need a phone number).
- These are *overlays*: they have their own tray and limit (6), don't use the 5 clip slots, show live previews in a popup (the editor's
  sandboxed renderer), appear on a **Motion** lane in Preview, and are added to the overlay lane when the cut is added.
  End screens land at the end; the rest are spread along the cut.
- Saved templates keep only a small reference (`animations[]`); the real overlay is resolved when added. An editor without that library
  sets them aside with a notice.

## Shared database: labelling convention
The Supabase project ("VideoRemix Product") is shared by several apps, so everything this feature adds is labelled as its own:
- every object name starts with `template_generator_` (table, index, function, trigger, and the four RLS policies
  `template_generator_owners_{read,insert,update,delete}_own`);
- every object has a database `COMMENT` starting `[app: template-generator]` (table, all 8 columns, index, function, trigger, policies) —
  applied by `20261113040821_template_generator_templates_labels.sql` (label-only; no data, grants or rules changed).
- Find everything the app owns: `select c.relname, obj_description(c.oid) from pg_class c where obj_description(c.oid) like '[app: template-generator]%';`
- New objects for this feature must follow the same two rules; `src/test/template-generator-sync.test.js` checks the migrations.

## Pending
- `20261113041000_template_generator_templates_ignore_stale_writes.sql` — makes the database drop a late-arriving *older* write so a
  slow device can't overwrite a newer edit or a delete (review finding on the sync race). SQL verified on the live database in a rolled-back
  transaction; **not applied yet** (awaiting approval).
