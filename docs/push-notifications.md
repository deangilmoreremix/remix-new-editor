# Browser push notifications (Web Push, free)

Owners get a browser push whenever a row is inserted into `public.owner_notifications`. That one table already
covers lead-generator / list-builder leads (`new_lead`), the retarget feature (`high_interest`,
`followup_opportunity`, `interest_surge`, `returning_engagement`) and video activity (`milestone`, `pricing_cta`,
`contact_cta`). `daily_digest` never pushes.

## Architecture

```
 owner device (service worker + subscribe UI)
   | PushManager.subscribe(VAPID public key)
   v   insert (RLS: own rows only)
 public.owner_push_subscriptions  <-----------------------------+
                                                          | read / cleanup (service role)
 public.owner_notifications --AFTER INSERT trigger-->  pg_net http_post
   (type != daily_digest; no-op if pg_net or           POST {notification_id}
    push_dispatch_config is missing; never raises)     header x-push-secret
                                                          |
                                                          v
                                          Netlify function push-dispatch
                                          1. constant-time check of x-push-secret
                                          2. load notification (skip daily_digest)
                                          3. retarget_preferences: push = true,
                                             type in enabled_types and push_types
                                             (NULL = all), not in quiet_hours
                                          4. web-push -> every subscription of the owner
                                          5. 404/410 -> delete; other failure -> failure_count+1
                                             (delete at 5); success -> last_success_at, reset
                                                          |
                                                          v
                                       push service (FCM / Mozilla / Apple) -> device
```

The in-app bell also receives the row live: `owner_notifications` is added to the `supabase_realtime` publication
(RLS limits events to the owner).

## Database (migration `20261118210000_web_push_notifications.sql`)

- `owner_push_subscriptions`: `id`, `clerk_user_id` (default `auth.jwt()->>'sub'`), `endpoint` (unique, https, <= 2048),
  `p256dh`, `auth`, `user_agent` (<= 300), `created_at`, `last_success_at`, `failure_count`. Owners can select, insert
  and delete their own rows; no update. The service role bypasses RLS.
- `retarget_preferences.push boolean not null default false`: per-account opt-in (existing owner policy and grants cover it).
- Optional migration `20261119090000_push_types.sql`: `retarget_preferences.push_types text[]` (nullable; a check allows only the nine known types,
  via an immutable `retarget_push_types_ok` function with `search_path = ''`). Backward compatible: without it the settings screen
  saves everything else and says per-type push choices need a database update, and `push-dispatch` reads preferences with
  `select=*` and treats the missing column as `NULL`.
- `push_dispatch_config`: single row (`id = 1`) with `url` and `secret`; service role only (RLS on, no policies).
- Trigger `owner_notifications_push` (security definer, `search_path = ''`): calls `net.http_post` only when schema `net`
  (pg_net) exists and the config row has a URL. Any error is swallowed, so a push problem can never block or roll back the insert.

## Preferences model (what decides whether a push is sent)

The in-app list is always the record of every alert that is enabled; push is an extra on top of it.

| Setting | Meaning |
| --- | --- |
| `enabled_types` | Which alerts exist at all (shown in the app). Unchanged. |
| `push` | Account-wide master switch for push. Off: nothing is pushed. |
| `push_types` | Optional per-type choice of which enabled alerts ALSO push. `NULL` (or column absent) = legacy: every type in `enabled_types` pushes. An array = only types in both `push_types` and `enabled_types`. The UI always saves an explicit array. `daily_digest` never pushes. |
| `quiet_hours` | `{start, end, timeZone, utcOffsetMinutes}`; see below. |

`push-dispatch` skip reasons, in order: `not_configured`, `bad_notification_id`, `notification_not_found`,
`type_not_pushed` (daily_digest), `no_preferences`, `push_disabled`, `type_disabled` (alert off),
`type_push_disabled` (alert on, but not selected for push), `quiet_hours`, `no_subscriptions`.

### Quiet hours

- Stored in `retarget_preferences.quiet_hours` as `{ "start": "22:00", "end": "07:00", "timeZone": "America/New_York", "utcOffsetMinutes": -300 }`.
  Overnight ranges are allowed; `start == end` means off. `null` = no quiet hours.
- Local time is computed from `timeZone` (IANA, via `Intl.DateTimeFormat`, so daylight saving is right). If `timeZone` is
  missing or invalid it falls back to the fixed `utcOffsetMinutes` (what older rows have), then to UTC. It never throws.
  The UI also stores the zone's offset at save time so older readers keep working.
- During quiet hours the push is **skipped, not delayed**: it is not sent later. The alert still appears in the app.
- The same `inQuietHours` helper is shared with the digest and email jobs (the e-mail queue still delays rather than skips; email needs a provider that is not connected yet).

## Environment variables (Netlify)

| Name | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` | VAPID public key (the client subscribes with the same value) |
| `VAPID_PRIVATE_KEY` | VAPID private key (server only, never commit) |
| `VAPID_SUBJECT` | `mailto:` address or https URL identifying the sender |
| `PUSH_DISPATCH_SECRET` | shared secret; must equal `push_dispatch_config.secret` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | already used by the other functions |

Without the VAPID variables the function answers `200 {"sent":0,"reason":"not_configured"}`.

## Generate keys

```bash
npm install
node scripts/generate-vapid-keys.mjs
```

Prints a fresh pair; nothing is stored. Put the private key only in the Netlify environment. Generate a random shared
secret yourself, e.g. `openssl rand -hex 32`.

## Fill `push_dispatch_config` (once, SQL editor as an admin)

```sql
insert into public.push_dispatch_config (id, url, secret)
values (1, 'https://<your-site>/.netlify/functions/push-dispatch', '<same value as PUSH_DISPATCH_SECRET>')
on conflict (id) do update set url = excluded.url, secret = excluded.secret;
```

## Deploy order

1. Generate keys; set the Netlify env vars above; deploy the site (function + client).
2. Apply the migration. Enable the `pg_net` extension (Database > Extensions) if it is not enabled.
3. Insert the `push_dispatch_config` row. Until then the trigger is a harmless no-op.
4. Owners enable push in the notification settings (creates a subscription and sets `retarget_preferences.push`).

## Privacy

- The payload contains only the notification title and summary (trimmed), the type, ids and the in-app link
  (`/#/timeline`); no viewer identity beyond what the owner's own alert already shows.
- Endpoints and keys are never logged. Subscriptions are per device and owner-deletable (RLS); dead or failing
  subscriptions are removed automatically.
- Owners control delivery with `push`, `enabled_types`, `push_types` and `quiet_hours`; with no preferences row nothing is pushed.

Note: the table is named `owner_push_subscriptions` because a different feature (the personalization app) already owns a `push_subscriptions` table in the same database, with a different shape (`endpoint_hash`, server-written).
