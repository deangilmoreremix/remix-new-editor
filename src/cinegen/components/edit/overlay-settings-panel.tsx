// [remix] Inspector for the selected overlay. The fields are drawn by the old editor's settings renderer (`renderAddonEditor`),
// so Lead Generator / List Builder / CTA have the same Basic / Style / Fields / Integrations tabs as before.
import { useEffect, useRef } from 'react';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS settings renderer from the main app
import { renderAddonEditor } from '../../../lib/editor/addons/addonEditor.js';
import { overlaySchema } from '@cinegen/lib/overlays/descriptors';

interface Props {
  overlay: OverlayClip;
  duration: number;
  onUpdate: (updates: Partial<OverlayClip>) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function OverlaySettingsPanel({ overlay, duration, onUpdate, onRemove, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(overlay);
  latest.current = overlay;

  useEffect(() => {
    if (!box.current) return;
    const schema = overlaySchema(latest.current);
    const editor = renderAddonEditor(box.current, {
      fields: schema.fields, fieldsFor: schema.fieldsFor, options: schema.options, idPrefix: `ov-${overlay.id}`,
      onChange: (next: Record<string, unknown>) => {
        if (latest.current.type === 'list-builder') onUpdate({ config: next });
        else {
          const { id: _id, type: _type, start: _start, end: _end, ...rest } = next as Record<string, unknown>;
          void _id; void _type; void _start; void _end;
          onUpdate(rest as Partial<OverlayClip>);
        }
      },
    });
    return () => editor?.destroy?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay.id]);

  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return (
    <aside className="clip-properties-panel addon-panel" style={{ overflow: 'auto' }}>
      <style>{`
        .addon-panel .addon-tabs{display:flex;gap:6px;margin:6px 0 10px;flex-wrap:wrap}
        .addon-panel .addon-tab{border:1px solid var(--border-medium,rgba(255,255,255,.18));background:transparent;color:var(--text-secondary);border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer}
        .addon-panel .addon-tab.active{border-color:#eb5054;color:#fff;background:rgba(235,80,84,.18)}
        .addon-panel .addon-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:11px;color:var(--text-secondary)}
        .addon-panel .addon-field input[type=text],.addon-panel .addon-field input[type=url],.addon-panel .addon-field textarea,.addon-panel .addon-field select{width:100%;box-sizing:border-box;background:var(--bg-raised,#10141c);color:var(--text-primary,#fff);border:1px solid var(--border-medium,rgba(255,255,255,.18));border-radius:6px;padding:6px 8px;font:inherit}
        .addon-panel .addon-fieldlist__row{display:flex;gap:4px;align-items:center;margin-bottom:4px}
        .addon-panel .mini-btn{border:1px solid var(--border-medium,rgba(255,255,255,.18));background:transparent;color:inherit;border-radius:6px;padding:2px 6px;cursor:pointer}
      `}</style>
      <div className="clip-properties-panel__header">
        <span className="clip-properties-panel__title">{overlay.name} overlay</span>
        <span>
          <button type="button" className="mini-btn" onClick={onRemove}>Delete</button>{' '}
          <button type="button" className="mini-btn" onClick={onClose} aria-label="Close">✕</button>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px' }}>
        <label style={{ fontSize: 11 }}>Start (s)<br />
          <input type="number" min={0} max={Math.max(0, overlay.end - 0.5)} step={0.1} value={Number(overlay.start.toFixed(2))}
            onChange={(e) => onUpdate({ start: Math.max(0, Math.min(num(e.target.value, overlay.start), overlay.end - 0.5)) })} style={{ width: 80 }} />
        </label>
        <label style={{ fontSize: 11 }}>End (s)<br />
          <input type="number" min={overlay.start + 0.5} max={Math.max(duration, overlay.end)} step={0.1} value={Number(overlay.end.toFixed(2))}
            onChange={(e) => onUpdate({ end: Math.max(overlay.start + 0.5, num(e.target.value, overlay.end)) })} style={{ width: 80 }} />
        </label>
      </div>
      <div ref={box} style={{ padding: '0 12px 16px' }} />
    </aside>
  );
}
