# Browser push notifications (Web Push, free)

Owners get a browser push whenever a row is inserted into `public.owner_notifications`. That one table already
covers lead-generator / list-builder leads (`new_lead`), the retarget feature (`high_interest`,
`followup_opportunity`, `interest_surge`, `returning_engagement`) and video activity (`milestone`, `pricing_cta`,
`contact_cta`). `daily_digest` never pushes.

The same dispatch also sends the optional **owner e-mail alert** (see "E-mail alerts") and holds pushes that
arrive during quiet hours for a **summary push** when quiet hours end (see "Quiet hours").

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
                                          6. independently of 3-5: e-mail alert (below)
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
| `email` | Account-wide switch for e-mail alerts ("Email alerts" in Preferences). Needs the e-mail env vars below; otherwise nothing is e-mailed. |
| `quiet_hours` | `{start, end, timeZone, utcOffsetMinutes, summary}`; see below. |

`push-dispatch` skip reasons, in order: `not_configured`, `bad_notification_id`, `notification_not_found`,
`type_not_pushed` (daily_digest), `no_preferences`, `push_disabled`, `type_disabled` (alert off),
`type_push_disabled` (alert on, but not selected for push), `quiet_hours_deferred` (quiet hours; held for the summary),
`quiet_hours` (quiet hours; dropped because the summary is off or the table is not there yet), `no_subscriptions`.

The response also carries `email`, a status string for the e-mail half (never an address): `not_configured`, `skipped_email_off`,
`skipped_type_disabled`, `skipped_digest`, `skipped_duplicate`, `skipped_no_preferences`, `sent`, `queued_quiet_hours`,
`queued_retry`, `queued`, `failed`, `skipped_no_recipient`, `error`. Push and e-mail are independent: either can be off while the other is on.
When neither push nor e-mail is configured the answer is still `{"sent":0,"reason":"not_configured"}`.

### Quiet hours

- Stored in `retarget_preferences.quiet_hours` as `{ "start": "22:00", "end": "07:00", "timeZone": "America/New_York", "utcOffsetMinutes": -300 }`.
  Overnight ranges are allowed; `start == end` means off. `null` = no quiet hours.
- Local time is computed from `timeZone` (IANA, via `Intl.DateTimeFormat`, so daylight saving is right). If `timeZone` is
  missing or invalid it falls back to the fixed `utcOffsetMinutes` (what older rows have), then to UTC. It never throws.
  The UI also stores the zone's offset at save time so older readers keep working.
- `summary` (boolean, absent = `true`) chooses what happens to a push that arrives during quiet hours:
  - `summary !== false`: the push is **held**. `push-dispatch` records a row in `public.owner_push_deferred`
    (service role only; unique per notification) and answers `reason: "quiet_hours_deferred"`. The scheduled function
    `push-quiet-flush` (every 15 minutes) sends ONE "While you were away" push per device once quiet hours are over:
    body such as "3 new leads, 2 retarget alerts, 1 video update", tag `quiet-summary`, link `/timeline`.
  - `summary === false`: the push is dropped, as before (`reason: "quiet_hours"`).
  - If the `owner_push_deferred` table does not exist yet (migration not applied), recording fails silently and the old
    drop behaviour and `quiet_hours` reason apply; `push-quiet-flush` reports `table_unavailable` and does nothing.
- The flush counts only types that are enabled for push **at flush time** (`enabled_types` and `push_types`). If push is
  off by then, or the summary was switched off, or the owner has no subscriptions, the held rows are deleted without sending.
  The summary is sent first and only the rows it covered are deleted afterwards, so two overlapping runs may send a
  duplicate summary but never lose one. If every device fails, the rows are kept and retried; rows older than 3 days are pruned.
  The alerts themselves always appear in the app right away.
- The same `inQuietHours` helper is shared with the digest and e-mail jobs. E-mails that arrive during quiet hours are
  delayed (retried every 30 minutes by the e-mail queue), not summarised.

## E-mail alerts (optional, Resend)

Owner e-mail is off until a provider is configured. Without `RESEND_API_KEY` and `ALERT_EMAIL_FROM` the adapter is the
no-op one: nothing is queued or sent, and the Email alerts checkbox only stores the preference.

- **When:** `push-dispatch` e-mails a notification when `retarget_preferences.email` is true, the type is in `enabled_types`
  and it is not `daily_digest`. Digests are queued and sent by the daily job (`digest-daily`), which also retries leftovers.
  The daily sweep only queues digests (not older alerts), so switching Email alerts on never sends a backlog.
