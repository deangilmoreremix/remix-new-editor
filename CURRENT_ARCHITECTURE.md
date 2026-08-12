# SmartVideo — Current Architecture Audit

**Audited**: 2026-08-10  
**Repository**: `/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor`  
**Scope**: Read-only. No source files were modified.

---

## 1. Framework & Build

### Stack
- **Bundler**: Vite 5.x (`vite.config.js`)
- **UI**: React 19 + vanilla JS (DOM factories) — hybrid architecture. Most studios are vanilla JS functions that build DOM nodes imperatively; modals and a few pages use JSX/React.
- **Styling**: Tailwind CSS 4.x (`tailwind.config.js`, `@tailwindcss/vite` plugin) + custom CSS in `src/style.css` and `src/components/modals/modal-styles.css`
- **Language**: ES modules (`.js`, `.jsx`, `.ts`, `.tsx`). TypeScript is used in `packages/` and `supabase/functions/`.
- **Package manager**: npm with workspaces (`packages/*`, `apps/*`)

### Entry Point
- **`src/main.js`** — bootstraps the app:
  - Initializes Popcorn.js
  - Sets up global error handlers
  - Determines initial page from URL path, hash, or `?studio=` query param
  - Renders landing page (full-page, no shell) or auth shell (Header + Sidebar + content area)
  - Mounts the router into `#content-area`
  - Dynamically imports and mounts the React modal system (`mountModalSystem.jsx`)
  - Shows the API-key setup popup once per session

### Routing
- **`lib/router.js`** — custom client-side SPA router (no React Router)
  - Uses `window.history.pushState` + hash-based URLs (`/#/<page>`)
  - `navigate(page, params)` is the primary navigation function, exposed globally
  - `pageLoaders` map route IDs to dynamic `import()` calls (lazy-loaded)
  - Router is initialized with `initRouter(container, callback)` from `main.js`
  - Notifies Header and Sidebar via `CustomEvent('route-changed')` on navigation

### Build Scripts (`package.json`)
| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (port 5173 default) |
| `npm run dev:all` | Vite + ai-vfx app concurrently |
| `npm run build` | Vite build → `dist/` + copies `apps/ai-vfx/dist` |
| `npm run build:analyze` | Vite build with bundle analysis |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint on `src/` |
| `npm run test` / `test:run` | Vitest |
| `npm run dev:backend` | Backend Express server |

### Vite Configuration Highlights
- Custom plugins: `stub-legacy-unresolved` (stubs broken legacy imports), `fix-legacy-imports` (rewrites CRA-style relative paths to `src/` equivalents)
- Dev middleware proxy for `/api/gtm-boost/*` → `backend/services/gtmBoostService.js`
- Dev CSP headers allowing Clerk, Supabase, Muapi, and local WebSocket origins
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

---

## 2. The 16 Studios

Each studio is a factory function exported from its component file. Studios are lazy-loaded via the router's `pageLoaders` map.

