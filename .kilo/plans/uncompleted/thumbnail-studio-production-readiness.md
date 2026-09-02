# Thumbnail Studio — Production Readiness Plan

**Status:** 🔴 NOT COMPLETE — pending execution
**Branch:** `develop` (ahead of `origin/develop` by 1 commit)
**Created:** 2026-08-17
**Last reviewed commit:** `3caa3361 fix(openaiConfig): make isOpenAIImageModel an instance method`

---

## Context

The Thumbnail Studio feature (ChatGPT-style "Explore Ideas" AI thumbnail generator) was
implemented across multiple sub-agent sessions and committed in `8ac94878`
(`feat(thumbnail): expand template registry, prompt builder, recommendation service, and docs`).
The code is feature-complete and unit-tested (123/123 thumbnail tests pass). However, the
feature is **not production-ready** because 28 of 30 template preview images are missing, and a
few release-process steps remain.

This plan captures every remaining step required to ship the Thumbnail Studio to production.
Items are ordered by priority. Each step lists the exact commands and a Definition of Done.

---

## Current Verified State

| Check | Result |
|-------|--------|
| `CinemaStudio.js` build blocker (duplicate `CAMERA_MOVEMENTS`) | ✅ Already fixed — single declaration at line 23 |
| `npm run build` | ✅ Passes (verified, ~2m29s) |
| Thumbnail unit tests (`__tests__/thumbnail*.test.js`) | ✅ 123/123 pass |
| Thumbnail code committed | ✅ In `8ac94878` (branch history) |
| `isOpenAIImageModel` mock fix | ✅ Committed in `3caa3361` |
| Edge function `recommend-templates` / `surprise-me` actions | ✅ Present in `supabase/functions/ai-thumbnail-generator/index.ts` |
| Template preview images (30 templates) | ❌ Only 2 present (`magazine-cover.webp`, `product-hero.webp`) |
| `.env` file present | ❌ Absent — no local credentials loaded |
| Branch pushed to remote | ❌ `develop` 1 commit ahead of `origin/develop` |

---

## Phase 1 — Generate Missing Template Preview Images  (P0, BLOCKING)

**Why:** The Explore Ideas grid renders each template card with its `previewUrl`. Without a
real image, cards fall back to a CSS gradient (functional but generic). 28 templates need
AI-generated previews before a polished production launch.

**Prerequisites:** A `.env` file with real Supabase + OpenAI credentials (see Phase 2).

### Step 1.1 — Create `.env` from example
```bash
cp .env.example .env
# Then edit .env and fill in real values:
#   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key
#   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # needed for storage uploads
#   OPENAI_API_KEY=sk-...                               # optional; forwarded to edge fn
```
**Definition of Done:** `.env` exists at repo root, is git-ignored, and contains all four vars.

### Step 1.2 — Dry run to verify connectivity
```bash
node scripts/generate-thumbnail-template-previews.mjs --dry-run
```
**Definition of Done:** Script lists the 28 templates it would generate with no auth/connection errors.

### Step 1.3 — Generate all missing previews (batch)
```bash
node scripts/generate-thumbnail-template-previews.mjs --force --update-registry
```
This will:
- Call the edge function `generate` action per template using `template.previewPrompt`
- Upload each result to Supabase Storage `template-thumbnails/previews/{id}.webp`
- Rewrite `previewUrl` fields in `src/lib/thumbnailTemplateRegistry.js`

**Definition of Done:** Script prints a summary with 28 generated, 0 failed. `git diff
src/lib/thumbnailTemplateRegistry.js` shows 28 `previewUrl` values updated to Supabase URLs.

### Step 1.4 — Commit the generated assets
```bash
git add public/thumbnails/templates/*.webp src/lib/thumbnailTemplateRegistry.js
git commit -m "feat(thumbnail): generate AI preview images for all 30 templates"
```
**Definition of Done:** `git status` clean for those paths. Previews present for all 30 templates.

