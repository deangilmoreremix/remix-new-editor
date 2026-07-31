# Director Feature — Staging Verification Checklist

Use this checklist to verify the Director feature is fully functional in the staging environment before promoting to production. A staging-pass requires all Critical items green.

---

## 1. Health Check

| # | Check | Method | Target | Pass Criteria |
|---|-------|--------|--------|---------------|
| 1.1 | `GET /health` returns 200 | `curl -i $BACKEND/health` | P95 < 500ms | HTTP 200, body contains `"status":"ok"` |
| 1.2 | `GET /health` response valid JSON | `curl -s $BACKEND/health \| jq .` | — | Parsable JSON with `status`, `timestamp` fields |
| 1.3 | Director backend reachable from videoagent-backend | `curl -s http://director-backend:8000/health` (from Render internal) | — | HTTP 200 or `connect()` succeeds |

```bash
# 1.1 — smoke test
BACKEND="https://videoagent-backend.onrender.com"
START=$(date +%s%3N)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/health")
END=$(date +%s%3N)
DUR=$((END - START))
echo "HTTP $HTTP in ${DUR}ms"
[ "$HTTP" = "200" ] && [ "$DUR" -lt 500 ] && echo "PASS" || echo "FAIL"
```

---

## 2. Director Page Loads

| # | Check | Method | Pass Criteria |
|---|-------|--------|--------------|
| 2.1 | `/director` renders HTTP 200 | `curl -s -o /dev/null -w "%{http_code}" $DIRECTOR_FE/director` | 200 |
| 2.2 | `/director` loads in < 2s | Measure TTFB via `--write-out` | P95 < 2000ms |
| 2.3 | 45 agents visible in DOM | Playwright: `page.locator('[data-agent]')` count | Exactly 45 |
| 2.4 | Page title contains "Director" | `page.title()` | "Director" or variant |

```bash
# 2.1 and 2.2
DIRECTOR_FE="https://director-frontend.onrender.com"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$DIRECTOR_FE/director")
DUR=$(curl -o /dev/null -s -w "%{time_total}" "$DIRECTOR_FE/director")
echo "Director page: HTTP $HTTP in ${DUR}s"
```

---

## 3. Agent Categories and Endpoints

### 3.1 Agent Actions Endpoint

| # | Check | Command | Expected |
|---|-------|---------|---------|
| 3.1.1 | `GET /api/agents/actions` returns all 45 actions | `curl -s $BACKEND/api/agents/actions -H "Authorization: Bearer $JWT" \| jq '.actions \| length'` | `45` |
| 3.1.2 | Each action returns an ID and steps | `curl -s $BACKEND/api/agents/actions -H "Authorization: Bearer $JWT" \| jq '.actions[0]'` | `{ id: string, steps: [string], hasImplementation: boolean }` |
| 3.1.3 | Existing agent actions DO NOT 404 | Smoke call to `POST /api/agents/actions` with a body | `{ ok: true }` or `"success: true"` |
| 3.1.4 | Unknown agent returns 404 with structured error | `curl -s -X POST "$BACKEND/api/agents/actions/nonexistent_action" -H "Authorization: Bearer $JWT" -d '{}'` | `{"error":"Unknown action: nonexistent_action"}` |

```bash
# 3.1.1
ACTIONS_COUNT=$(curl -s "$BACKEND/api/agents/actions" \
  -H "Authorization: Bearer $JWT" | jq '.actions | length')
echo "Agent actions count: $ACTIONS_COUNT"
[ "$ACTIONS_COUNT" -eq 45 ] && echo "PASS" || echo "FAIL"
```

### 3.2 VideoDB Proxy Health

| # | Check | Command | Expected |
|---|-------|---------|---------|
| 3.2.1 | `GET /api/videodb/health` returns 200 | `curl -s $BACKEND/api/videodb/health` | `200` with JSON payload |
| 3.2.2 | Proxy key validation works | `curl -s $BACKEND/api/videodb/health` | No server error |

