# Todo: Brightbean Studio Integration

## Task 1: Create `src/lib/brightbean.js` API client
**Description:** Create the missing API client that the existing Brightbean modals already import. It should wrap calls to the deployed Brightbean backend (`https://brightbean-web.onrender.com`) and expose `listAccounts`, `uploadMedia`, `createScheduledPost`, and `getPostAnalytics`.

**Acceptance criteria:**
- [ ] File `src/lib/brightbean.js` exists
- [ ] Exports `listAccounts`, `uploadMedia`, `createScheduledPost`, `getPostAnalytics`
- [ ] Uses existing API key (`bb_studio_AdSkqw6CI_LMZoehdY2XSLcNggOhcYeAwT1NqGvvun8_4986c14b`) or reads from env
- [ ] Handles errors and returns parsed JSON

**Verification:**
- [ ] `npm run build` succeeds
- [ ] Existing modals can import without error

**Dependencies:** None

**Files likely touched:**
- `src/lib/brightbean.js` (new)

**Estimated scope:** Small

---

## Task 2: Create `src/components/BrightbeanStudio.js` studio shell
**Description:** Create the studio component following the vanilla DOM pattern used by `CharacterStudio.js` and `ImageStudio.js`. It should call `mountStudioChrome(container, { currentRoute: 'brightbean', title: 'Brightbean' })` and build a tabbed UI inside the container.

**Acceptance criteria:**
- [ ] Exports `BrightbeanStudio()` factory function
- [ ] Calls `mountStudioChrome` with correct route and title
- [ ] Returns a DOM element
- [ ] Includes basic cleanup (`container.cleanup`)

**Verification:**
- [ ] `npm run build` succeeds
- [ ] Navigating to `/#/brightbean` shows studio chrome

**Dependencies:** Task 1

**Files likely touched:**
- `src/components/BrightbeanStudio.js` (new)

**Estimated scope:** Small

---

## Task 3: Register `brightbean` in `src/lib/studioRoutes.js`
**Description:** Add `brightbean` to `STUDIO_ROUTES` and add an icon to `ICONS`.

**Acceptance criteria:**
- [ ] `STUDIO_ROUTES.brightbean = { label: 'Brightbean', category: 'Tools' }`
- [ ] `ICONS.brightbean` contains a relevant SVG string
- [ ] `getGroupedStudioRoutes()` includes Brightbean under Tools

**Verification:**
- [ ] `npm run build` succeeds
- [ ] In-studio drawer lists Brightbean

**Dependencies:** None

**Files likely touched:**
- `src/lib/studioRoutes.js`

**Estimated scope:** XS

---

## Task 4: Register `brightbean` loader in `src/lib/router.js`
**Description:** Add `brightbean` to `pageLoaders` so the router knows how to load the studio.

**Acceptance criteria:**
- [ ] `pageLoaders.brightbean` maps to `import('../components/BrightbeanStudio.js').then(m => m.BrightbeanStudio())`

**Verification:**
- [ ] `npm run build` succeeds
- [ ] `navigate('brightbean')` loads the component

**Dependencies:** Task 2

**Files likely touched:**
- `src/lib/router.js`

**Estimated scope:** XS

---

## Task 5: Add `brightbean` to `src/components/Sidebar.js` nav items
**Description:** Add a `{ id: 'brightbean', icon: ..., label: 'Brightbean' }` entry to `navItems` in `Sidebar.js`, using the same SVG icon from `studioRoutes.js`.

**Acceptance criteria:**
- [ ] Brightbean appears in desktop sidebar
- [ ] Clicking it calls `navigate('brightbean')`
- [ ] Active state highlighting works via `route-changed` event

**Verification:**
- [ ] `npm run build` succeeds
- [ ] Sidebar shows Brightbean icon and label

**Dependencies:** Task 3

**Files likely touched:**
- `src/components/Sidebar.js`

