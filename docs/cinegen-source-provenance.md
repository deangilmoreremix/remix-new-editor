# CineGen source provenance

- Upstream: https://github.com/christopherjohnogden/CineGen, commit `769f148`, license **MIT** (attribution in `src/cinegen/NOTICE.md`).
- Method: every upstream renderer `.ts/.tsx` file copied; `@/` import alias rewritten to `@cinegen/`; nothing else changed in the 265 identical files.
- Adapted files carry `// [remix]` at each edit. Categories:
  1. **Provider swap** — fal/Topview/Higgsfield/Artlist/RunPod/CLI → MuAPI (user key) and OpenAI (user key): `lib/fal/models.ts`, `lib/cloud/funding.ts`, `lib/director/run-llm.ts`, `video-adapter.ts`, `lib/workflows/{execute,provider-model-options}.ts`.
  2. **Host boundary** — Electron `window.electronAPI` replaced by `src/cinegen/adapters/*` (web-api, web-media, web-store, web-elevenlabs, main-process/*).
  3. **UI strings / theme** — `theme-remix.css`, English strings.
- Adapter code written for this app (not from CineGen): `src/cinegen/adapters/*`. Local-only changes this run: `elements.upload` data-URL fallback (`web-api.ts`), `persistGeneratedAsset` accepts `data:`/`blob:` (`web-media.ts`).
- OpenChatCut code (AGPL-3.0-or-later) lives separately in `src/openchatcut`.
- Per-file status: `docs/evidence/cinegen-parity.json` (384 rows).
