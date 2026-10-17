# MuAPI Upload Architecture

Single shared adapter for every MuAPI file upload in OpenMontage, the
persistent-storage handoff for saved assets, and the browser/edge transport
topology. This document records the **verified** infrastructure limits that
drive the design and the explicit decision that media bytes must never transit
a Netlify serverless function.

## The ONE shared adapter — `src/lib/muapiUpload.js`

Every MuAPI upload (image, video, audio, "other", and re-uploads of saved Asset
Library assets) goes through `src/lib/muapiUpload.js`. There is deliberately no
second MuAPI upload implementation. The legacy upload code in `src/lib/muapi.js`
(`uploadFile`) and root `lib/muapi.js` (`uploadFile`) now **delegate** to this
module, and the upload pipeline (`src/lib/editor/upload.js`,
`src/lib/editor/uploadPipeline.js`) reaches it transitively via
`muapi.uploadFile`.

Public surface (relied on by the editor/UI and tests):

- `MUAPI_UPLOAD_URL` = `https://api.muapi.ai/api/v1/upload_file`
- `MuapiUploadError` — `{ code, retryable, userMessage, status }`
- `validateMuAPIUpload(file)` — magic-byte + size validation
- `handleMuAPIUploadError(error)` — normalizes any failure to
  `{ code, message, retryable, userMessage }`
- `uploadImageToMuAPI(file, authContext, options?)`
- `uploadVideoToMuAPI(file, authContext, options?)`
- `uploadFileToMuapi(file, authContext, options?)` (generic audio/other)
- `resolveMuAPIMediaInput(assetId, authContext, options?)`
- `getCachedMuapiUpload(assetId, authContext)` / `clearMuapiUploadCache()`

### MuAPI File Upload API (official, only)

```
POST https://api.muapi.ai/api/v1/upload_file
header: x-api-key: <the user's own BYOK key>
body:   multipart/form-data  field name = file
-> JSON: { url }   (accepted from result.url or result.data.url)
```

The HTTP client generates the multipart boundary — the code always hands a
`FormData` with a `file` field and never sets a `Content-Type` boundary by
hand. Uploads cost **zero credits** but require a positive MuAPI credit balance.

### BYOK + key hygiene

The MuAPI key is the user's own, held client-side (`src/lib/apiKeyManager.js`
`getMuapiKey()`, or `authContext.muapiKey`). It is:

- **never logged** (the Supabase proxy hashes it for rate-limiting only and
  runs every upstream error body through `redactSecrets()` before `console`),
- **never persisted** to the database,
- **never returned** in responses or error messages — `handleMuAPIUploadError`
  builds `message`/`userMessage` exclusively from fixed templates so a key that
  leaks into a raw error string cannot survive normalization.

A missing key produces `MUAPI_KEY_MISSING` with the UI-safe message
"Add your MuAPI API key in Settings to upload files."

### Transport selection

| File size            | Runtime            | Destination |
| -------------------- | ------------------ | ----------- |
| <= 8 MB (`SUPABASE_PROXY_BODY_LIMIT_BYTES`) | browser | Supabase edge proxy `/functions/v1/muapi-proxy` (multipart, `x-api-key` + `x-endpoint: upload_file`) |
| > 8 MB               | browser            | **direct** browser → MuAPI (multipart, `x-api-key`) |
| <= 8 MB              | non-browser, no `VITE_SUPABASE_URL` (e.g. node integration tests) | **direct** browser → MuAPI (only the BYOK key is required) |

Small files use the Supabase edge proxy so the key is still only handled in the
user's own session; large files bypass it because Supabase Edge Functions cap
the request body (~8 MB headroom for a 50 MB video would silently fail).

### Bounded retries, timeouts, abort

- Max **3 attempts**, exponential backoff **1s / 2s / 4s**.
- Only **network errors** and **502 / 503 / 429** are retried. `400/401/402/
  403/413/415/422` never retry.
- Per-attempt timeout: **30s** small (proxy) / **120s** large (direct).
- `AbortSignal` honored at every attempt; cancellation throws
  `MUAPI_CANCELLED`.
- A 200 body with no parsable `url` is `MUAPI_INVALID_RESPONSE` and is **never**
  treated as success.

### Presigned-URL lifetime + upload cache

MuAPI presigned URLs expire after **1 hour**. MuAPI URLs are treated as
temporary and are **never** persisted as an Asset Library identifier. The
module keeps a session-memory `Map` upload cache keyed
`${workspaceId}:${assetId}` storing `{ url, uploadedAt, expiresAt }` where
`expiresAt = uploadedAt + 60 min`. A cached URL is reused only while
`now < expiresAt - 5 min` (a safety margin that guarantees re-upload before
expiry). The cache is **never** written to `localStorage`.

## Flow diagrams

### Fresh upload (image / video / audio)

