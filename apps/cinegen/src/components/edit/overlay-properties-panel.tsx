import { useEffect, useRef } from 'react';
import type { OverlayClip } from '@/types/timeline';
import { OVERLAY_KIND_LABELS, isGateKind, overlayConfig, switchGateKind } from '@/lib/optin/overlay-kinds';
import { renderAddonEditor } from '@/lib/optin/addonEditor.js';
import { listBuilderFields } from '@/lib/optin/listBuilder.js';

interface OverlayPropertiesPanelProps {
  overlay: OverlayClip;
  onUpdate: (id: string, patch: Partial<OverlayClip>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/** Right-hand panel for an opt-in overlay: timing + Styles / Fields / Pointer / Integrations. */
export function OverlayPropertiesPanel({ overlay, onUpdate, onDelete, onClose }: OverlayPropertiesPanelProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ overlay, onUpdate });
  latest.current = { overlay, onUpdate };
  const gate = isGateKind(overlay.kind);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const editor = renderAddonEditor(el, {
      options: overlayConfig(latest.current.overlay),
      fieldsFor: (o: Record<string, unknown>) => listBuilderFields(o),
      idPrefix: 'ovl',
      onChange: (next: Record<string, unknown>) => {
        const cur = latest.current.overlay;
        // Switching List Builder <-> Personalizer swaps in that kind's defaults.
        if (isGateKind(cur.kind) && next.kind && next.kind !== cur.kind) {
          const switched = switchGateKind(cur, next.kind as OverlayClip['kind']);
          latest.current.onUpdate(cur.id, { kind: switched.kind, name: switched.name, options: switched.options });
          editor.setOptions(overlayConfig(switched));
          return;
        }
        latest.current.onUpdate(cur.id, { options: next });
      },
    });
    return () => editor.destroy();
  }, [overlay.id]);

  return (
    <div className="overlay-panel" data-testid="overlay-properties-panel">
      <div className="overlay-panel__header">
        <span className="overlay-panel__title">{OVERLAY_KIND_LABELS[overlay.kind]} overlay</span>
        <button type="button" className="overlay-panel__btn" onClick={() => onDelete(overlay.id)}>Delete</button>
        <button type="button" className="overlay-panel__btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      <div className="overlay-panel__body">
        {gate ? (
          <p className="overlay-panel__note">Viewers must fill this out before the video plays. It sits at the start of the timeline and takes no video time.</p>
        ) : (
          <div className="overlay-panel__times">
            <label>Start (s)
              <input type="number" min={0} step={0.1} value={overlay.start}
                onChange={(e) => onUpdate(overlay.id, { start: Math.max(0, Number(e.target.value) || 0), end: Math.max(overlay.end, (Number(e.target.value) || 0) + 0.5) })} />
            </label>
            <label>End (s)
              <input type="number" min={0.5} step={0.1} value={overlay.end}
                onChange={(e) => onUpdate(overlay.id, { end: Math.max(overlay.start + 0.5, Number(e.target.value) || 0) })} />
            </label>
          </div>
        )}
        <div ref={host} className="overlay-panel__form" />
      </div>
    </div>
  );
}
