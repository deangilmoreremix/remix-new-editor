# Setup checklist: Leads, Analytics and Push notifications

Everything below is **configuration you apply yourself**. Nothing in this list has been applied to a live
Supabase project or Netlify site. Tick items off in order; later steps depend on earlier ones.

## 0. Before you start

- [ ] Merge or deploy branch `claude/lucid-mayer-zrx8z0` of `remix-new-editor`.
- [ ] `npm install` (new dependencies: `web-push`, `write-excel-file`).
- [ ] Have admin access to: the Supabase project, the Netlify site that serves the editor, and Clerk.

## 1. Database migrations

> **Applied on 2026-11-18** to the `VideoRemix Product` Supabase project (all five, plus a small `search_path` follow-up for the two lead helper functions). Skip this section for that project. It remains the reference if you set up another environment. Note the push table is `owner_push_subscriptions`: the project already had an unrelated `push_subscriptions` table owned by the personalization app, so the name was changed to avoid touching it.

Apply **in this order**. Each is safe to re-run (`if not exists` / guarded), and the app degrades gracefully if one
is missing, but features below stay off until it is applied.

Prerequisites that should already be applied (check the Migrations list): `20261104120000_create_video_leads`,
`20261112020000_video_analytics`, `20261112030000_retargeting_notifications`.

| # | File | What it enables |
|---|------|-----------------|
| 1 | `20261118120000_video_leads_followup.sql` | Lead status, notes and tags (already on `main`; skip if applied) |
| 2 | `20261118130000_video_leads_email_dedupe.sql` | Repeat sign-up dedupe (`email_key` + unique index). Forward-only: old leads are not backfilled |
| 3 | `20261118131000_video_leads_followup_hardening.sql` | `updated_at`, tag length check, trigger bumping `updated_at` |
| 4 | `20261118200000_video_audience_country_versions.sql` | Country capture, "Where your viewers come from", "Compare versions" |
| 5 | `20261118210000_web_push_notifications.sql` | `owner_push_subscriptions`, `retarget_preferences.push`, `push_dispatch_config`, push trigger, Realtime on `owner_notifications` |
| 6 | `20261119090000_push_types.sql` | Optional: `retarget_preferences.push_types` (per-alert-type push choice). Everything works without it; per-type choices are only saved once it is applied |
| 7 | `20261119120000_push_deferred.sql` | Optional: `owner_push_deferred` (service role only), so pushes held by quiet hours become one "While you were away" summary push when quiet hours end. Without it they are dropped, as before |

- [ ] 1–3 applied (Leads)
- [ ] 4 applied (Analytics)
- [ ] 5 applied (Push). **Apply 4 before or together with the Netlify deploy**: the ingest function falls back safely if it is missing, but country data is lost until then.
- [ ] 7 applied (optional: quiet-hours summary push)
- [ ] Saving notification preferences now writes a `push` column, so apply **5 before** anyone saves preferences.

Note: three older migrations already share a version number (`20261013000000`, `20261104120000`,
`20261115000000`). This predates this work. If Supabase complains when applying, that is why.

## 2. Netlify environment variables (Site settings → Environment variables)

**The sign-in / token fix (fixes "Sign in to manage your projects")**

- [ ] `SUPABASE_JWT_SECRET`: the JWT secret from Supabase → Project settings → API. Scope: Functions. **This is the most important one.**
- [ ] Clerk keys used by the token function: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (or `VITE_CLERK_PUBLISHABLE_KEY`), and `CLERK_JWKS_URL` (or `CLERK_ISSUER`). Likely already set; confirm.
- [ ] `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`: existing; confirm.

**Push notifications (server)**

- [ ] Generate keys once: `node scripts/generate-vapid-keys.mjs`
- [ ] `VAPID_PUBLIC_KEY`: the public key
- [ ] `VAPID_PRIVATE_KEY`: the private key (server only, never commit)
- [ ] `VAPID_SUBJECT`: `mailto:you@yourdomain.com`
- [ ] `PUSH_DISPATCH_SECRET`: any long random string (must match step 4)

**Owner e-mail alerts (optional; Netlify, Functions scope; owner e-mails stay off without both)**

- [ ] `RESEND_API_KEY`: Resend API key (secret, server only, never commit)
- [ ] `ALERT_EMAIL_FROM`: sender on a domain verified in Resend, e.g. `SmartVideo Alerts <alerts@smartvid.app>`
- [ ] `CLERK_SECRET_KEY`: already required above; it is also used to look up the owner's primary verified e-mail address (Clerk Backend API)
- [ ] Optional: `APP_URL`: the site URL used for the "Open alerts" link (default `https://smartvid.app`)
- [ ] E-mails go out through the same database trigger as push, so the `pg_net` and `push_dispatch_config` steps in section 4 are needed too, and `VAPID_*` is not required for e-mail alone.

