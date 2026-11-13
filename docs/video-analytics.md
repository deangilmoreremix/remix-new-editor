# First-party video analytics

Free, first-party analytics for videos published from the Timeline Editor. No analytics SaaS, Redis, queue or extra backend: the hosted player -> a Netlify Function -> Supabase Postgres.

```
/watch/<id> or /v/<business>/<slug>
  analyticsClient.js (batched, idempotent, consent-aware)
    -> POST /api/video-events        netlify/functions/video-events.js  (validates, rate limits)
      -> rpc ingest_video_events()   service role only (supabase/migrations/20261112020000_video_analytics.sql)
        -> video_view_sessions, video_events, video_analytics_daily, video_daily_viewers, video_retention_buckets
Owner dashboard (Projects > Analytics) -> owner-only RPCs (RLS on the Clerk `sub`)
```

## Definitions
| Metric | Definition |
|---|---|
| Page visits | One valid `page_open` per page session. Not a play. |
| Video plays | First playback start of a session (`play`) plus each replay (max 10/session). |
| Viewing sessions | Page sessions that started playback. |
| Completed views | Sessions that reached the end (`complete`). Completion rate = completed / viewing sessions. |
| Watch time | Sum of continuous foreground playback segments. Seeks, pauses and hidden tabs end a segment; the server clamps each session to the wall-clock time since it began, so duplicate or inflated batches cannot add time. Average = watch time / viewing sessions. |
| Average % watched | Mean of the furthest position of genuinely watched time per played session (skipping ahead does not count). |
| Unique viewers | Distinct hashed random viewer ids with a play in the period. `null` ("—") when none are available. Sessions without an id (consent off / storage blocked) are reported separately and are never presented as people. |
| Returning | A known viewer id seen in an earlier session of the same video. |
| CTA clicks | Distinct CTA / call / product / overlay targets per session (repeat clicks on one target count once). |
| CTA / lead conversion rate | Count of the interaction / viewing sessions, as labelled in the UI. |
| Milestones | `progress_25/50/75/90` fire only after real viewing (position reached **and** >=80% of the preceding part watched). |

## Event schema (`POST /api/video-events`)
```json
{ "video": "<published id>", "session": "<random 16-64 chars>", "viewer": "<random, optional>",
  "contact": "<personal-link id, optional>", "ref": "<referrer host, optional>",
  "events": [ { "type": "cta_click", "seq": 4, "t": 31.2, "clip": "cta1", "section": "pricing", "props": { "label": "Get a quote", "pricing": true } } ] }
```
Types: `page_open play pause resume complete progress_25 progress_50 progress_75 progress_90 replay section_rewatch cta_click product_select call_click overlay_click lead_submit error` plus the internal aggregated `watch {t0,t1}`. `return` is derived server-side only. 1-25 events and <= 8 KB per request. Unknown keys are dropped. **Owner id, revision and interest scores are never accepted from the client**: the owner and revision are resolved from `published_videos`, and interest scores are computed on the server.

## Privacy and security
- IP addresses are never stored; a salted hash of IP+video is used only as a rate-limit key. The viewer id is random, stored in the viewer's `localStorage`, and hashed again server-side (`ANALYTICS_HASH_SALT`).
- Do-Not-Track and Global Privacy Control disable collection. `?consent=off` disables it and `?consent=essential` collects without a persistent viewer id (hosts embedding the player can pass these from their consent banner).
- Public roles cannot read any analytics table or call `ingest_video_events`; the old unauthenticated `record_video_event` / `increment_video_view` RPCs are revoked.
- Owners read only their own videos (RLS on `published_videos.clerk_user_id`). `delete_video_analytics(video)` removes all collected data for a video.
- Rate limits (database, shared across function instances): 120 requests/min per hashed client+video, 60/min per session, 1,200/min per video.

## Storage, retention and free-tier estimates (estimates, not guarantees)
- Raw sessions/events are pruned after 90 days (`prune_video_analytics`, nightly via pg_cron when installed, else call it from a scheduled job). Daily aggregates are kept. Watch segments are aggregated, not stored; at most 200 raw events per session.
- Roughly 2 KB of database per played session including indexes (1 session row + ~8 event rows).
- Function calls: about 3-5 invocations per played session (first flush ~2 s, then every 15 s, plus a final beacon), each making 3 limiter calls + 1 ingest.

| Monthly plays | Raw DB (90-day window) | Function invocations |
|---:|---:|---:|
| 1,000 | ~6 MB | ~4,000 |
| 10,000 | ~60 MB | ~40,000 |
| 100,000 | ~600 MB | ~400,000 |

**Measured** (local Postgres 16, 5 videos, 100,000 sessions, 600,000 events, 180 daily rows): sessions 40 MB, events 114 MB, aggregates 18 MB, i.e. about 1.7 KB per session of six events including indexes, in line with the estimate. Owner RPCs over a 90-day range for one 20,000-session video (RLS on, `supabase/tests/60_perf_seed.sql` + `61_perf_queries.sql`): summary 46 ms, timeseries 36 ms, retention 42 ms, CTA performance 62 ms, audience segments 218 ms, section engagement 352 ms, portfolio (5 videos) 68 ms, per-video stats 17 ms. No extra index was needed. Plain Postgres on one machine, not a Supabase instance; expect the same order of magnitude, not identical numbers.

Supabase free is 500 MB of database and Netlify free is 125k function invocations/month (check current plan limits). The 10k/month tier fits both; ~30k plays/month is about where the invocation allowance runs out, and ~80k where raw storage does unless retention is shortened. Lower `prune_video_analytics(days)` or batch less often to stretch it.

## Configuration
`SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` on Netlify (server only). Optional `ANALYTICS_HASH_SALT`.