| # | Studio | Component File | Route ID | Page/Route File | Current Functionality Summary |
|---|--------|---------------|----------|-----------------|-------------------------------|
| 1 | **Image Studio** | `src/components/ImageStudio.js` | `image` | `ImageStudio()` | Text-to-image & image-to-image generation. Model selector (20+ models via `t2iModels`/`i2iModels`), aspect ratio/resolution picker, prompt + negative prompt, advanced params (steps, guidance, CFG), multi-image upload for I2I, batch generation, LoRA support, provider sidebar, GTM personalization trigger. Calls `muapi.generateImage()` / `muapi.generateImageToImage()`. |
| 2 | **Video Studio** | `src/components/VideoStudio.js` | `video` | `VideoStudio()` | Text-to-video & image-to-video generation. T2V/I2V mode toggle, duration/resolution/aspect controls, model selector (15+ models), reference image upload, advanced params (seed, negative prompt), GTM trigger. Calls `muapi.generateVideo()` / `muapi.generateImageToVideo()`. |
| 3 | **Cinema Studio** | `src/components/CinemaStudio.js` | `cinema` | `CinemaStudio()` | Cinematic video generation with camera controls. Camera movements (dolly, crane, orbit, FPV, etc.), film looks (anamorphic, noir, vintage, etc.), lens/focal/aperture controls, prompt builder (`buildNanoBananaPrompt`), model selector. |
| 4 | **Storyboard Studio** | `src/components/StoryboardStudio.js` | `storyboard` | `StoryboardStudio()` | Multi-frame sequence generation. Shot type presets (wide, medium, close-up, POV, etc.), style/lighting/color presets, frame-by-frame generation, storyboard engine (`generateStoryboardFromIntent`), persistence via `saveProject`/`loadProjectFromStorage`, Supabase sync. |
| 5 | **Effects Studio** | `src/components/EffectsStudio.js` | `effects` | `EffectsStudio()` | 350+ visual effects. Tabs for Image Effects, Nano Banana, Kontext, AI Video Effects, Motion Controls, VFX. Comparison mode (before/after slider), effect param validation (`EFFECT_PARAM_SCHEMA`), `EffectCompositor`, model selector, save to asset store. |
| 6 | **Edit Studio** | `src/components/EditStudio.js` | `edit` | `EditStudio()` | AI-powered image editing tools. 25+ edit models (Flux Kontext, GPT-4o Edit, Midjourney, Nano Banana, Qwen, Wan, etc.), AI tools: Object Eraser, Background Remover, Image Extender, Generative Fill, Inpaint/Outpaint, Reference-based editing. Prompt-based and tool-based modes. |
| 7 | **Upscale Suite** | `src/components/UpscaleStudio.js` | `upscale` | `UpscaleStudio()` | AI image upscaling and enhancement. 3 methods: AI Upscaler (2x/4x), Topaz Upscale, SeedVR2 Upscale. Upload + process flow, model selector, factor selection. Calls `muapi.processV2V()` with upscale endpoints. |
| 8 | **Character Studio** | `src/components/CharacterStudio.js` | `character` | `CharacterStudio()` | Consistent character/face generation. Flux PuLID (face ID preservation), MiniMax Subject Reference. Upload reference image, prompt, generate character-consistent images. |
| 9 | **Commercial Studio** | `src/components/CommercialStudio.js` | `commercial` | `CommercialStudio()` | Product photography and ad content generation. Scene presets (studio, marble, outdoor, neon, etc.), format presets (banner 16:9, social 1:1, story 9:16, billboard 21:9), model selector, GTM personalization. |
| 10 | **Audio Studio** | `src/components/AudioStudio.js` | `audio` | `AudioStudio()` | Music, speech, and sound effects generation. Model selector (audio models from `models.js`), prompt, style, duration, voice selection, GTM trigger. Uses `muapi` for generation. |
| 11 | **Avatar Studio** | `src/components/AvatarStudio.js` | `avatar` | `AvatarStudio()` | AI avatar and talking head generation. Upload video/image + audio, model selector (avatar models), prompt, generate talking avatar videos. |
| 12 | **Training Studio** | `src/components/TrainingStudio.js` | `training` | `TrainingStudio()` | Custom LoRA model training. Select training model, enter LoRA name, trigger word, epoch count, upload training images (multi-image), start training job. |
| 13 | **Video Tools** | `src/components/VideoToolsStudio.js` | `videotools` | `VideoToolsStudio()` | Video enhancement and transformation tools. Video tools models (upscale, enhance, translate), upload video, prompt, process via `muapi`. |
| 14 | **Chat Studio** | `src/components/ChatStudio.js` | `chat` | `ChatStudio()` | AI-powered text generation and conversation. Text/LLM model selector, chat history (in-memory array), message-by-message generation, navigates to other studios from chat (e.g., generate image from chat). |
| 15 | **Lip Sync** | `src/components/LipSyncStudio.js` | `lipsync` | `LipSyncStudio()` | Portrait animation and lip sync. Two modes: image+audio → video, or video+audio → lip-synced video. Model selector (image/video lip-sync models), upload image/video/audio, resolution picker, pending jobs queue. |
| 16 | **AI Influencer** | `src/components/InfluencerStudio.js` | `influencer` | `InfluencerStudio()` | AI influencer/social content generation. 20+ style presets (Realistic, Y2K, Grunge, Coquette, etc.), format presets (Instagram, Story, YouTube, Pinterest), upload reference image, generate social-ready content. |