**Push notifications (build-time, exposed to the browser)**

- [ ] `VITE_VAPID_PUBLIC_KEY`: the same public key as `VAPID_PUBLIC_KEY`
- [ ] Optional: `VITE_TURNSTILE_SITE_KEY`: Cloudflare Turnstile site key (shows the spam widget on published lead forms)

Redeploy after setting these (build-time variables only apply on a new build).

## 3. Supabase edge function (`lead-capture`)

The lead function changed (Turnstile, email check, dedupe). **Redeploy it**: `supabase functions deploy lead-capture`.
Secrets (Supabase → Edge Functions → Secrets). All optional unless marked.

- [ ] `TURNSTILE_SECRET_KEY`: optional. When set, published forms must pass Cloudflare Turnstile.
- [ ] `LEAD_MX_CHECK`: optional. On by default; set to `off` to disable the email-domain check. Lookup failures never block a lead.
- [ ] `LEAD_EXTRA_DISPOSABLE_DOMAINS`: optional. Comma-separated extra throwaway domains.
- [ ] Already supported, set only if you use them: `RESEND_API_KEY` + `LEAD_EMAIL_FROM` (owner email alerts), `WEBHOOK_SIGNING_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY` (Kit / MailerLite keys), `LEAD_CAPTURE_ALLOWED_ORIGINS`.

## 4. Push notifications: database settings

- [ ] Supabase → Database → Extensions: enable **`pg_net`**. Without it the trigger silently does nothing.
- [ ] Insert the dispatch config row **once** (SQL editor, as admin). Use your real values:

```sql
insert into public.push_dispatch_config (id, url, secret)
values (1, 'https://YOUR-SITE.netlify.app/.netlify/functions/push-dispatch', 'THE-SAME-VALUE-AS-PUSH_DISPATCH_SECRET')
on conflict (id) do update set url = excluded.url, secret = excluded.secret;
```

- [ ] Realtime: the migration adds `owner_notifications` to the `supabase_realtime` publication. Confirm it under Database → Publications.

## 5. Verify (do these in the deployed app, signed in)

- [ ] Analytics tab: no "Sign in to manage your projects". If it fails, the message now names the cause (missing `SUPABASE_JWT_SECRET`, Clerk rejection, function not deployed).
- [ ] Publish a video. Leads tab shows the real table; Download CSV and Download Excel both work.
- [ ] Submit your own lead twice with the same email on the published page: the second is dropped (no second row or alert).
- [ ] Change a lead's status, add a tag and a note; reload; they persist.
- [ ] After a few plays: Analytics → Engagement shows form/button markers; Overview shows sources, devices and countries. Country needs Netlify to supply geo data. If the country card stays empty after plays, that is the cause.
- [ ] Notifications view → **Browser push notifications** → Enable on this device → "Send test notification".
- [ ] Turn on "Send me push notifications", submit a lead on the published page, and confirm a push arrives with the site closed.
- [ ] iPhone/iPad: add the site to the Home Screen first, or push is not available.
- [ ] E-mail (only if `RESEND_API_KEY` and `ALERT_EMAIL_FROM` are set): tick "Email alerts", save, submit a lead, and confirm an e-mail arrives at your account address. Check the `email` field of the `push-dispatch` function response or the `notification_email_queue` row if it does not.
- [ ] Quiet hours summary (only if migration 7 is applied): enable quiet hours covering the current time, submit a lead (no push), then wait until quiet hours end: one "While you were away" push arrives within about 15 minutes (function `push-quiet-flush`).

## 6. Known limits and risks

- Real push delivery, the `pg_net` call and Realtime were **not tested against live services**. The `net.http_post` call was written from memory; it is the most likely thing to need a small fix. Check Supabase logs and the Netlify function log if no push arrives.
- Quiet hours hold a push for one summary push when they end (migration 7 applied and "Send me one summary push" checked); otherwise the push is dropped. Real Resend delivery, the Clerk e-mail lookup and the 15-minute scheduled function were **not tested against live services**.
- Lead dedupe and disposable-email blocking: dedupe is forward-only; disposable blocking is an owner opt-in per form.
- Lead score uses only the lead's own answers and source, not watch time.
- No chart library was added (deliberate). The weekly digest, owner emails and Kit/MailerLite sync already existed and are unchanged.
