import type { ClipData, ProjectData } from "../types";
import { uid } from "../types";
import type { CardDef, PropField } from "../cards/types";
import { clipDefaultsFor } from "../cards/types";

/** Edit operations returned by the AI chat (netlify/functions/workbench-chat.js).
 *  Everything is validated here before it touches the project: unknown ops, ids,
 *  cards and prop keys are rejected or dropped, numbers are clamped. */
export type EditOp = { op: string; [k: string]: unknown };

export interface ApplyResult {
  project: ProjectData;
  applied: number;
  errors: string[];
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const str = (v: unknown, max = 200): string | undefined =>
  typeof v === "string" ? v.slice(0, max) : undefined;

const coerceProp = (field: PropField, v: unknown): unknown => {
  switch (field.type) {
    case "text":
    case "textarea":
      return typeof v === "string" ? v.slice(0, 2000) : undefined;
    case "color":
      return typeof v === "string" && /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i.test(v.trim()) ? v.trim() : undefined;
    case "boolean":
      return typeof v === "boolean" ? v : undefined;
    case "select":
      return typeof v === "string" && field.options.some((o) => o.value === v) ? v : undefined;
    case "number":
    case "slider": {
      const n = num(v);
      if (n === undefined) return undefined;
      const lo = "min" in field && field.min !== undefined ? field.min : -Infinity;
      const hi = "max" in field && field.max !== undefined ? field.max : Infinity;
      return clamp(n, lo, hi);
    }
  }
};

/** Keep only schema keys with valid values. Media cards' "file" may only reuse a file
 *  already present in the project (the AI must never invent media URLs). */
export const sanitizeProps = (
  card: CardDef,
  props: unknown,
  knownFiles: Set<string>,
  errors: string[],
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (!props || typeof props !== "object") return out;
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    const field = card.schema.find((f) => f.key === k);
    if (!field) {
      errors.push(`"${card.id}" has no property "${k}"`);
      continue;
    }
    if (k === "file" && typeof v === "string" && !knownFiles.has(v)) {
      errors.push(`refused unknown media file for "${card.id}"`);
      continue;
    }
    const c = coerceProp(field, v);
    if (c === undefined) errors.push(`invalid value for "${k}"`);
    else out[k] = c;
  }
  return out;
};

const findClip = (p: ProjectData, id: unknown) => {
  for (const track of p.tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return { track, clip };
  }
  return null;
};

