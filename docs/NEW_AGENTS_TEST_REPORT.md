# New Backend Agents Test Report

**Date:** 2026-08-01
**Worktree:** backend-real-outputs
**Tester:** Kilo (automated)

## Summary

Three new agents were added to the Director registry (`dynamic_ads`, `intro_outro`, `brand_elements`) with correct keyword entries and `AGENT_STEPS`. Frontend dispatch works correctly for all three. However, the backend `runAgentJob` function in `videoAgentService.js` has **no handler cases** for these tools, causing every job to fail immediately with `"Unsupported agent"` errors.

---

## Step 1: Verify Agents in DIRECTOR_AGENTS Registry

All three agents are correctly registered in `src/components/DirectorPage.js`:

| Agent ID | Tool | Name | Icon | Category | Has AGENT_STEPS | Has Keyword Entry |
|---|---|---|---|---|---|---|
| `dynamic_ads` | `dynamic-ads` | Dynamic Ads Generator | 🎯 | create | Yes | Yes |
| `intro_outro` | `intro-outro` | Intro/Outro Maker | 🎬 | create | Yes | Yes |
| `brand_elements` | `brand-elements` | Brand Elements | 🏷️ | enhance | Yes | Yes |

**Result: PASS** — All agents are in the registry with correct tool mappings.

---

## Step 2: Verify Backend Handles These Tools

### `runToolJob` switch (line 674 of `backend/services/videoAgentService.js`)

Lines 722–725:
```js
case 'intro-outro':
case 'brand-elements':
case 'dynamic-ads':
  return runAgentJob(jobId, toolId, payload);
```

**Result: PASS** — All three tools are registered in `runToolJob` and delegate to `runAgentJob`.

### `runAgentJob` switch (line 518 of `backend/services/videoAgentService.js`)

The switch statement at line 530 has cases for many agents (`storyboarding`, `highlights`, `text-to-movie`, `visual-search`, `keyword-search`, `voice-cloning`, `audio-overlay`, `sales-assistant`, `comparison`, `output-formatting`, `thumbnail`, `profanity`, `subtitle`, `slack`, etc.) but **does NOT have cases for**:
- `dynamic-ads`
- `intro-outro`
- `brand-elements`

These three tools fall through to the `default` branch at line 647–648:
```js
default:
  return failJob(jobId, new Error(`Unsupported agent: ${agentId}`));
```

**Result: FAIL** — `runAgentJob` has no handler cases for the three new tools. They hit the `default: failJob` branch.

---

## Step 3: Test the Backend Directly

