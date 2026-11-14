# Stage 12 — end-to-end chain on real local infrastructure

`npx vitest run --config scripts/stage12-e2e-check/vitest.stage12.config.mjs` (needs `su postgres`, `pdfinfo`, `pdftotext`).

Personal links → personalized emails through a real SMTP server → recipients open their links → a click and a form → push to the
owner's device → the report and PDF → unsubscribe → revocation, plus the attack paths. Real SQL, real route handlers and functions.
Only sign-in is faked. The per-recipient rendering (thumbnail, GIF, MP4) happens in the browser and is covered by
`scripts/stage10-bulk-check`. Nothing leaves this machine, and no real email or push was sent.