**Estimated scope:** XS

---

## Task 6: Add `brightbean` to `src/components/AppsHub.js`
**Description:** Add a `{ id: 'brightbean', name: 'Brightbean', ... }` entry to `TOOL_STUDIOS` (or `AI_APPS`) in `AppsHub.js`.

**Acceptance criteria:**
- [ ] Brightbean appears as a card in the Apps Hub
- [ ] Card has name, description, icon, badge, and color styling
- [ ] Clicking card navigates to `brightbean`

**Verification:**
- [ ] `npm run build` succeeds
- [ ] Apps Hub shows Brightbean card

**Dependencies:** Task 3

**Files likely touched:**
- `src/components/AppsHub.js`

**Estimated scope:** XS

---

## Task 7: Implement BrightbeanStudio tabs (Schedule / Analytics / Accounts)
**Description:** Build the tabbed UI inside `BrightbeanStudio.js`. Use the existing `BrightbeanScheduleModal.jsx` and `BrightbeanAnalyticsDrawer.jsx` if feasible, or create inline vanilla DOM tabs that call the API client directly.

**Acceptance criteria:**
- [ ] Studio shows at least 3 tabs: Schedule, Analytics, Accounts
- [ ] Each tab renders its content area
- [ ] Tab switching works without page reload

**Verification:**
- [ ] `npm run build` succeeds
- [ ] Tabs render and switch correctly

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/BrightbeanStudio.js`

**Estimated scope:** Medium

---

## Task 8: Wire API client methods to studio UI
**Description:** Connect the studio tabs to the API client. Schedule tab should list accounts and allow scheduling. Analytics tab should show post analytics. Accounts tab should list connected accounts.

**Acceptance criteria:**
- [ ] Schedule tab loads accounts via `listAccounts()`
- [ ] Analytics tab can fetch analytics by post ID
- [ ] Accounts tab shows connected accounts
- [ ] Error states are displayed

**Verification:**
- [ ] API calls succeed against `https://brightbean-web.onrender.com`
- [ ] Data renders in each tab

**Dependencies:** Task 1, Task 7

**Files likely touched:**
- `src/components/BrightbeanStudio.js`
- `src/lib/brightbean.js`

**Estimated scope:** Medium

---

## Task 9: Add cleanup/teardown for the studio component
**Description:** Ensure the studio properly cleans up timers, listeners, and React roots (if any) when navigated away from.

**Acceptance criteria:**
- [ ] `container.cleanup` is defined
- [ ] No console warnings about memory leaks on navigation

**Verification:**
- [ ] Navigate away from Brightbean and back — no duplicate listeners
- [ ] `npm run build` succeeds

**Dependencies:** Task 2, Task 7

**Files likely touched:**
- `src/components/BrightbeanStudio.js`

**Estimated scope:** XS

---

## Task 10: Verify responsive behavior and overflow handling
**Description:** Test the studio on different screen sizes and ensure it handles overflow correctly (scroll within tabs, not the whole page).

**Acceptance criteria:**
- [ ] Studio content scrolls within tab panels
- [ ] No horizontal overflow
- [ ] Works on mobile viewport

**Verification:**
- [ ] Manual browser check at common widths

**Dependencies:** Task 7

**Files likely touched:**
- `src/components/BrightbeanStudio.js`

**Estimated scope:** S

---

## Task 11: Add loading/error states consistent with other studios
**Description:** Add skeleton loaders or spinners while API data loads, and show friendly error messages on failure.

**Acceptance criteria:**
- [ ] Each tab shows loading state while fetching
- [ ] Errors are shown inline, not via `alert()`
- [ ] Styling matches existing studio patterns

**Verification:**
- [ ] Simulate API failure — error message displays
- [ ] `npm run build` succeeds

**Dependencies:** Task 8

**Files likely touched:**
- `src/components/BrightbeanStudio.js`

**Estimated scope:** S