export const applyOps = (
  project: ProjectData,
  ops: EditOp[],
  cards: Record<string, CardDef>,
): ApplyResult => {
  const p: ProjectData = JSON.parse(JSON.stringify(project));
  const errors: string[] = [];
  const knownFiles = new Set<string>();
  for (const t of p.tracks) for (const c of t.clips) if (typeof c.props.file === "string") knownFiles.add(c.props.file);
  let applied = 0;

  for (const op of Array.isArray(ops) ? ops.slice(0, 100) : []) {
    const before = errors.length;
    switch (op?.op) {
      case "update_clip": {
        const hit = findClip(p, op.clipId);
        if (!hit) { errors.push(`no clip "${String(op.clipId)}"`); break; }
        const c = hit.clip;
        const start = num(op.start); if (start !== undefined) c.start = Math.max(0, Math.round(start));
        const duration = num(op.duration); if (duration !== undefined) c.duration = Math.max(2, Math.round(duration));
        const inOffset = num(op.inOffset); if (inOffset !== undefined) c.inOffset = Math.max(0, Math.round(inOffset));
        const speed = num(op.speed); if (speed !== undefined) c.speed = clamp(speed, 0.25, 4);
        const opacity = num(op.opacity); if (opacity !== undefined) c.opacity = clamp(opacity, 0, 1);
        const scale = num(op.scale); if (scale !== undefined) c.scale = clamp(scale, 0.05, 10);
        const x = num(op.x); if (x !== undefined) c.x = clamp(x, -10000, 10000);
        const y = num(op.y); if (y !== undefined) c.y = clamp(y, -10000, 10000);
        const label = str(op.label); if (label !== undefined) c.label = label;
        break;
      }
      case "set_props": {
        const hit = findClip(p, op.clipId);
        const card = hit && cards[hit.clip.cardId];
        if (!hit || !card) { errors.push(`no clip "${String(op.clipId)}"`); break; }
        hit.clip.props = { ...hit.clip.props, ...sanitizeProps(card, op.props, knownFiles, errors) };
        break;
      }
      case "add_clip": {
        const card = typeof op.cardId === "string" ? cards[op.cardId] : undefined;
        if (!card) { errors.push(`unknown card "${String(op.cardId)}"`); break; }
        const track = p.tracks.find((t) => t.id === op.trackId) ?? p.tracks[0];
        if (!track) { errors.push("project has no tracks"); break; }
        const defaults = clipDefaultsFor(card, p.fps);
        const duration = num(op.duration);
        const clip: ClipData = {
          id: uid("clip"),
          cardId: card.id,
          start: Math.max(0, Math.round(num(op.start) ?? 0)),
          duration: duration !== undefined ? Math.max(2, Math.round(duration)) : defaults.duration,
          inOffset: 0,
          speed: defaults.speed,
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          props: sanitizeProps(card, op.props, knownFiles, errors),
          label: str(op.label),
        };
        track.clips.push(clip);
        break;
      }
      case "remove_clip": {
        const hit = findClip(p, op.clipId);
        if (!hit) { errors.push(`no clip "${String(op.clipId)}"`); break; }
        hit.track.clips = hit.track.clips.filter((c) => c.id !== op.clipId);
        break;
      }
      case "split_clip": {
        const hit = findClip(p, op.clipId);
        const at = num(op.at);
        if (!hit || at === undefined) { errors.push("invalid split"); break; }
        const local = Math.round(at - hit.clip.start);
        if (local <= 0 || local >= hit.clip.duration) { errors.push("split point is outside the clip"); break; }
        const right: ClipData = {
          ...JSON.parse(JSON.stringify(hit.clip)),
          id: uid("clip"),
          start: hit.clip.start + local,
          duration: hit.clip.duration - local,
          inOffset: hit.clip.inOffset + local * hit.clip.speed,
        };
        hit.clip.duration = local;
        hit.track.clips.push(right);
        break;
      }
      case "move_clip_to_track": {
        const hit = findClip(p, op.clipId);
        const target = p.tracks.find((t) => t.id === op.trackId);
        if (!hit || !target) { errors.push("invalid move"); break; }
        if (hit.track !== target) {
          hit.track.clips = hit.track.clips.filter((c) => c.id !== op.clipId);
          target.clips.push(hit.clip);
        }
        break;
      }
      case "add_track": {
        p.tracks.unshift({ id: uid("track"), name: str(op.name, 60) || `Track ${p.tracks.length + 1}`, clips: [] });
        break;
      }
      case "remove_track": {
        const n = p.tracks.length;
        p.tracks = p.tracks.filter((t) => t.id !== op.trackId);
        if (p.tracks.length === n) errors.push(`no track "${String(op.trackId)}"`);
        break;
      }
      case "set_project": {
        const name = str(op.name, 80); if (name) p.name = name;
        const bg = str(op.background, 40);
        if (bg !== undefined) {
          if (/^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(bg)) p.background = bg;
          else errors.push("invalid background colour");
        }
        break;
      }
      default:
        errors.push(`unsupported operation "${String(op?.op)}"`);
    }
    if (errors.length === before) applied++;
  }
  return { project: p, applied, errors };
};

/** Compact project for the model: ids, timing, card, label, props (no theme internals). */
export const compactProject = (p: ProjectData) => ({
  name: p.name,
  fps: p.fps,
  width: p.width,
  height: p.height,
  background: p.background,
  tracks: p.tracks.map((t) => ({
    id: t.id,
    name: t.name,
    clips: t.clips.map((c) => ({
      id: c.id, cardId: c.cardId, label: c.label, start: c.start, duration: c.duration,
      inOffset: c.inOffset, speed: c.speed, opacity: c.opacity, scale: c.scale, x: c.x, y: c.y, props: c.props,
    })),
  })),
});

/** Card catalog for the model: schemas for tunable cards, names only for the motion library. */
export const compactCatalog = (list: CardDef[]) =>
  list.map((c) =>
    c.schema.length
      ? { id: c.id, name: c.nameEn ?? c.name, schema: c.schema.map((f) => ({ key: f.key, type: f.type, ...("options" in f ? { options: f.options.map((o) => o.value) } : {}), ...("min" in f ? { min: f.min, max: f.max } : {}) })) }
      : { id: c.id, name: c.nameEn ?? c.name },
  );
