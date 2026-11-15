// [remix] One catalogue for every animation the Library offers, filed by what the animation is and never by where it came from.
// The 267 library animations keep the groups the Animations window already uses (groupOf in hyperframes-modal.tsx); the motion-graphics
// templates are mapped onto the same group names. Chips follow the window's order, with counts.
import type { MgTemplate } from './mg-templates';
import type { HfItem } from '@cinegen/lib/hyperframes/overlay';

export interface AnimationItem {
  id: string; name: string; description?: string;
  /** The shared group shown as a chip. */
  group: string;
  width: number; height: number; seconds: number;
  /** Internal only: how to add it to the timeline. Not shown in the UI. */
  kind: 'mg' | 'hf';
  mg?: MgTemplate; hf?: HfItem;
}

/** Group order shown as chips (same names as the Animations window). */
export const GROUP_ORDER = ['Lower thirds', 'Titles & text', 'Social & UI', 'Data & charts', 'Code', 'Transitions', 'Backgrounds & effects',
  'Scenes', 'Primitives', 'Compositions', 'Data & media', 'Paths & shapes', 'Motion graphics', 'Maps & device', '3D', 'Shaders', 'More'];
export const OTHER_GROUP = 'More';

const MG_GROUPS: Array<[string, RegExp]> = [
  ['Lower thirds', /lower[- ]?third/],
  ['Data & charts', /data|chart|graph|stat|map|geograph|infograph/],
  ['Titles & text', /title|typograph|text|headline|caption|kinetic|quote|handwrit|annotat/],
  ['Social & UI', /social|short|reel|tiktok|instagram|youtube|notification|mock-?ui/],
  ['Transitions', /transition|wipe|reveal/],
  ['Code', /code|developer|terminal/],
];
/** Group for a motion-graphics template (source category -> shared group name). Unrecognised ones go to "Motion graphics". */
export function mgGroup(raw: string | undefined): string {
  const c = String(raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!c || c === 'uncategorized') return 'Motion graphics';
  return MG_GROUPS.find(([, re]) => re.test(c))?.[0] ?? 'Motion graphics';
}

export function buildAnimationCatalog(sources: { mg?: MgTemplate[]; hf?: HfItem[]; hfGroup?: (i: HfItem) => string }): AnimationItem[] {
  const hf = (sources.hf ?? []).map((i): AnimationItem => ({ id: i.id, name: i.title, description: i.description, group: sources.hfGroup ? sources.hfGroup(i) : OTHER_GROUP, width: i.dimensions.width, height: i.dimensions.height, seconds: i.duration, kind: 'hf', hf: i }));
  const mg = (sources.mg ?? []).filter((t) => t.usable).map((t): AnimationItem => ({ id: t.id, name: t.name, description: t.description, group: mgGroup(t.category), width: t.width, height: t.height, seconds: t.durationInFrames / t.fps, kind: 'mg', mg: t }));
  return [...hf, ...mg];
}

/** Chips in the window's order, each with its count; groups not in the order list come last. */
export function animationGroups(items: AnimationItem[]): Array<{ group: string; count: number }> {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.group, (counts.get(i.group) ?? 0) + 1);
  const known = GROUP_ORDER.filter((g) => counts.has(g));
  const rest = [...counts.keys()].filter((g) => !GROUP_ORDER.includes(g));
  return [...known, ...rest].map((g) => ({ group: g, count: counts.get(g)! }));
}

export function filterAnimations(items: AnimationItem[], group: string | null, query: string): AnimationItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (!group || i.group === group) && (!q || `${i.name} ${i.description ?? ''} ${i.group}`.toLowerCase().includes(q)));
}
