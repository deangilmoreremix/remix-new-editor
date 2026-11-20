# Admin alert for custom domains

When an owner saves a custom domain in the Publish tab, the administrators get an e-mail. A domain only serves after
an administrator adds it to the hosting site and approves it, so this is the signal that something is waiting.

## How it works

```
 owner saves a domain  ->  set_custom_domain()  ->  video_owner_profiles.custom_domain changes
        |
        v   trigger video_owner_profiles_domain_alert (only when the domain changes to a non-null value)
 public.custom_domain_alerts  (one open row per domain; the durable record)
        |  best effort pg_net POST {alert_id}, header x-push-secret
        v
 Netlify function admin-domain-alert  ->  e-mail to ADMIN_ALERT_EMAIL  ->  row gets sent_at

 domain-alert-sweep (every 15 min) re-sends any row that is still unsent (older than 2 minutes, fewer than 8 tries)
```

- The call from the database is fire and forget, so the sweep is what guarantees the e-mail goes out.
- The e-mail names the domain, the business, the owner's verified address (when it can be looked up) and the exact
  SQL to approve or refuse the request. The function re-reads those from the database; the request body is only an id.
- Saving the same domain again does not send a second e-mail. Changing it before the alert went out replaces it.
- A domain that was changed again, removed or already approved when the alert is processed is marked done without an
  e-mail.

## Setup (once)

1. Netlify environment variables (Site settings, Environment variables):
   - `ADMIN_ALERT_EMAIL` - the addresses to notify, separated by commas, for example `ops@example.com, dev@example.com`
     (at most 10; invalid entries are ignored).
   - Already used by the owner alerts and required here too: `RESEND_API_KEY`, `ALERT_EMAIL_FROM`,
     `PUSH_DISPATCH_SECRET`, `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`. `CLERK_SECRET_KEY`
     is optional (it adds the owner's address to the e-mail).
2. Tell the database where to call (same secret as push-dispatch):

   ```sql
   update public.push_dispatch_config
      set admin_alert_url = 'https://smartvid.app/.netlify/functions/admin-domain-alert'
    where id = 1;
   ```

   Without this the sweep still delivers within about 15 minutes.

If `ADMIN_ALERT_EMAIL` or the e-mail provider is missing, alerts stay unsent (no attempts are used up) and go out once it
is set.

## Approving or refusing a domain

1. Confirm the owner controls the domain.
2. Netlify: site `smartvideo2`, Domain management, add the domain as an alias and set the DNS records it shows.
3. Approve, in the Supabase SQL editor:

   ```sql
   update public.video_owner_profiles set custom_domain_verified = true where custom_domain = 'videos.example.com';
   ```

   Or refuse:

   ```sql
   update public.video_owner_profiles set custom_domain = null where custom_domain = 'videos.example.com';
   ```

## Checking on it

```sql
-- alerts still waiting, and why
select id, domain, attempts, last_error, requested_at from public.custom_domain_alerts where sent_at is null;
```

`attempts` stops at 8. To retry one after fixing the cause: `update public.custom_domain_alerts set attempts = 0 where id = <id>;`.

## Files

- `supabase/migrations/20261120120000_custom_domain_admin_alert.sql` - table, config column, trigger
- `netlify/functions/_shared/domainAlert.js` - recipients, e-mail, send and retry logic
- `netlify/functions/admin-domain-alert.js` - called by the database
- `netlify/functions/domain-alert-sweep.mjs` - scheduled retry
