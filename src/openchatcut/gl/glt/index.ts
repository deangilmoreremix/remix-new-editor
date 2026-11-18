// Registry of the vendored gl-transitions shaders (ids `glt-*`), adapted to the CineGen/OpenChatCut GL runtime.
// Pure (no DOM, no ?raw imports) so it loads under node/vitest and inside the sandboxed export runner.
import { GLT_CATALOG, GLT_UPSTREAM, type GltEntry, type GltParam } from './catalog.generated';
import { buildGltFrag } from './buildFrag';

export type { GltEntry, GltParam };
export { GLT_UPSTREAM, GLT_CATALOG, buildGltFrag };

/** Stored per-cut parameter overrides: uniform name -> number | boolean | number[] (vec/ivec). */
export type GltParamValue = number | boolean | number[];
export type GltParams = Record<string, GltParamValue>;
export type GltDirection = 'left' | 'right' | 'up' | 'down';

export const GLT_PREFIX = 'glt-';
export const isGltId = (id?: string): id is string => !!id && id.startsWith(GLT_PREFIX) && BY_ID.has(id);

const BY_ID = new Map<string, GltEntry>(GLT_CATALOG.map((e) => [e.id, e]));
export const getGltEntry = (id: string): GltEntry | undefined => BY_ID.get(id);
export const GLT_IDS: readonly string[] = GLT_CATALOG.map((e) => e.id);
export const GLT_CATEGORIES: readonly string[] = [...new Set(GLT_CATALOG.map((e) => e.category))];

const fragCache = new Map<string, string>();
export function gltFrag(id: string): string | undefined {
  const e = BY_ID.get(id);
  if (!e) return undefined;
  let f = fragCache.get(id);
  if (!f) { f = buildGltFrag(e.glsl); fragCache.set(id, f); }
  return f;
}

/** Display label from the upstream name: CrossWarp -> Cross Warp. */
export const gltLabel = (id: string): string => (BY_ID.get(id)?.name ?? id).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

const DIRECTIONS: Record<GltDirection, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };
export const GLT_DIRECTIONS = Object.keys(DIRECTIONS) as GltDirection[];

/** The vec2 `direction` parameter, if the shader has one: the UI shows it as a 4-way control. */
export const gltDirectionParam = (id: string): GltParam | undefined => BY_ID.get(id)?.params.find((p) => p.name === 'direction' && p.type === 'vec2');
export const directionVector = (d: GltDirection): [number, number] => [...DIRECTIONS[d]] as [number, number];
export function directionOf(v: GltParamValue | undefined): GltDirection | undefined {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  return GLT_DIRECTIONS.find((d) => DIRECTIONS[d][0] === Math.sign(v[0]) && DIRECTIONS[d][1] === Math.sign(v[1]));
}

const toUniform = (v: GltParamValue): number | number[] => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

/** Defaults overlaid with stored overrides (unknown names and wrong-shaped values are ignored): the uniform map for the runtime. */
export function gltUniforms(id: string, overrides?: GltParams): Record<string, number | number[]> {
  const e = BY_ID.get(id);
  const out: Record<string, number | number[]> = {};
  if (!e) return out;
  for (const p of e.params) {
    let v: GltParamValue = p.default;
    const o = overrides?.[p.name];
    if (o !== undefined && sameShape(p, o)) v = o;
    out[p.name] = toUniform(v);
  }
  return out;
}

function sameShape(p: GltParam, v: GltParamValue): boolean {
  if (p.type === 'bool') return typeof v === 'boolean' || v === 0 || v === 1;
  if (p.type === 'float' || p.type === 'int') return typeof v === 'number' && Number.isFinite(v);
  const n = p.type === 'vec2' || p.type === 'ivec2' ? 2 : p.type === 'vec3' ? 3 : 4;
  return Array.isArray(v) && v.length === n && v.every((x) => Number.isFinite(x));
}

export function gltDefaultParams(id: string): GltParams {
  const out: GltParams = {};
  for (const p of BY_ID.get(id)?.params ?? []) out[p.name] = p.default;
  return out;
}

/** Search over label, upstream name, category, tags, description. */
export function searchGlt(query: string, category?: string | null): GltEntry[] {
  const q = query.trim().toLowerCase();
  return GLT_CATALOG.filter((e) => (!category || e.category === category) && (!q || [gltLabel(e.id), e.name, e.category, e.tags.join(' '), e.description].join(' ').toLowerCase().includes(q)));
}
