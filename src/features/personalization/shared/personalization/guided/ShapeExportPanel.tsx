'use client';

import type { ShapeExportState } from '../DemoPersonalizeProvider';
import { C, hintStyle, secondaryButtonStyle } from './tokens';

const SHAPE_LABELS: Record<string, string> = {
  '16:9': 'YouTube / web (16:9)',
  '9:16': 'Reels / TikTok / Shorts (9:16)',
  '1:1': 'Feed post (1:1)',
  '4:5': 'Feed portrait (4:5)',
};

/**
 * One click to render the approved video in every common shape. Rendered in the browser (no credits);
 * each file downloads as soon as it is ready, and one failed shape never blocks the others.
 */
export function ShapeExportPanel({
  state,
  disabled,
  onStart,
  onCancel,
}: {
  state: ShapeExportState
  disabled: boolean
  onStart: () => void
  onCancel: () => void
}): React.JSX.Element {
  const running = state.status === 'running';
  return (
    <div data-testid="pz-shape-export" style={{ marginTop: 12 }}>
      <button
        type="button"
        data-testid="pz-export-all-shapes"
        disabled={disabled || running}
        onClick={onStart}
        title="Renders the same approved video in 16:9, 9:16, 1:1 and 4:5 — free, in your browser"
        style={{ ...secondaryButtonStyle, opacity: disabled || running ? 0.6 : 1 }}
      >
        {running ? 'Rendering all shapes…' : 'Export all 4 shapes'}
      </button>
      {running && (
        <button type="button" data-testid="pz-export-all-cancel" onClick={onCancel} style={{ ...secondaryButtonStyle, marginLeft: 8 }}>
          Cancel
        </button>
      )}
      {state.status !== 'idle' && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 4 }}>
          {state.items.map((item) => (
            <li key={item.aspect} data-testid={`pz-shape-${item.aspect.replace(':', 'x')}`} data-status={item.status} style={{ ...hintStyle, margin: 0, color: item.status === 'failed' ? C.danger : item.status === 'done' ? C.green : undefined }}>
              {SHAPE_LABELS[item.aspect] ?? item.aspect}:{' '}
              {item.status === 'rendering' ? `rendering ${Math.round(item.progress * 100)}%`
                : item.status === 'done' ? 'saved to your downloads'
                : item.status === 'failed' ? `failed — ${item.error ?? 'try again'}`
                : item.status === 'cancelled' ? 'skipped'
                : 'waiting'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