```bash
curl -s -o /dev/null -w "HTTP %{http_code}" "$BACKEND/api/videodb/health"
```

### 3.3 Quick Actions (Per-Agent)

Each of the 45 agents must be invocable via `POST /api/agents/actions/<action_id>`:

```bash
AGENTS=("screenwriter" "camera-operator" "character-extractor" "editor" "scene-detection" "transcribe" "highlight-reel" "collage" "dubbing" "voice-replacement")

for agent in "${AGENTS[@]}"; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$BACKEND/api/agents/actions/$agent" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"videoUrl":"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}')
  echo "[$agent] HTTP $HTTP"
done
```

### 3.4 Cancel Button
- Trigger a long-running agent action (e.g., `upscale` on a 10-second video).
- Click Cancel in the UI within 5 seconds.
- Verify: the fetch AbortController is dispatched; a `{ success: false, cancelled: true }` response is shown; no zombie entries remain in the job queue.

---

## 4. Director Agent — 45-Agent Verification Table

Each agent must be present in the API response and return a valid payload when invoked with a valid video URL.

| # | Agent ID | Endpoint | Expected Response Shape | Has Implementation |
|---|---------|----------|------------------------|-------------------|
| 1 | `detect-scenes` | `POST /api/agents/actions/detect-scenes` | `{ scenes: [{time, label}], source: string, totalScenes: number }` | ✅ ffmpeg |
| 2 | `extract-highlights` | `POST /api/agents/actions/extract-highlights` | `{ highlights: [{start, end, score, label}], source: string }` | ✅ ffmpeg |
| 3 | `add-broll` | `POST /api/agents/actions/add-broll` | `{ broll: [{url, thumbnail, duration}], source: string }` | ✅ muapi/fallback |
| 4 | `create-shorts` | `POST /api/agents/actions/create-shorts` | `{ shorts: [{format, aspectRatio, base64?, duration}], source: string }` | ✅ ffmpeg |
| 5 | `color-correct` | `POST /api/agents/actions/color-correct` | `{ corrected: true, settings: {}, base64, source: string }` | ✅ ffmpeg |
| 6 | `upscale` | `POST /api/agents/actions/upscale` | `{ upscaled: true, scale, base64, source: string }` | ✅ ffmpeg |
| 7 | `stabilize` | `POST /api/agents/actions/stabilize` | `{ stabilized: true, base64, source: string }` | ✅ ffmpeg |
| 8 | `dub-video` | `POST /api/agents/actions/dub-video` | `{ dubbed: bool, source: 'director'|'fallback-tts-only', targetLanguage, voice }` | ⚠️ Director-only |
| 9 | `add-voiceover` | `POST /api/agents/actions/add-voiceover` | `{ voiceover: bool, audioBase64?, mimeType?, source: string }` | ✅ OpenAI TTS |
| 10 | `generate-subtitles` | `POST /api/agents/actions/generate-subtitles` | `{ success: true, action, note: string, steps: [string], source: 'forwarded' }` | ⚠️ Forwarded |
| 11 | `summarize-video` | `POST /api/agents/actions/summarize-video` | `{ success: true, action, note, steps, source: 'forwarded' }` | ⚠️ Forwarded |
| 12 | `scene-detection` | `POST /api/agents/actions/scene-detection` | `{ scenes: [...], source: string, totalScenes: number }` | ✅ ffmpeg |
| 13 | `highlight-detection` | `POST /api/agents/actions/highlight-detection` | `{ highlights: [...], source: string }` | ✅ ffmpeg |
| 14 | `clip-segmentation` | `POST /api/agents/actions/clip-segmentation` | `{ success: true, note: 'handled by videoAgentService.js', steps: [string] }` | ⚠️ Forwarded |
| 15 | `speed` | `POST /api/agents/actions/speed` | `{ sped: true, speedFactor, format, base64, source: string }` | ✅ ffmpeg |
| 16 | `reverse` | `POST /api/agents/actions/reverse` | `{ reversed: true, format, base64, source: string }` | ✅ ffmpeg |

