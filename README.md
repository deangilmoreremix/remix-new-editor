# SmartVideo — AI Video Agency Studio

SmartVideo is an AI video generation studio and "video agency in a box." It bundles
20+ generation models behind a single hash-routed SPA and a set of specialized
studios (Image, Video, Cinema, Character, AI‑VFX, Influencer, Commercial, Director,
Timeline, Video Agent, and more). Users log in with Clerk, store assets in
Supabase, generate with MiniMax H3 / MuAPI / VideoDB, and finish with a VideoDB
("Director") rendering pipeline.

The product ships as:

- **Frontend SPA** — built with Vite, deployed to **Netlify** from `main`.
- **videoagent-backend** — Node/Express proxy + AI agents, deployed to **Render** from `develop`.
- **director-backend** — VideoDB finishing backend (Docker), deployed to **Render** from `develop`.
- **director-frontend** — Director UI (Docker), deployed to **Render** from `develop`.

---

## Deploy targets

| Target | Service | Source branch | Build / start | Notes |
| --- | --- | --- | --- | --- |
| Netlify | Frontend SPA | `main` | `npm ci --include=optional && npm run build`, publish `dist` | Build-time env in dashboard; runtime secrets come from `import.meta.env` (Vite). |
| Render | `videoagent-backend` | `develop` | `npm install` → `node server.js`, health `/health` | `OPENAI_API_KEY` set manually after first launch (Render does **not** read `.env`). |
| Render | `director-backend` | `develop` | Docker (`apps/director/backend/Dockerfile`) | Reads `VIDEO_DB_API_KEY`, `OPENAI_API_KEY`, and Postgres via `director-db`. |
| Render | `director-frontend` | `develop` | Docker (`apps/director/frontend/Dockerfile`) | `VITE_APP_BACKEND_URL` injected from `director-backend`. |