### Additional Studio-Adjacent Routes (not in the "16 Studios" list but part of the SPA)
- `director` → `DirectorPage.js` (protected system)
- `video-agent` → `VideoAgentPage.js` (protected system)
- `timeline` → `TimelineEditorPage.jsx` (protected system)
- `render` → `RenderPage.js` (protected system)
- `ai-vfx` → `AIVFXPage.js` (protected system)
- `cinema-template` → `CinemaTemplateStudio.js`
- `apps` → `AppsHub.js`
- `templates` → `TemplatesPage.js`
- `explore`, `library`, `content-library`, `community`, `assist`

---

## 3. Studio Architecture

### How Studios Are Mounted
1. `main.js` computes `initialPage` from URL (path, hash, or `?studio=` query param)
2. Auth pages (`signin`, `signup`, etc.) are handled by `ClerkAuth.jsx`
3. All other pages go through `initRouter(contentArea, callback)` in `lib/router.js`
4. `navigate(page)` looks up `pageLoaders[page]`, dynamically imports the factory, calls it, and appends the returned DOM element to `#content-area`
5. Before mounting a new page, the previous page's `cleanup()` is called (if it exists)

### Shared UI Patterns
- **`mountStudioChrome(container, opts)`** (`lib/studioChrome.js`) — prepends a top bar with [menu][back] buttons and a slide-in drawer listing all routes. Used by every studio.
- **`createHeroSection(studioId, bannerClass)`** (`lib/thumbnails.js`) — creates the gradient hero banner with studio-specific imagery.
- **`createUploadPicker()`** (`src/components/UploadPicker.js`) — reusable file upload UI with drag-and-drop.
- **`createInlineInstructions(studioId)`** (`src/components/InlineInstructions.js`) — context-aware instructions panel.
- **`mountPersonalizeTrigger()`** / `replaceTokensInPrompt()` (`src/components/personalize/personalizePopover.js`) — GTM personalization popover for prompt templating.
- **`StudioThumbnailModal`** (`src/components/modals/StudioThumbnailPanel.jsx`) — studio-specific thumbnail customization.
- **`AuthModal`** (`src/components/AuthModal.js`) — shown when `requireEntitlement()` fails.
- **`requireEntitlement()`** (`lib/clerkEntitlements.js`) — gates paid features; shows `UpgradePrompt` if user lacks `smartvideo_full_access`.

### State Management
- **Local component state**: Each studio factory uses plain `let` variables for state (no React `useState` in vanilla studios). State is mutated in event handlers and the DOM is updated imperatively.
- **Store pattern** (`src/stores/base/Store.js`): Pub/sub store with `getState()`, `setState()`, `subscribe()`. Used for modal state (`modal.store`).
- **React Context**: `StoreProvider.jsx` wraps the React modal system with `StoreContext`.
- **MobX**: Listed in dependencies (`mobx`, `mobx-react`) but the active codebase has migrated to the custom `Store` class. Legacy MobX stores may still exist in `src/stores/`.
- **`videoIntentStore`** (`lib/videoIntentStore.js`): Global state for video generation intent (shared between Chat Studio and generation studios).
- **`renderQueueStore`** (`lib/editor/renderQueueStore.js`): Manages render job queue for Render Page.

### Reusable Components
- **`MediaPreview`** (`src/components/MediaPreview.js`) — image/video preview with fullscreen mode
- **`SubtitleControls`** (`src/components/SubtitleControls.jsx`) — subtitle editor controls
- **`TokenEditor`** (`src/components/TokenEditor.jsx`) — variable token editor for personalization
- **`CameraControls`** (`src/components/CameraControls.js`) — cinema camera movement/lens controls
- **`RetakePanel`** (`src/components/RetakePanel.jsx`) — regeneration UI
- **`InlineInstructions`** — per-studio instruction panels
- **`agentPanel`** (`src/components/agentPanel.js`) — agent UI panel
- **`UploadPicker`** — drag-and-drop file upload

