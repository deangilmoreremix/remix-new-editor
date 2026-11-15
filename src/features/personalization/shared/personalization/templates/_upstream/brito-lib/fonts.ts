// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template (repo 3: remotion-video-templates)
// template id : brito-lib (shared helper of every brito-* template)
// upstream    : https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)
// upstream src: src/lib/fonts.ts
// license     : MIT License — Copyright (c) 2026 Alejandro Brito. The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software (verbatim text: BRITO_LICENSE_NOTICE in templates/designs/batch3d/britoShared.tsx).
// Upstream code is reproduced verbatim apart from this header comment.
// EXCEPTION: the minimal edits listed in the DEVIATION RECORD below.
//
// DEVIATION RECORD (Phase 4 batch 3d porting rules)
// --------------------------------------------------
// D2 fonts: the upstream loads Inter through `@remotion/google-fonts/Inter`:
//
//      import { loadFont } from "@remotion/google-fonts/Inter";
//
//      const { fontFamily } = loadFont("normal", {
//        weights: ["400", "500", "600", "700", "800"],
//        subsets: ["latin"],
//      });
//
//      export const INTER = fontFamily;
//
//    That package is NOT installed (and must not be), and it downloads the
//    face from Google's CDN at render time. The app already bundles an Inter
//    Latin subset (SIL OFL 1.1) for every design — see `../../typography.ts`
//    and `../../designs/fonts.ts` — so INTER now resolves to that bundled
//    stack (`DESIGN_FONT_STACK`, whose first family is the bundled Inter
//    alias, with "Inter" as the next fallback). The bundled face is variable
//    (weights 100-900), so every weight the upstream requested is covered.
//    Readiness: the upstream's loadFont() blocked the render until the face
//    loaded; here the design stage calls `useDesignFonts()`, which does the
//    same for the bundled face. The upstream's explanatory comment is kept
//    below; the exported name `INTER` is unchanged.
// ---------------------------------------------------------------------------
// SPDX-FileCopyrightText: 2026 Alejandro Brito
// SPDX-License-Identifier: MIT
// Inter, loaded through @remotion/google-fonts.
//
// loadFont() returns a { fontFamily } handle and registers a promise that
// Remotion waits on before capturing frames, so text never renders in a
// fallback face mid-render. Importing this module once and reusing INTER keeps
// every template on the same typeface.
import { DESIGN_FONT_STACK } from "../../typography";

export const INTER = DESIGN_FONT_STACK;