The remaining 29 agents are Director backend-only agents handled at `POST /api/director/agent/<id>` by `directorProxy.js`. Verify reachability:

```bash
DIRECTOR_PROXY="https://videoagent-backend.onrender.com"
for agent in screenwriter camera-operator character-extractor editor transcribe highlight-reel collage dubbing voice-replacement summarize-video clip-segmentation; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$DIRECTOR_PROXY/api/director/agent/$agent" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"input":"test","videoId":"test_123"}')
  echo "[director-proxy/$agent] HTTP $HTTP"
done
# 200/502 structuré OK, 500/not-JSON FAIL
```

---

## 5. Performance Benchmarks

| Endpoint | Metric | Target | Test Command |
|----------|--------|--------|-------------|
| `GET /api/agents/actions` | P95 latency | < 2s | `ab -n 100 -c 10 -H "Authorization: Bearer $JWT" $BACKEND/api/agents/actions` |
| `POST /api/agents/actions/screenwriter` | P95 latency | < 2s (first call; may cold-start Director backend) | Same as §5 with POST body |
| `POST /api/videodb/health` | P95 latency | < 3s | `ab -n 100 -c 10 $BACKEND/api/videodb/health` |
| `GET /health` | P95 latency | < 500ms | `ab -n 100 -c 10 $BACKEND/health` |
| `GET /director` (Frontend) | P95 TTFB | < 2s | `ab -n 50 -c 5 $DIRECTOR_FE/director` |


## 6. Accessibility

| # | Check | Expected |
|---|-------|---------|
| 6.1 | Tab order on `/director` follows DOM order | Native focus indicators visible; no tab traps |
| 6.2 | Agent action buttons have accessible names | `aria-label` or inner text >= 1 word per button |
| 6.3 | Error panel uses `role="alert"` or `aria-live="polite"` | Screen reader announces errors on first render |
| 6.4 | Cancel/abort button announces status | `role="status"` aria live region on the progress panel |
| 6.5 | All interactive elements keyboard-focusable | No `pointer-events: none` or `tabindex="-1"` on interactive controls |
| 6.6 | Contrast ratio for primary text | ≥ 4.5:1 against background (WCAG AA) |
| 6.7 | Skip nav link present on `/director` | `<a href="#main-content">Skip to Director</a>` |

---

## 7. Security

### 7.1 SSRF Protection

Verify the SSRF block list catches private and loopback addresses:

```bash
BACKEND="https://videoagent-backend.onrender.com"
JWT="<staging-jwt>"

echo "--- 127.0.0.1 ---"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{"videoUrl":"https://127.0.0.1/x"}'
# Expected: 400 (blocked host) or error message mentioning "blocked host"

echo "--- localhost ---"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{"videoUrl":"https://localhost/x"}'
# Expected: 400

echo "--- 169.254.169.254 (EC2 metadata) ---"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{"videoUrl":"https://169.254.169.254/latest/meta-data/"}'
# Expected: 400

echo "--- 10.x private range ---"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{"videoUrl":"https://10.0.0.1/x"}'
# Expected: 400

echo "--- 192.168.x.x ---"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{"videoUrl":"https://192.168.1.1/x"}'
# Expected: 400

echo "--- HTTP (non-HTTPS) ---"
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{"videoUrl":"http://example.com/x"}'
# Expected: 400 ("Only HTTPS URLs are allowed")
```

### 7.2 Rate Limiting

| # | Check | Expected |
|---|-------|---------|
| 7.2 | `/api/agents` rate limited after 20 req/min | `429` on 21st request within 60s window |
| 7.2 | `/api/videodb` rate limited after 30 req/min | `429` on 31st request within 60s window |

```bash
# Rate-limit test (requires staging JWT)
for i in $(seq 1 25); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "$BACKEND/api/agents/actions")
  echo "#$i HTTP $HTTP"
  if [ "$HTTP" = "429" ]; then echo "RATE LIMIT ENFORCED at attempt $i"; break; fi
done
```

