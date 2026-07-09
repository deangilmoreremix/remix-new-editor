# Intelligence & Personalization Platform

## Overview

The Intelligence & Personalization Platform is a serverless backend + frontend system that enables:

- **Contact intelligence**: Discover public profiles (Maigret scan, GitHub, website crawl)
- **AI enrichment**: OpenAI/Gemini extracts structured business intelligence (company, products, pain points, tone, brand colors)
- **Asset discovery**: Logo, avatar, screenshot, and brand color extraction from websites
- **Auto-timeline generation**: AI-built video scene prompts personalized per contact
- **Token replacement**: `{{firstName}}`, `{{company}}`, etc. inserted into prompts
- **Cross-app handoff**: Send personalized data to other apps (email composer, video editor, CRM)
- **Export**: JSON, CSV, Markdown, HTML report formats

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend SPA   │────▶│  Netlify Funcs   │────▶│  Supabase DB    │
│  (Vite/React)   │     │  (Serverless)    │     │  (Postgres)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       ├── Maigret Worker ──────┤ (external)
        │                       ├── OpenAI / Gemini ──────┤ (external)
        │                       └── GitHub API ──────────┘ (external)
        │
        └── PersonalizeModal.jsx, PersonalizePage.js, VideoPersonalizationHub.jsx
```

## Components

### Backend (Netlify Functions)

| Function | Purpose | Endpoints |
|---|---|---|
| `intelligence-api.js` | Contact management, discovery pipeline, asset extraction, enrichment | `/contact`, `/contacts`, `/profile/:id`, `/discover`, `/assets/:id`, `/variables/:id`, `/auto-timeline/:id`, `/enrich` |
| `personalizer-api.js` | Profile scanning, content generation, visual prompts, handoff, export | `/scan`, `/generate`, `/generate-visual`, `/apps`, `/history`, `/save`, `/send-to-app`, `/export/:scanId` |

### Frontend (SPA)

| Component | Purpose | Location |
|---|---|---|
| `PersonalizePage.js` | Full-page personalization hub with contacts/workflow tabs | `src/components/` |
| `PersonalizeModal.jsx` | "Personalize for a contact" pop-up modal (used in all creation studios) | `src/components/modals/` |
| `VideoPersonalizationHub.jsx` | Multi-step workflow hub (upload → contacts → personalize → generate → deliver → analytics) | `src/components/modals/` |
| `personalizePopover.js` | Token insertion helpers (`insertTokenAtCursor`, `replaceTokensInPrompt`) | `src/components/personalize/` |

### Database (Supabase)

Tables required (migration: `supabase/migrations/20260709_intelligence_personalization_tables.sql`):

- `contacts` — Core contact records (name, email, company, etc.)
- `contact_profiles` — Rich profile data (social, website, assets, brand, intelligence, variables)
- `contact_variables` — Token replacement map (`{ firstName, lastName, company, ... }`)
- `contact_assets` — Discovered logos, avatars, screenshots
- `contact_discoveries` — Discovery attempt history (source, status, error)
- `profile_scan_results` — Maigret scan results (platforms, URLs, metadata)
- `personalization_projects` — User projects (mode, target, status, handoff_history)
- `personalization_outputs` — Generated content (text, visual prompts, metadata)
- `personalizer_apps` — App registry (appId, name, config)
- `personalized_assets` — Generated visual assets (video, image, status)
- `personalizer_templates` — System/user prompt templates (appId, mode, type)

## Environment Variables

Required in Netlify:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-only)
- `OPENAI_API_KEY` — OpenAI API key for enrichment
- `OPENAI_MODEL` — (optional, default `gpt-4o-mini`)
- `GEMINI_API_KEY` — (optional) Fallback AI provider
- `MAIGRET_WORKER_URL` — (optional) External Maigret worker
- `MAIGRET_WORKER_SECRET` — (optional) Maigret worker auth
- `GITHUB_TOKEN` — (optional) Higher rate limit for GitHub API
- `ALLOWED_ORIGINS` — (optional, default `*`) CORS origin

## Known Issues Fixed

1. **Broken `pages/personalize.jsx`** — Used Next.js `Head` component in a Vite project. Removed; the actual working component is `src/components/PersonalizePage.js`.
2. **Missing Supabase tables** — No migration existed for the 11 intelligence/personalization tables. Migration added.
3. **API proxy only worked in dev** — The vite proxy routes `/api/intelligence` and `/api/personalizer` to `localhost:8888` (Netlify CLI). In production, Netlify auto-rewrites these to `/.netlify/functions/*`. A `_redirects` file ensures the rewrite works on the static site.

## Status

✅ Backend functions deployed and operational
✅ Frontend components wired into all creation studios
✅ Supabase schema migration ready
✅ Production API routing via Netlify rewrites
✅ Token replacement working
✅ CSV/JSON/MD/HTML export working
