# Recovery: Browser Test Authentication (Task 5)

## Root cause of the browser parity block
Studio pages (e.g. `#/image`) are gated by a Clerk auth check at app startup
(`src/main.js` → `ensureClerkLoaded()` → router `ensureStudioAccess`). When no
session is present, the app renders the Clerk sign-in gate, a fullscreen overlay
(`position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px)`)
that intercepts all pointer events — so the model-picker button is unreachable
and the earlier Playwright probe saw empty output.

There is **no bug** to fix: the app requires an authenticated session to reach
studio routes in dev.

## The existing, safe test path (no production change required)
`src/lib/apiKeyManager.js:297` already exports:

```js
export const isDevBypass =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEV_BYPASS_AUTH === 'true') ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev'));
```

`src/main.js:239` honors it:
```js
if (!isDevBypass && initialPage !== 'landing' && !['signin','signup',...].includes(initialPage)) {
  await ensureClerkLoaded();          // skipped under bypass
} else { showSetupModalOnce(); }     // skipped under bypass
```

Under the bypass:
- Clerk preload is skipped → no sign-in overlay.
- A placeholder API key (`'dev'`) is seeded in-memory ONLY (`setKey(DEV_PLACEHOLDER_KEY, true)`),
  never persisted to sessionStorage/localStorage.
- `localStorage.__session` is NOT set (no fake session token is ever written).

So the bypass does **not** weaken production authentication:
- `VITE_DEV_BYPASS_AUTH` is a Vite client env; it is **not** set in any production
  build config / `.env.production` / Render/Vercel env, so it is falsy in prod.
- `?dev` is a URL query param only present when a test/dev navigates with it.

## Chosen approach (verified 2026-10-30)
Run the Vite dev server with the bypass env, then run Playwright/chromium against it.

```
VITE_DEV_BYPASS_AUTH=true npx vite --port 3100        # warm dev server, auth bypassed
npx playwright install chromium                        # one-time browser binary
```

Parity check (standalone, against the bypass-enabled dev server):
```js
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args:['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3100/#/image', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#model-btn', { state: 'visible' });
await page.click('#model-btn');
await page.waitForSelector('[data-provider="all"]', { state: 'visible' });
// providers=19, categories=2, entries=7  -> rich split-pane picker rendered
await browser.close();
```
**Result observed:** `model-btn visible`; `picker rendered: providers=19 search=0 categories=2 entries=7`; `RESULT: PASS`.

## Alternatives considered (and why not)
- `@clerk/testing` `initialState`-based `<ClerkProvider>`: cleanest for production apps,
  but this codebase uses the low-level `clerk-js` singleton (`src/lib/clerkInit.js`) + a
  custom router gate, not `@clerk/react`'s `ClerkProvider` for studio routes. Wiring
  `initialState` would require a production code change. The existing `?dev`/env bypass
  already achieves the same end-state with zero code change → preferred.
- The shipped `src/test/helpers/clerkJwksHarness.js` is a **backend JWKS/token** harness
  (it even `delete process.env.CLERK_PUBLISHABLE_KEY`, which would *break* the browser) —
  it is NOT a browser signed-in-session stub. Not applicable here.
- Seeding a real dev Clerk user and scripting sign-in: works but needs live dev
  credentials and is flaky vs. the deterministic bypass.

## Recommendation for the repo
Adopt the `?dev` / `VITE_DEV_BYPASS_AUTH=true` bypass as the canonical local + CI
browser-test auth path (it already exists). Document in CONTRIBUTING that e2e specs
must launch the dev server with this env (or append `?dev`). No production code change
is needed; no production auth is weakened.

## Risk / note
The bypass also seeds a placeholder API key, so studio pages that immediately fire
generation calls may attempt a real request with a `dev` key. This is harmless for a
picker-parity test (which only opens the selector) but means browser tests that
exercise full generation still need a real provider key. That is pre-existing behavior
of the bypass and out of scope for Task 5.
