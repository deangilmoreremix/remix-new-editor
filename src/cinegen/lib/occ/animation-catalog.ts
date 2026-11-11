// [remix] One catalogue for every animation the Library offers, filed by what the animation is (lower third, chart, title...) and never by
// where it came from. Each source (motion-graphics templates today; more sources can be added to `sources`) keeps its own category
// names; `animationGroup` maps them onto one shared list of groups. Unknown categories land in "Other" so nothing is hidden.
import type { MgTemplate } from './mg-templates';

export interface AnimationItem {
  id: string; name: string; description?: string;
  /** The category as the source names it (kept for search). */
  rawCategory: string;
  /** The shared group shown as a chip. */
  group: string;
  width: number; height: number; seconds: number;
  /** Internal only: how to add it to the timeline. Not shown in the UI. */
  kind: 'mg';
  mg: MgTemplate;
}

const GROUPS: Array<[string, RegExp]> = [
  ['Lower thirds', /lower[- ]?third/],
  ['Data & charts', /data|chart|graph|stat|map|geograph|infograph/],
  ['Titles & text', /title|typograph|text|headline|caption|kinetic/],
  ['Social', /social|short|reel|tiktok|instagram|youtube|notification|mock-?ui/],
  ['Transitions', /transition|wipe|reveal/],
  ['Hand-drawn & annotations', /handwrit|annotat|diagram|sketch|draw/],
  ['Code', /code|developer|terminal/],
  ['Quotes', /quote|testimonial/],
  ['Talking head', /talking|podcast|interview|speaker/],
];
export const OTHER_GROUP = 'Other';

export function animationGroup(raw: string | undefined): string {
  const c = String(raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!c || c === 'uncategorized') return OTHER_GROUP;
  return GROUPS.find(([, re]) => re.test(c))?.[0] ?? OTHER_GROUP;
}

export function buildAnimationCatalog(sources: { mg?: MgTemplate[] }): AnimationItem[] {
  return (sources.mg ?? []).filter((t) => t.usable).map((t) => ({
    id: t.id, name: t.name, description: t.description, rawCategory: t.category, group: animationGroup(t.category),
    width: t.width, height: t.height, seconds: t.durationInFrames / t.fps, kind: 'mg' as const, mg: t,
  }));
}

/** Chips in a stable order (known groups first, Other last), each with its count. */
export function animationGroups(items: AnimationItem[]): Array<{ group: string; count: number }> {
  const order = [...GROUPS.map(([g]) => g), OTHER_GROUP];
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.group, (counts.get(i.group) ?? 0) + 1);
  return order.filter((g) => counts.has(g)).map((g) => ({ group: g, count: counts.get(g)! }));
}

export function filterAnimations(items: AnimationItem[], group: string | null, query: string): AnimationItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((i) => (!group || i.group === group) && (!q || `${i.name} ${i.description ?? ''} ${i.rawCategory}`.toLowerCase().includes(q)));
}
