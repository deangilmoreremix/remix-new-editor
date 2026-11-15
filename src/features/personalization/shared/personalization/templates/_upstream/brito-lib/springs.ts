// ---------------------------------------------------------------------------
// SMARTVIDEO GO AI — Phase 4 upstream template (repo 3: remotion-video-templates)
// template id : brito-lib (shared helper of every brito-* template)
// upstream    : https://github.com/deangilmoreremix/remotion-video-templates (main @ 90149464d51a43fcb90e15491bf0d681c1b0fa49)
// upstream src: src/lib/springs.ts
// license     : MIT License — Copyright (c) 2026 Alejandro Brito. The MIT copyright notice and permission notice must be retained in all copies or substantial portions of the software (verbatim text: BRITO_LICENSE_NOTICE in templates/designs/batch3d/britoShared.tsx).
// Upstream code is reproduced verbatim apart from this header comment.
// ---------------------------------------------------------------------------
// SPDX-FileCopyrightText: 2026 Alejandro Brito
// SPDX-License-Identifier: MIT
// Shared spring presets.
//
// `spring()` in Remotion is a physics simulation: a value eases from `from`
// toward `to` governed by mass / stiffness / damping. Rather than sprinkle
// magic numbers across templates, we name three feels and reuse them.
//
// Usage:
//   const v = spring({ frame, fps, config: SNAPPY });
//
// Tuning intuition:
//   - stiffness ↑  => faster, more urgent
//   - damping   ↓  => more overshoot / bounce (damping is the "brake")
//   - mass      ↑  => heavier, slower to start and stop
import type { SpringConfig } from "remotion";

// SNAPPY — fast settle, almost no overshoot. Good for UI-like reveals,
// callouts and lower-thirds that should feel crisp and professional.
export const SNAPPY: Partial<SpringConfig> = {
  mass: 0.6,
  stiffness: 180,
  damping: 20,
};

// GENTLE — slow, heavily damped glide with zero bounce. Good for backgrounds,
// slow pans and anything that should feel calm and expensive.
export const GENTLE: Partial<SpringConfig> = {
  mass: 1,
  stiffness: 60,
  damping: 26,
};

// BOUNCE — overshoots and wobbles back. Good for logo pops and playful accents.
// Keep it for a single hero element per scene; overuse reads as gimmicky.
export const BOUNCE: Partial<SpringConfig> = {
  mass: 0.8,
  stiffness: 140,
  damping: 9,
};
