# Implementation Plan: Brightbean Studio Integration

## Objective
Integrate Brightbean (social media management platform) into smartvid.app as a first-class studio entry, consistent with existing studios such as Image Studio, Video Studio, Cinema Studio, Character Studio, and AI-VFX. Brightbean should appear in the global sidebar, Apps Hub, and in-studio drawer, and should be navigable via `/#/brightbean`.

## Architecture Decision
- **Pattern:** Follow the existing vanilla DOM studio pattern used by `CharacterStudio.js`, `ImageStudio.js`, etc.
- **Chrome:** Use `mountStudioChrome()` from `src/lib/studioChrome.js` for consistent top bar with back/menu buttons and title.
- **UI:** Create a native studio shell (`BrightbeanStudio.js`) that provides tabbed access to scheduling, analytics, and accounts. Reuse the existing `BrightbeanScheduleModal.jsx` and `BrightbeanAnalyticsDrawer.jsx` components where appropriate, or build inline tabs if those modals are modal-only patterns.
- **API Client:** Create `src/lib/brightbean.js` exporting `listAccounts`, `uploadMedia`, `createScheduledPost`, `getPostAnalytics`, etc., pointing to the deployed Brightbean backend (`https://brightbean-web.onrender.com`).
- **Registration:** Add `brightbean` to `STUDIO_ROUTES`, `pageLoaders`, `Sidebar.js` `navItems`, and `AppsHub.js` arrays.

## Task List

### Phase 1: API Client & Studio Shell
- [ ] Task 1: Create `src/lib/brightbean.js` API client
- [ ] Task 2: Create `src/components/BrightbeanStudio.js` studio shell

### Phase 2: Route Registration
- [ ] Task 3: Register `brightbean` in `src/lib/studioRoutes.js`
- [ ] Task 4: Register `brightbean` loader in `src/lib/router.js`
- [ ] Task 5: Add `brightbean` to `src/components/Sidebar.js` nav items
- [ ] Task 6: Add `brightbean` to `src/components/AppsHub.js` studio arrays

### Checkpoint: Phase 1-2 Complete
- [ ] `brightbean` appears in sidebar, apps hub, and drawer
- [ ] Navigating to `/#/brightbean` loads the studio shell with chrome
- [ ] No console errors on navigation

### Phase 3: Studio UI Implementation
- [ ] Task 7: Implement BrightbeanStudio tabs (Schedule / Analytics / Accounts)
- [ ] Task 8: Wire API client methods to studio UI
- [ ] Task 9: Add cleanup/teardown for the studio component

### Checkpoint: Phase 3 Complete
- [ ] Studio loads with functional tabs
- [ ] API calls succeed against deployed Brightbean backend
- [ ] UI matches existing studio patterns

### Phase 4: Polish
- [ ] Task 10: Verify responsive behavior and overflow handling
- [ ] Task 11: Add loading/error states consistent with other studios

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| `src/lib/brightbean.js` missing | High | Create it as part of Task 1; copy patterns from existing API clients |
| Modal components expect React root, not vanilla DOM | Medium | Either embed React root inside studio shell or rebuild tabs as vanilla DOM |
| Render backend URL changes | Low | Store base URL in a single constant in `brightbean.js` |
| Missing API key in frontend env | Medium | Use existing API key constant or read from `NEXT_PUBLIC_BRIGHTBEAN_API_KEY` |

## Open Questions
- Should Brightbean Studio use the existing React modals (`BrightbeanScheduleModal`, `BrightbeanAnalyticsDrawer`) inside a React root, or rebuild as vanilla DOM tabs?
- Should the studio URL be `brightbean` or `social` / `social-studio`?
