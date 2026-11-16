# Vendored: VidBee (https://github.com/nexmoe/VidBee)

MIT-licensed upstream code (see `LICENSE`), copied from commit `6542ebd` ("fix(download): recover empty metadata and discard stale requests (#526)").
Included: `apps/api`, `apps/web`, `resources/drizzle` (from `apps/desktop/resources/drizzle`), and the packages they depend on (`db`, `downloader-core`, `logger`, `subscriptions-core`, `task-queue`, `transcription`, `ui`, `i18n`).

## Host patches (search for `[host patch]`)
- `apps/web/vite.config.ts`, `src/router.tsx`, `src/lib/orpc-client.ts`, `src/components/{layout/app-shell,pages/about-page}.tsx`, `server.mjs`: optional sub-path (`VIDBEE_BASE_PATH`, e.g. `/vidbee`) so the web app can be mounted behind the host app's login.
- `apps/web/src/host-theme.css` (new) + one import line in `src/styles.css`: color tokens re-themed to the host app's palette (dark theme).
- `pnpm-workspace.yaml` / `package.json` / `pnpm-lock.yaml`: trimmed to the vendored projects.

## Updating
Re-copy from upstream, re-apply the patches above (`git diff` against the previous vendor commit shows them), then rebuild.
