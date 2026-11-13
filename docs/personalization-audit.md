# Personalization / Asset / Publishing audit

Status legend: Complete / Partial / Missing / Disconnected. "Evidence" is code-read only unless noted;
no feature here was verified against live services.

| Feature | Current implementation | Status | Classic | Timeline Studio | Published player | Action |
|---|---|---|---|---|---|---|
| Token engine (`{{X}}`, `{{up X}}`, `{{d X "fb"}}`) | `src/components/personalize/tokenSchema.js`, `src/lib/editor/addons/overlayRender.js` (`resolveOverlayText`); original syntax in `lib/constants/tokens.js` | Complete (overlay text only) | yes | yes (overlays) | yes (profile from query) | Reuse; share with prompt path |
| Prompt token replace | `personalizePopover.replaceTokensInPrompt` | Partial (no `up`/`d`) | n/a | n/a | n/a | Repair |
| Contact store / per-contact engine | `src/lib/contactStore.js`, `src/lib/editor/personalize/perContact.js`, `clientSync.js` | Complete (browser-local) | yes | partial | partial | Reuse |
| PersonalizationModal (Find business, assets) | `src/features/personalization/mount.jsx` `openPersonalization` | Complete | yes | **Disconnected** (opened old Hub) | n/a | Integrate (done in Stage 1) |
| Business Finder | `src/lib/personalization/businessDiscoveryService.js`, `netlify/functions/personalizer-api.js` | Complete | yes | via modal | n/a | Reuse |
| Asset Finder | `src/lib/personalization/assetDiscoveryService.js`, `src/components/personalize/discovery/*` | Complete | yes | via modal | n/a | Reuse |
| Persistent per-business asset library | localStorage `assetLibraryStore` only | Missing (server) | local | local | no | Add (Stage 2) |
| Background removal | `src/lib/editor/remotion/bgRemoval.js` | Complete classic | yes | absent | n/a | Out of scope for now |
| Publish (upsert, blob upload) | `src/lib/editor/publish/publishClient.js`, `published_videos` | Complete | yes | via `leads/use-publish.ts` | yes | Reuse |
| Hosted player + overlays + CTA + lead form | `interactivePlayer.js`, `viewerOverlays.js`, `WatchPage.jsx`, `lead-capture` | Complete | n/a | n/a | yes | Reuse |
| Custom slug `/v/:slug`, aliases | none (`id` is slug) | Missing | | | | Add (Stage 4) |
| Draft/live revisions | none (destructive upsert) | Missing | | | | Add (Stage 4) |
| Opaque recipient tokens, revocation | none (`?c=` + PII in query) | Missing | | | | Add (Stage 4) |
| Bulk link manager | classic Share panel lists 100 links + CSV, browser-only | Partial | partial | missing | n/a | Add (Stage 5) |
| MP4 export per contact | `timelineToComposition` + `exportModel` | Complete classic; Studio passes no profile | yes | **tokens stripped** | n/a | Repair (Stage 3/6) |

## Security findings (published_videos)
- Snapshot is publicly listable via REST with the anon key; slug is not a secret.
- Webhook URLs / notify emails live in the public `project` jsonb.
- Slugs are client-generated (~57 bits); `contact_id` in events is client-asserted.
- Uploaded media sits in a public bucket; no asset-level revocation.

## Naming notes
`PersonalizeModal`, `PersonalizationEditor`, `Personalization.jsx` do not exist as files; the modal is
`PersonalizationModal.tsx`. Root `components/TokenEditor.jsx` and `src/components/TokenEditor.jsx` are not the
personalization token editor (the latter is a design-token stub). No file is named BusinessFinder/AssetFinder;
the features are "Find a Business" and asset discovery.


## Update: live Supabase schema (project bzxohkrxcwodllketcpz, inspected read-only)

The live project already runs a different publishing model than the repo's migrations describe (applied on
2026-11-12 from code that is not in `develop` or this branch):

