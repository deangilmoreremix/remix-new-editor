# SmartVidDownloader brand layer

The vendored VidBee app (`apps/vidbee`, MIT, see `../LICENSE` and `../UPSTREAM.md`) is shown in SmartVid's Media Hub as
**SmartVidDownloader**. Like `apps/smartwarmupai-brand`, the rebrand happens **at build time**: the upstream sources stay
exactly as upstream wrote them, and `rebrand.mjs` rewrites user-facing text as the builds read the files.

This folder lives inside `apps/vidbee` (not next to it) because the Docker image (`apps/desktop/host/docker/Dockerfile`) is
built with `apps/vidbee` as its context.

## How it is hooked in

`npm run vidbee:build` (root) → `apps/vidbee` `npm run build` → `apps/desktop`:

- `host/vite.web.config.ts` registers `vitePlugin()` (renderer, workspace packages, locales, `index.html` title, `web-shim.js`).
- `host/build-host.mjs` registers `esbuildPlugin()` (main process and workers) and brands the inlined built-in `SKILL.md` files.

`VIDBEE_BRAND=off` builds pristine upstream text.

## What changes

- **Name**: every `VidBee` in renderer/main/package sources, built-in skills and all 14 locale files becomes `brand.json` → `name`
  (window title, title bar, sidebar logo text, About, Settings, notifications, agent identity, export footers, the optional
  "via …" filename suffix; files saved with the old "via VidBee" suffix are still found).
- **Kept on purpose**: links to the upstream repo/issue tracker and feedback mail (attribution), HTTP headers and user agents,
  on-disk folder names (`Downloads/VidBee`, the CLI/extension `VidBee` config folder), the MCP auth realm, internal labels,
  code identifiers/package names/env vars. The About text ends with "Based on the open-source VidBee project (MIT License)",
  and the About page's "follow the developer"/"share" texts still name VidBee, because they promote the upstream author.
- **Cloud / GitHub sign-in hidden** (no cloud account in the hosted embed): the Settings → Account tab (and `?tab=account`
  links), the cloud transcription block, the "VidBee Cloud" provider card, the "Sign in with GitHub" button in Ask AI guidance.
  The composer's cloud placeholder is removed (it reads "AI is not configured on this server" only when no key is set).
- **AI runs on SmartVid's OpenAI key**: set `SMARTVID_OPENAI_API_KEY` (falls back to `OPENAI_API_KEY`) on the VidBee
  server, and optionally `SMARTVID_OPENAI_MODEL` (default `gpt-5.4-mini`). The AI store then reports a single
  "OpenAI (SmartVid)" provider, always in use; providers users saved earlier are ignored, and the key never reaches the
  browser. The Settings → Providers page and the "Open provider settings" button are removed (`?tab=providers` opens
  General), and AI error help says to try again or contact support. With no key set the app still runs, AI features
  just report that AI is not set up. The VidBee server is separate from Netlify: Netlify's `OPENAI_API_KEY` does not
  reach it, so set the key where the VidBee container runs.
- **Wording**: strings saying downloads/transcripts run "on this computer"/"locally" now say they run on SmartVid's servers
  (`locale-overrides.json` → `en`). Non-English locales use their own server-side wording where upstream ships one
  (`fromWebKey`) and otherwise fall back to the corrected English text; add `"de": { … }` maps to translate.

Patches are exact-match and fail the build if upstream moves the code, so a sync cannot silently bring the removed UI back.

## Checking

`node apps/vidbee/brand/check.mjs [--out <dir>]` runs the rebrand over the sources without building, confirms every patch
still applies and lists every line that still contains "VidBee" (expected: the kept items above).
