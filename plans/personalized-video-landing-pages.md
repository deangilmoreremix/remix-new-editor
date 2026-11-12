# Personalized Video Landing Pages ("Remix Pages")

**Goal:** every video made in any Remix editor can be turned into a personalized landing page (video + per-recipient hero, copy, brand, CTA, booking, analytics) and sent as one link per contact, like Pirsonal Pages / Sendspark dynamic landing pages.

**Status:** Proposed. **Principle:** extend what exists; add no new stack.

---

## 1. What we already have (verified in repo)

| Capability | Where | Reuse as-is |
|---|---|---|
| Public player `/watch/:id`, embeddable, no sign-in | `src/pages/WatchPage.jsx`, `netlify/edge-functions/watch-embed.js` | Yes, becomes the video block inside a page |
| Publish timeline snapshot -> shareable row | `src/lib/editor/publish/publishClient.js`, table `published_videos` | Yes |
| Share panel (publish, copy link, embed, per-contact links, CSV, stats) | `src/lib/editor/publish/sharePanel.js` | Extend |
| Per-contact links `?c=<contactId>` + token values in query | `src/lib/editor/personalize/perContact.js`, `profileFromQuery` | Yes |
| `{{token}}` engine (23 canonical tokens, 3-tier fallback) | `src/components/personalize/tokenSchema.js` | Yes, reuse for page copy |
| Per-contact analytics (view/play/complete/cta_click/lead) | `published_video_events`, `record_video_event()`, `video_events_by_contact()` | Yes |
| Lead capture | `supabase/functions/lead-capture`, `video_leads` | Yes |
| Contact + brand discovery (website crawl, logo, colors, business research) | `netlify/functions/personalization-api.mts`, `_personalization/` | Yes, fills page brand automatically |
| Website/page builder (SSR-ish server endpoints, sessions) | `apps/openthorn` + `website-builder-api.mts` | Evaluate for layout engine (see 4.3) |
| Per-contact voice variants | Smart Speech `clip.tts.variants[contactId]`, `watch-voice.js` | Yes |
| Rendering | in-browser `exportToVideo.js`/`exportWorker.js`, `remotion-composer/`, HyperFrames, `apps/motion-agent`, `apps/cinegen` | Yes |
| Auth/DB/Storage | Clerk + Supabase (RLS on Clerk `sub`), Netlify functions + edge, Render for heavy backends | Yes |

**The gap** (confirmed by `docs/SENDSPARK_FEATURES_COMPARISON.md`: "Dynamic Landing Pages: MISSING"):

1. `/watch/:id` is a bare player, not a *page* (no hero, copy, brand, CTA block, booking, social proof, footer).
2. Only the **timeline editor** can publish. CineGen, Motion Agent, Video Agent Studio, Template/Cinema Studio, Render Studio, AI VFX outputs cannot.
3. Page content is not per-contact beyond tokens in clips (no per-contact headline, logo, screenshot, background).
4. No link previews (OG image/title per contact), so links look generic in email/LinkedIn/Slack.
5. No page-level analytics (scroll, CTA by block), no CRM/webhook delivery, no custom domains.

---

## 2. Architecture

```
 ANY EDITOR ──export──▶ Publish Adapter ──▶ published_videos (existing)
 (Timeline, CineGen,        (normalizes to        │
  Motion Agent, VAS,         a "project")         ▼
  Template/Render Studio)                    landing_pages (NEW) ──▶ page_contacts (NEW)
                                                  │  layout JSON +        per-contact overrides
                                                  │  brand + blocks       (tokens, brand, hero img)
                                                  ▼
                       /p/:pageId?c=<contactId>  (public page, SSR-lite via edge)
                          ├─ edge fn: injects OG/Twitter tags + per-contact title/thumbnail
                          ├─ block renderer (hero, video, text, CTA, booking, testimonial, form)
                          ├─ video block = existing interactivePlayer (/watch engine)
                          └─ events ──▶ record_video_event (+ new page events)
```

### 2.1 Universal ingest: "everything becomes a project"
`published_videos.project` is already `{version, title, timelineSeconds, tracks, listBuilder}`. For editors that don't have a timeline model, the Publish Adapter wraps their **rendered MP4 URL** (Supabase Storage) as a **single-clip project**. Result: the existing player, tokens, events and leads work unchanged for every editor. Only the timeline editor publishes a *live* (token-aware) snapshot; others publish a flat video (still fully page-personalizable; the per-contact part lives in the page, not the pixels).

