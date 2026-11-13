// [remix] OpenChatCut motion-graphics templates (assets/templates/*.json), hosted on the editor's existing sandboxed code renderer
// (src/lib/editor/remotion/codeLayer.jsx: opaque-origin iframe + static code gate). Upstream's template-host evaluates `({ item }) => JSX`
// in-page; here the template is wrapped as the sandbox's `function Animation({ props })` and still has to pass `checkAnimationCode`,
// so templates the gate rejects are listed as unavailable instead of being run.
// @ts-expect-error plain JS gate shared with the export runner
import { checkAnimationCode } from '../../../lib/editor/agent/codeGate.js';
import { t as t_ } from '../../../openchatcut/i18n/t';
import { mgEn } from './mg-templates-en';
import type { OverlayClip } from '@cinegen/types/workspace';

export interface MgPropField { key: string; type: string; defaultValue?: unknown; label?: string; min?: number; max?: number; step?: number; options?: Array<string | { value: string; label?: string }> }
export interface MgTemplate { id: string; name: string; category: string; description?: string; width: number; height: number; fps: number; durationInFrames: number; props: Record<string, unknown>; propSchema: MgPropField[]; code: string; thumb?: string; usable: boolean; why?: string }

const PACKS = ['social-shorts-templates', 'koubo-scenes-templates', 'openchatcut-templates'];
let cache: Promise<MgTemplate[]> | null = null;
/** Templates the code gate rejected only because of spelling (a variable named `top`, string `+` chains) load from the repaired pack made by scripts/repair-mg-templates.mjs; the gate still checks the repaired code. */
const REPAIRED = 'repaired';

/** Wrap an upstream template so it runs as the sandbox's `Animation({ props })`. */
export function mgCode(code: string): string {
  const m = code.match(/(?:^|\n)\s*(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/);
  const name = m?.[1] ?? 'Template';
  code = code.replace(/第 \{chapter\} 点/g, 'Point {chapter}'); // the one on-screen string that lives in code rather than in props
  return `${code}\nfunction Animation({ props }) { const { width, height } = useVideoConfig(); return <${name} item={{ props, width, height }} />; }`;
}

export function gateTemplate(code: string): { ok: boolean; why?: string } {
  const r = checkAnimationCode(mgCode(code)) as { ok: boolean; errors: string[] };
  return r.ok ? { ok: true } : { ok: false, why: r.errors[0] };
}

export function loadMgTemplates(base = '/occ-templates'): Promise<MgTemplate[]> {
  cache ??= Promise.all([Promise.all(PACKS.map(async (p) => {
    try { const r = await fetch(`${base}/${p}.json`); return r.ok ? ((await r.json()) as Array<Record<string, unknown>>) : []; } catch { return []; }
  })), (async () => { try { const r = await fetch(`${base}/${REPAIRED}.json`); return r.ok ? ((await r.json()) as Record<string, string>) : {}; } catch { return {}; } })()]).then(([packs, fixed]) => packs.flat().map((tpl) => {
    const t = tpl;
    const code = fixed[String(t.id)] ?? String(t.code ?? '');
    const g = gateTemplate(code);
    // OpenChatCut keys its UI strings by the Chinese original and ships an English dictionary: names, labels and sample text use it where it has an entry
    const en = (v: unknown) => (typeof v === 'string' ? mgEn(t_(v)) : v);
    const schema = ((t.propSchema as MgPropField[]) ?? []).map((f) => ({ ...f, label: en(f.label) as string, defaultValue: en(f.defaultValue), options: f.options?.map((o) => (typeof o === 'string' ? mgEn(t_(o)) : { ...o, label: en(o.label) as string })) }));
    const props = Object.fromEntries(Object.entries((t.props as Record<string, unknown>) ?? {}).map(([k, v]) => [k, en(v)]));
    return { ...(t as object), name: en(t.name) as string, description: en(t.description) as string, category: en(t.category) as string, width: Number(t.width) || 1920, height: Number(t.height) || 1080, fps: Number(t.fps) || 30, durationInFrames: Number(t.durationInFrames) || 90,
      props, propSchema: schema, usable: g.ok, why: g.why } as MgTemplate;
  })).catch((e) => { cache = null; throw e; }); // a failed load is not remembered, so Retry can try again
  return cache;
}

export function createMgOverlay(t: MgTemplate, startSec: number): OverlayClip {
  const id = `mg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const start = Math.max(0, startSec);
  return { id, type: 'mg-template', name: t.name, start, end: start + t.durationInFrames / t.fps, templateId: t.id, code: t.code, props: { ...t.props }, propSchema: t.propSchema, tplWidth: t.width, tplHeight: t.height, tplFps: t.fps };
}

/** Composition layer for an overlay (export + the sandbox preview frame). */
export function mgOverlayLayer(o: OverlayClip, fps: number) {
  const from = Math.round(o.start * fps);
  return { id: o.id, kind: 'code', trackIndex: 99, from, durationInFrames: Math.max(1, Math.round((o.end - o.start) * fps)), effects: [], code: mgCode(String(o.code ?? '')), props: (o.props as Record<string, unknown>) ?? {}, title: o.name };
}
