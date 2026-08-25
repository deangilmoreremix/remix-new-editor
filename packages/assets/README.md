# @remix/assets

Asset discovery (logo, brand colors, avatar, screenshot) and storage for
the personalizer platform. Takes the raw outputs from the discovery
providers (Maigret scan result, GitHub user, crawled website HTML) and
produces a deduplicated set of stable asset URLs backed by Supabase
storage.

## Quickstart

```ts
import { discoverAssets, mergeIntoProfileAssets } from '@remix/assets';

const result = await discoverAssets({
  contactId: 'abc-123',
  userId: 'user-xyz',
  websiteUrl: 'https://acme.com',
  websiteHtml: crawledHtml,
  maigret: { platforms: maigretScan.platforms },
  github: { avatar_url: ghUser.avatar_url, html_url: ghUser.html_url },
  contact: { avatarUrl: manualContact.avatarUrl },
  options: { uploadToStorage: true, timeoutMs: 10000 },
});

// result.assets map shape ready to merge into ContactProfile.assets
const assets = mergeIntoProfileAssets(existingProfile.assets, result);
// result.brandColors: { primary, secondary, accent }
```

## Extractors

| Module | What it does | Inputs | Output |
| ------ | ------------ | ------ | ------ |
| `extractors/logo` | Detect logo URL from website HTML | `html`, `baseUrl` | `{ url, candidates }` |
| `extractors/colors` | Extract brand colors from CSS | `html` | `{ primary, secondary, accent, allColors[] }` |
| `extractors/avatar` | Pick best avatar from Maigret/GitHub/manual | `maigretAvatars`, `githubAvatarUrl`, `contactAvatarUrl` | `DiscoveredAsset[]` |
| `extractors/screenshot` | OG image or screenshot API call | `url`, `html`, `apiUrl?` | `DiscoveredAsset?` |

## Storage

If Supabase is configured (via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
+ `ASSETS_BUCKET`), discovered assets are downloaded from their source
URL and re-uploaded to the bucket. This makes the URLs stable — source
URLs on third-party sites can disappear, but the Supabase URLs persist
as long as the bucket is intact.

Bucket layout:

```
contact-assets/
  contacts/
    {userId}/
      {contactId}/
        logos/{filename}
        avatars/{filename}
        screenshots/{filename}
```

Set `uploadToStorage: false` in the options to skip the upload and just
return source URLs (faster, useful for preview UI).

## Configuration

| Env var | Default | Required? |
| ------- | ------- | --------- |
| `SUPABASE_URL` | — | for storage |
| `SUPABASE_SERVICE_ROLE_KEY` | — | for storage |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | — | browser fallback (only for dev) |
| `ASSETS_BUCKET` | `contact-assets` | no |
| `SCREENSHOT_API_URL` | — | for true page screenshots |
| `SCREENSHOT_API_KEY` | — | for true page screenshots |

## Screenshots

True rendered-page screenshots require a headless browser. Point
`SCREENSHOT_API_URL` at any service that accepts a `POST` with
`{ url, width, height }` and returns `{ url: "https://..." }`. We
recommend a small Playwright service you deploy alongside this code
(same pattern as `services/maigret-worker/`), or a hosted service like
[screenshotmachine.com](https://screenshotmachine.com).

If neither is configured, the orchestrator falls back to the page's
`og:image` meta tag — which is usually a high-quality marketing image
anyway.

## Security

- The Supabase service key is only used in server-side code (Netlify
  functions, the build profile orchestrator). Never expose it to the
  browser.
- Asset downloads enforce a default 5 MB cap and 10s timeout. Tune via
  `options.maxBytes` and `options.timeoutMs`.
- Source URLs are NOT executed or rendered — we only fetch them as
  binary blobs and re-upload.
