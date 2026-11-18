// [remix] Stage 1: mark in / out strip + Insert / Overwrite buttons for the source monitor (Clip Viewer) when a media-pool asset is loaded.
import { formatTimecode } from './time-ruler';
import type { SourceMarks } from '@cinegen/lib/editor/stage1';

export interface SourceMarksUi {
  marks: SourceMarks;
  onSetIn: (time: number) => void;
  onSetOut: (time: number) => void;
  onClear: () => void;
  onInsert: () => void;
  onOverwrite: () => void;
}

const btn: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: 'inherit', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' };

export function SourceMarkBar({ ui, sourceTime, duration }: { ui: SourceMarksUi; sourceTime: number; duration: number }) {
  const { marks } = ui;
  const pct = (t: number | null) => (t !== null && duration > 0 ? `${Math.max(0, Math.min(100, (t / duration) * 100))}%` : null);
  const a = pct(marks.markIn); const b = pct(marks.markOut);
  return (
    <div className="source-viewer__marks" data-testid="source-marks" style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3 }} aria-hidden>
        {(a || b) && <div data-testid="source-marks-range" style={{ position: 'absolute', top: 0, bottom: 0, left: a ?? '0%', right: b ? `${100 - parseFloat(b)}%` : '0%', background: '#0fd7f1', opacity: 0.7, borderRadius: 3 }} />}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={btn} onClick={() => ui.onSetIn(sourceTime)} title="Mark in (I)" data-testid="mark-in">I</button>
        <button type="button" style={btn} onClick={() => ui.onSetOut(sourceTime)} title="Mark out (O)" data-testid="mark-out">O</button>
        <button type="button" style={btn} onClick={ui.onClear} title="Clear in and out (Alt+X)" data-testid="mark-clear">Clear</button>
        <span data-testid="mark-readout" style={{ opacity: 0.8 }}>
          {marks.markIn === null ? 'start' : formatTimecode(marks.markIn)} to {marks.markOut === null ? 'end' : formatTimecode(marks.markOut)}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={ui.onInsert} title="Insert at the playhead and ripple (,)" data-testid="insert-edit">Insert</button>
        <button type="button" style={btn} onClick={ui.onOverwrite} title="Overwrite at the playhead (.)" data-testid="overwrite-edit">Overwrite</button>
      </div>
    </div>
  );
}
