// [remix] Multicam camera switching: "Cut to this camera" over a stretch from the playhead. The edit plan is OpenChatCut's planCamSwitch.
import { useState } from 'react';
import { clipEffectiveDuration, clipEndTime, type Clip, type Timeline } from '@cinegen/types/timeline';
import { cutToCamera } from '@cinegen/lib/occ/cam-switch';
import { createGroup, deleteGroup, groupOfClip, normalizeDecisions, nudgeAngle, removeDecision, setAngle, type McClip, type MulticamTimeline } from '@cinegen/lib/occ/multicam-groups';

export function ClipMulticamSection({ clip, timeline, currentTime, onTimelineEdit }: { clip: Clip; timeline: Timeline; currentTime: number; onTimelineEdit: (edit: (tl: Timeline) => Timeline) => void }) {
  const [len, setLen] = useState(5);
  const [msg, setMsg] = useState('');
  const isVideoTrack = timeline.tracks.find((t) => t.id === clip.trackId)?.kind === 'video';
  const from = Math.max(currentTime, clip.startTime);
  const available = clipEndTime(clip) - from;
  const others = timeline.clips.filter((c) => c.trackId !== clip.trackId && timeline.tracks.find((t) => t.id === c.trackId)?.kind === 'video' && c.startTime < from + len && clipEndTime(c) > from);
  const mt = timeline as MulticamTimeline;
  const group = groupOfClip(mt, clip);
  const edit = (fn: (tl: MulticamTimeline) => MulticamTimeline | { error: string }, ok: string) => {
    let note = '';
    onTimelineEdit((tl) => { const r = fn(tl as MulticamTimeline); if ('error' in r) { note = r.error; return tl; } note = ok; return r; });
    setMsg(note);
  };
  const btn = { className: 'clip-properties-panel__toggle-btn' } as const;
  if (isVideoTrack && group) {
    const myAngle = (clip as McClip).multicam!.angleId;
    const decisions = normalizeDecisions(group);
    const len2 = Math.min(len, Math.max(0.5, group.end - Math.max(currentTime, group.start)));
    const from2 = Math.max(currentTime, group.start);
    return (
      <div className="clip-properties-panel__section" data-testid="multicam-group">
        <div className="clip-properties-panel__section-title">Multicam group · {group.name}</div>
        <div className="clip-properties-panel__row">
          <span className="clip-properties-panel__label">Length</span>
          <input type="range" className="clip-properties-panel__slider" min={0.5} max={Math.max(0.5, Math.min(60, group.end - group.start))} step={0.5} value={len} onChange={(e) => setLen(parseFloat(e.target.value))} />
          <span className="clip-properties-panel__value">{len.toFixed(1)}s</span>
        </div>
        {group.angles.map((a) => (
          <div className="clip-properties-panel__row" key={a.id}>
            <button {...btn} data-testid={`mc-cut-${a.id}`} style={a.id === myAngle ? { borderColor: '#d9ff00' } : undefined} onClick={() => edit((tl) => setAngle(tl, group.id, a.id, from2, from2 + len2), `${a.name} from ${from2.toFixed(1)}s to ${(from2 + len2).toFixed(1)}s.`)} title="Switch to this camera from the playhead">{a.name}</button>
            <button {...btn} aria-label={`${a.name} 1 frame earlier`} title="Sync: move this camera 1 frame earlier" onClick={() => edit((tl) => nudgeAngle(tl, group.id, a.id, -1 / 30), 'Camera nudged earlier.')}>◂</button>
            <button {...btn} aria-label={`${a.name} 1 frame later`} title="Sync: move this camera 1 frame later" onClick={() => edit((tl) => nudgeAngle(tl, group.id, a.id, 1 / 30), 'Camera nudged later.')}>▸</button>
          </div>
        ))}
        <div style={{ fontSize: 11, opacity: 0.75, margin: '4px 0' }}>Switches</div>
        {decisions.map((d) => (
          <div className="clip-properties-panel__row" key={d.id} style={{ fontSize: 11 }}>
            <span style={{ flex: 1 }}>{group.angles.find((a) => a.id === d.angleId)?.name} · {d.from.toFixed(1)}–{d.to.toFixed(1)}s</span>
            {d.angleId !== group.angles[0].id && <button {...btn} aria-label="Remove this switch" onClick={() => edit((tl) => removeDecision(tl, group.id, d.id), 'Switch removed.')}>✕</button>}
          </div>
        ))}
        <div className="clip-properties-panel__row">
          <button {...btn} onClick={() => edit((tl) => deleteGroup(tl, group.id, true), 'Group removed; the original cameras are back.')}>Remove group (restore cameras)</button>
          <button {...btn} onClick={() => edit((tl) => deleteGroup(tl, group.id, false), 'Group removed; the current cut stays.')}>Ungroup (keep cut)</button>
        </div>
        <div style={{ fontSize: 10.5, opacity: 0.6 }}>Group clips are re-built from the group's cameras when you switch; trim the cameras by changing switches rather than editing the pieces.</div>
        {msg && <div role="status" style={{ fontSize: 11, opacity: 0.85 }}>{msg}</div>}
      </div>
    );
  }
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
      <div className="clip-properties-panel__row">
        <button {...btn} data-testid="create-multicam-group" title="Keep these cameras together so switches can be revised later" onClick={() => edit((tl) => createGroup(tl, [clip.id, ...others.filter((o) => !((o as McClip).multicam)).map((o) => o.id)].slice(0, 6), undefined), 'Multicam group created. Use the camera buttons to switch.')}>Group these {others.length + 1} cameras</button>
      </div>
      {msg && <div role="status" style={{ fontSize: 11, opacity: 0.8 }}>{msg}</div>}
    </div>
  );
}
