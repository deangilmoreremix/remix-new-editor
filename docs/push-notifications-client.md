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
5. Alert types are grouped by feature (New leads, Retarget, Video activity) and map onto `enabled_types`;
   `daily_digest` is preserved.

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
