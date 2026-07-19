# Plan: Global Studio Navigation — Back Button + All-Studios Side-Menu Icon

Status: Awaiting human review. (Supersedes the earlier 18-studio estimate — audit found many more.)

## Overview
Every studio surface must expose two consistent navigation affordances:
1. A **Back** button (returns to the Apps hub / previous context).
2. A **side-menu icon** that opens a drawer listing **all routes** so the user can jump to any other studio.

Scope confirmed with user: **all studios**, side-menu lists **all SPA routes**.
NOTE: `apps/vimax` and `apps/director/frontend` are separate deployable apps embedded in/by other
applications (not SPA-routed studios) — **excluded from scope** (vimax confirmed external; director is
its own deployable frontend+backend). Only the in-SPA surface is in scope.

## Accurate audit of the surface

### A) Main SPA — single Vite bundle (`src/main.js` → `src/lib/router.js`)
The SPA shell already renders `Header` (top nav) + a global `Sidebar` (`src/components/Sidebar.js`,
`hidden md:flex` — desktop only, outside studio content). All of the following mount into
`#content-area` and should get the back + menu chrome:

**Vanilla `*Studio.js` components (18)** — none currently have back/menu icon except
TemplateStudio (text link), CinemaTemplateStudio & VideoAgentPage (`#back-btn` SVG, no menu icon):
`ImageStudio, VideoStudio, CinemaStudio, EditStudio, EffectsStudio, UpscaleStudio,
CharacterStudio, InfluencerStudio, CommercialStudio, AvatarStudio, AudioStudio, TrainingStudio,
VideoToolsStudio, ChatStudio, LipSyncStudio, StoryboardStudio, TemplateStudio, CinemaTemplateStudio`

**React `*Page` studio routes (~20+)**: `CinemaPage, CharacterPage, InfluencerPage, EffectsPage,
UpscalePage, StoryboardPage, CommercialPage, TextToImagePage, ImageToImagePage, ImageToVideoPage,
TextToVideoPage, VideoToVideoPage, VideoWatermarkPage, DirectorPage, AIVFXPage, VideoAgentPage,
EditorPage (EditorPage.js), RenderPage, TimelineEditorPage.jsx, ImpeccablePage (×~20 impeccable-* routes)`

**VideoAgent agent catalog (~50 sub-views)** inside `VideoAgentPage.js`: Scene Detection, Highlight
Detection, Visual Search, Keyword Search, ImageBind, Subtitle, Profanity Remover, Automated
Highlights, Storyboarding, Text-to-Movie, Text-to-Video, Kids Storyteller, Faceless Video, AI Ad
Films, TikTok Lyric, Year in Frames, Trailer Narration, CosyVoice, Fish Speech, Seed-VC, Whisper,
Voice Cloning, Audio Overlays, AI Voiceovers, Dubbing, Multi-Lang Dubbing, Clip Segmentation, Color
Correction, Video Upscale, Stabilize, Intro/Outro, Brand Elements, Dynamic Ads, Output Formatting,
Sales Assistant, Slack, Thumbnail, Comparison, Stand-up, Commentary, Video Overview, Meme, Music
Video, Video Q&A, etc. These are launched from within VideoAgentPage (not separate routes) → the
chrome belongs on VideoAgentPage + each agent sub-view.

→ **SPA routes total ≈ 58** (incl. impeccable-*). Target: back+menu on every studio route + agent sub-views.

### B) Director frontend — IN SCOPE (it IS the Director product frontend, deployed on Render)
- `apps/director/frontend` (`DirectorLayout.vue`) uses the shared `@higgsfield/layout/vue` system
  (`AppShell` provides `toggleSidebar`/`sidebarCollapsed`; `Sidebar` shows a collapse toggle when
  `config.collapsible` is true, and already lists all Director "studios": New Chat, Video Search,
  Video Edit, Generate, History).
- Add to the Header `#actions` slot: a **back button** (router back / → '/') and an **all-studios menu
  icon** that calls `toggleSidebar()` to reveal the sidebar. Set `sidebarConfig.collapsible = true`.
- `apps/ai-vfx` — reached **as an in-SPA route** (`ai-vfx` → `AIVFXPage.js`), so covered by (A).

### C) EXCLUDED
- `apps/vimax` — built into another application; not a SPA-routed studio. Excluded.
- `packages/layout` — shared lib; only consumed, not modified for this feature.