Netlify applies security headers (`X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, etc.), SPA auth-route redirects
(`/signin`, `/signup`, `/account`, …), a model-catalog redirect, and a
`/director-api/*` proxy to `${DIRECTOR_API_URL}` (set as a Netlify build-time env
var — if unset, the call falls through to the SPA fallback and 404s rather than
silently mocking).

> **Note:** Render services deploy from `develop`, not `main`. Merging frontend
> changes to `main` only triggers Netlify; backend/Director changes must land on
> `develop` to reach Render.

---

## Prerequisites & install

- Node.js **>= 20** (Netlify pins `NODE_VERSION = "20"`).
- npm (use `npm ci` so the lockfile is authoritative).
- The MiniMax H3 upstream gallery repo is **required only to regenerate** the
  demo manifest; it is not needed for a normal build (the generated files are
  committed under `src/data/`).

```bash
# 1. Install exactly what the lockfile declares.
npm ci

# 2. (Only if you changed the MiniMax H3 demo list) regenerate the manifest.
#    Exact invocation from scripts/generate-minimax-h3-manifest.mjs:
node scripts/generate-minimax-h3-manifest.mjs /path/to/awesome-minimax-h3-prompts

# 3. Build the frontend.
npm run build

# 4. Optional: typecheck/lint/tests before deploy.
npm run lint
npm test
```

`npm run build` = `rm -rf dist && vite build && cp -R apps/ai-vfx/dist dist/ai-vfx`.
The `apps/ai-vfx` workspace is proxied under `/ai-vfx/` in production.

### Why the manifest step exists

`scripts/generate-minimax-h3-manifest.mjs` regenerates
`src/data/minimaxH3Demos.ts`, `src/data/minimaxH3Prompts.json`, and
`src/data/minimaxH3Prompts.ts` from the upstream
`awesome-minimax-h3-prompts` `prompts/gallery.json`. It exists because:

- upstream `category` values are coarse and frequently wrong,
- upstream has no per-demo use-case copy, CTA routing intent, or numeric duration,
- the ~69 KB of full prompt text must be **code-split out** of the landing
  critical path (only the prompt modal lazy-imports it).

The generated `minimaxH3Demos.ts` is the single source of truth for every MiniMax
H3 landing section — components must not duplicate demo metadata, and they map a
demo category to a studio route via `getCreateTarget()` rather than hardcoding URLs.

---

## Required environment variables

Vite only exposes **`VITE_`-prefixed** variables to the browser. Non-prefixed
vars are server/edge/backend only. Copy `.env.example` to `.env` for local dev.

| Variable | Where set | Purpose | Safe default / example |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Netlify dashboard / `.env` | Supabase project URL (auth, storage, edge fns) | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Netlify dashboard / `.env` | Supabase anon key (client) | `your-anon-key-here` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Netlify dashboard / `.env` | Clerk publishable key (client auth) | `pk_test_…` |
| `CLERK_SECRET_KEY` | Netlify edge / backend secrets | Clerk secret key (server/edge) | `sk_test_…` |
| `VITE_BACKEND_URL` | Netlify dashboard / `.env` | Routes VideoDB calls through the Render proxy | `https://videoagent-backend.onrender.com` |
| `OPENAI_API_KEY` | **Render** dashboard (`gtmBoostService`, `videoAgentService`) | Powers GTM Boost and Video Agent | set manually; `sync: false` |
| `VIDEO_DB_API_KEY` | Render `director-backend` | VideoDB finishing API key | set manually; `sync: false` |
| `VIDEO_DB_BASE_URL` | Render `videoagent-backend` | VideoDB base URL | `https://api.videodb.io` |
| `VIDEO_DB_DEFAULT_COLLECTION` | Render `videoagent-backend` | Default VideoDB collection | `default` |
| `DIRECTOR_API_URL` | **Netlify build-time** env | Backend URL for `/director-api/*` proxy in prod | `https://director-backend.onrender.com` |
| `DIRECTOR_BASE_URL` | Render `videoagent-backend` | Director FastAPI base URL | `http://localhost:8000` |
| `AGENT_ACTIONS_URL` | Render `videoagent-backend` | Internal agent actions endpoint | `http://localhost:3001` |
| `MUAPI_API_KEY` / `VITE_MUAPI_KEY` | Supabase edge secrets / Netlify | MuAPI key (server proxy vs client) | `your-key` |
| `MUAPI_BASE_URL` | Render `videoagent-backend` | MuAPI API base | `https://api.muapi.ai/api/v1` |
| `PEXELS_API_KEY` | Netlify / Render | Pexels stock proxy (server) | `your-pexels-api-key-here` |
| `VITE_PEXELS_ENABLED` | Netlify / `.env` | Enables Pexels integration client-side | `true` / `false` |
| `VITE_PEXELS_API_KEY` | Netlify / `.env` | Optional per-user Pexels key | _(empty)_ |
| `SUPABASE_URL` | Render `videoagent-backend` | Supabase URL (backend) | _(project url)_ |
| `SUPABASE_ANON_KEY` | Render `videoagent-backend` | Supabase anon (backend) | _(anon key)_ |
| `SUPABASE_SERVICE_KEY` | Render `videoagent-backend` | Supabase service role (backend) | _(service key)_ |
| `MAIGRET_WORKER_URL` | **Netlify** functions | Maigret worker URL (Discover graph data) | _(Render maigret-worker URL)_ |
| `MAIGRET_WORKER_SECRET` | **Netlify** functions | Maigret worker auth secret | _(worker secret)_ |
| `GTM_BOOST_MODEL` | Render `videoagent-backend` | Model for GTM Boost (optional) | `gpt-4o-mini` |
| `FFMPEG_PATH` | Render `videoagent-backend` | ffmpeg binary path | `ffmpeg` |
| `SLACK_WEBHOOK_URL` | Render `videoagent-backend` | Optional job notifications | _(webhook)_ |
| `VITE_DIRECTOR_API_URL` | `.env` (dev) | Director URL for Vite dev proxy | `http://localhost:8000` |
| `VITE_DIRECTOR_SOCKET_URL` | Netlify / `.env` | Director Socket.IO URL (prod) | _(director URL)_ |
| `VITE_WHISPER_LOCAL_URL` | `.env` | Local Whisper endpoint | `http://localhost:8080` |
| `VITE_MUAPI_URL` | n/a | MuAPI client base URL | `https://api.muapi.ai` |
| `VITE_DEV_USER_EMAIL` / `VITE_DEV_USER_PASSWORD` | `.env` | Dev-only auto-login | _(empty)_ |
| `VITE_DEV_BYPASS_AUTH` | `.env` | Skip API-key prompt in local dev (`true` or `?dev`) | `false` |
| `VITE_ENABLE_ANALYTICS` | Netlify / `.env` | Enable analytics (prod only) | `false` |
| `VITE_LOG_LEVEL` | Netlify / `.env` | Client log verbosity | `INFO` |
| `VITE_ERROR_TRACKING_DSN` | Netlify / `.env` | Error-tracking DSN (note: **not** `VITE_ENABLE_ERROR_TRACKING`) | _(empty)_ |
| `VITE_APP_VERSION` / `VITE_BUILD_HASH` | Netlify / `.env` | Build metadata shown in UI | `1.0.0` / `devel` |
| `VIDEO_AGENT_BACKEND_URL` | Render `videoagent-backend` + Supabase edge | Public backend URL for the Video Agent edge fn | `https://videoagent-backend.onrender.com` |
| `MINIMAX_H3_REPO` | shell (optional) | Fallback path for the manifest generator | `../awesome-minimax-h3-prompts` |
| `NODE_ENV` / `PORT` | Render (auto) | Runtime env / port | `production` / `10000` |
| `DEV_BYPASS_SECRET`, `AUTH_VERIFY_TIMEOUT_MS` | Render `videoagent-backend` | Auth middleware tuning | `local-dev-only` / `5000` |
| `POSTGRES_*` (DB_TYPE=postgres) | Render `director-backend` | Injected from `director-db` | from database |
| `VITE_APP_BACKEND_URL` | Render `director-frontend` | Injected from `director-backend` | `RENDER_EXTERNAL_URL` |

> **Secret hygiene:** Netlify's `SECRETS_SCAN_OMIT_KEYS` already excludes
> `CLERK_SECRET_KEY`, `MAIGRET_WORKER_SECRET`, and `MAIGRET_WORKER_URL` from the
> build-time secrets scan. Never commit `.env`; only edit `.env.example`.

---

## Architecture notes

### Two modal base systems
The studio UI has **two** parallel modal foundations — do not assume they are
interchangeable:

- **`src/components/modals/BaseModal.jsx`** — the *current* React-Component
  modal base, styled with the Timeline Design System CSS variables
  (`--bg`, `--panel`, `--cyan`, …) and a `createElementFromHTML` renderer. New
  modals (e.g. `GTMPromptModal.jsx`, `AIVideoCreator.jsx`,
  `TemplateGeneratorModal.jsx`, `RecorderModal.jsx`) extend this.
- **`src/components/modals/BaseModal.react.js`** — a *legacy* class-based
  `Modal extends Component` base (overlay/animation/accessibility lifecycle via
  `beforeMount`/`mounted`/`beforeUnmount`). Kept for older callers; treat as
  legacy and prefer `BaseModal.jsx` for new work.

Modal orchestration lives in `src/lib/uiIntegration.js` (the
`EnhancementModalManager`, `extendGenerationPanel`, and `openGTMPromptModal`).

### Lazy landing-section pattern
`src/components/landing/LandingPage.jsx` renders the header and hero eagerly,
then every other section via `createLazySection(importFn, id, props, index)`.
Each section is wrapped in a `min-h-[200px]` spinner placeholder observed by a
single `IntersectionObserver` (`rootMargin: '20000px'`) that dynamically
`import()`s the section module, swaps the placeholder, and applies the
`.animate-in` / `.stagger-N` reveal classes. The MiniMax H3 showcase sections
(`MinimaxWorkflowSection`, `MadeWithSmartVideo`, `UGCDemoShowcase`,
`AIVideoGallery`, `AcademyVideoShowcase`, `RepoShowcase`) and the new
`GTMBoostSection` all use this same observer — none are statically imported.

### GTM Boost flow
GTM Boost turns a one-line idea into a structured, cinematic, go-to-market prompt.

- The feature is exposed as **`openGTMPromptModal(appTheme, onPromptGenerated, onGenerateThumbnail)`**
  in `src/lib/uiIntegration.js`. It instantiates `GTMPromptModal` (from
  `BaseModal.jsx`) and wires a default callback that writes the generated prompt
  into the studio's prompt `<textarea>` (or copies to clipboard) and dispatches a
  `gtm:prompt-generated` window event; it can also generate a thumbnail and
  dispatch `gtm:thumbnail-generated`.
- The backend side (`backend/services/gtmBoostService.js`) calls `OPENAI_API_KEY`
  (model `GTM_BOOST_MODEL` or `gpt-4o-mini`) to produce the structured output.
- On the landing page, `GTMBoostSection.jsx` **replaces the old floating FAB**:
  it presents GTM Boost as a feature section (what it is, a static input→output
  demo mirroring the real modal's Hook / Story Beat / Visual / Audio / CTA
  structure, and a real demo clip whose prompt is inspectable via the shared
  "View Prompt" modal). Its "Try GTM Boost" button dynamically imports
  `uiIntegration.js` → `openGTMPromptModal` so the heavy modal + OpenAI/Supabase
  deps stay out of the standalone landing bundle.

---

## Common failure modes / runbook

- **Missing generated manifest** — build fails or landing sections can't import
  `src/data/minimaxH3Demos.ts` / `minimaxH3Prompts.ts`.
  *Recover:* if you touched the demo list, run
  `node scripts/generate-minimax-h3-manifest.mjs /path/to/awesome-minimax-h3-prompts`;
  otherwise restore the committed generated files and rebuild.

- **Secret not set** — e.g. `OPENAI_API_KEY` missing on Render → GTM Boost and
  Video Agent return 500s; `VIDEO_DB_API_KEY` missing → Director finishing
  fails; `CLERK_SECRET_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` mismatch → login
  loops; `MAIGRET_WORKER_URL` unset → Discover graph data is skipped (degrades,
  doesn't crash).
  *Recover:* set the key in the relevant dashboard (Render for backend keys,
  Netlify for `VITE_*` and Netlify function keys). Remember Render does **not**
  read `.env.local` — use the dashboard or `render env set`.

- **Backend down / unreachable** — `VITE_BACKEND_URL` or `VIDEO_AGENT_BACKEND_URL`
  points at a spun-down free Render service (cold start) or a wrong region.
  *Recover:* confirm `videoagent-backend` health at `/health`; for free plans
  expect a cold-start delay; verify the URL in the dashboard matches the env var.

- **Director socket proxy 404** — `/director-api/*` on Netlify rewrites to
  `${DIRECTOR_API_URL}/:splat` over HTTP only; Socket.IO upgrades may not proxy.
  *Recover:* ensure `DIRECTOR_API_URL` is set as a Netlify build-time env var and
  that the Director backend serves Socket.IO; set `VITE_DIRECTOR_SOCKET_URL`
  separately if the socket needs a different host.

- **Wrong branch deployed** — frontend merged to `main` but backend change not on
  `develop`. *Recover:* backends deploy from `develop`; promote backend changes
  there, not `main`.

---

## What shipped recently

- **Landing page redesign** — replaced the hero-first layout with a lazy,
  section-by-section landing (IntersectionObserver-driven `createLazySection`).
  Added a cinematic MiniMax H3 video hero above the legacy hero (legacy hero
  accessibility-fixed to `h2` / single `banner`), plus new showcase sections:
  `MinimaxWorkflowSection`, `MadeWithSmartVideo`, `UGCDemoShowcase`,
  `AIVideoGallery`, `AcademyVideoShowcase`, `RepoShowcase`.
- **GTM Boost feature section** — `GTMBoostSection.jsx` now presents GTM Boost as
  a proper landing feature (replacing the floating FAB). It shows what the
  feature does, a static input→output demo that mirrors the real
  `GTMPromptModal`, and a real demo clip whose prompt opens in the shared
  "View Prompt" modal. "Try GTM Boost" still opens the live modal via
  `openGTMPromptModal`.
