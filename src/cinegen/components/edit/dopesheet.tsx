// [remix] Stage 2: dopesheet - one row per keyed property, key diamonds on the clip's time axis. Click a diamond to select it (and move the playhead there),
// drag it to retime, Delete / the button removes it; click an empty part of a row to move the playhead.
import { useRef } from 'react';
import { ANIM_PROPS, parseFxPropId, type ClipAnim } from '@cinegen/lib/editor/stage2/anim';

export interface KeySel { prop: string; index: number }
const labelOf = (id: string) => ANIM_PROPS.find((p) => p.id === id)?.label ?? (parseFxPropId(id) ? `Effect ${parseFxPropId(id)!.index + 1} · ${parseFxPropId(id)!.key}` : id);

export function Dopesheet({ anim, duration, time, selected, onSelect, onMove, onSeek }: {
  anim: ClipAnim | undefined; duration: number; time: number; selected: KeySel | null;
  onSelect: (s: KeySel) => void; onMove: (prop: string, index: number, t: number) => number | void; onSeek: (t: number) => void;
}) {
  const rows = Object.entries(anim?.keys ?? {}).filter(([, l]) => l?.length);
  const dur = Math.max(0.01, duration);
  const track = useRef<HTMLDivElement | null>(null);
  const timeAt = (clientX: number, el: HTMLElement) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(dur, ((clientX - r.left) / Math.max(1, r.width)) * dur)); };
  if (!rows.length) return <div data-testid="dopesheet" style={{ fontSize: 11, opacity: 0.7, padding: '4px 0' }}>No keyframes yet. Turn on auto-key or press ◇ on a property.</div>;
  return (
    <div data-testid="dopesheet" role="grid" aria-label="Dopesheet" style={{ margin: '4px 0' }}>
      {rows.map(([prop, list]) => (
        <div key={prop} role="row" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 22 }}>
          <span style={{ width: 84, fontSize: 10, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(prop)}</span>
          <div ref={track} data-testid={`dopesheet-row-${prop}`} style={{ position: 'relative', flex: 1, height: 16, background: 'rgba(255,255,255,.06)', borderRadius: 3, cursor: 'pointer' }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) onSeek(timeAt(e.clientX, e.currentTarget)); }}>
            <div style={{ position: 'absolute', left: `${(Math.min(dur, time) / dur) * 100}%`, top: 0, bottom: 0, width: 1, background: '#ef4444', pointerEvents: 'none' }} />
            {list.map((k, i) => {
              const on = selected?.prop === prop && selected.index === i;
              return (
                <button key={i} type="button" data-testid={`dopesheet-key-${prop}-${i}`} aria-label={`${labelOf(prop)} key ${i + 1} at ${k.t.toFixed(2)}s`} aria-pressed={on}
                  style={{ position: 'absolute', left: `${(k.t / dur) * 100}%`, top: 2, width: 11, height: 11, marginLeft: -5, padding: 0, border: 0, transform: 'rotate(45deg)', background: on ? '#22d3ee' : k.ease === 'hold' ? '#a3a3a3' : '#f59e0b', cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation(); onSelect({ prop, index: i }); onSeek(k.t);
                    const row = e.currentTarget.parentElement as HTMLElement; let moved = false; let idx = i;
                    const move = (ev: PointerEvent) => { moved = true; const ni = onMove(prop, idx, timeAt(ev.clientX, row)); if (typeof ni === 'number') idx = ni; };
                    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); void moved; };
                    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
                  }} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
