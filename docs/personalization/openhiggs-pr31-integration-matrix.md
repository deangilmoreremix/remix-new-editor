# Phase 1 — OpenHiggsBolt PR #31 → SmartVideo AI Implementation Matrix

## Baselines

- Target repository: `deangilmoreremix/remix-new-editor`
- Target branch: `feature/unified-personalization-image-editor`
- Target starting SHA: `e2bd509de61c38fd23a95ba25b29ebb5ff686d7a`
- Canonical OpenHiggs source: `main` merge commit `f2ed2a1d462e248fdbb36ef85a8c59a36b5db940`
- PR #31 final feature head: `f09ab873049e207d1084f348bb914cd08951e000`
- Earlier investigation snapshot: `8dd77f241e0905216736b3ac647a5316713c47a5` (reference only; no longer authoritative)
- Product branding in this port: **SmartVideo AI**

## Architecture decisions

1. Keep `src/components/modals/PersonalizeModal.jsx` as the single modal entry point.
2. Keep existing contact discovery, token resolution, selected-contact state, history, and Personalizer handoff behavior.
3. Extend existing `contact_profiles` / `contact_assets` storage instead of creating a parallel client database.
4. Reuse `src/lib/thumbnailService.js` + `supabase/functions/ai-thumbnail-generator/index.ts` for generation, Responses refinement, masks/inpainting, streaming previews, references, persistence, and BYOK/server key routing.
5. Port OpenHiggs asset recipes, operation registry, Vision analysis/QA semantics, Video Ready orchestration, and editor UX.
6. Add only missing server capabilities to the existing Supabase/Netlify layer. Do not copy Next.js/Clerk API routes.
7. Preserve free-first discovery. Vision is explicit. Firecrawl is not a required or primary dependency.
8. Original assets are immutable; edits create versions.
9. Exact logos, phone numbers, URLs, and CTA wording stay protected and may use deterministic overlays.
10. Existing Personalizer and legacy image tools remain available; this feature does not delete unrelated editors.

## Implementation matrix

