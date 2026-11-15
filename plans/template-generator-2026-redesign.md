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

## Written niche scripts and AI writing (added)
- **120 written scripts** (`src/lib/nicheScripts/`, one file per industry, merged in `index.js`): one per niche template, **exactly one line per
  scene** in the template's own order, plus a call to action. Written to the video length (about 1–2.9 spoken words per second), with no
  guarantees, cure or outcome claims (legal / dental / med-spa / wellness lines carry disclaimers where needed). Fill-ins: `{business_name}`,
  `{city}`, `{offer}`; anything left empty shows as `[Your business]` / `[Your city]` / `[Your offer]` so it can't be missed.
- **Script step**: picking a template puts its script in the editor; **Your details** (business, city, offer, about) fill it in live; anything the
  user edits is never overwritten (a button brings the written script back); the Preview popup shows each scene with its line. Captions follow the
  script's own lines (5 clips ↔ 5 scenes, fewer clips share the lines).
- **AI writing is scene-aware** and runs on the **customer's own OpenAI key** (no platform fallback; `X-OpenAI-Key`): "Write with AI / Rewrite /
  Shorten / Expand" send the template's scenes (or one per picked clip), the user's details, tone and a word budget; the answer is cleaned to exactly
  one line per scene. The call to action is kept separate and the model is told not to invent facts.
- Saved templates keep the user's details. Tests: `src/test/niche-scripts.test.js`, `netlify/functions/__tests__/timeline-script.test.js`, plus
  wizard tests in `template-generator-modal-smoke.test.js`.

## Video templates as a footage source (added)
Step 1 now starts on **Video templates**: the public 184-clip library kept in the `demo-template-videos` Supabase Storage bucket
(see `docs/template-videos.md`). Source module: `template-generator/videoTemplates.js`.
- Reads `catalog.json` once (public, CORS `*`, no key, GET only). **Read-only:** this app never writes to, renames or deletes that bucket; it sits in the shared project.
- Filters: category, subcategory, shape (landscape / portrait) and search. Tiles show the catalog's real poster and play the real clip on hover.
- Credit (author + original post link) travels with each clip into the preview popup, the selection and saved templates (`source: 'template-video'`).
- Failure to load shows a plain error with a retry on the next search; nothing is cached on failure.
- Tests: `src/test/template-generator-video-templates.test.js` (fixture = real catalog entries, no live network).
- Rights: the owner confirmed commercial-use permission; the published catalog's `rights` note still says to confirm (republishing it is the library owner's call).

## Real transitions and lower-third styles in the Overlay step (added)
- **Transitions:** in the CineGen editor the Overlay step lists the editor's own 16 GL transitions in categories (Fade, Wipe, Motion) with a real A/B still and a live loop on hover
  (`generatorTransitions()` in `cinegen/lib/occ/template-generator-sources.ts`, drawn by `openchatcut/gl/transitionThumb.ts`). The picked id is kept on the timeline as `glType`
  (`template-composition.ts`); before, every choice became a plain dissolve. The classic editor passes none and keeps the legacy list.
- **Lower thirds:** a style picker (8 Lottie styles, in Bars / Minimal) with the user's own text previewed; the chosen style is placed as a real `overlay-lower-third`
  (name | title). Saved in `elements.lowerThirdStyle`, so it travels with saved and synced templates (no DB change).
- The two transition sample photos the renderer needs are in `public/library-previews/` (they were only under `apps/video-agent-studio`, so the existing Transitions window had blank thumbnails too).
- Not added: the Motion Studio clips from the Personalization wizard (finished MP4s, not overlays).

## Real media instead of text (added)
- Selected clips/animations show their real poster or still; the script preview shows the user's own picked clips in order; the start screen is a collage of real catalog posters; the Preview step shows the chosen transition's real still.
- Script cards show a real footage still only for niches the 184-clip library genuinely fits (restaurant, gym, auto, fashion, luxury, events, beauty/salon); real estate, dental, chiropractic and legal get none rather than a misleading one (they need Pexels/Pixabay footage).
- Known gaps: about a third of the Animations stills and many motion-graphic stills are mostly-empty dark frames (small element on a dark background); Pexels/Pixabay need `PEXELS_API_KEY` / `PIXABAY_API_KEY` to show real results.

