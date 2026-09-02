# Changelog

All notable changes to the Template Studio are documented in this file.

## [Unreleased] — 2026-07-31

### Fixed
- **Mobile responsiveness on LipSyncStudio + CinemaStudio** (`src/components/LipSyncStudio.js`, `src/components/CinemaStudio.js`): Added `flex-wrap` so generation controls no longer overflow on narrow viewports.
- **OpenAI Responses path not cancellable** (`src/lib/openaiService.js`, `src/components/StoryboardStudio.js`): Threaded `AbortController.signal` through the OpenAI Responses call so the Cancel button actually aborts the request.
- **8 lint errors in VideoStudio.js** (`src/components/VideoStudio.js`): Removed unused `showToast` import and fixed `showVideoErrorBanner` scoping.

### Security
- **Security headers on muapi-proxy** (`supabase/functions/muapi-proxy/index.ts`): Added HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff` to all responses.
- **Tightened production auth on muapi-proxy** (`supabase/functions/muapi-proxy/index.ts`): Reject anon-only requests when `SUPABASE_ENV === "production"` and `ALLOW_UNAUTHENTICATED` is not set to `"true"`.
- **RateLimiter wired into all muapi.js calls** (`src/lib/muapi.js`): Wrapped every generation call with the shared `RateLimiter` (200 tokens/hour) to prevent abuse.
- **CSRF defense-in-depth on muapi-proxy** (`supabase/functions/muapi-proxy/index.ts`): Validates `Sec-Fetch-Site: same-origin` and `Origin` headers on state-changing requests.
- **XSS audit — escapeHtml + sanitizeUserInput helpers** (`src/lib/sanitize.js`, applied across 8 studios): Added shared escaping helpers and sanitized all user-supplied prompt/seed text rendered as HTML.

### Added
- **Lazy loading on result images** across 7 studios: Added `loading="lazy"` and `decoding="async"` to `<img>` tags for generated results.
- **localStorage history persistence** on VideoStudio, ImageStudio, AudioStudio, and AvatarStudio: Recent generations now survive page reloads.
- **React ErrorBoundary + global error handlers** (`src/components/ErrorBoundary.jsx`, `src/main.js`): Top-level `ErrorBoundary` and `setupGlobalErrorHandlers()` wired in to surface uncaught render and runtime errors with a recovery UI.
- **Keyboard accessibility on all 18 studios**: Added `type="button"`, `aria-label`, and `role="status"` where applicable to action buttons and result regions.
- **Analytics backend endpoint** (`supabase/functions/analytics/index.ts`): New `/api/analytics` endpoint that receives client-side generation events; `trackGeneration()` invoked from `src/lib/muapi.js` on every successful generation.

### Changed
- **Vite manualChunks improvement** (`vite.config.js`): Split out `@huggingface/transformers` and `tiktoken` into their own chunks to reduce initial bundle size.

## [Unreleased] — 2026-07-30

### Fixed

- **Placeholder images in template generation** (`src/lib/muapi.js`): `generateImage` no longer sends `image_url: null` to the muapi API, which was causing placeholder images instead of prompt-based generation.
- **i2v effect templates broken** (`src/lib/muapi.js`): `generateI2V` and `generateVideo` now forward the `name` parameter required by effect endpoints like `generate_wan_ai_effects`. Previously, effect selection dropdowns had no effect on the generated output.
- **AI Enhancer keywords never applied** (`src/components/TemplateStudio.js`): The enhancer keywords (e.g. "cinematic, professional, 4K") are now applied whenever the AI Enhancer toggle is on, not only when a user prompt was provided.
- **CinematicTemplateWizard routing** (`src/components/CinematicTemplateWizard.js`): The wizard now routes by `template.modelType` (i2v → `generateI2V`, i2i → `generateI2I`, image → `generateImage`, video → `generateVideo`) instead of the broken `template.kind` / regex logic.
- **`{prompt}` replacement edge case** (`src/components/TemplateStudio.js`): When no user prompt is provided, the leading `, ` from `{prompt}` substitution is now trimmed.
- **Enhancer keyword duplication** (`src/components/TemplateStudio.js`): Repeated keyword phrases are now deduplicated in the final prompt.
- **Weak prompts for templates without `basePrompt`** (`src/components/TemplateStudio.js`): 29 templates that lack a `basePrompt` now receive a category-specific quality default (social, product, cinematic, or general).
- **`generateVideoEffect` contract regression** (`src/lib/muapi.js`): Restored to the correct `generationType: 'video-effect'` and `studioType: 'video-tools'`.
- **supabase.js silent fallback** (`src/lib/supabase.js`): The mock client fallback that silently rejected uploads has been removed. Missing env vars now throw and dispatch a `supabase-misconfigured` event.

### Security

- **Dev auth bypass disabled in production** (`src/lib/apiKeyManager.js`): `isDevBypass` is now hard-disabled when `import.meta.env.MODE === 'production'`, regardless of `VITE_DEV_BYPASS_AUTH` or `?dev` query param.
- **CORS restricted in production** (`supabase/functions/muapi-proxy/index.ts`): The wildcard `*` fallback is disabled when `SUPABASE_ENV === "production"` and no `ALLOWED_ORIGINS` is set.

### Changed

- **Prompt length capped at 2000 characters** (`src/components/TemplateStudio.js`): `buildEnrichedPrompt` truncates cleanly at the nearest word boundary.
- **Minimum prompt length: 10 characters** (`src/components/TemplateStudio.js`): The Generate handler shows a visible error panel if the enriched prompt is shorter than 10 chars.
- **Minimum brief length: 10 characters** (`src/components/modals/TemplateThumbnailModal.jsx`): The Thumbnail modal's `goGenerate()` requires at least 10 characters before calling the image API.
- **Placeholder-regression detection** (`src/components/TemplateStudio.js`): `showResult` now checks `result.url` for `placeholder|sample|mock|test/` patterns and displays a red warning instead of rendering a fake result.
- **Cancel button during generation** (`src/components/TemplateStudio.js`): The Generate button now shows "Cancel" while generating and aborts the request via `AbortController`.
- **Visible error panel** (`src/components/TemplateStudio.js`): Errors now render in a red panel below the Generate button instead of just the button text.
- **Preview empty state fixed for t2i templates** (`src/components/TemplateStudio.js`): The preview area no longer says "Upload an image" for text-to-image templates.
- **aria-labels added** (`src/components/TemplateStudio.js`): The wand and thumbnail buttons now have `aria-label` attributes for screen readers.
