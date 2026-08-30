# Phase 4C — Protected Commit Manifest

**Date:** 2026-08-29  
**Branch:** `develop`  
**SHA:** `40bc3637b`

This manifest documents the recent authoritative commits that must be preserved during forward-porting. Every recovery decision must preserve newer intentional committed work.

---

## Recent Protected Commits

| Commit | Purpose | Key Files | Must Preserve |
|--------|---------|-----------|---------------|
| `40bc3637b` | Restore SmartVideo branding in prerender.mjs | `scripts/prerender.mjs` | YES — landing-page rebrand |
| `95022df5b` | Apply working tree changes from prior stash operations | `src/components/AIVFXPage.js`, `src/components/DirectorPage.js`, `src/components/OpenMontagePage.js`, `src/lib/router.js`, `.kilo/kilo.json` | YES — studio/routing fixes |
| `98ede443a` | Restore dev proxy, CSP, loading state, health check, dev config | `apps/ai-vfx/next.config.mjs`, `apps/ai-vfx/package.json`, `package.json`, `vite.config.js` | YES — AI-VFX integration |
| `218b9db97` | Add attachment toolbar visibility tests | `tests/e2e/studio-screenshots.spec.js` | YES — e2e coverage |
| `28fbb15e0` | Correct container variables and default toolbar visibility | CSS/styling files | YES — UI fixes |
| `c187131ad` | Add unified attachment toolbar to chat and all creation studios | Multiple studio components | YES — feature commit on main |
| `ff19986cc` | Point all Render services to production branch | `render.yaml` | YES — deployment config |
| `d47056392` | Add attachment toolbar and refine studio upload flows | Upload components | YES — upload system |
| `ac3fe767b` | Add boundary upload tests and test fixtures | Test files | YES — test coverage |
| `a272c90b1` | Pass full demo prompt through Create This Style flow | Landing/studio components | YES — UX fix |
| `5b9f6bbcf` | Flip studio dropdowns to open downward | Studio components | YES — UI fix |
| `f8af44c20` | Harden upload system — centralized limits, boundary tests, pre-commit hook | Upload system | YES — security/stability |
| `85cf64349` | Redesign split-pane layout with larger logos and viewport-aware positioning | Model picker | YES — UI redesign |
| `01426bc26` | Restore personalization content on landing page | Landing page components | YES — landing content |
| `12e3da11b` | Consolidate Pexels into modal, add settings key, wire all studios | Pexels integration | YES — media integration |
| `16dc47936` | Show demos in 20-card chunks in MadeWithSmartVideo | Landing page | YES — performance |
| `9daf2fb2b` | Remove ZeroLu demos from MadeWithSmartVideo and add Show More pattern | Landing page | YES — content curation |
| `9e241a1d7` | Merge edit-studio features into develop | Multiple components | YES — feature integration |
| `57e9c7fb5` | Port Open-Generative-AI model picker design with category tabs | Model picker | YES — UI port |
| `929b78f89` | Align template grid to 5 columns x 6 rows with full-image previews | Template studio | YES — layout fix |
| `34080cd96` | Add explicit dropdown positioning to all studio model pickers | Model pickers | YES — UI fix |
| `95a207e08` | Remove duplicate all-studios button from VideoAgentPage | VideoAgentPage | YES — UI cleanup |
| `c06a52335` | Remove Video Agent from all menus and navigation | Navigation components | YES — navigation cleanup |
| `1d2cb92be` | Remove impeccable routes from studio drawer and wire cinema-page/content-library/studios routes | Router | YES — routing fix |
| `be4e36c7e` | Align prompt bar buttons in one row | Cinema studio | YES — UI fix |
| `a3cef83ba` | Fix example gallery lightbox, image sizing, and show-all button | Example gallery | YES — UI fixes |
| `bad38745e` | Add preview thumbnails and before/after comparison | Edit studio | YES — feature |
| `34544e022` | Prevent model picker dropdowns from opening on load and clean up listener leaks | Model pickers | YES — bug fix |
| `332c5363a` | Update screenshot gallery and add audit artifacts | Screenshots/docs | YES — maintenance |
| `5d0e8ad06` | Update screenshot tests, studio demo configs, and CinemaTemplateStudio fixes | Tests/studios | YES — test/config |
| `276f19935` | Restore tool thumbnails and controls rendering | Edit studio | YES — bug fix |
| `b6475593f` | Add AI captions button to TemplateStudio, CinemaTemplateStudio, and EffectsStudio | Multiple studios | YES — feature |
| `564441f0f` | Sync working tree changes and push to develop | Various | YES — maintenance |
| `247eee7a8` | Replace browse modal with show-more gallery, fix actions, remove Chinese prompts | Image studio | YES — UX improvement |
| `a5645c2e3` | Position model dropdown and add AI captions button to preview view | Cinema template | YES — UI fix |
| `38359326a` | Fix landing section rendering, studio assets, zeroLu demos, tests, and router updates | Landing/studios/router | YES — comprehensive fix |
| `4dc35b213` | Merge Seedance Cinema demos into MadeWithSmartVideo showcase and remove duplicate Cinema Shorts section | Landing page | YES — content consolidation |
| `f79b14c66` | Remove duplicate export keywords in storyboardEngine.js | Storyboard engine | YES — bug fix |
| `abb4c12c7` | Add missing generateTextStream, fix server.js typo, wire deleteConversation, import chat CSS | Chat system | YES — chat fixes |
| `ee60ecd5d` | Add behavioral tests for model/AR selector and API model parameter | Storyboard tests | YES — test coverage |
| `c4a90c542` | Restore model selector functionality and add persistence | Storyboard | YES — bug fix |
| `0c5a6560c` | Simplify modal, remove dead UI/state, add screenshots | AI captions | YES — cleanup |
| `032e4627c` | Merge main into develop with proper conflict resolution | Various | YES — integration |
| `3f5914d89` | Resolve pre-existing build and lint issues | Build config | YES — build fix |
| `7456100f4` | Add dynamic model browser from live API schemas | Edit studio | YES — feature |
| `8af2af3da` | Add React UI components and hook | Chat system | YES — feature |
| `f9fb21c06` | Correct ai-image-upscaler endpoint typo | Models config | YES — bug fix |
| `33e0dc35d` | Add backend routes, websocket, db, and auth | Chat system | YES — feature |
| `a98169ef4` | Add persistence, store, api client, and streaming | Chat system | YES — feature |
| `8493c3c76` | Unblock build, add types, remove dead code | Chat system | YES — build fix |

