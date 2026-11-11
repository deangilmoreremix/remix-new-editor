import type { CardDef } from "./types";
import { LEGACY_DEMO_MODULES } from "./legacy-index";

/** Retired recipes (the 66 upstream took out of its library in 2026-10), kept only so a saved project or an
 *  imported JSON that names one still plays its original frames, timing and speed. They are never offered in
 *  the library (`buildCardRegistry` puts them in the lookup, not in the list), so nothing new is built with them. */
export const LEGACY_CARDS: CardDef[] = LEGACY_DEMO_MODULES.map((m) => ({
  id: `demo:${m.stem}`,
  name: m.name,
  nameEn: m.nameEn,
  category: m.category,
  durationInFrames: m.duration,
  component: m.component,
  schema: [],
  accent: "#c58a2a",
}));
