// [remix] Cut transition for the selected clip → next clip on its track, using OpenChatCut's GL transitions.
import { useState } from 'react';
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { usePluginPacks, pluginResourceItems } from '../../../openchatcut/library/pluginResources';
import { GL_TRANSITION_ORDER, glTransitionLabel, nextClipOnTrack, transitionBetween, transitionHandle, addGlTransition, setGlType, setGlParams, removeTransition, transitionSnapshotFor } from '@cinegen/lib/occ/transitions';
import { TransitionPicker, TransitionParams } from './transition-picker';
import type { GltParams } from '../../../openchatcut/gl/glt';
import { getCustomTransition } from '../../../openchatcut/gl/customTransitions';

export function ClipTransitionSection({ clip, timeline, onTimelineEdit }: { clip: Clip; timeline: Timeline; onTimelineEdit: (edit: (tl: Timeline) => Timeline) => void }) {
  const [type, setType] = useState<string>('cross-dissolve');
  const [dur, setDur] = useState(0.5);
  const [params, setParams] = useState<GltParams | undefined>(undefined);
  const plugin = pluginResourceItems(usePluginPacks(), 'transition');
  const label = (id: string) => (id.startsWith('plugin:') ? getCustomTransition(id)?.label ?? id : glTransitionLabel(id));
  const classic = GL_TRANSITION_ORDER.map((id) => ({ id: id as string, label: label(id) }));
  const pluginItems = plugin.map((p) => ({ id: p.id, label: label(p.id) }));
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
            <button className="clip-properties-panel__toggle-btn" aria-pressed={!existing.glType} onClick={() => onTimelineEdit((tl) => setGlType(tl, existing.id, undefined))}>Plain dissolve</button>
          </div>
          <TransitionPicker value={existing.glType} classic={classic} plugin={pluginItems} onPick={async (v) => { const snap = v.startsWith('plugin:') ? await transitionSnapshotFor(v) : undefined; onTimelineEdit((tl) => setGlType(tl, existing.id, v, snap)); }} />
          {existing.glType && <TransitionParams id={existing.glType} params={existing.glParams} onChange={(np) => onTimelineEdit((tl) => setGlParams(tl, existing.id, np))} />}
          <div className="clip-properties-panel__row">
            <button className="clip-properties-panel__toggle-btn" onClick={() => onTimelineEdit((tl) => removeTransition(tl, existing.id))}>Remove transition ({existing.duration.toFixed(2)}s)</button>
          </div>
        </>
      ) : handle <= 0.05 ? (
        <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.35 }}>A transition needs spare footage at the cut: trim the end of this clip and the start of the next one first.</div>
      ) : (
        <>
          <TransitionPicker value={type} classic={classic} plugin={pluginItems} onPick={(id) => { setType(id); setParams(undefined); }} />
          <TransitionParams id={type} params={params} onChange={setParams} />
          <div className="clip-properties-panel__row">
            <span className="clip-properties-panel__label">Length</span>
            <input type="range" className="clip-properties-panel__slider" min={0.2} max={Math.max(0.2, Math.min(2, handle))} step={0.05} value={Math.min(dur, handle)} onChange={(e) => setDur(parseFloat(e.target.value))} />
            <span className="clip-properties-panel__value">{Math.min(dur, handle).toFixed(2)}s</span>
          </div>
          <div className="clip-properties-panel__row">
            <button className="clip-properties-panel__toggle-btn" onClick={async () => { const snap = type.startsWith('plugin:') ? await transitionSnapshotFor(type) : undefined; onTimelineEdit((tl) => addGlTransition(tl, clip, next, type, Math.min(dur, handle), snap, params)); }}>Add transition</button>
          </div>
        </>
      )}
    </div>
  );
}
