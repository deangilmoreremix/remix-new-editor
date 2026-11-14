# Stage 12 — autosave, recovery and backup: real-browser check

`node scripts/stage12-recovery-check/check.mjs` (needs unzip and python3). Real headless Chromium: the Origin Private File System draft
store, Web Locks and BroadcastChannel; a real page reload; two tabs saving the same draft at once; an aborted OPFS write; a backup ZIP
read by `unzip -t` and Python; a private-window profile. `out/` is git-ignored.
