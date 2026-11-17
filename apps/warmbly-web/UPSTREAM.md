# Warmbly dashboard (vendored)

This directory is the `web/` app from https://github.com/warmbly/warmbly, vendored under the Apache License 2.0 (see `LICENSE`).

- Source commit: `c2e36cc` (warmbly/warmbly `main`, 2026-11).
- Built as a static app under `/warmbly-app/` and embedded by `src/components/studios/WarmblyStudio/WarmblyStudio.js`.
- Runs with no backend in demo mode (`VITE_DEMO=1`), answering API calls from responses recorded from a seeded instance. Set `WARMBLY_API_URL` (runtime `config.js`) and build without `VITE_DEMO` to use a real Warmbly backend instead.

## Local changes (keep this list short so upstream syncs stay easy)

| File | Change |
|---|---|
| `vite.config.ts` | `base` from `VITE_BASE` |
| `src/router.tsx` | `basepath` from Vite's `BASE_URL` |
| `src/lib/information.ts` | `DEMO` flag |
| `src/lib/api/client/Client.ts` | axios uses the fetch adapter in demo mode |
| `src/main.tsx` | `installDemo()` before first render in demo mode |
| `src/lib/demo/*` | new: recorded-data server, fake Phoenix socket, installer, `fixtures.json` |

Warmbly is a trademark of its owners; Apache-2.0 does not grant trademark rights.
