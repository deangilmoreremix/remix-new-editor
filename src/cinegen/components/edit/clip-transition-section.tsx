// [remix] Cut transition for the selected clip → next clip on its track, using OpenChatCut's GL transitions.
import { useState } from 'react';
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { GL_TRANSITION_ORDER, glTransitionLabel, nextClipOnTrack, transitionBetween, transitionHandle, addGlTransition, setGlType, removeTransition } from '@cinegen/lib/occ/transitions';

const selectStyle = { flex: 1, minWidth: 0, background: 'var(--cg-surface-2, #0d1218)', color: 'inherit', border: '1px solid rgba(255,255,255,.14)', borderRadius: 4, padding: '3px 6px', fontSize: 12 } as const;

export function ClipTransitionSection({ clip, timeline, onTimelineEdit }: { clip: Clip; timeline: Timeline; onTimelineEdit: (edit: (tl: Timeline) => Timeline) => void }) {
  const [type, setType] = useState<string>('cross-dissolve');
  const [dur, setDur] = useState(0.5);
  const next = nextClipOnTrack(timeline, clip);
  if (!next) return null;
  const existing = transitionBetween(timeline, clip, next);
  const handle = transitionHandle(clip, next);
  return (
    <div className="clip-properties-panel__section" data-testid="clip-transition">
      <div className="clip-properties-panel__section-title">Transition to next clip</div>
      {existing ? (
        <>
          <div className="clip-properties-panel__row">
            <select aria-label="Transition type" style={selectStyle} value={existing.glType ?? ''} onChange={(e) => onTimelineEdit((tl) => setGlType(tl, existing.id, e.target.value || undefined))}>
              <option value="">Dissolve (plain)</option>
              {GL_TRANSITION_ORDER.map((id) => <option key={id} value={id}>{glTransitionLabel(id)}</option>)}
            </select>
          </div>
          <div className="clip-properties-panel__row">
            <button className="clip-properties-panel__toggle-btn" onClick={() => onTimelineEdit((tl) => removeTransition(tl, existing.id))}>Remove transition ({existing.duration.toFixed(2)}s)</button>
          </div>
        </>
      ) : handle <= 0.05 ? (
        <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.35 }}>A transition needs spare footage at the cut: trim the end of this clip and the start of the next one first.</div>
      ) : (
        <>
          <div className="clip-properties-panel__row">
            <select aria-label="New transition type" style={selectStyle} value={type} onChange={(e) => setType(e.target.value)}>
              {GL_TRANSITION_ORDER.map((id) => <option key={id} value={id}>{glTransitionLabel(id)}</option>)}
            </select>
          </div>
          <div className="clip-properties-panel__row">
            <span className="clip-properties-panel__label">Length</span>
            <input type="range" className="clip-properties-panel__slider" min={0.2} max={Math.max(0.2, Math.min(2, handle))} step={0.05} value={Math.min(dur, handle)} onChange={(e) => setDur(parseFloat(e.target.value))} />
            <span className="clip-properties-panel__value">{Math.min(dur, handle).toFixed(2)}s</span>
          </div>
          <div className="clip-properties-panel__row">
            <button className="clip-properties-panel__toggle-btn" onClick={() => onTimelineEdit((tl) => addGlTransition(tl, clip, next, type, Math.min(dur, handle)))}>Add transition</button>
          </div>
        </>
      )}
    </div>
  );
}
