# AI-VFX Sidebar Integration Report

## Step 1 — React Version Decision

### What was found
- **Root `package.json`:** declares `react: ^19.2.6`; does **not** declare `react-dom`.
- **Root `node_modules`:** has both `react@19.2.7` and `react-dom@19.2.7` installed.
- **`src/main.js` bridge pattern** (used for `PersonalizationModal` and `TokenEditor`):
  - `const { createRoot } = await import('react-dom/client')` — resolves to root `react-dom@19.2.7`
  - `const mod = await import('react')` — resolves to root `react@19.2.7`
  - `root.render(mod.createElement(Component, props))` — React 19 `createElement`
- **`apps/ai-vfx/package.json`:** expects `react: ^18.3.1`, `react-dom: ^18.3.1`.
- **`apps/ai-vfx/src/App.jsx`:** imports `React, { useState } from 'react'` — no React 19-specific APIs.
- **`apps/ai-vfx/src/main.jsx`:** does `ReactDOM.createRoot(...)` — same API as React 18/19, so compatible.

### Decision
**Use root React 19.2.7, do not install a separate React 18.**

Rationale:
1. `src/main.js` already uses the root React 19 for the modal bridge. Installing React 18 separately would create dual React instances and break the modals.
2. The ai-vfx `App.jsx` uses only `useState` and Chakra UI — no React 19-incompatible patterns.
3. Chakra UI v2's `peerDependencies` declare `react: ">=18"`, so React 19 satisfies the peer requirement.

### Additional packages installed at root
The ai-vfx app imports `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, and `framer-motion` from bare specifiers. These were missing from root `node_modules` (only `apps/ai-vfx/node_modules` had them). They were installed at root so Vite can resolve them when the browser requests the ai-vfx module:
```
@chakra-ui/react@^2.8.2
@emotion/react@^11.11.4
@emotion/styled@^11.11.5
framer-motion@^11.3.0
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/Sidebar.js` | Added `{ id: 'ai-vfx', ..., label: 'AI VFX' }` to `navItems` |
| `src/lib/router.js` | Added `'ai-vfx': () => import('../components/AIVFXPage.js').then(m => m.AIVFXPage())` to `pageLoaders` |
| `src/components/AIVFXPage.js` | **Created.** Mounts real `apps/ai-vfx/src/App.jsx` via `createRoot` bridge |
| `package.json` | Added 4 dependencies (`@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, `framer-motion`) |
| `package-lock.json` | Auto-updated by `npm install` |

## Step 3 — AIVFXPage.js Design

- **Wrapper:** `div.w-full.h-full.flex.flex-col.overflow-hidden.bg-app-bg` (matches `DirectorPage.js` convention).
- **Header bar:** inline HTML header with icon + "AI VFX STUDIO" title, matching the shell's visual language.
- **Mount surface:** a flex-1 div with id `ai-vfx-mount` and dark background.
- **Bridge pattern (mirrors `src/main.js` lines 221–261):**
  1. `const { createRoot } = await import('react-dom/client')` — dynamic import, same as modals.
  2. `const React = await import('react')` — dynamic import.
  3. `const AppMod = await import('../../apps/ai-vfx/src/App.jsx')` — imports the real component.
  4. `root.render(React.createElement(App))` — mounts the real app.
- **Fallback:** If React is unavailable, renders a plain HTML message (not a blank screen).
- **No props passed to App:** `apps/ai-vfx/src/App.jsx` is a default-exported function component with no required props. It was designed to be the root of a standalone app, and mounting it into a sub-container (rather than `document.getElementById('root')`) works because it renders its own root `<Box>` and does not call `ReactDOM.createRoot` itself.

## Step 4 — Router Wiring

- Sidebar uses `navigate(item.id)` → router checks `pageLoaders[page]`.
- Sidebar id `'ai-vfx'` maps directly to router key `'ai-vfx'`.
- Loader: `'ai-vfx': () => import('../components/AIVFXPage.js').then(m => m.AIVFXPage())`
- This follows the exact same convention as `'director'`, `'timeline'`, `'video-agent'`, etc.

## Step 5 — Verification

I cannot open a real browser in this CLI environment. Instead, I verified the import chain programmatically using Vite's transform and SSR APIs:

| Test | Result |
|------|--------|
| `server.transformRequest('/src/components/AIVFXPage.js')` | ✅ OK (3708 chars) |
| `server.transformRequest('/apps/ai-vfx/src/App.jsx')` | ✅ OK (19263 chars) |
| Vite dep optimization | ✅ `✨ new dependencies optimized: @chakra-ui/react, @supabase/supabase-js` |
| `server.ssrLoadModule('/src/components/AIVFXPage.js')` | ✅ Module loaded, `AIVFXPage` is a function |
| Dev server startup | ✅ `VITE v5.4.21 ready in 2962 ms` on port 3000 |

### Known risk: Chakra UI v2 + React 19

Chakra UI v2 was built for React 18. While its `peerDependencies` declare `react: ">=18"` (which React 19 satisfies), there are known runtime compatibility issues with React 19 (e.g., changes to `useId`, ref handling). This may cause the app to render with console warnings or errors at runtime. The fallback HTML in `AIVFXPage.js` will display if the React render throws.

### What I cannot verify in this environment
- Actual browser rendering and visual output.
- Console errors at runtime (e.g., `Invalid hook call`, `useId` warnings).
- Whether Chakra UI v2 components render correctly under React 19.
- Whether the `useToast` / `Modal` / `Tabs` Chakra components work.

The dev server is running and ready for browser verification at `http://localhost:3000`.
