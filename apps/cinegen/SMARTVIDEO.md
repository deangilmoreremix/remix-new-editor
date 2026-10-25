# CineGen in this repo

Vendored from https://github.com/deangilmoreremix/CineGen at commit
`769f14865aa3e5b9e76808d1d34930be2016d02f`, excluding the Electron/desktop-only
parts (`electron/`, `native/`, `dist-electron/`, `build/`) plus `screenshots/`
and `outputs/`.

The **CineGen Studio** route (`#/cinegen`,
`src/components/studios/CineGenStudio/CineGenStudio.jsx`) embeds CineGen's web
build, which includes every tab: Elements, Spaces, Director, Edit, LLM, Export.

## Run locally

```bash
npm run cinegen:install   # once
npm run cinegen:build
npm run cinegen:start     # serves app + API on http://localhost:8787
```

The main app's dev server embeds `http://localhost:8787` automatically. For
other environments set `VITE_CINEGEN_WEB_URL` at build time.

If the service isn't configured or reachable, the studio falls back to a
lightweight in-app version (Elements / Spaces / Edit) and shows a notice.

## Before deploying publicly

`web/server` is CineGen's single-user local server: it has **no
authentication** and keeps one shared project store in `CINEGEN_WEB_DATA_ROOT`
(default `web/.data`). Don't expose it on a public URL as-is. That would let
anyone with the URL use it, and every user would share the same projects.
Hosting it for real users needs a per-user auth layer (for example, verifying
the Clerk session) and per-user data roots, plus a persistent disk and FFmpeg
on the host.

Provider keys (fal, kie, Topview, ElevenLabs, etc.) are entered in CineGen's
own Settings panel.
