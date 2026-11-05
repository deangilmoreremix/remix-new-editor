# Motion Studio — ported-code notice & attribution

Motion Studio (`src/apps/motion-studio/`) is a direct port of the **ShotCraft
Workbench** and the shot-card motion library from
[`video-shotcraft`](https://github.com/Vincentwei1021/video-shotcraft)
(author: Wei Yihao), which is licensed under the **Apache License 2.0**.

```
Copyright 2026 Wei Yihao

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## What changed in this port

- **Rebranded.** All customer-facing branding was replaced: the product is
  shipped as **Motion Studio**, part of **SmartVideo GO** (`src/apps/motion-studio/demosrc/_fixtures/Brand.tsx`,
  `src/apps/motion-studio/i18n.ts`, `src/apps/motion-studio/App.tsx`).
- **Re-themed.** The ported stylesheet consumes the existing OpenHiggsBolt design
  tokens (`app/globals.css`, `src/shared/styles/designTokens.ts`) instead of the
  original Apple-dark palette.
- **Integrated.** The app was moved from a standalone Vite entry
  (`workbench/src/main.tsx`) into the Next.js App Router as
  `src/apps/motion-studio/MotionStudio.tsx`, routed from
  `components/StandaloneShell.js` under `/studio/motion-studio`.
- **Renderer moved server-side.** The upstream dev-server `/api/export`
  middleware (which spawned `remotion render`) became the Next.js route
  `app/api/motion-studio/render/route.ts`. `Remotion` and the
  `@remotion/*` packages are Apache-2.0 by Remotion GmbH.

## Internally kept for compatibility

These identifiers are **not** branding: renaming them would discard existing
saved projects and palettes and break the palette import/export format, so they
are deliberately retained (each has an inline comment at its declaration).

| Identifier | Location | Why it must not change |
|---|---|---|
| `shotcraft-workbench-project-v1` | `src/apps/motion-studio/store.ts` | localStorage key holding the saved project |
| `shotcraft-workbench-locale` | `src/apps/motion-studio/i18n.ts` | localStorage key holding the UI language |
| `shotcraft:palettes:*` | `src/apps/motion-studio/panels/ThemePanel.tsx` | localStorage prefix holding saved palettes |
| `shotcraft-palette` (format id) | `src/apps/motion-studio/palettePresets.ts` | `.palette.json` interchange format |
| card ids (`demo:*`, `inkpress-*`, `text-basic`, `bg-*`, `video-clip`, `image-clip`, `audio-clip`, `proj:*`) | `src/apps/motion-studio/cards/*` | referenced by saved projects |

## Audio assets

`public/motion-studio/sfxlib/**` and `public/motion-studio/bgmlib/**` come from
the upstream repository's `assets/audio/`; its `ATTRIBUTION.md` is the source of
truth for the per-file licences and the upstream attribution requirements.