---

## 4. Model Registry

### Primary File: `lib/models.js`
Contains `MODELS` object with ~30 model definitions (the file header claims "200+ AI models" but the actual `MODELS` object has ~30 entries; the broader catalog is in `public/api/model-catalog.json` generated at build time).

### Model Categories (in `MODELS`)
| Type | Models | Example IDs |
|------|--------|------------|
| `text-to-image` | 5+ | `flux-dev`, `flux-schnell`, `nano-banana-2`, `flux-1.1-pro`, `midjourney-v7`, `sdxl` |
| `image-to-image` | 4+ | `flux-dev-i2i`, `flux-kontext-dev-i2i`, `nano-banana-2-edit`, `gpt-4o-edit` |
| `text-to-video` | 5+ | `kling-v3.0-pro`, `kling-v2.1-pro`, `runway-gen-3`, `sora`, `veo-3`, `seedance-2.0`, `wan-2.1` |
| `image-to-video` | 4+ | `kling-v3.0-pro-i2v`, `runway-gen-3-i2v`, `veo-3-i2v`, `midjourney-v7-i2v` |
| `video-to-video` | 1+ | `ltx-2.3-lipsync` |
| `voice-cloning` | 2 | `elevenlabs-voice-clone`, `coqui-voice-clone` |
| `text-to-speech` | 2 | `elevenlabs-tts`, `openai-tts` |
| `video-to-video` (tools) | 1 | `video-watermark-remover` |
| `image-to-image` (upscale) | 2 | `upscale-2x`, `face-enhancer` |

### Additional Model Groups (derived from `models.js` exports)
- `audioModels` — audio generation models
- `avatarModels` — avatar/talking head models
- `trainingModels` — LoRA training models
- `videoToolsModels` — video processing tools
- `textModels` — LLM/chat models
- `lipsyncModels`, `imageLipSyncModels`, `videoLipSyncModels` — lip sync variants
- `i2iModels` (expanded) — 25+ edit models listed in `EditStudio.js` (Flux Kontext, GPT-4o, Midjourney, Nano Banana, Qwen, Wan, Reve, Kling, Vidu, Grok, Flux 2, etc.)
- `i2vModels` (expanded) — 60+ video effect/motion models (Wan AI effects, motion controls, VFX)

### Helper Functions (exported from `models.js`)
- `getModelsByType(type)` — filter models by type string
- `getModelById(id)` — single model lookup
- `getTextToImageModels()`, `getImageToImageModels()`, `getTextToVideoModels()`, `getImageToVideoModels()`, `getVideoToVideoModels()`, `getVoiceCloningModels()`, `getTextToSpeechModels()` — typed getters
- `supportsAspectRatio(modelId, aspectRatio)` — validates aspect ratio support
- `getModelMaxResolution(modelId)` — returns max resolution string
- `supportsMultipleImages(modelId)` — checks `maxImages > 1`
- `getModelMaxImages(modelId)` — returns max images count
- `DEFAULT_MODELS` — default selections per use case
- `MODEL_CATEGORIES` — UI organization object

### Other Model-Related Files
- `lib/modelSelectorUI.js` — `PROVIDER_LOGOS`, `invertLogos`, `getProviderStyle()`, `getAvailableProviders()`, `filterModels()`, `renderProviderSidebar()`, `renderSearchBar()`, `renderModelList()` — UI rendering helpers
- `lib/modelDescriptions.js` — human-readable model descriptions
- `lib/modelCatalog.js` — client-side model catalog
- `backend/services/modelCatalogService.js` — serves `public/api/model-catalog.json` (pre-built at build time)

---

## 5. Services & APIs

### Client-Side Services (`src/lib/`)