> **Alternative (manual review):** Generate one at a time with
> `node scripts/generate-thumbnail-template-previews.mjs --template=creator-reaction` and inspect
> each before committing. Use this for the first 3–5 templates, then switch to the batch run.

---

## Phase 2 — Configuration & Secrets  (P0)

**Why:** The preview script and the live recommendation/surprise-me features require credentials
that are not currently present in the environment.

### Step 2.1 — Confirm `.env` is git-ignored
```bash
git check-ignore .env && echo "OK: .env is ignored"
```
**Definition of Done:** Command prints `OK`. If not ignored, add `.env` to `.gitignore` immediately.

### Step 2.2 — Set production secrets in deployment platforms
- **Netlify** (frontend): dashboard → Environment variables → set `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`.
- **Render** (backend): dashboard → set `OPENAI_API_KEY` (per `render.yaml` note).
- **Supabase**: ensure `OPENAI_API_KEY` is set on the project for edge function server fallback.
**Definition of Done:** Preview deployment loads without missing-env errors; recommendation API
works in the deployed environment.

### Step 2.3 — Extend `.env.example` documentation
Add stubs for `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` (currently only
Supabase URL/key are present) so future operators know what to provide.
**Definition of Done:** `.env.example` documents all four required variables.

---

## Phase 3 — Deploy Edge Function  (P1)

**Why:** The `recommend-templates` and `surprise-me` actions exist in code but must be deployed to
the live Supabase project for the AI features to work in production.

### Step 3.1 — Verify current deployment
```bash
npx supabase functions list
npx supabase functions logs ai-thumbnail-generator --no-follow | tail -20
```
**Definition of Done:** Confirm whether the function is deployed and which actions are live.

### Step 3.2 — Deploy if needed
```bash
npx supabase functions deploy ai-thumbnail-generator
```
**Definition of Done:** `recommend-templates` and `surprise-me` are callable from the deployed function.

### Step 3.3 — Smoke test the endpoints
Use the app's Explore Ideas "Recommended for You" section and "Surprise Me" action in a deployed
or local-with-keys environment.
**Definition of Done:** Recommendations return valid template IDs; Surprise Me returns a concept.

---

## Phase 4 — Triage Uncommitted Changes  (P1)

**Why:** The working tree has changes unrelated to the thumbnail studio that must not block or
pollute the release.

### Step 4.1 — List uncommitted work
```bash
git status -sb
```
Current uncommitted (non-thumbnail) items observed:
```
Modified:   src/components/DirectorPage.js
Modified:   src/components/EffectsStudio.js
Modified:   src/lib/studioPexels.js
Modified:   vitest.config.js
Untracked:  backend/mcp-server/
Untracked:  src/components/modals/StudioPexelsModal.jsx
Untracked:  src/lib/aiAgentService.js
Untracked:  src/lib/recipeRunner.js
Untracked:  src/lib/templateThumbnails.js
Untracked:  src/lib/videoTemplateBundles.js
Untracked:  src/test/commercial-studio-pricing.test.js
Untracked:  src/test/model-catalog-video.test.js
Untracked:  src/test/muapi-video-methods.test.js
Untracked:  src/test/template-engine-video.test.js
Untracked:  src/test/video-template-bundles.test.js
```

### Step 4.2 — Decide per file: commit, revert, or isolate
- For each file, confirm intent. If it is part of an unrelated feature, commit it on its own
  branch or revert it so the thumbnail release branch stays clean.
**Definition of Done:** No stray uncommitted changes on the release branch, or they are intentionally
committed under a clearly named separate commit/branch.

---

## Phase 5 — Push & Merge  (P0)

### Step 5.1 — Push `develop` to remote
```bash
git push origin develop
```
**Definition of Done:** `git status -sb` shows `develop...origin/develop` with no `ahead` count.

### Step 5.2 — Merge to `main` (if `main` is the production branch)
```bash
git checkout main
git merge develop
git push origin main
```
**Definition of Done:** Production branch contains the thumbnail feature + preview assets.

