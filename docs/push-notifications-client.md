# Push notifications: browser side

Owners get owner alerts (`public.owner_notifications`) in two ways: real Web Push (works when the site is closed) and
live in-app updates through Supabase Realtime. The server half (table, `push-dispatch` function, VAPID private key)
is documented separately; this page covers what runs in the browser.

## How "Enable" works

1. Open Timeline Editor, Analytics, Notifications. The **Browser push notifications** card sits under Preferences.
2. **Enable on this device** (a click, never on page load) asks the browser for permission, calls
   `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` and stores the subscription in
   `public.owner_push_subscriptions` (delete-then-insert on the endpoint, there is no UPDATE policy). It also switches on
   `retarget_preferences.push`.
3. **Send test notification** shows a local notification through the service worker, so you can check OS and browser
   settings without the server.
4. **Disable on this device** deletes the row and unsubscribes the browser. The "Send me push notifications" checkbox
   (`retarget_preferences.push`) is the account-wide opt-in; the per-device button is separate.
5. Alert types are grouped by feature (New leads, Retarget, Video activity). Each type row has an **Alert** checkbox
   (`enabled_types`: the alert exists and always shows in the app) and a **Push** checkbox (`push_types`: it also sends a
   push). Group headers have a master for each, with an indeterminate state. Unchecking Alert unchecks and disables Push;
   Push is also disabled while "Send me push notifications" is off or push is not set up on the site/browser.
   `daily_digest` has only Alert (it never pushes) and is preserved.
6. `push_types` semantics: `NULL` (legacy rows, or the column not migrated yet) shows Push checked for every enabled type;
   saving always writes an explicit array. If the database does not have the column yet (optional migration
   `20261119090000_push_types.sql`; PostgREST `PGRST204` / `42703` / an error naming `push_types`), the save is retried
   without it and the form says per-type push choices need a database update; everything else is still saved.
7. **Quiet hours** card in Preferences: "Enable quiet hours", From / Until (defaults 22:00 and 07:00 when first enabled) and a
   time zone (defaults to the browser's; all supported zones when `Intl.supportedValuesOf` exists, else a short list plus
   the browser zone). Stored as `quiet_hours = {start, end, timeZone, utcOffsetMinutes, summary}`; unchecking stores `null`.
   Invalid times are rejected; From equal to Until means off (an inline hint says so). The checkbox "Send me one summary
   push when quiet hours end" (default checked; enabled only while quiet hours are on) is stored as `quiet_hours.summary`
   (boolean; rows without the key read as checked, see `quietHours.js`). The helper text under the card follows it: checked,
   "During quiet hours push notifications are held and sent as one summary when quiet hours end. Alerts still appear in the
   app right away."; unchecked, the pushes are not sent and no summary follows. Alerts always appear in the app.
8. **Email alerts** checkbox (saves `retarget_preferences.email`; it was disabled and always saved `false` before). The helper
   text is neutral because the browser cannot know whether the site has an e-mail provider: "Email alerts go to the address on
   your account. Pushes and email follow the same quiet hours." Nothing in the UI claims an e-mail was sent. See
   `docs/push-notifications.md` for how e-mail is delivered.

Clicking a notification focuses an open tab (service worker posts `remix:open-alerts`) or opens `/?alerts=1#/timeline`;
the page then does what the header bell does (sets `remix_open_projects` / dispatches `remix:open-projects`).

## Configuration

- `VITE_VAPID_PUBLIC_KEY` (base64url VAPID public key, build time). If unset the card says "Push notifications aren't set
  up on this site yet" and shows no controls.
- The service worker `/sw.js` is registered only in production builds (`src/main.js`), so push cannot be enabled on
  `npm run dev`; the card says "Push works on the deployed site".

## Browser support

- Chrome, Edge, Firefox, Safari 16+ on macOS and Android Chrome: supported.
- **iPhone / iPad (iOS 16.4+): the site must be added to the Home Screen first** (Share, Add to Home Screen) and opened from
  there; in a normal Safari tab the card explains this.
- Push requires HTTPS (localhost counts as secure).
- If the user denies permission the browser will not ask again: re-enable via the site settings (lock icon), then reload.

## Live updates (Realtime)

The header bell subscribes to `INSERT` on `owner_notifications` filtered by `clerk_user_id`, authenticating the Realtime
socket with the same minted Supabase token as REST calls. A new row bumps the badge and, only while the tab is visible,
shows a small toast; hidden tabs rely on push. It re-subscribes when the token refreshes, closes on sign-out and falls
back silently to the existing 3-minute polling if Realtime is unavailable.

## Testing locally

- Unit tests: `npx vitest run src/lib/push src/lib/__tests__/notificationsBell src/lib/editor/projectLibrary`.
  The service worker logic is tested by evaluating the code between the `<push-logic>` markers in `public/sw.js`.
- Manual: `npm run build && npx vite preview` (or a Netlify deploy preview) with `VITE_VAPID_PUBLIC_KEY` set, sign in,
  enable push, use **Send test notification**. Real delivery needs the server function deployed.