#### `lib/muapi.js` — MuapiClient (Primary AI Gateway)
- Singleton-style class exported as `muapi`
- **Base URL**: `https://api.muapi.ai` (direct in old code, proxied via Supabase edge function in current code)
- **Proxy URL**: In dev, `/functions/v1/muapi-proxy` (Vite-proxied). In prod, `${VITE_SUPABASE_URL}/functions/v1/muapi-proxy`
- **Key methods**:
  - `generateImage(params)` — T2I via muapi
  - `generateImageToVideo(params)` — I2V
  - `generateVideo(params)` — T2V
  - `processV2V(params)` — video-to-video (upscale, effects, watermark)
  - `generateLipSync(params)` — lip sync generation
  - `generateAvatar(params)` — avatar generation
  - `generateAudio(params)` — audio/music generation
  - `trainModel(params)` — LoRA training
  - `uploadFile(file)` — upload to muapi proxy, falls back to Supabase Storage
  - `pollForResult(requestId, ...)` — polls for async job completion
- **Auth**: Reads Muapi API key from `apiKeyManager` (`x-api-key` header)
- **Rate limiting**: Token-bucket via `lib/services/RateLimiter.js`
- **Analytics**: Tracks generations via `lib/analytics.js`

#### `lib/ttsService.js` — TTSService
- Multi-provider TTS: Coqui, OpenAI, Azure, ElevenLabs
- `generateSpeech(text, options)` dispatches to provider-specific methods
- Used by Audio Studio and Video Agent

#### `lib/openaiService.js`
- Direct OpenAI API integration
- Used for prompt enhancement, GTM responses, and some text generation

#### `lib/videoDb.js`
- VideoDB API client
- Used by Director, Video Agent, Timeline for video indexing/search

#### `lib/analytics.js`
- In-browser analytics client
- Sends event batches to `POST /api/analytics` on the backend

#### `lib/supabase.js` — SupabaseClient
- **Simulation stub**: The current `lib/supabase.js` is a mock/simulation client (not the real Supabase JS SDK). It simulates `from()`, `insert()`, `select()`, `storage` operations with timeouts.
- Real Supabase JS SDK (`@supabase/supabase-js`) is listed in `package.json` but the active client code appears to be the simulation layer.
- Tables referenced: `generations`, `characters`, `storyboards`

#### `lib/hybrid-supabase.js`
- Real Supabase integration (referenced by `TimelineEditorPage.jsx` and `uploadPipeline.js`)
- Provides `uploadFileToStorage()`, `supabase` client instance

### Backend Services (`backend/services/`)

| Service | Route | Purpose |
|---------|-------|---------|
| `aiAgentService.js` | `/api/ai-agent` | AI agent orchestration |
| `sceneDetectionService.js` | `/api/scene-detection` | Scene boundary detection |
| `semanticSearchService.js` | `/api/semantic-search` | Semantic video search |
| `speechTranscriptionService.js` | `/api/speech-transcription` | Audio transcription |
| `videoAgentService.js` | `/videoagent` | Video processing (FFmpeg, VideoDB, OpenAI). Retry wrapper, rate limiting. 45+ agent tools. |
| `agentActionsService.js` | `/api/agents` | Agent action execution |
| `modelCatalogService.js` | `/api/model-catalog` | Serves pre-built model catalog JSON |
| `videoDbProxyService.js` | `/api/videodb` | VideoDB API proxy (index, search, stream, resolve) |
| `gtmBoostService.js` | `/api/gtm-boost` | GTM content generation (sales roles, industries, methodologies) |
| `storyboardService.js` | `/api/storyboard` | Storyboard generation backend |
| `directorProxy.js` | (internal) | Proxies Director agent requests to local Flask/socket.io service (`localhost:8000`) or VideoDB chat API |

### Backend Auth (`backend/middleware/auth.js`)
- Verifies Supabase JWT via `POST ${SUPABASE_URL}/auth/v1/user`
- Exports `auth` (strict) and `optionalAuth` (passes through if no token)
- Dev bypass: `x-dev-bypass: <DEV_BYPASS_SECRET>` header in development

### Supabase Edge Functions (`supabase/functions/`)