---

## Phase 6 — Verification & QA  (P1)

Run after Phases 1–5 so the deployed build reflects all changes.

### Step 6.1 — Full production build
```bash
npm run build
```
**Definition of Done:** Zero errors.

### Step 6.2 — Full test suite
```bash
npm run test:run
```
**Definition of Done:** All thumbnail tests pass. Note: pre-existing `__tests__/core.test.js`
imports `@jest/globals` and is incompatible with Vitest — either fix the import or move/remove
the file so the suite is green.

### Step 6.3 — Manual E2E: Explore Ideas flow
1. Open any studio → thumbnail button → **Explore Ideas**
2. Browse / search / filter templates
3. Select a template (e.g. *Creator Reaction*)
4. Upload required reference (person photo)
5. Generate → Refine → Add text → Save & Apply
**Definition of Done:** Full flow completes; generated image applies to the studio.

### Step 6.4 — Manual E2E: Social Publisher integration
1. Open Social Publisher → Write step
2. Thumbnail step → select template → generate
3. Continue to Destinations → Publish
**Definition of Done:** Selected thumbnail persists through all steps.

### Step 6.5 — Studio coverage
Verify all 16 studios using `StudioThumbnailModal` show the Explore Ideas button and the flow works.

### Step 6.6 — Responsive & a11y spot checks
- Viewports: 320 / 375 / 768 / 1024 px (grid collapses 3→2→1 col)
- Keyboard: Tab through cards, Enter selects, Esc closes
- Screen reader: aria-labels present on cards, search, filters, configurator

### Step 6.7 — Error handling
Test: missing OpenAI key, invalid key, generation failure, network failure, missing required
reference, moderation rejection. UI must show friendly fallbacks (no crash).

---

## Phase 7 — Optional Hardening  (P2, post-launch OK)

- Add per-user/IP rate limiting to `recommend-templates` / `surprise-me` in the edge function.
- Restrict edge function CORS from `*` to known domains.
- Add analytics events (`thumbnail_explore_opened`, `thumbnail_template_selected`,
  `thumbnail_generated`, `thumbnail_applied`, `thumbnail_sent_to_social`) using existing
  `thumbnail_analytics` table — no raw prompts/keys/images.
- Consider a CI job that runs `generate-thumbnail-template-previews.mjs --dry-run` on registry changes.

---

## Acceptance Criteria (all must be true before "done")

- [ ] All 30 templates have preview images in `public/thumbnails/templates/` (or Supabase URLs in registry)
- [ ] `npm run build` passes with zero errors
- [ ] `npm run test:run` passes (thumbnail suite + legacy suite resolved)
- [ ] Edge function deployed with `recommend-templates` + `surprise-me`
- [ ] Explore Ideas → Customize → Generate → Refine → Text → Save → Apply works end-to-end
- [ ] Social Publisher thumbnail step works end-to-end and persists thumbnail
- [ ] Release branch pushed and merged to production branch
- [ ] No OpenAI key exposed client-side; BYOK fallback verified

---

## Quick Command Reference

```bash
# Phase 1 — previews
cp .env.example .env
node scripts/generate-thumbnail-template-previews.mjs --dry-run
node scripts/generate-thumbnail-template-previews.mjs --force --update-registry
git add public/thumbnails/templates/*.webp src/lib/thumbnailTemplateRegistry.js
git commit -m "feat(thumbnail): generate AI preview images for all 30 templates"

# Phase 3 — edge fn
npx supabase functions deploy ai-thumbnail-generator

# Phase 5 — push/merge
git push origin develop
git checkout main && git merge develop && git push origin main

# Phase 6 — verify
npm run build
npm run test:run
```

---

*This plan is intentionally conservative: it preserves all existing thumbnail functionality,
reuses the existing edge function and storage, and never regenerates previews on user page load.
The only net-new production asset is the set of 28 preview images plus their registry URLs.*