## Editable text on the video (added)
- Every text (captions, title, lower third, CTA) has a look in the editor's Smart Text vocabulary (`template-generator/textStyles.js`: 6 presets Clean/Bold/Pop/Box/Minimal/Neon, role defaults for box + entrance). Only the user's changes are saved (`elements.styles[role]`), so saved/synced templates keep them and old ones get the defaults.
- The look reaches the timeline: `toBuilderState` puts `textStyle` + `role` on each clip, `applyComposition` merges it into the Smart Text overlay (font, colour, outline, box, entrance). Classic editor (`applyCompositionToTimeline`) is not wired yet.
- The Preview step draws the text with the editor's own overlay renderer (`buildOverlayElement`) at the playhead, so it is WYSIWYG; click a text (or its chip) to select it, drag/resize it with the editor's handles (`attachDragResize`), and use the inspector (look, words, font, colour, entrance, bold/outline/shadow/box, reset).
- Long script lines are split into short timed captions (`splitCaption`) so they stay readable.
- No Konva: the editor's DOM renderer + Pointer Events drag handles do the same job without a new dependency.

## Voiceover, music and mix (added)
- **Voiceover** (`template-generator/voiceover.js`): "My OpenAI key" (the customer's own key, copied into their storage, never a `data:` URL) or "Free, on this device" (Kokoro, ~90 MB first-time model). Shown in the Preview step's Voice panel with progress/cancel and clear errors; saved with the template when stored for good.
- **Music** (`music.js`): the three bundled tracks the app licenses, trimmed to the cut with a fade; optional ducking under the voice. **Mix** panel: footage / voiceover / music volumes. One `audioPlan` feeds the live preview, the composition and the saved template.
- The preview now plays the audio in sync with the video (`preview.js`). `applyComposition` honours audio duration, volume and volume keyframes. `netlify.toml` serves `/motion-studio/bgmlib/*` with CORS so the export runner can read the music.
- CineGen editor only: the classic editor's add-to-timeline drops audio.

## Cut out a presenter (background removal) (added)
- "✂ Cut out" on each clip in the Preview step (`template-generator/cutout.js`): the editor's on-device MODNet model (no key, no upload for processing, ~25 MB first-time download). The result is stored in the customer's storage; the original link is kept so "↺ Original" restores it; saved templates keep both.
- Safety: a result that keeps under 6% of the picture is rejected and the clip is left as it is.
- Honest limits (tested with the real model in headless Chrome on CPU/WASM): a 1 s clip takes about 30-40 s including the model download, an 8 s clip is estimated at several minutes without WebGPU; on AI-generated full-body, dark or stylised clips the model keeps only fragments (works best on a person close to the camera in good light). Not tested on WebGPU.

## Export video from the Preview step (added)
- "⬇ Export video" (CineGen editor): the template is built on its own empty timeline (never the user's project) and rendered in the browser with the editor's export (WebCodecs + Remotion web renderer); progress is shown and the MP4 downloads. Shared mapper `cinegen/lib/occ/export-args.ts` (also used by the Export tab). Blocked with a clear message while the script still says `[Your business]`, and disabled where the browser cannot encode video.
- Verified for real in headless Chrome: a 16 s 720p H.264 + AAC MP4 with the styled title/captions burned in and the music audible. Not done: classic editor export (it drops audio), WebGPU path, long/4K renders.

## Animation and motion-graphic stills, fixed (added)
- The stills were rendered over a dark frame, so dark artwork vanished and small elements (lower thirds, name bars) sat in a corner. The generator now shoots each render over a transparent page at 3x and composes the tile (`scripts/template-thumbs/compose.mjs`): the element is cropped and enlarged, dark artwork gets a light backdrop, full frames and sparse full-frame overlays keep their whole frame.
- Re-rendered the 211 stills that looked empty. Near-empty stills went from 81 to 48 (Animations) and 13 to 5 (Motion graphics); the rest are ambient backgrounds, gradients, starfields and dark code windows, sparse by nature. One previously blocklisted motion graphic (it was dark-on-dark) is offered again (blocklist 23 → 22).
- `src/test/template-stills-quality.test.js` guards against empty tiles coming back.