| Function | Purpose |
|----------|---------|
| `muapi-proxy/` | Primary AI gateway proxy. Forwards requests to `api.muapi.ai`. Rate limiting, CSRF protection, endpoint validation, OpenAI key forwarding, unwrapResponse. |
| `muapi-webhook/` | Receives muapi.ai webhooks. HMAC signature verification, updates generation status. |
| `process-upload/` | Handles file upload processing |
| `create-share/` | Creates shareable links |
| `ai-cinematic-prompt-generator/` | Generates cinematic prompts |
| `ai-thumbnail-generator/` | Generates thumbnails |
| `frame-agent/` | Frame-level agent processing |
| `videoagent/` | Video agent edge function |

---

## 6. Supabase

### Configuration
- **Client-side**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`
- **Server-side**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` in backend `.env`
- **No `config.toml`** found in `supabase/` directory (may be managed via Supabase Dashboard or CLI)
- **Edge functions** deployed to Supabase; secrets set via `supabase secrets set`

### Migrations (`supabase/migrations/`)
22 migration files covering:
- `20260310081146_create_core_tables.sql` — core tables
- `20260310144824_create_thumbnails_and_instructions.sql` — thumbnails
- `20260311021031_create_uploads_storage_bucket.sql` — storage bucket setup
- `20260314191122_create_multi_tenant_core_schema.sql` — tenants, users, roles
- `20260314191306_create_projects_and_new_generations.sql` — projects, generations (`cost_credits`)
- `20260314191343_create_usage_billing_audit_tables.sql` — **billing tables** (usage_logs, credit_balances, credit_transactions, subscriptions, audit_logs, api_keys)
- `20260314191423_create_sharing_notifications_settings.sql` — sharing, notifications, settings
- `20260314191518_seed_roles_and_helper_functions.sql` — RBAC roles, `log_credit_usage()` function, seed data
- `20260314193620_create_multi_tenant_storage_system.sql` — storage system
- `20260709_intelligence_personalization_tables.sql` — personalization tables
- `20260715000000_create_projects_and_media.sql` — projects and media
- `20260730_create_distributed_rate_limiter.sql` — rate limiting
- `20260801000000_enable_pgcron_and_schedule_cleanup.sql` — pg_cron, cleanup jobs
- `20260803000000_allow_pdfs_in_uploads_bucket.sql` — PDF upload support
- `20260803000001_create_content_library_table.sql` — content library
- `20260803000002_fix_content_library_rls.sql` — RLS fix
- `20260803000003_content_library_updated_at_trigger.sql` — trigger

### Storage Buckets
- `uploads` — user file uploads (images, videos, audio, PDFs)
- `media` — generated media assets

---

## 7. Authentication

### Clerk Integration
- **Packages**: `@clerk/clerk-js` (v6.20.0), `@clerk/react` (v6.12.4)
- **Config**: `VITE_CLERK_PUBLISHABLE_KEY` (client), `CLERK_SECRET_KEY` (server/edge)
- **Auth Pages**: `src/components/auth/ClerkAuth.jsx` — mounts sign-in, sign-up, forgot-password, reset-password, account, profile routes
- **Header Auth**: `src/components/auth/HeaderAuth.jsx` — mounts Clerk user button in header
- **Dev Bypass**: `src/lib/devAuth.js` — `window.devLogin()` for local development; auto-sign-in if `VITE_DEV_USER_EMAIL`/`VITE_DEV_USER_PASSWORD` set
- **Backend Auth**: `backend/middleware/auth.js` verifies Supabase JWTs (not Clerk tokens) — note: the backend uses Supabase auth, not Clerk sessions

### Entitlements (`lib/clerkEntitlements.js`)
- `useEntitlement()` — React hook using `@clerk/react`'s `useAuth().has()` with feature `smartvideo_full_access`
- `requireEntitlement()` — async guard; shows `UpgradePrompt` toast if user lacks access
- `getEntitlement()` / `setEntitlement()` — globalThis cache (non-persistent)
- `hasFullAccess()` — checks cache

### API Key Manager (`lib/apiKeyManager.js`)
- Manages per-provider API keys: `muapi`, `openai`, `videodb`
- Storage: `sessionStorage` (primary) + `localStorage` (optional, obfuscated)
- Obfuscation: Base64 with salt prefix `muapi_2024_` (not encryption)
- Key hashing: SHA-256 for validation without exposure
- Exports: `apiKeyManager` singleton with `getMuapiKey()`, `hasMuapiKey()`, `setMuapiKey()`, `getKey()`, etc.
- `isDevBypass` — flag for dev auth bypass mode

