# Template videos (demo templates) library

The library holds **539 ready-made AI video clips**. Every clip carries a **branding label**: **No logo** (298 clips: reviewed, no visible logo,
watermark or credit) or **Has logo** (241 clips: a platform watermark, badge, caption credit or in-scene brand text is visible). It is browsed in
two places, both reading the same generated data:

- **Timeline editor** (CineGen, EDIT → *Add to timeline* → **Template videos** tab): category and subcategory chips, search, length / **Logo** / aspect
  filters; picking a card adds the clip to the timeline as a normal video clip. Each card shows a No logo / Has logo badge.
- **Personalization modal, step 2** (*Your video* → **AI Demos**): the same 539 clips (the original catalog demos reuse the hosted media), with the
  step's own business categories, plus a **Logo** filter and the same badge. Catalog demos whose video files were never shipped
  (29 PromptFeed, 14 Seedance 1, 1 MiniMax) are hidden until their files exist; see `EXCLUDED_DEMO_COLLECTIONS` in `demoLibraryRegistry.ts`.

## Where the data lives
- `src/data/templateVideoLibrary.js` — **generated**, do not edit. Regenerate with `node scripts/generate-template-video-library.mjs`.
- Inputs (all in `scripts/`): `template-video-branding.json` (per-clip No logo / Has logo verdicts for every landing-page clip; `exclude` = not usable
  footage), `template-video-allowlist.json` (the first 184 clips, hand-reviewed), `template-video-labels.json` (curated names, category, subcategory;
  clips without an entry get an automatic title and are flagged `autoLabeled`), `template-video-measured-durations.json` (real durations),
  `template-video-sources.json` (generated: original locations, used by the uploader).
- Per clip: `title`, `category` (Action, Animation, Cinema, Commercial, Fashion, Social, VFX), `subcategory`, `topics` (descriptive keywords),
  `orientation`, `duration`, `aspectRatio`, `branding`, `marks` (what the visible mark is, for Has logo), `source`, `posterSrc`, `videoSrc`.
- Timeline UI: `src/cinegen/components/edit/template-videos-modal.tsx` (`TemplateVideosPanel`, used as a tab in `add-to-timeline-modal.tsx`; placement
  in `template-video-placement.ts`). Step 2: `src/features/personalization/data/demoLibraryRegistry.ts` (merges this library into the demo registry) and
  `guided/StepChooseVideo.tsx` (Logo filter + badge); `sourceProfile.ts` treats hosted library clips as owner-verified.

## Hosting — Supabase Storage bucket `demo-template-videos`
464 of the 539 clips are hosted in the bucket (about 850 MB with posters); the other 75 are repo files under `public/media/**` (served with CORS by
`netlify.toml`).
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

## Using these templates from another app (or another Claude)
Everything needed is public. Start from the catalog:

    https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos/catalog.json

`catalog.json` (generated from this repo, also kept as `scripts/template-video-catalog.json`) lists every clip with a commercial-style name
(`title`), `category`, `subcategory`, `branding` (`none` = no visible logo), `topics`, `orientation`, `duration`, `aspectRatio`, public `videoUrl` and `posterUrl`, the upstream `originalTitle` and `credit`
(author + post URL), plus a `categories` map (category -> subcategories) and a `rights` note. It is served with `application/json`,
`Access-Control-Allow-Origin: *` and a 5-minute cache. The bucket's `README.txt` points at it, so a Claude that lists the Supabase buckets
finds `demo-template-videos`, reads the README, and gets to the catalog.

Paste this into the other app's `CLAUDE.md` / docs so it knows where to look:

    ## Demo template videos
    Ready-made AI video templates (cinematic, commercial, social, action, animation, fashion, VFX) live in the public Supabase Storage bucket
    `demo-template-videos` (project ref bzxohkrxcwodllketcpz; the project is shared by many apps, do not write to this bucket).
    Catalog (names, categories, URLs, credit): https://bzxohkrxcwodllketcpz.supabase.co/storage/v1/object/public/demo-template-videos/catalog.json
    Pick clips by category/subcategory (use `branding: "none"` for clean footage) from `clips[]` and use `videoUrl` / `posterUrl` directly (public, CORS *, range requests).
    The media is third-party; the owner confirmed commercial-use permission. Source repo: remix-new-editor (docs/template-videos.md).

To refresh the catalog after changing the library: `node scripts/generate-template-video-library.mjs`, then re-upload `catalog.json` and
`README.txt` with `node scripts/upload-template-videos.mjs` (needs `SUPABASE_SERVICE_ROLE_KEY`; it only writes to `demo-template-videos`).
