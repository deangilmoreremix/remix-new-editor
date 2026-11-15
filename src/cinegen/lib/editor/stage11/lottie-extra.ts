// [remix] Stage 11 (port J): Lottie value-slot overrides and layer visibility (pure JSON, no renderer). Completes the Stage 2 colour / text / speed edits.
// Value-slot DISCOVERY is adapted from FreeCut (https://github.com/walterlow/freecut, MIT licence), commit 5ceeeb388eef5423640b7db157706274bf1b8165, file
// src/infrastructure/lottie/lottie-slots.ts (scalar = single number, vector = [x, y] default of the top-level `slots` table; colour, gradient and text
// slots are handled by lottie-edit.ts and skipped here). FreeCut applies slot values through dotlottie-web's native setters at render time; this editor
// renders with lottie-web (preview) and @remotion/lottie (export), which have no slot API, so the value is BAKED into the properties that reference
// the slot (`sid`), like colours and text already are. Layer visibility has no FreeCut counterpart: it sets the standard Lottie `hd` (hidden) flag.
// Limits: an animated slot property becomes static at the chosen value; only top-level layers are listed (not layers inside precompositions).

export type LottieSlotValue = number | [number, number];
export interface LottieValueSlot { id: string; type: 'scalar' | 'vector'; label: string; value: LottieSlotValue }
export interface LottieLayerInfo { key: string; label: string; kind: 'precomp' | 'solid' | 'image' | 'null' | 'shape' | 'text' | 'audio' | 'other'; hidden: boolean }

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isVec2 = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
const parse = (json: unknown): Obj | null => {
  if (typeof json === 'string') { try { return JSON.parse(json) as Obj; } catch { return null; } }
  return isObj(json) ? json : null;
};

/** The static value of a slot property; the first keyframe's start value when animated. */
function slotStaticValue(p: unknown): unknown {
  if (!isObj(p)) return undefined;
  if (p.a === 1) { const first = Array.isArray(p.k) ? (p.k[0] as { s?: unknown } | undefined) : undefined; return first?.s; }
  return p.k;
}

/** Editable scalar / 2D value slots of a Lottie animation (empty for animations without a `slots` table). */
export function extractLottieValueSlots(json: unknown): LottieValueSlot[] {
  const data = parse(json);
  const slots = data?.slots;
  if (!isObj(slots)) return [];
  const out: LottieValueSlot[] = [];
  for (const [id, def] of Object.entries(slots)) {
    const d = isObj(def) ? def : {};
    let value = slotStaticValue(d.p);
    if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'number') value = value[0]; // keyframe start values are 1-element arrays (not handled upstream)
    const label = typeof d.nm === 'string' && d.nm.trim() ? d.nm.trim() : id;
    if (typeof value === 'number') out.push({ id, type: 'scalar', label, value });
    else if (isVec2(value)) out.push({ id, type: 'vector', label, value: [value[0], value[1]] });
  }
  return out;
}

function bakeProp(prop: Obj, value: LottieSlotValue) {
  prop.a = 0;
  if (typeof value === 'number') { prop.k = value; return; }
  const old = Array.isArray(prop.k) && prop.a === 0 ? prop.k : null;
  prop.k = old && old.length > 2 && typeof old[0] === 'number' ? [value[0], value[1], ...(old.slice(2) as number[])] : [value[0], value[1]];
}

/** Patched copy with the slot values written into every property that references the slot. The input is never mutated. */
export function applyLottieValueOverrides<T>(animation: T, values: Record<string, LottieSlotValue> | undefined | null): T {
  if (!animation || !values || !Object.keys(values).length) return animation;
  const copy = JSON.parse(JSON.stringify(animation)) as T;
  const slotById = new Map(extractLottieValueSlots(copy).map((s) => [s.id, s]));
  const valid = (id: string, v: LottieSlotValue) => { const s = slotById.get(id); return !!s && (s.type === 'scalar' ? typeof v === 'number' && Number.isFinite(v) : isVec2(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])); };
  const todo = Object.entries(values).filter(([id, v]) => valid(id, v));
  if (!todo.length) return animation;
  const map = new Map(todo);
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!isObj(node)) return;
    if (typeof node.sid === 'string' && map.has(node.sid) && 'k' in node) bakeProp(node, map.get(node.sid) as LottieSlotValue);
    for (const v of Object.values(node)) walk(v);
  };
  walk(copy);
  // keep the slot table itself in step (some players read defaults from it)
  const slots = (copy as unknown as Obj).slots;
  if (isObj(slots)) for (const [id, v] of map) { const d = slots[id]; if (isObj(d) && isObj(d.p)) bakeProp(d.p, v); }
  return copy;
}

const KIND: Record<number, LottieLayerInfo['kind']> = { 0: 'precomp', 1: 'solid', 2: 'image', 3: 'null', 4: 'shape', 5: 'text', 6: 'audio' };

/** Top-level layers, keyed by their index in `layers`. */
export function extractLottieLayers(json: unknown): LottieLayerInfo[] {
  const data = parse(json);
  const layers = data?.layers;
  if (!Array.isArray(layers)) return [];
  return layers.map((l, i) => {
    const o = isObj(l) ? l : {};
    const nm = typeof o.nm === 'string' && o.nm.trim() ? o.nm.trim() : '';
    return { key: String(i), label: nm || `Layer ${i + 1}`, kind: KIND[o.ty as number] ?? 'other', hidden: o.hd === true };
  });
}

/** Patched copy with the given layers hidden (`hd: true`). Layers already hidden stay hidden; null layers (parents) are hidden too if listed. */
export function applyLottieLayerVisibility<T>(animation: T, hidden: readonly string[] | undefined | null): T {
  if (!animation || !hidden?.length) return animation;
  const data = animation as unknown as Obj;
  if (!Array.isArray(data.layers)) return animation;
  const set = new Set(hidden);
  if (!data.layers.some((_, i) => set.has(String(i)))) return animation;
  const copy = JSON.parse(JSON.stringify(animation)) as T;
  (copy as unknown as { layers: Obj[] }).layers.forEach((l, i) => { if (set.has(String(i)) && isObj(l)) l.hd = true; });
  return copy;
}
