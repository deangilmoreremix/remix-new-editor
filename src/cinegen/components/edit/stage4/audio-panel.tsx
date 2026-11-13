// [remix] Stage 4: audio tab of the media-tools dock: master volume, stereo meters, per-clip 6-band EQ with response curve.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Clip, Timeline } from '@cinegen/types/timeline';
import type { PlaybackEngine } from '@cinegen/lib/editor/playback-engine';
import { defaultClipEq, EQ_PRESETS, eqResponseDb, logFrequencies, normalizeClipEq, type ClipEq, type EqBand, EQ_GAIN_DB_MAX, EQ_GAIN_DB_MIN } from '@cinegen/lib/audio/eq';
import { dbToFraction, holdPeak } from '@cinegen/lib/audio/meter';
import { S } from './ui';

export function StereoMeters({ engine, playing }: { engine: PlaybackEngine; playing: boolean }) {
  const [lv, setLv] = useState({ l: -120, r: -120, hl: -120, hr: -120 });
  const hold = useRef({ l: -120, r: -120, t: 0 });
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const fx = engine.getAudioFx();
      const levels = fx?.levels();
      const dt = hold.current.t ? (now - hold.current.t) / 1000 : 0;
      hold.current = { l: holdPeak(hold.current.l, levels?.left.peakDb ?? -120, dt), r: holdPeak(hold.current.r, levels?.right.peakDb ?? -120, dt), t: now };
      setLv({ l: levels?.left.peakDb ?? -120, r: levels?.right.peakDb ?? -120, hl: hold.current.l, hr: hold.current.r });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, playing]);
  const bar = (db: number, holdDb: number, id: string) => (
    <div data-testid={`meter-${id}`} data-db={db.toFixed(1)} style={{ position: 'relative', flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${dbToFraction(db) * 100}%`, height: '100%', background: db > -3 ? '#ef4444' : db > -12 ? '#f59e0b' : '#7ed321' }} />
      <div style={{ position: 'absolute', left: `${dbToFraction(holdDb) * 100}%`, top: 0, width: 2, height: '100%', background: '#fff' }} />
    </div>
  );
  const txt = (db: number) => (db <= -100 ? '-inf' : db.toFixed(1));
  return (
    <div data-testid="stereo-meters" aria-label="Stereo level meters">
      {([['L', lv.l, lv.hl], ['R', lv.r, lv.hr]] as const).map(([n, db, h]) => (
        <div key={n} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
          <span style={{ width: 10, fontSize: 10 }}>{n}</span>{bar(db, h, n)}<span style={{ width: 34, fontSize: 10, textAlign: 'right' }}>{txt(db)}</span>
        </div>
      ))}
      <div style={S.small}>dBFS peak (white tick = hold). Shows the master output while the timeline plays.</div>
    </div>
  );
}

function EqCurve({ eq }: { eq: ClipEq }) {
  const freqs = useMemo(() => logFrequencies(96), []);
  const db = useMemo(() => eqResponseDb(eq, freqs), [eq, freqs]);
  const W = 380; const H = 70;
  const x = (i: number) => (i / (freqs.length - 1)) * W;
  const y = (d: number) => H / 2 - (Math.max(-24, Math.min(24, d)) / 24) * (H / 2);
  return (
    <svg data-testid="eq-curve" width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.2)" />
      <polyline fill="none" stroke="#7ed321" strokeWidth={1.5} points={Array.from(db, (d, i) => `${x(i).toFixed(1)},${y(d).toFixed(1)}`).join(' ')} />
    </svg>
  );
}

/** The clip whose EQ is edited for a selection: itself when on an audio track (or an audio asset), else its linked audio-track clip, else none. */
export function eqTarget(tl: Timeline, c: Clip): Clip | undefined {
  const kind = (id: string) => tl.tracks.find((t) => t.id === id)?.kind;
  if (kind(c.trackId) === 'audio') return c;
  return (c.linkedClipIds ?? []).map((id) => tl.clips.find((x) => x.id === id)).find((x): x is Clip => !!x && kind(x.trackId) === 'audio');
}

interface Props { timeline: Timeline; selectedClipIds: Set<string>; engine: PlaybackEngine; isPlaying: boolean; commit: (t: Timeline) => void }

export function AudioPanel({ timeline, selectedClipIds, engine, isPlaying, commit }: Props) {
  const picked: Clip | undefined = timeline.clips.find((c) => selectedClipIds.has(c.id));
  // sound lives on audio-track clips: a selected video clip edits its linked audio clip
  const clip: Clip | undefined = picked && eqTarget(timeline, picked);
  const eq = normalizeClipEq(clip?.eq) ?? null;
  const setEq = (next: ClipEq | undefined) => clip && commit({ ...timeline, clips: timeline.clips.map((c) => (c.id === clip.id ? { ...c, eq: next } : c)) });
  const setBand = (i: number, patch: Partial<EqBand>) => { const cur = eq ?? defaultClipEq(); setEq({ ...cur, bands: cur.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) }); };
  const master = timeline.masterVolume ?? 1;
  return (
    <div data-testid="audio-panel">
      <div style={S.h}>Master volume</div>
      <div style={S.row}>
        <input data-testid="master-volume" type="range" min={0} max={100} value={Math.round(master * 100)} onChange={(e) => commit({ ...timeline, masterVolume: Number(e.target.value) / 100 })} style={{ flex: 1 }} aria-label="Master volume" />
        <span style={{ width: 36, fontSize: 11 }}>{Math.round(master * 100)}%</span>
      </div>
      <div style={S.small}>Applies to everything you hear and to the exported file (clip volume, track volume and fades are in the clip and track controls).</div>
      <div style={S.h}>Meters</div>
      <StereoMeters engine={engine} playing={isPlaying} />
      <div style={S.h}>Equalizer {clip ? `for “${clip.name}”` : ''}</div>
      {!picked && <div style={S.small}>Select a clip on the timeline to edit its 6-band EQ.</div>}
      {picked && !clip && <div style={S.small}>“{picked.name}” has no audio on an audio track (its sound is unlinked or absent), so there is nothing to equalize.</div>}
      {clip && (
        <>
          <div style={S.row}>
            <label style={{ fontSize: 11 }}><input data-testid="eq-enabled" type="checkbox" checked={!!eq?.enabled} onChange={(e) => setEq(e.target.checked ? { ...(eq ?? defaultClipEq()), enabled: true } : eq ? { ...eq, enabled: false } : undefined)} /> EQ on</label>
            <select aria-label="EQ preset" data-testid="eq-preset" style={S.input} value="" onChange={(e) => { const p = EQ_PRESETS.find((x) => x.id === e.target.value); if (p) setEq({ enabled: true, bands: p.apply((eq ?? defaultClipEq()).bands) }); }}>
              <option value="">Preset…</option>{EQ_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {eq && <button style={S.btn} onClick={() => setEq(undefined)}>Remove EQ</button>}
          </div>
          {eq && <EqCurve eq={eq} />}
          {eq?.bands.map((b, i) => (
            <div key={i} style={{ ...S.row, marginTop: 3 }}>
              <input type="checkbox" aria-label={`Band ${i + 1} on`} checked={b.enabled} onChange={(e) => setBand(i, { enabled: e.target.checked })} />
              <span style={{ width: 62, fontSize: 10 }}>{b.type}</span>
              <input data-testid={`eq-freq-${i}`} type="number" min={20} max={20000} value={Math.round(b.frequency)} style={{ ...S.input, width: 56 }} onChange={(e) => setBand(i, { frequency: Number(e.target.value) })} aria-label={`Band ${i + 1} frequency Hz`} />
              <input data-testid={`eq-gain-${i}`} type="range" min={EQ_GAIN_DB_MIN} max={EQ_GAIN_DB_MAX} step={0.5} value={b.gain} disabled={b.type === 'highpass' || b.type === 'lowpass' || b.type === 'notch'} onChange={(e) => setBand(i, { gain: Number(e.target.value) })} style={{ flex: 1, minWidth: 60 }} aria-label={`Band ${i + 1} gain dB`} />
              <span style={{ width: 40, fontSize: 10 }}>{b.gain > 0 ? '+' : ''}{b.gain.toFixed(1)} dB</span>
              <input type="number" step={0.1} min={0.3} max={10.3} value={Number(b.q.toFixed(2))} style={{ ...S.input, width: 44 }} onChange={(e) => setBand(i, { q: Number(e.target.value) })} aria-label={`Band ${i + 1} Q`} />
            </div>
          ))}
          <div style={S.small}>Heard live while you play. In the export the EQ is baked into this audio clip&apos;s sound with an offline render (sources up to 20 minutes).</div>
        </>
      )}
    </div>
  );
}
