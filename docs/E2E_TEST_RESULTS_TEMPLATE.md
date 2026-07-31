# Template Studio — E2E Test Results

> Template for documenting the outcome of a Template Studio E2E run.
> The `scripts/run-e2e-tests.sh` runner auto-fills the metadata below;
> fill in the human-authored sections by hand.

## 1. Test Environment

| Field | Value |
| --- | --- |
| Date | `YYYY-MM-DD` |
| Runner | `<name>` |
| Base URL | `https://app.example.com` |
| Build / commit | `<git SHA or version>` |
| Environment | `production` / `staging` |
| Browser | Chromium (default) |
| Muapi key configured | `yes / no` |
| Supabase URL | `https://<project>.supabase.co` |
| Allowed origin | `https://app.example.com` |
| Network coverage | `full (live Muapi) / UI-only` |

```bash
E2E_BASE_URL=... \
E2E_MUAPI_KEY=... \
E2E_ALLOW_NETWORK=1 \
E2E_PRODUCTION=1 \
./scripts/run-e2e-tests.sh
```

## 2. Test Results Summary

| Outcome | Count |
| --- | --- |
| Passed | `N` |
| Failed | `N` |
| Skipped | `N` (network-dependent without backend) |
| Total | `N` |

## 3. Coverage by Category

| Category | Spec | Sampled | Notes |
| --- | --- | --- | --- |
| Base templates | 52 | 8 | TikTok Video, YouTube Thumbnail, Reaction Thumbnail, Product Hero, Disney Pixar, Lego Style, Fashion Stride, Drone FPV |
| Niche templates | 120 | 8 | Restaurant / Medspa / Fitness / Real Estate / Dental / Automotive |
| Matrix templates | 120 | 8 | One from each top-level matrix niche |
| Cinematic templates | 129 | 8 | Cinematic Commercial, Documentary, Emotional Brand Story, Bold Direct Response, Luxury Brand Promo, Dramatic Trailer, Inspirational Founder, Customer Transformation |
| Functional plan 2.1–2.15 | 15 | 15 | All cases from `docs/E2E_TEST_PLAN.md` |
| Error plan 3.1–3.9 | 9 | 9 | All cases from `docs/E2E_TEST_PLAN.md` |
| GTM Boost | 4 | 4 | Pill, secondary button, modal open, context call |
| Prompt combination | 3 | 3 | raw, raw + basePrompt, GTM-generated |
| Security guards | 5 | 5 | CORS allowlist (2), dev bypass (2), mock client (1) |
| **Total** | **421** | **60** | |

## 4. Functional Test Results (2.1–2.15)

| ID | Case | Status | Notes |
| --- | --- | --- | --- |
| 2.1 | t2i template generates from prompt | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.2 | i2i template generates from prompt + image | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.3 | i2v template generates with effect name | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.4 | Effect `name` is forwarded in i2v payload | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.5 | Effect `name` is forwarded in video payload | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.6 | Enhancer keywords applied when AI Enhancer is ON | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.7 | Enhancer keywords NOT applied when AI Enhancer is OFF | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.8 | Cinematic wizard routes correctly for i2v | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.9 | Cinematic wizard routes correctly for i2i | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.10 | Cinematic wizard routes correctly for image/video | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.11 | Empty prompt does not return placeholder | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.12 | Model dropdown loads and selects correctly | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.13 | Thumbnail upload and selection works | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.14 | Generate Again button works | ⬜ pass / ❌ fail / ⏭ skip | |
| 2.15 | History persists across page reloads | ⬜ pass / ❌ fail / ⏭ skip | |

## 5. Error Handling Results (3.1–3.9)

| ID | Case | Status | Notes |
| --- | --- | --- | --- |
| 3.1 | Missing API key | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.2 | API key validation on proxy | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.3 | Network failure during polling | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.4 | 404 on poll | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.5 | Generation timeout | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.6 | Invalid endpoint | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.7 | Missing template | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.8 | Model not in catalog | ⬜ pass / ❌ fail / ⏭ skip | |
| 3.9 | Rate limit | ⬜ pass / ❌ fail / ⏭ skip | |

## 6. Security Guard Results

| Guard | Status | Notes |
| --- | --- | --- |
| CORS — disallowed origin rejected | ⬜ pass / ❌ fail | |
| CORS — allowed origin echoed | ⬜ pass / ❌ fail | |
| Dev bypass disabled in production | ⬜ pass / ❌ fail | |
| `?dev` query param ignored in production | ⬜ pass / ❌ fail | |
| No mock/placeholder URLs in any response | ⬜ pass / ❌ fail | |

## 7. Known Issues / Gaps

> Document any skipped cases, flaky tests, environment-specific quirks, or
> follow-up bugs here.  Each entry should be linkable to a tracking ticket.

- _e.g. TC-2.7 skipped on Safari because enhancer toggle ID differs._

## 8. Sign-off

| Role | Name | Date | Signature |
| --- | --- | --- | --- |
| Engineering lead | | | |
| QA | | | |
| Product | | | |

## 9. Artifacts

- Playwright HTML report: `playwright-report/index.html`
- Machine-readable report: `test-results/e2e-report.json`
- Markdown summary: `docs/E2E_TEST_RESULTS.md`
- Screenshots / traces: `test-results/`
