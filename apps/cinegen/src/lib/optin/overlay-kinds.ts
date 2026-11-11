import type { OverlayClip, OverlayKind } from '@/types/timeline';
import { defaultOptin, normalizeListBuilder, switchListBuilderKind } from './listBuilder.js';

export const OVERLAY_KIND_LABELS: Record<OverlayKind, string> = {
  'list-builder': 'List Builder',
  personalizer: 'Personalizer',
  'lead-generator': 'Lead Generator',
};

/** List Builder / Personalizer are a registration wall at 0s (one per video). */
export const isGateKind = (kind: OverlayKind): boolean => kind === 'list-builder' || kind === 'personalizer';

/** Visual length of a gate marker on the lane (it takes no video time). */
export const GATE_MARKER_SECONDS = 3;

export function newOverlay(kind: OverlayKind, start: number, hasGate = false): OverlayClip {
  const id = `ov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const gate = isGateKind(kind);
  return {
    id,
    kind,
    name: OVERLAY_KIND_LABELS[kind],
    // A Lead Generator never lands on top of the List Builder marker at 0s.
    start: gate ? 0 : Math.max(start, hasGate ? GATE_MARKER_SECONDS : 0),
    end: gate ? GATE_MARKER_SECONDS : Math.max(start, hasGate ? GATE_MARKER_SECONDS : 0) + 6,
    options: { ...defaultOptin(kind), enabled: true },
  };
}

/** The full opt-in config for an overlay (fills options a saved project predates). */
export function overlayConfig(o: OverlayClip): Record<string, unknown> {
  if (isGateKind(o.kind)) return { ...normalizeListBuilder({ ...o.options, kind: o.kind }), enabled: true };
  return { ...defaultOptin('lead-generator'), ...o.options, kind: 'lead-generator', enabled: true };
}

/** Switch a gate between List Builder and Personalizer (swaps that kind's defaults). */
export function switchGateKind(o: OverlayClip, kind: OverlayKind): OverlayClip {
  return { ...o, kind, name: OVERLAY_KIND_LABELS[kind], options: switchListBuilderKind({ enabled: true }, kind) };
}
