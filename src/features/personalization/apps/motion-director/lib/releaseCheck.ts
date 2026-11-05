/**
 * The release check upstream runs before a storyboard is shown (pipeline stage 3, "consistency
 * check before release"): every feature of the feature → shot map is in the film, a technique
 * leads once, the shot cards' caps / exclusions / look family hold, the opening has its time and
 * the film ends on a hold. A feature whose first-choice card was ruled out gets its fallback card
 * (stage 2: "preferred + fallback card per feature"), as long as the fallback breaks no rule.
 */
import type { DirectorPlan, DirectorScene, MappingRow } from './directorPlan';
import { isBrandScene } from './directorPlan';
import { filmRuleViolations, type Polarity } from './shotRules';

export interface ReleaseItem {
  code: 'F1' | 'P4' | 'R' | 'B3' | 'B1';
  ok: boolean;
  text: string;
}

const isRecipeShot = (s: DirectorScene) => s.kind === 'shot' && Boolean(s.recipeId) && !isBrandScene(s.recipeId);

/** Scenes that show a mapped feature: its first or fallback card, or a scene that carries its message. */
function covers(scene: DirectorScene, row: MappingRow): boolean {
  if (scene.recipeId && (scene.recipeId === row.firstShot || scene.recipeId === row.altShot)) return true;
  const f = row.feature.toLowerCase().trim();
  return Boolean(f && scene.feature && scene.feature.toLowerCase().includes(f));
}

export function releaseCheck(
  plan: DirectorPlan,
  mapping: readonly MappingRow[] | null | undefined,
  opts: { keep?: ReadonlySet<string>; ground?: Polarity | null } = {},
): { plan: DirectorPlan; items: ReleaseItem[]; swapped: string[] } {
  const keep = opts.keep ?? new Set<string>();
  let scenes = plan.scenes.map((s) => ({ ...s }));
  const swapped: string[] = [];
  const rows = mapping ?? [];
  const mapped = new Set(rows.flatMap((r) => [r.firstShot, r.altShot]).filter(Boolean));

  // Stage 2 fallback: a feature lost its card (a rule ruled it out) -> its fallback card takes a scene that shows no mapped feature.
  for (const row of rows) {
    if (scenes.some((s) => covers(s, row))) continue;
    for (const card of [row.firstShot, row.altShot].filter(Boolean)) {
      const slot = scenes.findIndex((s, i) => i > 0 && i < scenes.length - 1 && isRecipeShot(s) && !mapped.has(s.recipeId) && !keep.has(s.recipeId));
      if (slot < 0) break;
      const trial = scenes.map((s, i) => (i === slot ? { ...s, recipeId: card, feature: row.feature, asset: row.pageState || s.asset } : s));
      if (filmRuleViolations(trial, keep, opts.ground).some((v) => v.index === slot)) continue;
      scenes = trial;
      swapped.push(`${row.feature}: ${card === row.firstShot ? 'first-choice' : 'fallback'} card in scene ${slot + 1}`);
      break;
    }
  }

  const items: ReleaseItem[] = [];
  if (rows.length) {
    const missing = rows.filter((r) => !scenes.some((s) => covers(s, r)));
    items.push({
      code: 'F1',
      ok: missing.length === 0,
      text: missing.length ? `Not in the film: ${missing.map((m) => m.feature).join('; ')}.` : `All ${rows.length} mapped features have a shot.`,
    });
  }
  const seen = new Map<string, number>();
  for (const s of scenes) if (isRecipeShot(s)) seen.set(s.recipeId, (seen.get(s.recipeId) ?? 0) + 1);
  const repeats = [...seen].filter(([id, n]) => n > 1 && !keep.has(id));
  items.push({ code: 'P4', ok: repeats.length === 0, text: repeats.length ? `${repeats.length} technique${repeats.length === 1 ? '' : 's'} lead more than once.` : 'Each technique leads once.' });
  const violations = filmRuleViolations(scenes, keep, opts.ground);
  items.push({ code: 'R', ok: violations.length === 0, text: violations.length ? violations.map((v) => `scene ${v.index + 1}: ${v.reason}`).join('; ') : 'Shot-card caps, exclusions and look family hold.' });
  const firstShot = scenes.find((s) => s.kind === 'shot');
  const opening = scenes.slice(0, scenes.indexOf(firstShot as DirectorScene) + 1).reduce((t, s) => t + s.durationSec, 0);
  items.push({ code: 'B1', ok: opening >= 3, text: opening >= 3 ? `The opening runs ${opening.toFixed(1)} s (≥ 3 s).` : `The opening is only ${opening.toFixed(1)} s (needs ≥ 3 s).` });
  const last = scenes[scenes.length - 1];
  items.push({ code: 'B3', ok: Boolean(last && last.durationSec >= 1), text: last && last.durationSec >= 1 ? 'The film ends on a hold of at least 1 s.' : 'The last scene is shorter than the 1 s sign-off hold.' });
  return { plan: { ...plan, scenes }, items, swapped };
}

export const releaseLine = (items: readonly ReleaseItem[]): string =>
  `Release check: ${items.filter((i) => i.ok).length}/${items.length} ✓${items.some((i) => !i.ok) ? ` · ${items.filter((i) => !i.ok).map((i) => `${i.code} ✗ ${i.text}`).join(' · ')}` : ''}`;