Adapter contract (new `src/lib/editor/publish/adapters/`):
```js
// each returns { title, videoUrl, posterUrl, durationSec, source: 'timeline'|'cinegen'|... , project? }
publishFromTimeline(state) | publishFromCinegen(job) | publishFromMotionAgent(render)
publishFromVideoAgent(result) | publishFromTemplateStudio(render) | publishFromUrl(url)
```
Each editor gets one **"Create landing page"** button in its export/finish step that calls its adapter then opens the Page Builder.

### 2.2 Data model (new migration `2026xxxx_create_landing_pages.sql`, same RLS pattern as `published_videos`)

- `landing_pages`: `id` (slug, same alphabet/check as videos), `clerk_user_id`, `video_id` -> `published_videos`, `title`, `layout jsonb` (ordered blocks), `brand jsonb` (logo, colors, font, from discovery), `settings jsonb` (CTA url, booking url, language, password/expiry), `published`, `view_count`, timestamps. Size check + guard trigger like `published_videos_guard`.
- `page_contacts`: `page_id`, `contact_id` (matches `?c=`), `overrides jsonb` (tokens, hero image, logo, headline, CTA label), `og_image_url`, `status` (draft/ready/sent). Owner-only RLS.
- Reuse `published_video_events`; add `page_id` + kinds `page_view`, `scroll_50`, `section_view`, `booking_click`. Extend the `kind` check and `record_video_event()` (security definer, same validation style).
- Public read: only `published = true` pages; per-contact overrides fetched via a `security definer` RPC `get_page_for_contact(page_id, contact_id)` so the full contact list is never readable by anon.

### 2.3 Block system (JSON-driven, no new framework)
Blocks: `hero`, `video`, `rich_text`, `cta`, `booking` (Cal/Calendly embed), `testimonial`, `logo_bar`, `faq`, `lead_form` (-> `lead-capture`), `footer`. Text fields accept `{{tokens}}` resolved by `resolveToken`; unresolved tokens strip via existing `stripUnresolvedTokens` so a page never shows `{{company}}`.
Renderer is vanilla JS/Vite like `WatchPage.jsx` (no React requirement for the public page, keeps it light and embeddable), styled with Tailwind v4 tokens already in the repo.

### 2.4 Personalization sources (automatic, per contact)
1. **Contact import** (existing Contact Importer/Personalizer): name, company, website, email.
2. **Brand pull** via existing discovery (`discover-assets`, `research-business`): logo, brand colors, hero screenshot (PageShot), tagline.
3. **AI copy**: per-contact headline/intro using existing `timeline-llm`/`openai-enhance` (BYOK-aware via `_shared/byok.js`), with preview + edit before bulk apply.
4. **Per-contact voice/video**: existing Smart Speech variants; optional per-contact re-render through existing export queue (`renderQueueStore.js`) for lip-sync/face-swap tiers (cost-gated, off by default).

### 2.5 Delivery & link previews
- **Edge function `page-embed.js`** (sibling of `watch-embed.js`): for `/p/:id`, fetches page + contact override and injects `<title>`, `og:*`, `twitter:*` so each link previews as "Hi Ann, a quick video for Acme" with a personalized thumbnail. Bots get static HTML; humans get the SPA.
- **OG thumbnail**: poster frame + name/logo overlay generated once per contact in a Netlify background function (pattern: `motion-studio-capture-background.mts`, Chromium via `@sparticuz/chromium` already bundled), stored in Supabase Storage.
- **Animated GIF preview** for email (ffmpeg on Render backend; later phase).
- Netlify only for deploy/CI (per AGENT_GUIDE): add `/p/*` redirect + edge function to `netlify.toml`; no GitHub Actions.

### 2.6 Analytics & integrations
- Extend `video_events_by_contact()` with page events; new dashboard tab in the Share panel: per-contact funnel (opened -> played -> 50%/complete -> CTA/booking -> lead), hot-lead flag (rules, e.g. complete + CTA click).
- **Outbound webhooks** (Zapier/Make/Clay/HubSpot via generic webhook, `lead_webhooks` table, HMAC-signed, fired from a Supabase edge function on `lead`/`cta_click`/`booking_click`).
- Email send: reuse existing publisher email flow (`components/publisher/flows/email`) with merge fields `{{pageLink}}`, `{{gifUrl}}`. Kit/MailerLite connectors are available for later direct sync.
- **Custom domains** (later): Netlify domain aliases + `landing_pages.settings.domain`.

