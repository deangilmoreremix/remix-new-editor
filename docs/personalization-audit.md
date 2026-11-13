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

24 passed, 1 `fixme`. Covered: assets (upload, assign, states, persistence across reload, isolation between businesses),
publish + business/video link names, 22 personalized links from one video with no new media, anonymous visitors in separate
browsers seeing only their own text, images, call number and website, lead form timing/pause/resume, refresh-images,
draft save/preview/publish on the same URLs, 20-contact CSV import, export, revoke, and visitor-side security checks
(invented/edited/expired/revoked tokens, hostile text, unpublished video, renamed link redirect).

Bugs found by the browser test and fixed (separate commits): REST requests went out as anonymous (supabase-js Headers
object); call/website destinations were not personalized; action notices vanished; early play taps were lost (two races);
replaced images were pinned by a stale contact variable; CSV import added every contact twice.

Open (not fixed, found by the browser test):
- The Personalization Modal's `onComplete` fires only when a personalization run finishes and carries generated outputs;
  assets found or assigned inside the modal stay in the modal's own saved project and are never written to the business
  library (`test.fixme`). Decision needed on how to bridge them.
- The remix-side Asset Finder client (`assetDiscoveryService.js`) and `personalizer-api.js` authenticate with a Supabase
  Auth session, which does not exist under Clerk sign-in ("Sign in to use business asset discovery.").
- Recipient links copy every contact variable (including email) into the recipient's own token payload.
- Not browser-tested: MP4 export per recipient, real Business Finder / Asset Finder on real websites, the real database.