---

## Critical Protected Infrastructure

| Component | Commit(s) | Status |
|-----------|-----------|--------|
| Clerk authentication | Multiple recent commits | MUST NOT be downgraded |
| Supabase auth middleware | `auth.js`, `optionalAuth` | MUST preserve both middlewares |
| MuAPI integration | `muapi.js`, `agentActionsService.js` | MUST preserve server-side key pattern |
| VideoDB proxy | `videoDbProxyService.js` | MUST preserve SSRF protections |
| Rate limiting | `server.js` | MUST preserve existing limiters |
| Model registry | `models.js` | MUST NOT be replaced wholesale |
| Router | `router.js` | MUST preserve current page loaders |
| Lead Finder | Multiple commits | MUST NOT be overwritten |
| Landing page | Recent commits | MUST preserve rebrand |
| Netlify/deployment | `netlify.toml`, `render.yaml` | MUST preserve configs |

---

## Forward-Port Constraints

1. **Do NOT merge** `recovery/dropped-director-security-130a9e34` directly
2. **Do NOT** remove services that currently exist in `develop`
3. **Do NOT** remove routes that currently exist in `server.js`
4. **Do NOT** replace current `models.js` with historical version
5. **Do NOT** downgrade authentication architecture
6. **DO** port only specific missing security protections
7. **DO** preserve all current studio implementations
8. **DO** preserve all current test files

---

*This manifest was created before any forward-porting began.*