| OpenHiggs / desired capability | RNE current capability | Status | Decision | Source | Target |
|---|---|---|---|---|---|
| Single personalization modal | Existing `PersonalizeModal.jsx` used by studios | Present | KEEP + EXTEND | `PersonalizationModal.tsx` | `src/components/modals/PersonalizeModal.jsx` |
| Existing contact intelligence | Contact/GitHub/website/Maigret discovery | Present | KEEP | existing RNE | `PersonalizeModal.jsx`, `personalizer-api.js` |
| Token personalization | Canonical token schema + aliases + profile fallbacks | Present | KEEP | existing RNE | `src/components/personalize/tokenSchema.js` |
| Contact/profile browser store | `contactStore.js` local canonical layer | Present | KEEP + EXTEND | existing RNE | `src/lib/contactStore.js` |
| Supabase contact/profile store | contacts/contact_profiles/contact_assets/etc. | Present | EXTEND | existing RNE | new migration + intelligence API |
| Who: Me / My Business / Client | No equivalent unified business audience state | Missing | PORT | OpenHiggs `types.ts` / modal | modal + profile schema |
| Business/client profile | Company/intelligence fields exist but not OpenHiggs client contract | Partial | ADAPT | OpenHiggs `ClientProfile` | profile.business/client extension |
| OSM / Overpass business search | No integrated OSM business picker in current modal | Missing | PORT | OpenHiggs businessDiscovery | Netlify function/service + modal |
| Nominatim research/geocoding | Not integrated in current personalizer | Missing | PORT | OpenHiggs businessDiscovery | Netlify function/service |
| Free-first website asset discovery | RNE discovers logo, avatar, screenshot, colors | Partial | EXTEND | OpenHiggs discovery pipeline | `packages/assets` + personalizer API |
| Product/service/storefront/team/etc classification | Current RNE asset discovery categories are narrow | Missing | PORT | OpenHiggs discovered asset types | shared personalization model |
| Review/select/reject/restore/reclassify | No equivalent full review grid | Missing | PORT | OpenHiggs modal | unified modal Assets tab |
| Durable mirroring | RNE `packages/assets` can mirror to Supabase | Present | REUSE + HARDEN | existing RNE | `packages/assets/src/discoverAssets.ts` |
| Person/presenter library | Avatar URL(s) exist | Partial | EXTEND | OpenHiggs AssetLibrary | contact assets/profile |
| Logos | Existing logo URLs + token | Partial | EXTEND | OpenHiggs AssetLibrary | contact assets/profile |
| Products | Basic productImages field | Partial | EXTEND | OpenHiggs AssetLibrary | contact assets/profile |
| Brand references | Brand colors + basic brand data | Partial | EXTEND | OpenHiggs AssetLibrary | contact assets/profile |
| First frame | Studio handoff supports uploadedImageUrl/start frame | Partial | EXTEND | OpenHiggs AssetRole | contact assets + handoff |
| Last frame | Not first-class personalization asset | Missing | PORT | OpenHiggs AssetRole | contact assets + handoff |
| CTA graphic | Not first-class personalization asset | Missing | PORT | OpenHiggs AssetRole | contact assets + handoff |
| Background reference | Existing image references can be passed, not role-aware | Partial | EXTEND | OpenHiggs AssetRole | contact assets + handoff |
| Saved references | No unified role-aware saved-reference collection | Partial | EXTEND | OpenHiggs AssetRole | contact assets/profile |
| 68-operation image edit registry | RNE has generic image/refine/inpaint transport but no personalization registry | Missing | PORT/REBRAND | `imageEditRegistry.ts` | `src/lib/personalization/imageEditRegistry.js` |
| 16 asset recipes | None | Missing | PORT/REBRAND | `imageEditRegistry.ts` | same registry module |
| Image generation/edit transport | ThumbnailService + ai-thumbnail-generator | Present | REUSE | existing RNE | no parallel API |
| Conversational Responses Smart Edit | `refineLastImage` + `previousResponseId` + refs | Present | REUSE + WRAP | RNE existing | personalization image service |
| Streaming partial images | `refineLastImageStream` | Present | REUSE | RNE existing | personalization image service |
| Direct masked edit/inpaint | `ThumbnailService.inpaint` | Present | REUSE | RNE existing | personalization image service |
| Multiple reference images | Existing thumbnail/refine transport supports arrays | Present | REUSE | RNE existing | personalization image service |
| Output format/compression/quality | Existing image backend supports controls | Present | REUSE | RNE existing | personalization image service |
| Simple editor mode | No PR #31-equivalent personalization editor | Missing | PORT UI | `ImageEditorModal.tsx` | new SmartVideo AI editor component |
| Advanced editor mode | Legacy editors exist, but not PR #31 integrated workflow | Partial | PORT without deleting legacy | `ImageEditorModal.tsx` | new personalization editor |
| Brush/shape mask editor | Existing backend mask transport; no PR #31 mask UX | Missing | PORT | `MaskEditor.tsx` | new mask component |
| Local canvas transforms | Other editors have some transforms, not unified | Partial | ADAPT | PR #31 editor | editor local-canvas module |
| Vision asset analysis | Existing AI enrichment is text/contact focused | Missing | PORT semantics | image-analyze route | existing server architecture |
| Vision edit QA | None | Missing | PORT | image-analyze validate mode | existing server architecture |
| Asset protection rules | Not first-class | Missing | PORT | PR #31 recipes + Vision | personalization asset metadata |
| Make Video Ready | None as reusable personalization pipeline | Missing | PORT | `batchVideoReady.ts` | `src/lib/personalization/videoReady.js` |
| Version history / compare | Thumbnail refinement has response metadata; no asset version model | Partial | EXTEND | PR #31 editor | personalization asset metadata + UI |
| Prompt Vision context | Existing token/intelligence prompt enrichment | Partial | EXTEND | `promptPersonalizer.ts` | token/profile prompt context |
| Image Studio handoff | Existing adapter | Present | EXTEND asset roles | existing RNE | `personalizerAdapters.js` |
| Video Studio handoff | Existing adapter | Present | EXTEND first/last/reference roles | existing RNE | `personalizerAdapters.js` |
| Template Studio handoff | Existing adapter | Present | EXTEND | existing RNE | `personalizerAdapters.js` |
| Cinema Studio handoff | Current personalization hooks exist; verify exact adapter path | Partial | AUDIT + EXTEND | existing RNE | adapter/studio integration |
| OpenAI server/user key routing | Existing ai-thumbnail-generator supports BYOK/server fallback | Present | KEEP | existing RNE | do not expose keys |
| Clerk entitlement from OpenHiggs | RNE uses different auth/session patterns per server layer | Incompatible | DO NOT PORT | PR #31 routes | use RNE Supabase/auth conventions |
| Next.js API routes from OpenHiggs | RNE production personalization uses Netlify + Supabase Edge | Incompatible | DO NOT PORT | PR #31 routes | extend existing functions |
| Firecrawl-first scraping | Not desired | N/A | REJECT | — | static/free-first; Firecrawl last optional fallback |

## Port order

1. Shared asset roles/data contract.
2. Operation registry + recipes.
3. Personalization image-service wrapper over ThumbnailService.
4. Vision analyze/validate server action.
5. Video Ready orchestration.
6. Durable asset version persistence/migration.
7. Business/client profile UI and persistence.
8. Business discovery + expanded website asset discovery.
9. Discovered-assets review UI.
10. ImageEditor + MaskEditor UI.
11. Prompt-context integration.
12. Studio handoff expansion.
13. Regression + E2E gates.

## Explicit non-goals

- No duplicate Personalize modal.
- No second OpenAI image backend.
- No direct copy of Clerk entitlement code.
- No mandatory Firecrawl dependency.
- No deletion of Personalizer, token workflow, legacy editors, or existing studio routes.
- No automatic merge or deployment.
