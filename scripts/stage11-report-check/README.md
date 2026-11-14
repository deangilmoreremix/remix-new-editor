# Stage 11 — results report and push: full-stack check

`npx vitest run --config scripts/stage11-report-check/vitest.stage11.config.mjs` (needs `su postgres`, `pdfinfo`, `pdftotext`, python3 with pypdf).

Real SQL (every migration through Stage 11), the real `video-events` handler, the real report and push routes, the real sender and a
real local HTTP "push service" that decrypts each message with Mozilla's `http_ece`. Only sign-in is faked. Nothing leaves this machine.
It does NOT prove a message reaches a real browser: that needs your VAPID keys and a real subscription.
