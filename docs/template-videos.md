# Template videos (demo templates) library

The timeline editor's **Template videos** modal (CineGen editor → EDIT → *Add overlay* → *Template videos…*) browses a curated
library of ready-made AI video clips and adds the chosen one to the timeline as a normal video clip.

## Where the data lives
- `src/data/templateVideoLibrary.js` — **generated**, do not edit. Regenerate with `node scripts/generate-template-video-library.mjs`.
- Inputs (all in `scripts/`): `template-video-allowlist.json` (which clips; every one was reviewed for logos/watermarks/captions),
  `template-video-labels.json` (commercial names, category, subcategory), `template-video-measured-durations.json`
  (real durations measured in a browser), `template-video-sources.json` (generated: original locations, used by the uploader).
- UI: `src/cinegen/components/edit/template-videos-modal.tsx` exports `TemplateVideosPanel` (the browsing content: category + subcategory
  chips, filters, grid) and `TemplateVideosModal` (the window around it, opened from *Add overlay → Template videos…*). The panel follows the same
  Panel/Modal split as `HyperframesPanel` / `MgTemplatesPanel`, so it can also become a **Template videos tab** in the unified *Add to timeline* window
  (`add-to-timeline-modal.tsx`, currently on branch `claude/elegant-wright-6s6w2l`): add a tab entry and render
  `<TemplateVideosPanel onPick={...} />` for it. Placement on the timeline: `template-video-placement.ts`.

## Hosting — Supabase Storage bucket `demo-template-videos`
The Supabase project is **shared by many apps**. The bucket `demo-template-videos` is dedicated to this library and nothing else may
be stored in it. It is public (clips load directly in the browser and the export runner), has a 50 MB per-object limit, and is limited
to video/webm, video/mp4, image/webp, image/jpeg and text/plain. Objects: `clips/<set>/<slug>.<ext>`, `posters/<set>/<slug>.<ext>`,
`README.txt`. Public URLs send `Access-Control-Allow-Origin: *` and support range requests, which the editor's export needs.

To re-upload after changing the allowlist: `SUPABASE_SERVICE_ROLE_KEY=… node scripts/upload-template-videos.mjs` (re-runnable;
`--dry-run` lists what it would do; it only writes to `demo-template-videos`). The bucket was originally filled through a temporary,
secret-free edge function `demo-templates-import`, which is now a disabled stub and can be deleted in the Supabase dashboard.

## Rights
The clips are third-party media (originally posted on X, sourced from public prompt galleries). The owner has confirmed they hold
commercial-use permission for the clips; `sourceAuthor` / `sourceUrl` in the upstream data files hold the attribution.

## Where it appears in the app
Timeline editor (CineGen) -> EDIT -> "Add to timeline" -> **Template videos** tab. Picking a card adds the clip to a video track at the playhead.

## Using these templates from another app (or another Claude)
Everything needed is public. Start from the catalog:

    https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos/catalog.json

`catalog.json` (generated from this repo, also kept as `scripts/template-video-catalog.json`) lists every clip with a commercial-style name
(`title`), `category`, `subcategory`, `duration`, `aspectRatio`, public `videoUrl` and `posterUrl`, the upstream `originalTitle` and `credit`
(author + post URL), plus a `categories` map (category -> subcategories) and a `rights` note. It is served with `application/json`,
`Access-Control-Allow-Origin: *` and a 5-minute cache. The bucket's `README.txt` points at it, so a Claude that lists the Supabase buckets
finds `demo-template-videos`, reads the README, and gets to the catalog.

Paste this into the other app's `CLAUDE.md` / docs so it knows where to look:

    ## Demo template videos
    Ready-made AI video templates (cinematic, commercial, social, action, animation, fashion, VFX) live in the public Supabase Storage bucket
    `demo-template-videos` (project ref bzxohkrxcwodllketcpz; the project is shared by many apps, do not write to this bucket).
    Catalog (names, categories, URLs, credit): https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos/catalog.json
    Pick clips by category/subcategory from `clips[]` and use `videoUrl` / `posterUrl` directly (public, CORS *, range requests).
    The media is third-party: confirm commercial-use permission before production use. Source repo: remix-new-editor (docs/template-videos.md).

To refresh the catalog after changing the library: `node scripts/generate-template-video-library.mjs`, then re-upload `catalog.json` and
`README.txt` with `node scripts/upload-template-videos.mjs` (needs `SUPABASE_SERVICE_ROLE_KEY`; it only writes to `demo-template-videos`).

## Retired objects (still in the bucket, no longer in the library; safe to delete in the Supabase dashboard)
Removed from the allowlist after the audits (small "AI" corner badge, end-card/subtitle/logo marks, or on-screen brand text). The
Supabase connector used here cannot delete storage objects, so the files were left in place.
- `clips/sd25/5-minutes-a-day-just-for-you-019376.*` and `posters/sd25/5-minutes-a-day-just-for-you-019376.*`
- `clips/sd25/action-film-study-229811.*` and `posters/sd25/action-film-study-229811.*`
- `clips/sd25/cinematic-story-study-143211.*` and `posters/sd25/cinematic-story-study-143211.*`
- `clips/sd25/morning-coffee-mini-dv-vlog.*` and `posters/sd25/morning-coffee-mini-dv-vlog.*`
- `clips/sd25/photorealistic-cinematic-modern-american-airport-643718.*` and `posters/sd25/photorealistic-cinematic-modern-american-airport-643718.*`
- `clips/sd25/super-casual-real-smartphone-home-video-footage-896933.*` and `posters/sd25/super-casual-real-smartphone-home-video-footage-896933.*`
- `clips/sd25/ten-member-idol-concert.*` and `posters/sd25/ten-member-idol-concert.*`
- `clips/sd25/victorian-greenhouse-mechanical-hummingbird.*` and `posters/sd25/victorian-greenhouse-mechanical-hummingbird.*`
- `clips/mmx25/hip-hop-music-video-make-the-character-from-video1-107776.*` and `posters/mmx25/hip-hop-music-video-make-the-character-from-video1-107776.*`
- `clips/sd25/created-with-seedance-2-5-141060.*` and `posters/sd25/created-with-seedance-2-5-141060.*`
- `clips/sd25/i-made-this-full-video-in-5-minutes-100-automated-857085.*` and `posters/sd25/i-made-this-full-video-in-5-minutes-100-automated-857085.*`
- `clips/sd25/made-with-seedance-2-5-on-352388.*` and `posters/sd25/made-with-seedance-2-5-on-352388.*`
- `clips/sd25/wow-the-metamorphosis-in-is-totally-cinematic-to-155054.*` and `posters/sd25/wow-the-metamorphosis-in-is-totally-cinematic-to-155054.*`
- `clips/sd25/listen-up-228251.*` and `posters/sd25/listen-up-228251.*`
- `clips/sd25/my-first-test-of-526392.*` and `posters/sd25/my-first-test-of-526392.*`
- `clips/zerolu/john4.*` and `posters/zerolu/john4.*`
- `clips/zerolu/vicky.*` and `posters/zerolu/vicky.*`