```
   browser (user's BYOK MuAPI key, held in apiKeyManager)
      │
      │ uploadImageToMuAPI / uploadVideoToMuAPI / uploadFileToMuapi
      ▼
   src/lib/muapiUpload.js
      ├─ validateMuAPIUpload()  (magic bytes + 10/50/10 MB limits)
      └─ transportUpload()
            size <= 8MB ─────────────────────────────────┐
                                                          ▼
                    POST multipart{file}                api.muapi.ai
                    x-api-key + x-endpoint: upload_file /api/v1/upload_file
                          │                                     ▲
                          ▼                                     │
               supabase/functions/muapi-proxy                    │
                 (streams multipart to MuAPI with                │
                  the user-supplied x-api-key;                   │
                  never logs the key)                            │
                          │                                     │
            size > 8MB ───┴──── direct browser ─MusAPI───────────┘
                                                          ▼
                                        parse JSON { url }  (5 min safety margin)
                                          ↳ presigned temp URL (1h)
```

### Saved Asset Library asset → fresh MuAPI URL (`resolveMuAPIMediaInput`)

```
   resolveMuAPIMediaInput(assetId, authContext)
      │
      ├─ cache hit & now < expiresAt - 5min  ──►  return { source:'cache', url }
      │
      └─ cache miss / expiring:
            import('./assetLibrary.js')
              resolvePermanentMediaReference(assetId) ──► { url, path, name, mime, ... }
              (permanent Supabase Storage reference — NEVER a MuAPI temp URL)
            fetch(ref.url)  ── download durable original bytes (browser)
            transportUpload(same proxy/direct routing)
              ↳ fresh presigned MuAPI URL   →   cache it, return { source:'asset', url }
```

## Netlify infrastructure limits — VERIFIED

Verified against the current Netlify Functions documentation
(`https://docs.netlify.com/build/functions/configuration`) on the date of this
document:

| Limit                                                   | Value |
| ------------------------------------------------------- | ----- |
| Synchronous function execution limit                    | **60 seconds** |
| Synchronous buffered **request** payload                | **6 MB** |
| Synchronous buffered **response** payload               | **6 MB** |
| Bytecode/streamed response payload                      | 20 MB (HTTP 429 if exceeded) |
| Background function request/response payload           | 256 KB |

Critically, Netlify documents that **requests with binary payloads (such as
image uploads) are Base64-encoded, adding ~30% overhead — effectively reducing
the binary request payload limit to ~4.5 MB.**

### Explicit infrastructure blocker

> **A 50 MB video cannot pass through a Netlify synchronous function.** The sync
> request payload limit is **6 MB**, effectively **~4.5 MB** for binary data
> after Base64 encoding — a 50 MB video exceeds it by ~11x (and a 10 MB image
> already exceeds it). The synchronous execution limit of **60 seconds** is a
> second ceiling for large multipart relays.

Therefore **no Netlify function relays media bytes.** The compatible secure flow
is fully browser-mediated, as shown in the diagrams above:

1. **Small files** (<= 8 MB) → the existing **Supabase edge proxy**
   (`supabase/functions/muapi-proxy`), which streams multipart to MuAPI with the
   user-supplied `x-api-key` (magic-byte size enforcement, rate limiting, and
   endpoint validation preserved).
2. **Large files** (> 8 MB) → **direct browser → MuAPI** with the user's own
   BYOK key. No server credential is exposed because the key belongs to the
   user's own browser session.
3. **Saved assets** → the browser **refetches the durable Supabase-Storage
   original** and re-uploads it to MuAPI through the same adapter
   (`resolveMuAPIMediaInput`). The Supabase proxy additionally supports an
   optional, strictly-host-allowlisted JSON `source_url` re-upload mode for
   cases where the browser itself cannot fetch the bytes.

The existing Netlify functions (`cinegenProviders.js` and the API proxies) are
unchanged; they handle JSON metadata, not media bytes.

## Supabase proxy hardening (`supabase/functions/muapi-proxy/index.ts`)

- The `upload_file` multipart path and the JSON re-upload path run every
  upstream error body through `redactSecrets(errorText, effectiveApiKey)` before
  logging, so the user's key can never reach function logs.
- Optional JSON `{ endpoint: "upload_file", source_url }` mode lets the proxy
  fetch a durable original and forward it to MuAPI **only** when `source_url` is
  on the app's own Supabase Storage host (`SUPABASE_URL`, https, exact hostname
  match). There is no wildcard and no redirect following — **no open SSRF**.
  Disabled when `SUPABASE_URL` is unset.

## Tests

- `src/lib/editor/__tests__/muapiUpload.test.js` — vitest/jsdom; mocked
  `fetch`; covers validation, proxy-vs-direct routing, retry policy, error
  mapping, key-redaction, and the `resolveMuAPIMediaInput` cache behaviour
  (with `vi.mock` on the `assetLibrary.js` seam).
- `tests/integration/muapi-upload.integration.test.mjs` — **real** provider
  integration, env-gated on `MUAPI_TEST_API_KEY` / `MUAPI_API_KEY`; prints an
  explicit SKIP notice and exits 0 when unset, otherwise uploads a real PNG /
  JPEG / MP4, checks reachability, runs one real generation from an uploaded
  image URL, and asserts client-side size rejection. Never mocks the provider.
