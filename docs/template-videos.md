# Template videos (demo templates) library

The timeline editor's **Template videos** modal (CineGen editor → EDIT → *Add overlay* → *Template videos…*) browses a curated
library of ready-made AI video clips and adds the chosen one to the timeline as a normal video clip.

## Where the data lives
- `src/data/templateVideoLibrary.js` — **generated**, do not edit. Regenerate with `node scripts/generate-template-video-library.mjs`.
- Inputs (all in `scripts/`): `template-video-allowlist.json` (which clips; every one was reviewed for logos/watermarks/captions),
  `template-video-labels.json` (commercial names, category, subcategory), `template-video-measured-durations.json`
  (real durations measured in a browser), `template-video-sources.json` (generated: original locations, used by the uploader).
- UI: `src/cinegen/components/edit/template-videos-modal.tsx`; placement on the timeline: `template-video-placement.ts`.

## Hosting — Supabase Storage bucket `demo-template-videos`
The Supabase project is **shared by many apps**. The bucket `demo-template-videos` is dedicated to this library and nothing else may
be stored in it. It is public (clips load directly in the browser and the export runner), has a 50 MB per-object limit, and is limited
to video/webm, video/mp4, image/webp, image/jpeg and text/plain. Objects: `clips/<set>/<slug>.<ext>`, `posters/<set>/<slug>.<ext>`,
`README.txt`. Public URLs send `Access-Control-Allow-Origin: *` and support range requests, which the editor's export needs.

To re-upload after changing the allowlist: `SUPABASE_SERVICE_ROLE_KEY=… node scripts/upload-template-videos.mjs` (re-runnable;
`--dry-run` lists what it would do; it only writes to `demo-template-videos`). The bucket was originally filled through a temporary,
secret-free edge function `demo-templates-import`, which is now a disabled stub and can be deleted in the Supabase dashboard.

## Rights
The clips are third-party media (originally posted on X, sourced from public prompt galleries). Commercial-use / redistribution
permission must be confirmed before production use; `sourceAuthor` / `sourceUrl` in the upstream data files hold the attribution.