### 2.7 Security & privacy (non-negotiable)
- Unguessable slugs (reuse `makeSlug`); contact ids validated by the existing regex; **PII never in URLs beyond `c` and non-sensitive display tokens**: prefer `?c=` only and fetch values server-side via the RPC (existing query-string tokens remain for back-compat).
- Anon cannot enumerate contacts or events; owner-only RLS on Clerk `sub`.
- Optional password + expiry per page (replace the SHA-256 shortcut in `create-share` with a salted hash / bcrypt-equivalent via Web Crypto PBKDF2 before reuse).
- `noindex` on all `/p/*` pages; unsubscribe/opt-out line in footer; sanitize all block HTML (no raw HTML blocks).
- Cost guards: rate limit via existing `distributed_rate_limiter` migration; per-plan caps on contacts/pages.

---

## 3. Phased delivery

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Spike (2-3 d)** | Confirm `published_videos` accepts single-clip projects; render one in `/watch`. Decide block renderer approach (vanilla vs. openthorn layout reuse). | Flat MP4 plays via `/watch` with leads + events |
| **1. Page MVP (1-2 wk)** | Migration (`landing_pages`, `page_contacts`), `/p/:id` renderer, blocks: hero, video, text, CTA, lead_form; Page Builder panel in Timeline editor; token-resolved copy; per-contact link generation reusing `personalLinks`. | Create page from a timeline video, 10 contacts, each link shows own name/company, leads recorded |
| **2. All editors (1 wk)** | Publish adapters + "Create landing page" button in CineGen, Motion Agent, Video Agent Studio, Template/Render Studio, AI VFX. | Same flow works from each editor, one e2e test each |
| **3. Brand + AI (1-2 wk)** | Auto brand/hero from discovery + PageShot; AI per-contact headline with preview; templates (5 starters). Bulk apply for CSV import. | Import 50 contacts -> 50 ready pages, review grid |
| **4. Link previews (1 wk)** | `page-embed` edge fn, OG thumbnail background function, GIF preview. | Pasting link in Slack/LinkedIn/Gmail shows personalized card |
| **5. Analytics + integrations (1-2 wk)** | Page events, funnel + hot-lead view, webhooks, CSV/CRM export, booking block. | Hot-lead webhook fires into a test Zapier hook |
| **6. Scale/polish** | Custom domains, password/expiry, A/B hero variants, team sharing, i18n. | As needed |

MVP to demo-able = Phases 0-2 (~3 weeks).

---

## 4. Key decisions to confirm

1. **Route**: `/p/:id` (recommended) vs. extending `/watch/:id` with `?page=1`. Separate route keeps the lightweight embeddable player intact.
2. **Per-contact video**: ship page-level personalization first (cheap, instant). Per-contact re-rendered/lip-synced video as a later paid tier via existing generation queue.
3. **Layout engine**: custom JSON blocks (recommended, minimal) vs. reusing `apps/openthorn` Smart Website Builder (richer but heavier, own build under `/openthorn/`). Phase 0 spike decides.
4. **PII in links**: switch to server-side contact lookup (recommended) while keeping query-string tokens working for existing `/watch` links.
5. **Plan limits/pricing**: pages and contacts per tier (ties to monetization hub plan).

## 5. Risks

| Risk | Mitigation |
|---|---|
| Netlify 6 MB / 60 s function limits | No media through functions (existing rule); OG/GIF generation in background fn / Render |
| Non-timeline editors have inconsistent export formats | Single adapter contract; normalize to MP4 + poster in Supabase Storage first |
| Clerk-as-Supabase-JWT config differences across envs | RLS already fails closed; add health check + test in `e2e/` |
| Link previews cached by Slack/LinkedIn | Version OG URL with `?v=`; regenerate on edit |
| Spam/abuse of public pages | Rate limiter, per-plan caps, abuse report link, noindex |

## 6. Testing

Vitest unit tests beside each new module (pattern: `src/lib/editor/publish/__tests__/publish.test.js`), SQL/RLS checks for anon-vs-owner access, Playwright e2e (`e2e/`, `playwright.config.ts`) for create page -> open `?c=` link -> lead -> stats; Netlify deploy preview as the check gate (lint runs in the build command).

## 7. First tasks (ready to start)

1. Phase 0 spike: publish a flat MP4 as a single-clip `published_videos` row; confirm `/watch` plays it.
2. Write migration + RLS for `landing_pages`, `page_contacts`, extended events.
3. Scaffold `src/pages/LandingPage.jsx` + `src/lib/pages/{blocks,renderer,pageClient}.js` and `/p/*` route in `src/main.js` (mirror `IS_WATCH_PAGE`).
4. Add "Landing page" tab to `sharePanel.js` and the adapter for the timeline editor.
