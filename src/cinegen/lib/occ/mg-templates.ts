// [remix] OpenChatCut motion-graphics templates (assets/templates/*.json), hosted on the editor's existing sandboxed code renderer
// (src/lib/editor/remotion/codeLayer.jsx: opaque-origin iframe + static code gate). Upstream's template-host evaluates `({ item }) => JSX`
// in-page; here the template is wrapped as the sandbox's `function Animation({ props })` and still has to pass `checkAnimationCode`,
// so templates the gate rejects are listed as unavailable instead of being run.
// @ts-expect-error plain JS gate shared with the export runner
import { checkAnimationCode } from '../../../lib/editor/agent/codeGate.js';
import type { OverlayClip } from '@cinegen/types/workspace';

export interface MgPropField { key: string; type: string; defaultValue?: unknown; label?: string; min?: number; max?: number; step?: number; options?: Array<string | { value: string; label?: string }> }
export interface MgTemplate { id: string; name: string; category: string; description?: string; width: number; height: number; fps: number; durationInFrames: number; props: Record<string, unknown>; propSchema: MgPropField[]; code: string; thumb?: string; usable: boolean; why?: string }

const PACKS = ['social-shorts-templates', 'koubo-scenes-templates', 'openchatcut-templates'];
let cache: Promise<MgTemplate[]> | null = null;

/** Wrap an upstream template so it runs as the sandbox's `Animation({ props })`. */
export function mgCode(code: string): string {
  const m = code.match(/(?:^|\n)\s*(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/);
  const name = m?.[1] ?? 'Template';
  return `${code}\nfunction Animation({ props }) { const { width, height } = useVideoConfig(); return <${name} item={{ props, width, height }} />; }`;
}

export function gateTemplate(code: string): { ok: boolean; why?: string } {
  const r = checkAnimationCode(mgCode(code)) as { ok: boolean; errors: string[] };
  return r.ok ? { ok: true } : { ok: false, why: r.errors[0] };
}

export function loadMgTemplates(base = '/occ-templates'): Promise<MgTemplate[]> {
  cache ??= Promise.all(PACKS.map(async (p) => {
    try { const r = await fetch(`${base}/${p}.json`); return r.ok ? ((await r.json()) as Array<Record<string, unknown>>) : []; } catch { return []; }
  })).then((packs) => packs.flat().map((t) => {
    const code = String(t.code ?? '');
    const g = gateTemplate(code);
    return { ...(t as object), width: Number(t.width) || 1920, height: Number(t.height) || 1080, fps: Number(t.fps) || 30, durationInFrames: Number(t.durationInFrames) || 90,
      props: (t.props as Record<string, unknown>) ?? {}, propSchema: (t.propSchema as MgPropField[]) ?? [], usable: g.ok, why: g.why } as MgTemplate;
  }));
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