The backend was started with `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars set. Direct curl requests to `/videoagent/process` were blocked by the Supabase auth middleware (the anon key is a service key, not a user session JWT, and is rejected by `SUPABASE_URL/auth/v1/user` with 403).

To bypass auth, the `videoAgentService` router was mounted directly on a test Express app (same approach as `backend/tests/director.test.js`), and `supertest` was used to make requests.

### Test Results

| Tool | Submit Status | JobId Returned | Final Status | Error |
|---|---|---|---|---|
| `dynamic-ads` | 200 | Yes (`process-tool_1785543162076_04gckp`) | **failed** | `Unsupported agent: dynamic-ads` |
| `intro-outro` | 200 | Yes (`process-tool_1785543162602_l03dz7`) | **failed** | `Unsupported agent: intro-outro` |
| `brand-elements` | 200 | Yes (`process-tool_1785543163115_my6i3e`) | **failed** | `Unsupported agent: brand-elements` |

**Key observation:** All three tools successfully create a job (return a `jobId` with status `processing`), but the job immediately fails with `"Unsupported agent: {toolId}"` because `runAgentJob` has no cases for them.

---

## Step 4: Test Frontend Dispatch

### Keyword Inference (`inferAgentId` function, line 1118)

| Input Text | Expected Agent ID | Actual Result | Match? |
|---|---|---|---|
| `"dynamic ad"` | `dynamic_ads` | `dynamic_ads` | Yes |
| `"make a dynamic ad"` | `dynamic_ads` | `dynamic_ads` | Yes |
| `"intro"` | `intro_outro` | `intro_outro` | Yes |
| `"add intro"` | `intro_outro` | `intro_outro` | Yes |
| `"brand"` | `brand_elements` | `brand_elements` | Yes |
| `"brand watermark"` | `brand_elements` | `brand_elements` | Yes |

### Dispatch Flow (`runAgentById`, line 265)

All three agent IDs (`dynamic_ads`, `intro_outro`, `brand_elements`) are listed in the VideoDB + OpenAI agents case (lines 303–305) of `runAgentById`. The function correctly:
1. Finds the agent in `DIRECTOR_AGENTS`
2. Gets the `tool` mapping (`dynamic-ads`, `intro-outro`, `brand-elements`)
3. Calls `runVideoAgent(tool, basePayload, ...)` which POSTs to `/videoagent/process`

**Result: PASS** — Frontend dispatch works correctly for all three agents.

---

## Step 5: Document Results

| Agent ID | Tool | Frontend Dispatch | Backend Handler | Final Status | Error (if any) |
|---|---|---|---|---|---|
| `dynamic_ads` | `dynamic-ads` | Works (keyword inference + `runAgentById` dispatch) | `runToolJob` delegates to `runAgentJob`, but `runAgentJob` has no case | **failed** | `Unsupported agent: dynamic-ads` |
| `intro_outro` | `intro-outro` | Works (keyword inference + `runAgentById` dispatch) | `runToolJob` delegates to `runAgentJob`, but `runAgentJob` has no case | **failed** | `Unsupported agent: intro-outro` |
| `brand_elements` | `brand-elements` | Works (keyword inference + `runAgentById` dispatch) | `runToolJob` delegates to `runAgentJob`, but `runAgentJob` has no case | **failed** | `Unsupported agent: brand-elements` |

---

## Bug Found

### Root Cause

The three new tools (`dynamic-ads`, `intro-outro`, `brand-elements`) are registered in the `runToolJob` switch statement in `backend/services/videoAgentService.js` (lines 722–725), but the `runAgentJob` switch statement (line 530) has **no cases** for them. When `runToolJob` delegates to `runAgentJob`, the new tools fall through to the `default` branch and fail with `"Unsupported agent: {toolId}"`.

### Affected Code

- **File:** `backend/services/videoAgentService.js`
- **Function:** `runAgentJob` (line 518)
- **Lines:** 530–648 (switch statement) — missing cases for `dynamic-ads`, `intro-outro`, `brand-elements`

### Fix Required

Add cases for `dynamic-ads`, `intro-outro`, and `brand-elements` to the `runAgentJob` switch statement, with proper implementations (similar to how other agents like `storyboarding`, `highlights`, etc. are implemented). Each case should:
1. Update job progress and stage
2. Optionally search VideoDB for relevant video context
3. Call the OpenAI Responses API with an appropriate prompt
4. Return a completed job with the agent's output

### Severity

**High** — The agents are fully wired up in the frontend and the backend accepts their jobs, but every job fails immediately with a user-facing error. Users would see "Unsupported agent" errors when trying to use these features.

---

## Additional Notes

- The `getRequiredInputFields` function (line 1131) does not have cases for any of the three new agents, so they return `[]` (no extra input required). This is correct for agents that only need a prompt.
- The `AGENT_STEPS` for all three agents are properly defined (lines 393–395).
- The `KEYWORD_TO_AGENT` entries are properly defined (lines 1114–1116).
- The auth middleware (`backend/middleware/auth.js`) requires a valid Supabase user session JWT for `/videoagent` routes. The `VITE_SUPABASE_ANON_KEY` from `.env.local` is a service-level key that cannot be used as a Bearer token for user authentication.