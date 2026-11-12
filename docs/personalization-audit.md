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
