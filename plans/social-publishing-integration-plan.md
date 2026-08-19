# Social Publishing for Image & Video Studios — Integration Plan

**Goal:** Let users publish the media they generate in *any* image or video studio
directly to **YouTube, TikTok, and Instagram** using the muapi Social Publishing API
(https://muapi.ai/docs/social-publishing), via a single reusable modal.

This plan covers the design, the code that has already been implemented in this branch,
and the rollout to every studio.

---

## 1. How muapi Social Publishing works (the API contract)

All calls go through the **existing** `muapi-proxy` Supabase Edge Function, which attaches
the server's `MUAPI_API_KEY` — the browser never sees a muapi key.

| Step | Endpoint | Method | Notes |
|------|----------|--------|-------|
| Connect account | `POST /api/v1/social/{youtube\|tiktok\|instagram\|facebook}/connect-url` | POST | Body: `{ external_user_id, redirect_to }` → returns OAuth `url` |
| List accounts | `GET /api/v1/social/ext/accounts?external_user_id=<id>` | GET | Returns array; `id` is the `account_id` to publish with |
| Publish (YT) | `POST /api/v1/youtube-publish` | POST | `account_id`, `media_url`, `title`(≤100), `description`, `tags[]`, `privacy`, `category_id` |
| Publish (TikTok) | `POST /api/v1/tiktok-publish` | POST | `account_id`, `media_url`, `title`(≤150), `privacy_level`, `disable_*` |
| Publish (IG) | `POST /api/v1/instagram-publish` | POST | `account_id`, `media_url`, `caption`, `media_type` IMAGE\|VIDEO, `placement`, `share_to_feed`, `cover_url`/`thumb_offset` |
| Poll result | `GET /api/v1/predictions/{request_id}/result` | GET | `status`: processing → completed |

- **Cost:** $0.01 per successful publish (billed to the app's muapi account).
- **Media requirement:** `media_url` must be a **publicly reachable URL**. Studios must
  hand the generated asset's CDN/storage URL to the modal (or the user pastes one).
- **Platform fit:** YouTube & TikTok are **video only**. Instagram accepts **both** image
  (feed) and video (Reel). The modal enforces this by disabling incompatible platforms.

---

## 2. Architecture delivered in this branch

```
Studio (image/video)
   │  openSocialPublish({ mediaUrl, mediaType, ... })        src/lib/socialPublishHelpers.js
   ▼
ModalContainer  ──(window.openModal)──▶  SocialPublishModal   components/modals/SocialPublishModal.jsx
                                            │  (connect / list / publish / poll)
                                            ▼
                                       socialPublishing service   src/lib/socialPublishing.js
                                            │  muapi.proxyJson(...)
                                            ▼
                                       muapi-proxy  (Supabase Edge Fn)  ──▶ api.muapi.ai
```

### Files added / changed

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/socialPublishing.js` | **NEW** | `getConnectUrl`, `listAccounts`, `disconnectAccount`, `publish`, `getResult`, `publishAndPoll`, platform/category configs, `external_user_id` resolution. |
| `components/modals/SocialPublishModal.jsx` | **NEW** | The reusable publish modal (connect → pick account → fill fields → publish + poll). Self-contained, inline dark-theme styles. |
| `src/lib/muapi.js` | **EDIT** | Added `proxyJson(endpoint, { method, params, generationType })` — generic proxy passthrough. |
| `supabase/functions/muapi-proxy/index.ts` | **EDIT** | `validateEndpoint` now allows a trailing `?query` so `external_user_id` is forwarded on GET list calls. |
| `lib/constants/modals.js` | **EDIT** | Registered `SOCIAL_PUBLISH_MODAL = 'social-publish'` (lazy `SocialPublishModal`, `maxWidth: 'md'`). |
| `src/lib/socialPublishHelpers.js` | **NEW** | `openSocialPublish(options)` → `window.openModal(SOCIAL_PUBLISH_MODAL, options)`. |
| `components/common/PublishToSocialButton.jsx` | **NEW** | Drop-in button any studio can render. |
| `src/components/TimelineEditorPage.jsx` | **EDIT** | Reference wiring: the existing `social` action now opens `SocialPublishModal` with the studio's `state.lastGeneratedVideo.src`. |

### Why a new modal (not reusing `SocialPublisherModal`)
`SocialPublisherModal` is the legacy iframe-based **marketing campaign** tool
(email / Facebook / LinkedIn). Social Publishing is a different concern (direct publish of
a generated asset). Keeping them separate avoids coupling and lets the new modal be a plain
React component with full control over the muapi flow.

---

## 3. Opening the modal from any studio (the one-liner)

```js
import { openSocialPublish } from '../../lib/socialPublishHelpers';

// From a button handler in any studio:
openSocialPublish({
  mediaUrl: generatedAssetUrl,   // public URL of the image/video you just made
  mediaType: 'video',            // or 'image' — inferred from URL if omitted
  title: 'My AI clip',           // optional, prefilled into the form
  description: '...',
  tags: ['ai', 'muapi'],
  externalUserId,                // optional; resolved from session if omitted
  onPublished: ({ platform, url }) => console.log('published', platform, url),
});
```

Or drop the button in JSX:

```jsx
import PublishToSocialButton from '../common/PublishToSocialButton';

<PublishToSocialButton mediaUrl={assetUrl} mediaType="image" />
```

---

## 4. Rollout to all image & video studios

Apply the same pattern. For each studio, pass the **public URL of the generated asset**
and its type. Studios that already expose a "Share / Export / Download" affordance should
add `PublishToSocialButton` next to it.

| Studio (component) | Type | `mediaUrl` source | Status |
|--------------------|------|-------------------|--------|
| `TimelineEditorPage.jsx` | Video | `state.lastGeneratedVideo.src` | ✅ Wired (reference) |
| `VideoToolsStudio.js` | Video | `result.url` from `processVideoTool` (captured in `lastOutputUrl`) | ✅ Wired |
| `EditStudio.js` | Image | `result.url` from `generateI2I` (`lastOutputUrl`) | ✅ Wired |
| `UpscaleStudio.js` | Image | `result.url` from `generateI2I` (`lastOutputUrl`) | ✅ Wired |
| `EffectsStudio.js` | Image/Video | `result.url` from `generateI2I`/`generateI2V` (`lastOutputUrl`, `lastMediaType`) | ✅ Wired |
| `StoryboardStudio.js` | Image | `frame.imageUrl` (per-frame) | ✅ Wired |
| `ImageToVideoPage.jsx` | — | n/a — landing/nav page, no generation | ⏭️ Excluded |
| `CharacterPage.js` / `CinemaPage.js` | — | n/a — landing/nav pages | ⏭️ Excluded |
| `CinemaTemplateStudio.js` | — | n/a — builds a render handoff only; no media produced | ⏭️ Excluded |
| `ChatStudio.js` / `AssistPage.js` | — | n/a — text/prompt tools, no media | ⏭️ Excluded |
| `ai-storyboard/AIStoryboardStudio.jsx` | — | stub (returns null) | ⏭️ Excluded |

> **Correction to original scope:** the original table listed 11 studios, but only the
> 6 above actually generate publishable media. The rest are landing/navigation or
> text/prompt pages (`ImageToVideoPage`, `CharacterPage`, `CinemaPage`,
> `CinemaTemplateStudio`, `ChatStudio`, `AssistPage`) — they have no generated asset
> URL to publish, so they were excluded. All generator studios are **imperative DOM
> components**, so wiring uses the imperative `openSocialPublish({ mediaUrl, mediaType })`
> call (same pattern as the TimelineEditor reference) rather than dropping the React
> `<PublishToSocialButton>` into `innerHTML`.

> **Note on `external_user_id`:** now wired in `src/components/auth/HeaderAuth.jsx`
> (the signed-in branch calls `setExternalUserId(user.id)`), so connected accounts are
> isolated per Clerk user. The localStorage fallback remains only for signed-out use.

---

## 5. User flow (what the modal does)

1. **Media** — prefilled/editable public URL + image/video toggle.
2. **Connect** — "Connect YouTube / TikTok / Instagram" opens the muapi OAuth popup
   (`redirect_to` = current studio URL). The modal polls the account list every 2.5 s until
   the popup closes, then refreshes.
3. **Select destination** — radio list of connected accounts; incompatible platforms are
   greyed out for the chosen media type. Disconnect available per account.
4. **Details** — platform-specific fields (YouTube title/description/tags/privacy/category;
   TikTok title/privacy/toggles; Instagram caption/media_type/placement/cover).
5. **Publish** — `publishAndPoll` submits, then polls `predictions/{id}/result` every 2 s,
   showing live status, and finally surfaces the platform post URL with an "Open" link.

---

## 6. `external_user_id` / auth wiring — ✅ Implemented

muapi stores each OAuth token against *our* `external_user_id`. To map it to the real app
user, `src/components/auth/HeaderAuth.jsx` calls `setExternalUserId(user.id)` in the
signed-in branch (added this pass). Wiring is complete; the localStorage fallback only
applies to signed-out visitors.

```js
// in src/components/auth/ClerkAuth.jsx (or HeaderAuth.jsx), inside the signed-in branch:
import { setExternalUserId } from '../../lib/socialPublishing';
useEffect(() => { if (isSignedIn && user) setExternalUserId(user.id); }, [isSignedIn, user]);
```

Until then the localStorage fallback keeps the feature fully functional for a single browser.

---

## 7. Error handling & edge cases

- **Non-public `media_url`** → muapi fails; modal shows the error and keeps the form open.
- **Account disconnected** (`connected: false`) → list shows it; publishing returns 409 —
  modal prompts to reconnect.
- **No accounts** → connect CTA is front and center.
- **Popup blocked** → falls back to a new tab.
- **Publish timeout** (>~3 min) → friendly message; the post usually still completes on the
  platform — user can re-check.
- **`MUAPI_API_KEY` missing on the proxy** → proxy returns 500 with a clear message.

---

## 8. Testing

- **Unit:** `socialPublishing.js` with a mocked `muapi.proxyJson` (connect/list/publish/
  poll happy path + failure + timeout).
- **Proxy:** deploy `muapi-proxy`, `curl` `social/ext/accounts?external_user_id=test` to
  confirm the query string reaches muapi (regression for the `validateEndpoint` change).
- **Manual:** in a studio, generate media → Publish to Social → connect a test YouTube →
  publish → confirm the returned `url` opens the live video.
- **Visual:** modal renders in dark theme, scrolls within the 88 vh container, responsive
  down to the `md` (960 px) width.

---

## 9. Out of scope / future

- **Facebook publishing** — connect-url exists; publish params are not documented, so it is
  left as connect-only for now.
- **Scheduling / queues, analytics, multi-clip carousels** — not in the muapi MVP surface.
- **Permanent account delete** (`DELETE`) — only the reversible disconnect is wired.
- **Webhook completion** instead of polling — muapi supports a `webhook` query param; can
  replace the poll loop later.