| Concern | Live implementation | Used by this work |
|---|---|---|
| Readable links | `video_owner_profiles` (business slug) + `published_videos.slug`; `/v/<business>/<slug>`; RPCs `claim_business_slug`, `set_video_slug`, `get_published_video(p_id,p_business,p_slug)`; old slugs redirect via `video_slug_redirects` | Yes (client aligned) |
| Revisions | `published_video_revisions`, written by a trigger on every project change (newest 20 kept) | Yes (history; draft promote relies on it) |
| Public read | `get_published_video` strips webhook / notify-email keys with `strip_private_keys` | Yes (viewer now reads through it) |
| Analytics | `video_events`, `video_view_sessions`, `ingest_video_events` | Not changed |

Added on top (applied 2026-11-12): `business_profiles`, `business_assets`, `asset_assignments`, `video_recipients`,
`published_video_drafts`, `resolve_recipient()`, `promote_video_draft()`. Not changed: any existing table, policy or function.

Still open: `published_videos` keeps its public `SELECT ... where published = true` policy (the raw row, including webhook
URLs, is readable by table query); `record_video_event` does not validate recipient tokens; no rate limit on
`resolve_recipient`; 117 pre-existing tables in the project have RLS disabled (reported by the Supabase advisor, untouched).


## Browser test results (real Chromium, real app; sign-in and Supabase are fixtures)

`npx playwright test -c playwright.links.config.ts` (needs a dev server with dummy Supabase env; see the config header).
Backend is `tests/e2e/fixtures/fakeSupabase.js`, which models the live project's behavior. The live database and
every other external service were never contacted (any outgoing request is aborted and the last test fails if one occurred).

26 passed, 0 skipped. Covered: assets (upload, assign, states, persistence across reload, isolation between businesses),
assets found inside the real Personalization Modal reaching the business library (discovery endpoint is a fixture),
publish + business/video link names, 22 personalized links from one video with no new media, anonymous visitors in separate
browsers seeing only their own text, images, call number and website, lead form timing/pause/resume, refresh-images,
draft save/preview/publish on the same URLs, 20-contact CSV import, export, revoke, visitor-side security checks
(invented/edited/expired/revoked tokens, hostile text, unpublished video, renamed link redirect), and per-recipient MP4
export (G): each business's MP4 is rendered in the browser, probed with ffprobe (h264, duration) and frame crops sampled with
ffmpeg show only that business's logo/photo colours, greeting and call button.

Production build: `playwright.links.prod.config.ts` + `personalization-links.prod.spec.js` run the hosted viewer from a
`vite build`, served by `vite preview`, with the browser's content-security rules enforced (no bypass): two visitors each see
their own greeting, images and call link, playback is proven by the lead form appearing at 1.5 s, no CSP violations.
(The data comes from `fixtures/published-fixture.json`, captured through the real publish path with `E2E_DUMP_FIXTURE=1`.)

Bugs found by the browser tests and fixed (separate commits): REST requests went out as anonymous (supabase-js Headers
object); call/website destinations were not personalized; action notices vanished; early play taps were lost (two races);
replaced images were pinned by a stale contact variable; CSV import added every contact twice; assets imported in the
Personalization Modal never reached the business library (the modal now emits `remix:personalization-assets-imported`, the
library hook saves them); recipient links copied every contact variable (they now carry only what the video reads).

Findings that remain (not fixed):
- The remix-side Asset Finder client (`assetDiscoveryService.js`) and `personalizer-api.js` authenticate with a Supabase
  Auth session, which does not exist under Clerk sign-in ("Sign in to use business asset discovery.").
- By design of the token engine, `businessPhone` falls back to the contact's email when there is no phone, so a link for such
  a contact carries that email under `businessPhone` (the call button reads that token).
- The Remotion web renderer calls `www.remotion.pro/api/track/register-usage-point` on every render (library usage tracking).
  The test aborts it and asserts the body carries no customer data; production would send it.
- Not tested: real Business Finder / Asset Finder on real websites, the real database through the browser (needs a real
  Clerk login), a Netlify deploy preview (response headers come from netlify.toml and edge functions, not `vite preview`).
- Four unit tests fail identically on the base commit and on this branch (remotionui ledger, motion-director legacyCards,
  two businessDiscovery research-provider tests); this branch changes nothing under their paths.
