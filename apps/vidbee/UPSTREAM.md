# Vendored: VidBee (https://github.com/nexmoe/VidBee)

MIT-licensed upstream code (see `LICENSE`), copied from commit `6542ebd` ("fix(download): recover empty metadata and discard stale requests (#526)").
Included: `apps/api`, `apps/web`, `resources/drizzle` (from `apps/desktop/resources/drizzle`), and the packages they depend on (`db`, `downloader-core`, `logger`, `subscriptions-core`, `task-queue`, `transcription`, `ui`, `i18n`).

## Host patches (search for `[host patch]`)
- `apps/web/vite.config.ts`, `src/router.tsx`, `src/lib/orpc-client.ts`, `src/components/{layout/app-shell,pages/about-page}.tsx`, `server.mjs`: optional sub-path (`VIDBEE_BASE_PATH`, e.g. `/vidbee`) so the web app can be mounted behind the host app's login.
- `apps/web/src/host-theme.css` (new) + one import line in `src/styles.css`: color tokens re-themed to the host app's palette (dark theme).
- `packages/ui/src/components/ui/button.tsx` (+ `sonner.tsx` action button): variants restyled to the host studios' outlined, transparent button language (no solid fills).
- `pnpm-workspace.yaml` / `package.json` / `pnpm-lock.yaml`: trimmed to the vendored projects.

## Updating
Re-copy from upstream, re-apply the patches above (`git diff` against the previous vendor commit shows them), then rebuild.

## Transcripts + AI (host-added; upstream ships these only in the Electron desktop app)
- `apps/api/src/upstream/` — **unmodified** copies of `apps/desktop/src/shared/{ai-prompts,ai-presets,ai-types,transcript-export,subtitle-export}.ts` and `apps/desktop/src/main/lib/source-file.ts`, plus `skills/` (built-in prompts: Overview, Translate, FAQ, Mindmap, …).
  `builtin-skills.ts` is adapted: it reads `skills/*/SKILL.md` from disk instead of Vite's `import.meta.glob`.
- `apps/api/src/lib/hub-router.ts` (new glue) — `/hub/*` routes over upstream's `TranscriptStore`, `enqueueTranscription` and task queue.
- `apps/web/src/{lib/hub-client.ts,components/pages/transcripts-page.tsx,routes/transcripts.tsx}` (new) — Transcripts page: captions, speaker rename, export, AI prompts, translate, chat.
- Not ported: the desktop's 9,600-line transcript UI and its agent runtime (tools, skills install, plugins). The web chat is a plain transcript Q&A.
