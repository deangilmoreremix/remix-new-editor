// [remix] Caption timeline lane (OpenChatCut's CaptionTrackLane behaviour on CineGen's timeline): cues placed by time with their
// duration, click / shift-click to select (several cues), drag to move (group move for the whole selection), drag the edges to trim,
// Delete, Ctrl/Cmd+C / V, snapping to the playhead, clip edges and other cues. Edits are saved on `clip.captions`.
import { useMemo, useRef, useState } from 'react';
import { clipEndTime, type Clip } from '@cinegen/types/timeline';
import { copyCues, deleteCues, laneCues, moveCues, pasteCues, snapMs, trimCue, clipCaptions, type LaneClipboard, type LaneCue } from '@cinegen/lib/occ/caption-lane';
import type { CaptionsData } from '../../../openchatcut/captions/types';

interface Props {
  clips: Clip[];
  pxPerSecond: number;
  scrollLeft: number;
  labelWidth: number;
  sequenceDuration: number;
  currentTime: number;
  snapEnabled: boolean;
  markers?: Array<{ time: number }>;
  selectedClipIds: Set<string>;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string) => void;
  onUpdateCaptions: (clipId: string, captions: CaptionsData) => void;
}

let board: LaneClipboard | null = null;
type Drag = { mode: 'move' | 'start' | 'end'; cue: LaneCue; x: number; keys: string[]; delta: number };

