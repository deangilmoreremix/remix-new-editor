// [remix] Multicam camera switching: "Cut to this camera" over a stretch from the playhead. The edit plan is OpenChatCut's planCamSwitch.
import { useState } from 'react';
import { clipEffectiveDuration, clipEndTime, type Clip, type Timeline } from '@cinegen/types/timeline';
import { cutToCamera } from '@cinegen/lib/occ/cam-switch';

export function ClipMulticamSection({ clip, timeline, currentTime, onTimelineEdit }: { clip: Clip; timeline: Timeline; currentTime: number; onTimelineEdit: (edit: (tl: Timeline) => Timeline) => void }) {
  const [len, setLen] = useState(5);
  const [msg, setMsg] = useState('');
  const isVideoTrack = timeline.tracks.find((t) => t.id === clip.trackId)?.kind === 'video';
  const from = Math.max(currentTime, clip.startTime);
  const available = clipEndTime(clip) - from;
  const others = timeline.clips.filter((c) => c.trackId !== clip.trackId && timeline.tracks.find((t) => t.id === c.trackId)?.kind === 'video' && c.startTime < from + len && clipEndTime(c) > from);
  if (!isVideoTrack || !others.length) return null;
  const to = from + Math.min(len, Math.max(0.1, available));
  return (
    <div className="clip-properties-panel__section" data-testid="clip-multicam">
      <div className="clip-properties-panel__section-title">Multicam</div>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{others.length} other camera clip{others.length === 1 ? '' : 's'} overlap this stretch.</div>
      <div className="clip-properties-panel__row">
        <span className="clip-properties-panel__label">Length</span>
        <input type="range" className="clip-properties-panel__slider" data-testid="multicam-length" min={0.5} max={Math.max(0.5, Math.min(60, clipEffectiveDuration(clip)))} step={0.5} value={len} onChange={(e) => setLen(parseFloat(e.target.value))} />
        <span className="clip-properties-panel__value">{len.toFixed(1)}s</span>
      </div>
      <div className="clip-properties-panel__row">
        <button className="clip-properties-panel__toggle-btn" data-testid="cut-to-camera" disabled={available < 0.1} onClick={() => {
          let note = '';
          onTimelineEdit((tl) => {
            const r = cutToCamera(tl, clip.id, from, to);
            if ('error' in r) { note = r.error; return tl; }
            note = `Switched ${from.toFixed(1)}s–${to.toFixed(1)}s to this camera.${r.gapSeconds > 0.05 ? ` ${r.gapSeconds.toFixed(1)}s of the stretch is not covered by this camera.` : ''}`;
            return r.timeline;
          });
          setMsg(note);
        }}>Cut to this camera ({from.toFixed(1)}s → {to.toFixed(1)}s)</button>
      </div>
      {msg && <div role="status" style={{ fontSize: 11, opacity: 0.8 }}>{msg}</div>}
    </div>
  );
}