---

## 8. Billing & Credits

### Database Schema (`supabase/migrations/20260314191343_create_usage_billing_audit_tables.sql`)
- **`usage_logs`** — per-resource consumption tracking (studio_type, credits_consumed, quantity, unit)
- **`credit_balances`** — per-tenant current balance (`credits_available`, `credits_consumed`, `credits_purchased`)
- **`credit_transactions`** — purchase/grant/refund/adjustment history
- **`subscriptions`** — plan_type, status, billing_interval, price_amount, credits_per_month, payment_provider
- **`audit_logs`** — comprehensive audit trail
- **`api_keys`** — hashed programmatic API keys

### Credit Logic (`supabase/migrations/20260314191518_seed_roles_and_helper_functions.sql`)
- `log_credit_usage(tenant_id, user_id, resource_type, resource_id, credits_amount, ...)` — deducts credits atomically, checks balance, raises exception if insufficient
- Seed data: 100 free credits for new tenants

### Frontend Billing
- **No dedicated billing UI** in the current codebase — billing is managed via Clerk entitlements + Supabase
- `UpgradePrompt.js` — simple toast: "Upgrade to access this feature"
- `requireEntitlement()` gates studios/features based on Clerk's `has({ feature: 'smartvideo_full_access' })`
- Credit error handling in `muapi.js`: 402/403 responses surface real errors (no silent fallback)

---

## 9. Storage & Uploads

### `lib/s3.js` (Legacy)
- Uses `noxmox-vremix` (emulation) or `knox` (real S3) based on `config.s3.emulation`
- MIME type mapping for images, videos, audio
- `saveMedia()` — saves to S3 with UUID key
- **Status**: Legacy code; active uploads use Supabase Storage or muapi proxy

### `lib/editor/uploadPipeline.js` (Active)
- Unified upload pipeline for all file sources: file input, drag-and-drop, clipboard, cloud import, API
- **Steps**: Validate → Read metadata → Upload → Create asset → Generate thumbnail → Insert into timeline → Save → Undo snapshot → Refresh UI
- Validation: magic bytes (`file-type`), MIME, extension
- Metadata extraction: `mediainfo.js`, `exifr`, `music-metadata-browser`, `mp4box`
- Upload: `uploadFileToStorage()` from `hybrid-supabase.js` (Supabase Storage)
- Thumbnail: data URL for images, video frame capture for videos
- Integration: timeline state, persistence, undo stack

### Upload Flow Across Studios
- Studios call `createUploadPicker()` for file selection UI
- `processFileUpload(file, options)` from `uploadPipeline.js` is the central entry point
- Image/video/audio files go through validation → Supabase Storage upload → asset creation
- Muapi proxy handles uploads for AI processing (with Supabase fallback on network errors)

---

## 10. Protected Systems

These systems are explicitly identified as protected and must NOT be modified:

### Director
- **`src/components/DirectorPage.js`** — 45 production-ready agents wired to real backend endpoints (VideoDB, Video Agent, FFmpeg). Agent categories: analysis, search, extract, translate, enhance, audio, edit, create, social.
- **`apps/director/`** — Separate director application with its own `frontend/` (React/Vite/TS) and `backend/` (Flask/socket.io Python service)

### Video Agent
- **`src/components/VideoAgentPage.js`** — 20+ AI tools: scene detection, clip segmentation, highlight detection, voice cloning (CosyVoice, Fish Speech, Seed-VC), Whisper transcription, ImageBind, dubbing, color correction, upscale, stabilize, storyboarding, text-to-movie, visual search, keyword search, Slack integration, faceless video creator, etc.

