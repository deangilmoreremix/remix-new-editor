# Vendored from HeyPuter/everything

- Source: https://github.com/HeyPuter/everything
- Commit: `95cf576a8efc3f9719483f87301efa87d81b1d1b`
- License: MIT, Copyright (c) 2026 Puter Technologies Inc. (see `LICENSE` in this folder)

Everything under `src/` and `dev/` here is an **unmodified copy** of the upstream files at that
commit (verified byte-identical with `diff -r`, excluding `node_modules` and `dist`). Do not edit
these files in place. To update, re-copy from upstream and bump the commit above.

| Path | Upstream path |
|---|---|
| `src/teamchat/` | `src/teamchat/` |
| `src/meetings/` | `src/meetings/` |
| `dev/puter-localhost.mjs` | `dev/puter-localhost.mjs` (imported by both apps' `vite.config.js`) |

Verified from this location with `npm ci`, `vite build` and `vitest run`:
- Teamchat: 172 files, 2525 tests passing.
- Meetings: 45 files, 572 tests passing.

Teamchat runs in two ways, both upstream's own:
- `index.html` — the real app, backed by a Puter account (loads Puter.js).
- `mock.html` — the same app and worker code against a browser-local fake Puter (`dev/worker-runtime.js`,
  `dev/mock-boot.js`, `dev/mock-peer.js`). No account or server. Tabs of one browser share state; open
  `mock.html?as=alice` and `mock.html?as=bob`.
