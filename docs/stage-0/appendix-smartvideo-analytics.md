# SmartVideo analytics/engagement audit (branch claude/focused-brown-9xfv3c, read-only)

## 1. Watch pages / CTAs
| File | Lines | Verdict |
|---|---|---|
| src/pages/WatchPage.jsx | 191 | Public player /watch/<id>, /v/<biz>/<slug>. Creates analytics, wires CTA click capture (delegated capture-phase click on `a[href]` in frame) |
| src/lib/editor/publish/interactivePlayer.js | 285 | Interactive engine: pause/loop/skip, lead-form gates, List Builder/Personalizer, `click-to-call` CTA clips + `linkBox` overlays |
| netlify/edge-functions/watch-embed.js | 18 | Only strips X-Frame-Options / sets `frame-ancestors *` for /watch/*, /v/*. No analytics |
| netlify/functions/watch-voice.js (NOT an edge fn) | 182 | Smart Speech TTS per token; in-memory rate limit; no analytics |

- Personalization: `profileFromQuery()` (publishClient.js ~L298) turns every query param (except embed/autoplay/t/c; key<=40, value<=200) into {{token}} variables; `?c=<contactId>` = per-contact link id (regex `[A-Za-z0-9_-]{1,80}`); `<token>__f/__l` image crop/brightness; `?consent=`; `?embed=1`.
- CTA kinds that actually exist: only 2 link modes (ctaLink.js): URL (open link, `_blank/_parent`) and PHONE (`tel:`, with `callNotifyAddress`), plus lead-form clips and List Builder/Personalizer forms. There is NO typed "book a call / visit website / get offer / contact" CTA: those are just a clip label. Tracking is by event type + free-text `label` (<=80 chars) + `clip` id; `isPricingLabel` flags pricing; DB `_is_contact_label/_is_pricing_label` classify labels for interest scoring.
- Click tracking: `cta_click` (any link), `call_click` (tel:), `lead_submit` (after successful lead), `overlay_click`, `product_select` are allowed by the server but only cta_click/call_click/lead_submit/error are emitted by WatchPage. No CTA impression/"shown" event.

## 2. Ingestion
netlify/functions/video-events.js (170) – only writer; client src/lib/editor/publish/analyticsClient.js (261). src/lib/analytics.js (175) is the unrelated app-wide (generation) analytics, not video.
- Event types accepted: page_open, play, pause, resume, complete, progress_25/50/75/90, replay, section_rewatch, cta_click, product_select, call_click, overlay_click, lead_submit, error, plus `watch` (segment {t0,t1}, 0<len<=120s). DB additionally allows `return` (server-generated).
- Payload kept after re-shaping: {type, seq(0..999999), t (seconds, <=86400), clip (<=80), section (<=80), props:{label, pricing(bool), reason}}; envelope: video, session, viewer, contact (?c), ref (referrer HOST only), device class from UA (mobile/tablet/desktop). Unknown keys dropped.
- NO positions x/y, no scroll, no pointer, no element ids/selectors, no viewport size, no timestamps from client.
- Batching: client queue, first flush ~2s, then 15s, `sendBeacon` on pagehide/hidden, max 20 events/batch (server 25, body 8192 B), 3 retries with backoff, watch segments aggregated (flush every 10s of continuous play, min 0.5s); nothing per second.
- Dedupe: (session_id, seq) unique; `dedupe_key` index; retried batches idempotent (returns accepted/duplicates).
- Rate limit: DB `rate_limit_check` for per-ip+video 120/min, per-session 60/min, per-video 1200/min; fails open if limiter down.
- Privacy: viewer id random in localStorage, SHA-256 with server salt (default salt 'smartvideo-analytics-v1' if env unset), IP only hashed for limiter key, not stored. Consent: DNT/GPC or ?consent=0|off|no -> nothing sent; ?consent=essential|anonymous -> no viewer id. No cookie banner; consent is URL/browser-signal based. `contact_id` (?c) is stored in clear in sessions.
- Watch time: only continuous foreground playback (seek/pause/hidden tab ends segment); coverage stored as 1%-buckets (0..99) per session.

## 3. Supabase schema (migrations in repo)
| Table | Key columns / indexes | RLS |
|---|---|---|
| published_videos (20261105120000) | id text, clerk_user_id, title, project jsonb(<2MB), published, view_count; idx owner | owner CRUD; public read policy dropped in 20261112050000 (public read via RPC/function) |
| video_view_sessions (20261112020000) | video_id, revision, session_key, viewer_hash, contact_id, device_class, referrer_host, is_return, played, completed, watch_seconds, max_progress, `covered smallint[]` (1% buckets), last_watch_seq, event_count; idx (video_id,started_at), (video_id,viewer_hash) | owner select via published_videos.clerk_user_id = jwt sub; all writes revoked |
| video_events | session_id, video_id, seq, type, t, clip_id, section_id, props jsonb<=512B, dedupe_key, created_at; unique(session,seq); idx video+created, video+type+created | same owner select |
| video_analytics_daily | per video/day counters: page_visits, plays, sessions, completes, progress_25..90, cta/call/overlay clicks, product_selects, leads, returns, errors, watch_seconds | same |
| video_daily_viewers | (video,day,viewer_hash) | same |
| published_video_events (20261105160000, legacy) | video_id, contact_id, kind(view/play/complete/cta_click/lead), clip_id | owner select; written by anon-callable `record_video_event` (security definer, unauthenticated, no rate limit, only checks video is published) |
| video_leads (20261104120000) | clerk_user_id, project_id, clip_id, kind, data jsonb<32KB, source jsonb, preview | owner select/insert/delete |
| retarget_rules / retarget_preferences / viewer_interests / owner_notifications / notification_email_queue (20261112030000) | per-owner weights, thresholds, interest scores per session, in-app alerts, email queue | owner policies; viewer_interests owner read |
| video_campaigns, campaign_recipients (ONLY on origin/claude/modest-tesla-yhjel6, 20261113000000_video_campaigns.sql) | recipient `email` (<=320), `contact jsonb`, token, status | owner manage; anon RPC `get_campaign_recipient_page(token)` |

Owner RPCs (security invoker, owner enforced by RLS/jwt): `video_analytics_summary(video,from,to)->jsonb`, `video_analytics_timeseries -> (day,page_visits,plays,unique_viewers,completes,cta_clicks,leads)`, `video_retention_curve -> (bucket 0..99, viewers, base)`, `video_section_engagement(video, sections jsonb, from,to)`, `video_cta_performance -> (type,clip_id,label,sessions,eligible_sessions)` (eligible = played sessions, NOT impressions), `owner_video_stats`, `owner_portfolio_summary`, `video_events_by_contact(video_id) -> contact_id,views,plays,completes,cta_clicks,leads,last_seen`, `video_interest_summary`, `video_audience_segments`, `owner_unread_notifications`, `mark_notifications_read`, `delete_video_analytics(video)` (definer, owner-checked), service_role only: `ingest_video_events`, `prune_video_analytics`, `detect_interest_surges`, `build_daily_digests`.
Retention: raw sessions/events pruned at 90 days (pg_cron 03:17 nightly where available); daily aggregates and daily_viewers kept indefinitely; owner can delete.

Data availability:
| Need | Status | Detail |
|---|---|---|
| (a) click heatmap (norm. x/y) | NOT AT ALL | no coordinates in client, function allowlist, or tables (`props` allows only label/pricing/reason) |
| (b) CTA CTR with impressions | PARTIAL | click counts per type/clip/label and distinct sessions vs played-sessions denominator exist; no CTA-shown/visible event, so true impression CTR impossible; no CTA kind taxonomy |
| (c) watch-time / segment heatmap | PARTIAL (good) | 1%-bucket coverage per session -> retention curve, section engagement, watch_seconds, replay, section_rewatch, progress milestones, complete exist; NOT stored: raw segments (aggregated away), per-second buckets (1% granularity only), explicit skip events, replay counts per bucket, drop-off point (derivable only from curve/max_progress) |
| (d) scroll depth | NOT AT ALL | page is a player; no scroll listener or field |
| (e) pointer movement | NOT AT ALL | none |

## 4. Existing analytics UI
- src/lib/editor/projectLibrary/analytics/SmartVideoAnalytics.tsx (120): tabs overview/engagement/conversions; LineChart (plays/day), RetentionChart (SVG curve), "EngagementExplorer" with `.sv-heatmap` = 34 bar columns of retention along the runtime (a bar-strip "heat" of watch retention, not a spatial heatmap), section bars, conversions list, MarketingOpportunities. Filters: period today/7d/30d/90d/custom date range ONLY. No video/campaign/CTA/device filter UI (device_class is stored but not surfaced; referrer stored not surfaced).
- Others: analyticsData.js (157, RPC loaders), AnalyticsTabView.jsx (83), LivePreview.jsx (89), mountAnalyticsTab.jsx (29); projectTabs.js (232): Audience (interest bars, segments), Retarget (interest map, follow-up comparison table, launchFollowup), Notifications (alerts + prefs; email disabled, no provider), Share (per-contact table from video_events_by_contact). projectsPanel.js (338): project cards with owner_video_stats. retarget/recommendations.js (114), followup.js (39).
- src/cinegen/components/analytics/analytics-tab.tsx (131): thin CineGen wrapper reusing the above (only file in that dir).
- Report/export: NONE. grep for csv/pdf/report in projectLibrary and cinegen analytics finds only the word "Reporting period". No export, no scheduled/client reports, no white-label report.

## 5. Heatmap-like code
- src/lib/editor/remotion/remotionui/vendored/primitives/heatmap-grid.tsx (216), map-heat-overlay.tsx (199, maplibre geo heat layer), demos/heatmap-grid.jsx (16): Remotion video-overlay primitives (animated grid cells of `number[][]`, geo heat on a map) for creating videos; unrelated to analytics. heatmap-grid could be repurposed as a pure render component for a coarse grid, but it's frame-driven (useCurrentFrame), not a normal React DOM chart.
- heatmap.js / simpleheat: not in package.json, not imported anywhere.

## 6. Tests
| Path | tests |
|---|---|
| netlify/functions/__tests__/video-events.test.js | 9 |
| netlify/functions/__tests__/watch-voice.test.js | 4 |
| src/lib/editor/publish/__tests__/analyticsClient.test.js | 18 |
| .../sections.test.js | 5 (publish.test.js, publishSlugs.test.js also exist) |
| src/lib/editor/projectLibrary/__tests__/projectTabs.test.js | 15 |
| .../projectsPanel.test.js | 12 |
| analytics/__tests__/AnalyticsTabView.test.jsx | 19 |
| analytics/__tests__/analyticsData.test.js | 13 (+ editorTheme, noFixtureInProduction tests) |
| src/test/personalization-analytics.test.js | exists (personalization, not video) |
| tests/e2e/projects-analytics.spec.js | 8 (Playwright) |
| tests/browser-harness/projects-analytics/ | local-only, not CI: seed.py, bridge.mjs, e2e.cjs, chain.cjs (real player -> function -> DB -> tab), publish.cjs, cinegen.cjs, fn-adapter.mjs, palette.cjs, README.md; uses real Postgres+RLS |
No tests for WatchPage.jsx click delegation or interactivePlayer in the found set; SQL tested only via harness.

## Classification
| Feature | Status | Gaps |
|---|---|---|
| Click heatmap | MISSING | no x/y capture, schema, RPC, UI, renderer |
| CTA engagement | PARTIAL | clicks/calls/leads per clip+label with session-based rate; no impressions, no CTA type taxonomy (book/visit/offer/contact), no UI table CTR per CTA/device |
| Video engagement heatmap | PARTIAL (largely implemented) | retention curve + 1% coverage + bar strip + section engagement exist; no per-second, skip/replay/drop-off views |
| Scroll depth | MISSING | |
| Pointer heatmap | MISSING | |
| Campaign/recipient analytics | PARTIAL | per-contact (`?c`) totals exist; campaigns/recipients tables exist only on modest-tesla branch (not merged); no campaign-level aggregates in analytics RPCs; UTM/referrer attribution only on upbeat-goodall branch (leads only, not sessions) |
| Client reports | MISSING | no export/PDF/CSV/share report |

## In-flight branches (diff vs origin/develop...)
| Branch | Files touched relevant here |
|---|---|
| laughing-babbage-v4ti68 | src/cinegen/components/analytics/analytics-tab.tsx, analytics-tab.css, overview/published-overview.tsx, leads/use-publish.ts, lib/leads/overview-deps.ts, project-link.ts, WebApp.tsx, home-view.tsx, src/lib/editor/projectLibrary/projectsPanel.js, tests/browser-harness/projects-analytics/cinegen-overview.cjs (+2 cinegen tests). HIGH overlap with analytics UI/projectsPanel |
| upbeat-goodall-9lmvej | src/pages/WatchPage.jsx, interactivePlayer.js, viewerOverlays.js, publishClient.js, new publish/attribution.js (UTM+referrer for leads) and pixel.js (FB pixel), addons/*, leadClient, lead-capture edge fn, migrations 20261113010000_webhook_deliveries, 20261113020000_lead_integrations, cinegen leads. HIGH overlap with watch page / CTA tracking; does NOT touch analyticsClient.js or video-events.js |
| modest-tesla-yhjel6 | supabase/migrations/20261113000000_video_campaigns.sql, PersonalizedVideoStudio.js, personalizedVideoEngine.js, router.js, studioRoutes.js. Overlap only on campaign/recipient schema |
| confident-fermi-3azaem | no diff vs origin/develop (empty) |
Conflict hot-spots for new work: WatchPage.jsx (upbeat-goodall), projectsPanel.js + analytics-tab.tsx (laughing-babbage), migration numbering 20261113* (3 branches already use 20261113000000/010000/020000: use a later timestamp).

## Security notes
- Recipient identity: `contact_id` (?c) stored raw and returned by `video_events_by_contact`; query-param personalization values (names/company) ride in the URL; modest-tesla `campaign_recipients.email`+`contact jsonb` plaintext PII and a token-based anon RPC (check token entropy / no enumeration / revoke when campaign ends). Retention note in UI says "viewers are anonymous", which is not true for contact-linked sessions.
- Legacy `record_video_event` is anon-callable with no rate limit and no session dedupe, so it can inflate legacy counts (the new path goes via service role + limiter); consider revoking.
- RLS policies are granted to `anon` role but gated by jwt sub, fine; aggregate RPCs `video_analytics_summary/timeseries/cta_performance/owner_*` are granted to anon (security invoker, returns nothing without a sub) - harmless but unnecessary.
- Default hash salt is a literal in code if ANALYTICS_HASH_SALT unset; limiter fails open; sec rate-limit key falls back to 'unknown' IP (shared bucket).
- Any new click/pointer capture must reuse consentMode(), avoid element text/selectors containing personal data, store normalized coords only, and be pruned by the same 90-day job.
