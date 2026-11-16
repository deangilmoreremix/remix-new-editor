# Warmbly (standalone)

Self-contained cold-outreach + warmup app inspired by [warmbly/warmbly](https://github.com/warmbly/warmbly) (Apache-2.0).
Zero runtime dependencies: Node 22.5+ and built-in SQLite. Not a port of the Go/Postgres/Redis stack.

    npm start            # http://localhost:3000 (admin password printed on first run, or set WARMBLY_PASSWORD)
    npm test

Features: multi-step campaigns with sending windows, per-mailbox daily caps/spacing, warmup pool with daily ramp,
open/click tracking, one-click unsubscribe, bounce/unsubscribe suppression, unified reply inbox, CRM (contacts, deal
pipeline, tasks, CSV import), REST API keys, webhooks.

Real sending: set SMTP host/user/password on a mailbox and `npm i nodemailer`. Otherwise sends are simulated
(set `WARMBLY_SIMULATE=1` to force). Set `PUBLIC_URL` so tracking links resolve publicly. Theme lives in `public/theme.css`.
Limits: no IMAP reply sync (post replies to `POST /api/replies`), warmup is intra-pool only, single admin user.
