# MuAPI Placeholder/Demo Content Detection — Test Suite

This directory contains tests to verify that the standardized fix for
placeholder/demo content detection is working correctly across all
MuAPI model types.

## Files

| File | Purpose |
|------|---------|
| `test-output-integrity.mjs` | Pure-JS helper unit tests (no network) |
| `test-live-proxy-outputs.mjs` | Live proxy smoke test (requires `MUAPI_KEY`) |
| `test-regression-placeholder-block.mjs` | Regression test entry point |

---

## 1. Helper Unit Tests (offline, no network)

```bash
node tests/unit/test-output-integrity.mjs
```

**Expected output:**
```
=== Output Integrity Helper Tests ===

isStaticPlaceholderUrl:
  PASS: detects homepage asset
  PASS: detects sandbox asset
  ...
  PASS: is case-insensitive

extractOutputUrls:
  PASS: extracts outputs array
  ...
  PASS: returns empty array when no URLs

validateOutputIntegrity:
  PASS: ok:true for real URL
  PASS: ok:false for homepage asset
  PASS: ok:false for empty outputs
  PASS: still flags static URLs even when processing

=== Helper Tests: 21 passed, 0 failed ===
```

**Acceptance:** 21/21 tests pass.

---

## 2. Live Proxy Test (requires deployed proxy with fix)

```bash
MUAPI_KEY=your-key node tests/unit/test-live-proxy-outputs.mjs
```

Or use the project test key:
```bash
node tests/unit/test-live-proxy-outputs.mjs
```

**Expected output AFTER fix is deployed:**
```
=== Test 1: Static/demo output blocking ===
  [ImageStudio] flux-dev-image: OK real content (3627ms)
  [ImageStudio] flux-schnell-image: OK real content (3313ms)
  [AudioStudio] suno-create-music: OK real content (3192ms)
  [VideoStudio] wan2.5-image-to-video: OK real content (3183ms)

Test 1 Results: 4 real, 0 blocked, 0 failed

=== Test 2: Output uniqueness ===
  Prompt: "a red apple" -> https://cdn.muapi.ai/outputs/generated/unique-id-123.png
  Prompt: "a blue elephant on the moon" -> https://cdn.muapi.ai/outputs/generated/unique-id-456.png
  Prompt: "a cyberpunk city at sunset" -> https://cdn.muapi.ai/outputs/generated/unique-id-789.png

Uniqueness: 3 unique out of 3
All identical: false
Contains static: false

=== Test 3: Valid dimensions (multiples of 64) ===
  256x256: 200 (418ms) OK
  512x512: 200 (433ms) OK
  640x384: 200 (347ms) OK
  768x768: 200 (389ms) OK
  1024x1024: 200 (389ms) OK

Test 3 Results: 5 passed, 0 failed

=== Overall Acceptance ===
  PASS: No static/demo outputs returned
  PASS: All submissions return request_id
  PASS: Outputs are unique per prompt
  PASS: No static URLs in outputs
  PASS: All valid dimensions accepted

Final: ALL ACCEPTED
```

**Current behavior BEFORE fix is deployed:**
```
=== Overall Acceptance ===
  FAIL: No static/demo outputs returned
  PASS: All submissions return request_id
  FAIL: Outputs are unique per prompt
  FAIL: No static URLs in outputs
  PASS: All valid dimensions accepted

Final: SOME CHECKS FAILED
```

**Acceptance criteria:**
- Test 1: **0** static/demo outputs blocked, **4** real outputs returned
- Test 2: **3** unique URLs out of 3, `All identical: false`, `Contains static: false`
- Test 3: **5/5** dimensions accepted with HTTP 200
- Overall: `Final: ALL ACCEPTED`

---

## 3. Vitest Unit Tests (existing)

```bash
npx vitest run src/test/muapi-fixes.test.js
```

**Expected output:**
```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

Key tests:
- `detects static homepage asset in outputs` — client-side blocks static URLs
- `detects static webassets path in video url` — client-side blocks `/webassets/`
- `allows real unique generation URLs` — real URLs pass through
- `allows processing status without outputs` — no false positives during polling
- `detects sandbox path in direct-return generateText` — direct endpoints also validated

---

## 4. Proxy Deployment Verification

After deploying the proxy (`supabase functions deploy muapi-proxy`), verify:

```bash
# 1. Proxy health
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "https://bzxohkrxcwodllketcpz.supabase.co/functions/v1/muapi-proxy/health"

# 2. Submit a test request and check response
curl -s -X POST \
  "https://bzxohkrxcwodllketcpz.supabase.co/functions/v1/muapi-proxy" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_ROLE" \
  -H "x-api-key: $MUAPI_KEY" \
  -d '{
    "endpoint": "flux-dev-image",
    "params": {"prompt": "test", "model": "flux-dev", "width": 256, "height": 256},
    "generationType": "image",
    "studioType": "image"
  }' | jq .

# 3. Poll for result and verify output URL
# Replace REQUEST_ID with the returned request_id
curl -s -X POST \
  "https://bzxohkrxcwodllketcpz.supabase.co/functions/v1/muapi-proxy" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_ROLE" \
  -H "x-api-key: $MUAPI_KEY" \
  -d '{
    "endpoint": "predictions/REQUEST_ID/result",
    "params": {},
    "generationType": "poll"
  }' | jq .
```

**Expected after fix:**
- If upstream returns static content: HTTP 422 with `error: "static_placeholder_detected"`
- If upstream returns real content: HTTP 200 with `outputs` containing non-static URLs

---

## 5. Quick Smoke Test (all-in-one)

```bash
# Run all offline + live tests
node tests/unit/test-output-integrity.mjs && \
node tests/unit/test-live-proxy-outputs.mjs
```

**Exit codes:**
- `0` — All tests passed, fix is working
- `1` — Some tests failed, review output above

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| All helper tests fail | Code regression in integrity helpers | Check `supabase/functions/muapi-proxy/index.ts` and `src/lib/muapi.js` |
| Live test still shows static URLs | Proxy not deployed yet | Run `supabase functions deploy muapi-proxy` |
| Live test shows 422 for all requests | Proxy deployed but upstream still returning static | Contact MuAPI support; verify key is not sandbox |
| Unique URLs are still identical | Upstream returning cached/demo content regardless of prompt | Same as above — upstream issue |
| Valid dimensions start failing | Proxy validation too strict | Review `validateEndpoint()` in proxy |

---

## Contact

If the proxy is deployed and still returning static content, gather:
1. Output of `node tests/unit/test-live-proxy-outputs.mjs`
2. Proxy logs: `supabase functions logs muapi-proxy --project-ref bzxohkrxcwodllketcpz`
3. The `request_id` from a blocked response

And contact MuAPI support with the evidence.