export function CaptionLane({ clips, pxPerSecond, scrollLeft, labelWidth, sequenceDuration, currentTime, snapEnabled, markers, selectedClipIds, onSeek, onSelectClip, onUpdateCaptions }: Props) {
  const cues = useMemo(() => laneCues(clips), [clips]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  if (!cues.length) return null;
  const byClip = (id: string) => clips.find((c) => c.id === id)!;
  const sel = cues.filter((c) => selected.has(c.key));
  const targets = (skip: Set<string>): number[] => [
    currentTime * 1000, ...(markers ?? []).map((m) => m.time * 1000),
    ...clips.flatMap((c) => [c.startTime * 1000, clipEndTime(c) * 1000]),
    ...cues.filter((c) => !skip.has(c.key)).flatMap((c) => [c.start, c.end]),
  ];
  const thresholdMs = (6 / pxPerSecond) * 1000;

  const commitMove = (d: Drag, deltaMs: number) => {
    const moving = d.keys.map((k) => cues.find((c) => c.key === k)!).filter(Boolean);
    for (const clipId of new Set(moving.map((m) => m.clipId))) onUpdateCaptions(clipId, moveCues(clipCaptions(byClip(clipId))!, moving.filter((m) => m.clipId === clipId), deltaMs));
  };
  const snapDelta = (d: Drag, raw: number): number => {
    if (!snapEnabled) return raw;
    const skip = new Set(d.keys);
    const t = targets(skip);
    const moving = d.keys.map((k) => cues.find((c) => c.key === k)!).filter(Boolean);
    const first = Math.min(...moving.map((m) => m.start)); const last = Math.max(...moving.map((m) => m.end));
    const a = snapMs(first + raw, t, thresholdMs) - first; const b = snapMs(last + raw, t, thresholdMs) - last;
    return Math.abs(a - raw) <= Math.abs(b - raw) ? a : b;
  };
  const begin = (e: React.PointerEvent, cue: LaneCue, mode: Drag['mode']) => {
    e.stopPropagation(); hostRef.current?.focus();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let next = new Set(selected);
    if (additive) { if (next.has(cue.key)) next.delete(cue.key); else next.add(cue.key); }
    else if (!next.has(cue.key)) next = new Set([cue.key]);
    setSelected(next);
    onSelectClip(cue.clipId); onSeek(cue.start / 1000);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ mode, cue, x: e.clientX, keys: mode === 'move' ? [...next] : [cue.key], delta: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const raw = ((e.clientX - drag.x) / pxPerSecond) * 1000;
    setDrag({ ...drag, delta: drag.mode === 'move' ? snapDelta(drag, raw) : snapEnabled ? snapMs((drag.mode === 'start' ? drag.cue.start : drag.cue.end) + raw, targets(new Set([drag.cue.key])), thresholdMs) - (drag.mode === 'start' ? drag.cue.start : drag.cue.end) : raw });
  };
  const end = () => {
    if (drag && Math.abs(drag.delta) >= 1) {
      if (drag.mode === 'move') commitMove(drag, drag.delta);
      else onUpdateCaptions(drag.cue.clipId, trimCue(clipCaptions(byClip(drag.cue.clipId))!, drag.cue, drag.mode, drag.delta));
    }
    setDrag(null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) {
      e.preventDefault();
      for (const clipId of new Set(sel.map((s) => s.clipId))) onUpdateCaptions(clipId, deleteCues(clipCaptions(byClip(clipId))!, sel.filter((s) => s.clipId === clipId)));
      setSelected(new Set());
    } else if (mod && e.key.toLowerCase() === 'c' && sel.length) {
      e.preventDefault(); const one = sel[0].clipId; board = copyCues(clipCaptions(byClip(one))!, sel.filter((s) => s.clipId === one));
    } else if (mod && e.key.toLowerCase() === 'v' && board) {
      e.preventDefault();
      const target = (sel[0] ? byClip(sel[0].clipId) : clips.find((c) => selectedClipIds.has(c.id) && clipCaptions(c))) ?? clips.find((c) => clipCaptions(c));
      if (target) onUpdateCaptions(target.id, pasteCues(clipCaptions(target)!, board, currentTime * 1000, target.id));
    } else if (e.key === 'Escape') setSelected(new Set());
  };

  const shift = (c: LaneCue) => {
    if (!drag) return { start: c.start, end: c.end };
    if (drag.mode === 'move') return drag.keys.includes(c.key) ? { start: c.start + drag.delta, end: c.end + drag.delta } : { start: c.start, end: c.end };
    if (c.key !== drag.cue.key) return { start: c.start, end: c.end };
    return drag.mode === 'start' ? { start: c.start + drag.delta, end: c.end } : { start: c.start, end: c.end + drag.delta };
  };
  return (
    <div className="caption-lane" ref={hostRef} tabIndex={0} onKeyDown={onKey} data-testid="caption-lane" style={{ display: 'flex', height: 30, borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,.08))', background: 'var(--bg-surface, #0b0e14)', flex: '0 0 auto', outline: 'none' }}>
      <div title="Captions: drag to move, drag edges to trim, Shift-click to select several, Delete, Ctrl/Cmd+C / V" style={{ width: labelWidth, flex: '0 0 auto', display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, opacity: 0.8 }}>Captions{sel.length > 1 ? ` · ${sel.length}` : ''}</div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(sequenceDuration, 1) * pxPerSecond, transform: `translateX(${-scrollLeft}px)` }}>
          {cues.map((c) => {
            const on = selected.has(c.key); const s = shift(c);
            return (
              <div key={c.key} role="button" tabIndex={-1} data-testid="caption-cue" title={`${c.text} · ${(s.start / 1000).toFixed(2)}s–${(s.end / 1000).toFixed(2)}s`}
                onPointerDown={(e) => begin(e, c, 'move')}
                style={{ position: 'absolute', top: 4, bottom: 4, left: (s.start / 1000) * pxPerSecond, width: Math.max(8, ((s.end - s.start) / 1000) * pxPerSecond), borderRadius: 5, background: on ? 'rgba(34,211,238,.45)' : 'rgba(34,211,238,.22)', border: `1px solid ${on ? '#22d3ee' : 'rgba(34,211,238,.5)'}`, color: '#e5f9ff', fontSize: 10, padding: '0 8px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', cursor: drag ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}>
                <span onPointerDown={(e) => begin(e, c, 'start')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
                {c.text}
                <span onPointerDown={(e) => begin(e, c, 'end')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