### 7.3 No Stack Traces in Error Responses

```bash
# Trigger an error (no input required)
RESPONSE=$(curl -s -X POST "$BACKEND/api/agents/actions/create-shorts" \
  -H "Authorization: Bearer $JWT" \
  -d '{}')
# Verify no stack trace in response
echo "$RESPONSE" | grep -i "Error:" && echo "PASS - structured error only"
echo "$RESPONSE" | grep -E "at (\w+\.js|__)" && echo "FAIL - stack trace leaked" || true
```

### 7.4 Header Security

| Header | Expected Value |
|--------|---------------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (or `SAMEORIGIN`) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | present on HTML responses |

```bash
curl -sI "$DIRECTOR_FE/director" | grep -i "x-content-type-options"
curl -sI "$BACKEND/health" | grep -i "x-frame-options"
```

---

## 8. Browser Compatibility

| Browser | Min Supported Version | Pass Criteria |
|---------|-----------------------|---------------|
| Chrome | Latest 2 stable versions | Page loads, all 45 agents render, `/director` fully interactive |
| Firefox | Latest 2 stable versions | Same as Chrome |
| Safari | Latest 2 stable versions (macOS + iOS) | Same as Chrome |

**Test matrix:**

```bash
# Use Playwright or BrowserStack to run against each browser
cd e2e
pnpm exec playwright test director-staging.spec.ts \
  --project=chromium \
  --project=firefox \
  --project=webkit
```

Key things to verify across browsers:
- Tab order is consistent (DOM-order in all browsers)
- `fetch` with `AbortController` signals cancel the running agent action
- `FormData` multipart upload to `/api/videodb/proxy` works
- CSS Grid/Flex used in the agent grid renders consistently
- ES module imports resolve without CORS Taint errors

---

## 9. E2E Checklist — Director Page (Automated Playwright Spec)

Add or run `e2e/director-staging.spec.ts`:

```typescript
// e2e/director-staging.spec.ts
import { test, expect } from '@playwright/test';

const STAGING_URL = process.env.STAGING_URL || 'https://director-frontend.onrender.com';
const JWT = process.env.STAGING_JWT!;
const BACKEND = process.env.BACKEND_URL || 'https://videoagent-backend.onrender.com';

test.describe('Director Staging Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${STAGING_URL}/director`);
  });

  test('page title is Director', async ({ page }) => {
    await expect(page).toHaveTitle(/Director/i);
  });

  test('all 45 agents are visible', async ({ page }) => {
    const agents = await page.locator('[data-agent-id]').all();
    await expect(agents.length).toBe(45);
  });

  test('agent categories render', async ({ page }) => {
    const categories = ['Editing', 'Audio', 'Analysis', 'Generation', 'Social'];
    for (const cat of categories) {
      await expect(page.getByText(cat, { exact: false })).toBeVisible();
    }
  });

  test('quick actions endpoint returns 45 entries', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/agents/actions`, {
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.actions.length).toBe(45);
  });
});
```

---

## 10. Rollback Trigger Summary

| Metric | Hold | Rollback |
|--------|------|----------|
| Error rate | > 10% baseline | > 2x baseline |
| P95 latency | > 20% baseline | > 50% baseline |
| User reports | Any spike | > 5% decline in engagement |

When any Rollback threshold is breached:
1. Escalate in the incident Slack channel.
2. Run the rollback commands in `docs/DEPLOYMENT_RUNBOOK.md §4`.
3. File an incident ticket with timestamps, affected service, and root cause hypothesis within 1 hour.
4. Investigate before re-deploying.

---

## 11. Sign-Off

| Role | Name | Date | Passed? | Notes |
|------|------|------|---------|-------|
| QA Engineer | | | | |
| Backend Engineer | | | | |
| Frontend Engineer | | | | |
| Release Manager | | | | |

A staging verification is complete only when all Roles in the sign-off table above have marked `Passed? = ✅` and all Critical checklists (Health, Director page load, 45-agent verification, SSRF, rate limiting, no stack traces) are green.