### Timeline
- **`src/components/Timeline.js`** — Legacy Timeline component (extends `Component` base class). State-based with tracks, clips, zoom, playhead.
- **`src/components/TimelineEditorPage.jsx`** — Full timeline editor page (6946 lines). Imports: drag-drop, persistence, media library, design system enforcement, keyframe system, transition editor, subtitle timeline, CineGen integration, agent integration, color correction. The primary timeline editing surface.
- **`packages/timeline-editor/`** — `@higgsfield/timeline-editor` TypeScript package. Uses `@tanstack/react-virtual`, `@xstate/react`, `xstate` state machines. Adapters, hooks, services, types.

### Render
- **`src/components/RenderPage.js`** — Render/export hub. Action tiles: Create Shorts, Generate Highlights, Add Subtitles, Dub/Voiceover, Trailer Cut, Social Resize. Preset configurations (Luxury Brand Grade, Documentary Contrast, Film Trailer Punch, Emotional Story Tone). Repository endpoints: Open Higgsfield, SmartVideo, Director, ViMax, Rendiv, LTX-Desktop, chatvideo-yucut. Render queue management.
- **`apps/ai-vfx/`** — Separate Vite + React app (port 3001). Built and copied to `dist/ai-vfx/` during root build. Contains AI VFX processing.

---

## Additional Architecture Notes

### Monorepo Structure
- **Root**: Main SmartVideo app (Vite + vanilla JS/React hybrid)
- **`packages/`**: Shared TypeScript packages (`timeline-editor`, `layout`, `navigation`, `tokens`, `transitions`, `subtitles`, `video-compiler`, `audio-mixer`, `color-grading`, `style-templates`, `ai-chat`, `intelligence`, `assets`)
- **`apps/`**: Separate deployable apps (`ai-vfx` — Vite+React, `director` — Flask backend + React frontend, `vimax` — separate workspace)
- **`backend/`**: Express server for API routes, WebSocket MCP server, FFmpeg processing

### Design System
- Tailwind CSS 4.x with custom theme tokens
- `tailwind-merge` + `clsx` + `class-variance-authority` for class composition
- Custom CSS variables for colors (`--color-primary`, etc.)
- `designSystemEnforcer.js` enforces design tokens in timeline editor

### State Management Summary
| Scope | Mechanism |
|-------|-----------|
| Studio UI state | Local `let` variables (vanilla JS) |
| Cross-component state | `Store` pub/sub class (`src/stores/base/Store.js`) |
| Modal state | `modal.store` via `StoreProvider` React context |
| Router state | `lib/router.js` (page, params) |
| Video intent | `lib/videoIntentStore.js` (global mutable object) |
| Render queue | `lib/editor/renderQueueStore.js` |
| User auth | Clerk (`@clerk/react`) + `apiKeyManager` |
| Projects/assets | `lib/editor/persistence.js` + Supabase |

### AI Provider Routing
1. **Muapi.ai** — primary AI gateway for all generation (images, video, audio, avatars, training, lip sync, effects, upscale, video tools)
2. **OpenAI** — direct for chat, prompt enhancement, some TTS
3. **ElevenLabs / Coqui** — voice cloning and TTS (via muapi proxy or direct)
4. **VideoDB** — video indexing, search, scene detection, streaming
5. **FFmpeg** — local video processing (scene detection, upscale, color correction, stabilization, finalization)
6. **Supabase Edge Functions** — proxy layer for muapi, webhooks, uploads

### Security
- CSP headers in dev (allowlists for Clerk, Muapi, Supabase, localhost)
- API keys obfuscated (not encrypted) in browser storage
- Backend verifies Supabase JWTs
- Muapi proxy: CSRF protection, rate limiting, endpoint validation, HMAC webhook verification
- `lib/security.js` — `escapeHtml()`, `createSafeImage()`, `createSafeVideo()`

---

## Protected Systems File List (Must NOT Be Modified)

### Director
- `src/components/DirectorPage.js`
- `apps/director/` (entire directory)

### Video Agent
- `src/components/VideoAgentPage.js`

### Timeline
- `src/components/Timeline.js`
- `src/components/TimelineEditorPage.jsx`
- `packages/timeline-editor/` (entire directory)

### Render
- `src/components/RenderPage.js`
- `apps/ai-vfx/` (entire directory)