- **How:** the notification is inserted into `notification_email_queue` (unique per `notification_id`, so a second dispatch
  of the same notification sends nothing) and delivered at once through the same `drainEmailQueue` the daily job uses:
  attempts, exponential backoff (1m, 4m, 16m, ...), 5 attempts, and the 30-minute quiet-hours delay all apply. Drains take an
  atomic 10-minute lease on a row (`PATCH ... status=eq.pending&next_attempt_at=lte.now`), so the immediate path, the daily
  job and `push-quiet-flush` (which drains the queue every 15 minutes) can run at the same time without double sends.
  Resend also receives the notification id as `Idempotency-Key`.
- **Recipient:** never taken from a request or an editable field. The adapter asks the Clerk Backend API
  (`GET https://api.clerk.com/v1/users/{id}`, `Authorization: Bearer $CLERK_SECRET_KEY`) and uses the user's **primary,
  verified** address (`primary_email_address_id` + `verification.status === 'verified'`). No key, unknown user, no primary or an
  unverified one means no e-mail (the queue row is marked `skipped`, `no_recipient`). Results are cached for one invocation only.
- **Content:** subject `New lead: <title>` / `Retarget: ...` / `Video: ...`; the title, summary and suggestion; an "Open alerts"
  button to `${APP_URL or https://smartvid.app}/timeline`; footer "You get this because Email alerts is on in Notifications > Preferences."
  Plain text plus escaped HTML.
- **Errors:** Resend 429, 5xx, timeouts (8 s) and network errors are retried; other 4xx are final. Addresses, keys and bodies are never logged.
- The lead form's own owner notification (`lead-capture` edge function, `RESEND_API_KEY` + `LEAD_EMAIL_FROM` secrets, owner-chosen
  recipients) is a separate feature. If both are on, an owner can receive both a form notification and an alert e-mail for the same lead.

## Environment variables (Netlify)

| Name | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` | VAPID public key (the client subscribes with the same value) |
| `VAPID_PRIVATE_KEY` | VAPID private key (server only, never commit) |
| `VAPID_SUBJECT` | `mailto:` address or https URL identifying the sender |
| `PUSH_DISPATCH_SECRET` | shared secret; must equal `push_dispatch_config.secret` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | already used by the other functions |
| `RESEND_API_KEY` | optional: Resend API key for owner e-mail alerts (secret; functions scope). Without it owner e-mails stay off |
| `ALERT_EMAIL_FROM` | optional: sender on a domain verified in Resend, e.g. `SmartVideo Alerts <alerts@smartvid.app>`. Both this and `RESEND_API_KEY` are required |
| `CLERK_SECRET_KEY` | already set for sign-in; also used to look up the owner's primary verified e-mail |
| `APP_URL` | optional: site URL for the "Open alerts" link (default `https://smartvid.app`; must be http(s)) |

Without the VAPID variables the push half answers `reason: "not_configured"` (the e-mail half still runs if it is configured).
`RESEND_API_KEY` and `ALERT_EMAIL_FROM` are in `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` (they are read only by functions).

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

## Database: `owner_push_deferred` (optional migration `20261119120000_push_deferred.sql`)

`id`, `clerk_user_id`, `notification_id` (references `owner_notifications` on delete cascade, unique), `type`, `created_at`;
index on `(clerk_user_id, created_at)`. RLS on with no policies; `anon` and `authenticated` have no grants; `service_role` only.
Additive: nothing else changes. Without it pushes in quiet hours are dropped as before.

## Deploy order

1. Generate keys; set the Netlify env vars above; deploy the site (function + client).
2. Apply the migration. Enable the `pg_net` extension (Database > Extensions) if it is not enabled.
3. Insert the `push_dispatch_config` row. Until then the trigger is a harmless no-op.
4. Owners enable push in the notification settings (creates a subscription and sets `retarget_preferences.push`).
5. Optional: apply `20261119120000_push_deferred.sql` to turn on the quiet-hours summary (the scheduled function `push-quiet-flush` deploys with the site).
6. Optional: set `RESEND_API_KEY` and `ALERT_EMAIL_FROM` (verified Resend domain) to turn on owner e-mail alerts. E-mail uses the same
   database trigger and `push-dispatch`, so steps 2-3 are needed for immediate e-mails even if no one uses push.

## Privacy

- The payload contains only the notification title and summary (trimmed), the type, ids and the in-app link
  (`/timeline`); no viewer identity beyond what the owner's own alert already shows.
- Endpoints, keys, e-mail addresses and message bodies are never logged. The e-mail recipient is always looked up server side from the owner's Clerk account.
- Endpoints and keys are never logged. Subscriptions are per device and owner-deletable (RLS); dead or failing
  subscriptions are removed automatically.
- Owners control delivery with `push`, `enabled_types`, `push_types` and `quiet_hours`; with no preferences row nothing is pushed.

Note: the table is named `owner_push_subscriptions` because a different feature (the personalization app) already owns a `push_subscriptions` table in the same database, with a different shape (`endpoint_hash`, server-written).
