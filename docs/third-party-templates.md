# Third-party template sources

The Animations library includes templates imported from three public GitHub repositories, all MIT-licensed. The source is vendored (copied) into
`src/lib/editor/remotion/templates/<repo>/` as pinned, unmodified code apart from import rewrites (see `scripts/templates/build.mjs`); commit SHAs and a sha256 per file are in
`src/lib/templates/lock.json`.

| Key | Repository | License | Templates |
|---|---|---|---|
| `free` | https://github.com/deangilmoreremix/free-remotion-templates (fork of RenderComp/free-remotion-templates) | MIT, SPDX-FileCopyrightText 2026 Trimora Inc. (`LICENSE` in the repo) | 50 |
| `video` | https://github.com/deangilmoreremix/remotion-video-templates (fork of AleBrito124356/remotion-video-templates) | MIT, Copyright (c) 2026 Alejandro Brito | 7 |
| `rve` | https://github.com/deangilmoreremix/remotion-templates (fork of reactvideoeditor/remotion-templates) | MIT, as stated in the repo README ("All templates in this repository are available under the MIT License"; attribution appreciated: https://www.reactvideoeditor.com). The repo has no separate LICENSE file. | 81 |

MIT requires keeping the copyright and permission notice with copies of the software: the license text of the first two repositories is in their `LICENSE` files, referenced by commit in the lock file. The `rve` templates carry the credit comment from the original files.

Not imported: the reactvideoeditor.com gallery beyond the 81 templates in the MIT repository (its license page was not verified) and the Remotion "AI SaaS template" (an application scaffold, not animations).

## How they run
- `from "remotion"` is redirected to a shim (`src/lib/editor/remotion/templates/shim.tsx`) so a template sees the clip's own length; `staticFile()` resolves the few sample assets to inline data URIs; `next/image` becomes `<img>`.
- `rve` templates have no props: every fixed text in them became an editable text slot (`t1`, `t2`, ... via `__T` / `__S` in the shim). `free` and `video` templates use their own typed props and defaults.
- They are normal animation overlays (`blockId` `tpl:<repo>:<name>`), placed and edited like every other animation, exported by the same sandboxed runner.

## Regenerating
```bash
node scripts/templates/build.mjs --free <dir> --video <dir> --rve <dir>      # vendor + catalog + loaders
# run the production-path sweeps (prod-render.mjs with DISCOVER=1, override renders, prod-export.mjs), then
python3 scripts/templates/analyse.py <stills> <log> <analysis.json>
python3 scripts/hyperframes/measure-effect.py ...    # which fields visibly change the picture
python3 scripts/templates/finalize.py --analysis ... --effect ... --exports ...
node scripts/templates/build.mjs ... && node scripts/templates/ledger.mjs && python3 scripts/templates/make-thumbs.py <stills>
```
See `docs/templates-resource-ledger.md` for the result per template and the reason for each one not enabled.
