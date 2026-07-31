# Template Studio — E2E Test Plan

These test cases map directly to Section 2 of the production checklist. They must be run against a deployed environment with a **real Muapi key** in the Supabase Edge Function env, and a **real Supabase project** with the `uploads` storage bucket configured.

## Prerequisites

- Production build deployed with all env vars set (see `docs/DEPLOYMENT_RUNBOOK.md`).
- A valid Muapi key in the user's localStorage (`muapi_key`).
- A valid Supabase project with the `uploads` bucket.
- Browser DevTools open to the Network tab to inspect requests.

## Test Cases

### 2.1 — t2i template generates from prompt
1. Navigate to `/template/youtube-thumbnail` (or any `t2i` template).
2. Enter a prompt: "A shocked face with fire background, bold text overlay".
3. Click **Generate**.
4. **Expected:** A real generated image appears in the preview area within 30–60s. The result URL does NOT contain `placeholder`, `sample`, `mock`, or `test/`.
5. **Check Network:** The POST to `/functions/v1/muapi-proxy` should include `params.prompt` with the enriched text, and the response should contain a real CDN URL.

### 2.2 — i2i template generates from prompt + image
1. Navigate to `/template/reaction-thumbnail` (or any `i2i` template).
2. Upload an image.
3. Enter a prompt: "Cyberpunk effect with neon lights".
4. Select an effect from the dropdown (e.g. "Cyberpunk").
5. Click **Generate**.
6. **Expected:** A real generated image that incorporates the uploaded image and the effect.

### 2.3 — i2v template generates from prompt + image + effect name
1. Navigate to `/template/tiktok-video-effect` (or any `i2v` template).
2. Upload an image.
3. Enter a prompt: "dancing in the rain".
4. Select an effect: "360 Rotation".
5. Click **Generate**.
6. **Expected:** A real generated video (may take 1–3 minutes).
7. **Check Network:** The POST body should include `params.name: "360 Rotation"`.

### 2.4 — Effect `name` is forwarded in i2v payload
1. Open DevTools Network tab.
2. Trigger an i2v generation (as in 2.3).
3. **Expected:** In the POST body to `/functions/v1/muapi-proxy`, `params.name` should be present and match the selected effect.

### 2.5 — Effect `name` is forwarded in video payload
1. Open DevTools Network tab.
2. Trigger any video generation that uses an effect.
3. **Expected:** `params.name` is present in the POST body.

### 2.6 — Enhancer keywords applied when AI Enhancer is ON
1. Open any template.
2. Leave the AI Enhancer toggle ON (default).
3. Click **Generate**.
4. **Expected:** The prompt sent to the API includes keywords like "cinematic", "4K", "premium" (from `specs.enhancerKeywords`).
5. **Verify:** In the output textarea, the "Enhanced Prompt" tab shows the full enriched prompt with enhancer keywords.

### 2.7 — Enhancer keywords NOT applied when AI Enhancer is OFF
1. Open any template.
2. Toggle the AI Enhancer OFF.
3. Click **Generate**.
4. **Expected:** The prompt does NOT include the enhancer keywords. The result is still real but without the cinematic/4K polish.

### 2.8 — Cinematic wizard routes correctly for i2v
1. Navigate to a cinematic template (e.g. one with `cinematic: true` and `modelType: 'i2v'`).
2. Open the cinematic wizard.
3. Fill in the steps and click **Generate**.
4. **Expected:** The wizard calls `muapi.generateI2V`. Check the Network tab for a POST with `generationType: "i2v"`.

### 2.9 — Cinematic wizard routes correctly for i2i
1. Navigate to a cinematic template with `modelType: 'i2i'`.
2. Run the wizard.
3. **Expected:** The wizard calls `muapi.generateI2I`. Check Network for `generationType: "i2v"` (the proxy uses i2v for i2i as well, but the client calls `generateI2I`).

### 2.10 — Cinematic wizard routes correctly for image/video
1. Navigate to a cinematic template with `modelType: 't2i'` or `t2v`.
2. Run the wizard.
3. **Expected:** The wizard calls `muapi.generateImage` (for image) or `muapi.generateVideo` (for video).

### 2.11 — Empty prompt does not return placeholder
1. Open any template.
2. Clear all inputs and the AI Enhancer.
3. Click **Generate**.
4. **Expected:** A red error panel appears with the message "Please enter a longer prompt (at least 10 characters)." The API is NOT called.

### 2.12 — Model dropdown loads and selects correctly
1. Open any template that has a model selector.
2. **Expected:** The dropdown populates with models from `/api/model-catalog`.
3. Select a different model.
4. Click **Generate**.
5. **Expected:** The POST body includes `params.model` matching the selection.

### 2.13 — Thumbnail upload and selection works
1. Open an i2v or i2i template.
2. Upload an image.
3. Click **Generate**.
4. **Expected:** The POST body includes `params.image_url` with the uploaded image's public URL.

### 2.14 — Generate Again button works
1. Complete a successful generation.
2. Click **Generate Again** in the result area.
3. **Expected:** A new request is fired and a new result is displayed.

### 2.15 — History persists across page reloads
1. Complete a successful generation.
2. Reload the page.
3. **Expected:** The history (if displayed) is still shown, backed by `localStorage.muapi_history`.

## Error Handling Tests (Section 3)

### 3.1 — Missing API key
1. Clear localStorage/sessionStorage.
2. Navigate to any template.
3. Click **Generate**.
4. **Expected:** The auth modal opens, prompting for a Muapi key. No API call is made.

### 3.2 — API key validation on proxy
1. Temporarily unset `MUAPI_API_KEY` in the Supabase Edge Function env.
2. Make any request.
3. **Expected:** The proxy returns `500` with "Server configuration error: API key not set". The UI shows this as a user-facing error, not a placeholder.

### 3.3 — Network failure during polling
1. Disconnect the network mid-generation.
2. **Expected:** `pollForResult` retries on 5xx but surfaces the error. The UI shows the error message.

### 3.4 — 404 on poll
1. (Difficult to simulate without mocking) — verify in code that `404` surfaces as "Request not found - may have expired".

### 3.5 — Generation timeout
1. (Difficult to simulate) — verify in code that 60-attempt timeout surfaces as "Generation timed out after polling."

### 3.6 — Invalid endpoint
1. Send a request with endpoint `../../etc/passwd`.
2. **Expected:** The proxy returns `400` with "Invalid endpoint".

### 3.7 — Missing template
1. Navigate to `/template/nonexistent-template-id`.
2. **Expected:** The page shows "Template not found".

### 3.8 — Model not in catalog
1. Edit a template to use a model ID not in the catalog.
2. Click **Generate**.
3. **Expected:** The endpoint falls back to the model ID itself. The API is still called (no mock).

### 3.9 — Rate limit
1. Make 101 requests within 1 minute.
2. **Expected:** The 101st request returns `429` with "Rate limit exceeded".

## Reporting

Record results in `docs/TEMPLATE_STUDIO_PRODUCTION_CHECKLIST.md` Section 2 and Section 3. Any failures should be filed as bugs and triaged before production deploy.