### Reference back-button markup (standardize on this)
`CinemaTemplateStudio.js` / `VideoAgentPage.js`:
```js
<button id="back-btn" class="p-2 hover:bg-white/10 rounded-lg transition-colors">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
</button>
```
wired: `container.querySelector('#back-btn').onclick = () => navigate('apps');`

## Architecture decisions
- **Single source of truth for the studio list:** build the all-studios drawer from `src/lib/router.js`
  route keys + labels (derive a display label per route; reuse the global `Sidebar.js` `navItems`
  icon set where available). The drawer = "all routes".
- **Shared SPA helper** `src/lib/studioChrome.js`:
  - `createStudioBackButton(onBack = () => navigate('apps'))`
  - `createStudioMenuButton(onToggle)` (grid/launcher icon)
  - `mountStudioDrawer(rootEl, { routes })` → overlay drawer listing all routes; ESC + backdrop close.
- **React studios** (`*Page.jsx`): a `StudioChrome` React component (`src/components/StudioChrome.jsx`)
  rendering the same back+menu affordances, wrapping page content, so React pages stay consistent
  without manual DOM.
- **Back target:** `navigate('apps')` (Apps hub) by default; agent sub-views return to `video-agent`.
- **External apps (vimax, director):** out of scope — they are not SPA-routed studios.

## Tasks

### Phase 1 — Foundation (SPA)
- [ ] T1: Extract route→{label,icon} map from `router.js` + `Sidebar.js navItems` into
  `src/lib/studioRoutes.js` (single source for the drawer).
- [ ] T2: Create `src/lib/studioChrome.js` (back btn, menu btn, `mountStudioDrawer`) listing **all routes**.
- [ ] T3: Add `StudioChrome.jsx` React wrapper + wire `studio-chrome.css` globally.
- [ ] T4: E2E helper/selector contract: every studio route exposes `[data-studio-back]` and
  `[data-studio-menu]`; drawer `[data-studio-drawer]` lists all routes.

### Checkpoint: Foundation
- [ ] Drawer lists all ~58 routes; back→`navigate('apps')`; no console errors in SPA.

### Phase 2 — Wire SPA studios
- [ ] T5: Vanilla studios (18) — inject `[menu][back]` top row; mount drawer.
- [ ] T6: React `*Page` studio routes — wrap with `StudioChrome`.
- [x] T7: `VideoAgentPage` + its ~50 agent sub-views — back + menu; drawer lists all routes. (Done: `mountStudioDrawer(document.body,{currentRoute:'video-agent'})` wired to a `Studios` menu button; idempotent id `va-studio-drawer` + cleanup removes it on page teardown; existing `Back to Video` button preserved → `navigate('render',{videoId,videoUrl})`. Verified: drawer opens with 64 routes / 5 groups, Video Agent highlighted, route-click navigates and cleans up, ESC/backdrop close.)
- [ ] T8: Standardize existing back buttons (TemplateStudio, CinemaTemplateStudio, VideoAgentPage) onto helper.

### Checkpoint: SPA complete
- [ ] Every SPA studio route + VideoAgent agent view has back + menu; drawer navigates to any route.

### Phase 3 — Director frontend
- [ ] T9b: `DirectorLayout.vue` — `sidebarConfig.collapsible = true`; add back button + all-studios
  menu icon to Header `#actions` (menu toggles sidebar via injected `toggleSidebar`).

### Phase 4 — Polish & tests
- [ ] T10: Mobile: drawer full-screen, closes on selection/backdrop/ESC; keyboard a11y.
- [ ] T11: E2E smoke test — assert back + menu presence on a representative set across SPA studios
  (and Director frontend if a test harness is available).

### Checkpoint: Complete
- [ ] All in-scope studios (SPA + Director frontend) pass; tests green; ready for review.

## Risks / Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Two rendering models (vanilla DOM vs React vs Vue) | High | Three helpers: `studioChrome.js` (vanilla), `StudioChrome.jsx` (React), Vue component in director |
| ~50 agent sub-views in VideoAgentPage re-render per view | Med | Mount drawer once at VideoAgentPage root; back returns to `video-agent` |
| `vimax`/`director` are separate bundles | n/a | Out of scope — not SPA-routed studios |
| Drawer "all routes" is long (~58) | Low | Grouped/categorized drawer (mirror `Sidebar.js` grouping) |
| Breaking existing back buttons | Low | Migrate to shared helper rather than duplicating |

## Open questions (resolved by user)
- Scope: **everything incl. apps/** ✅
- Side-menu lists: **all routes** ✅
- Remaining: confirm back target = `apps` for top-level studios (assumed). Agent sub-views → `video-agent`.
