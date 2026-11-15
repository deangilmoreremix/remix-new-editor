// [remix] Stage 1 editing controller for the CineGen edit tab. Keeps all Stage 1 wiring in one place (the pure logic is in
// lib/editor/stage1/*): source-monitor marks + insert / overwrite, J K L shuttle, group / ungroup, compound clips, speed ramps.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { Timeline, Clip } from '@cinegen/types/timeline';
import {
  setMarkIn, setMarkOut, clearMarks, resolveRange, insertEdit, overwriteEdit, groupClips, ungroupClips, createCompound, expandCompound,
  applySpeedRamp, RAMP_PRESETS, nextShuttleRate, needsSeekDriver, shuttleTick, type SourceMarks, type ShuttleKey,
} from '@cinegen/lib/editor/stage1';
import type { SourceMarksUi } from './source-marks';
import { marksFromAsset, marksMetadataPatch } from '@cinegen/lib/editor/range/source-marks-persist'; // [remix] Fix B2
import { setRangeIn, setRangeOut, resolveTimelineRange, withRange, loopTarget } from '@cinegen/lib/editor/range/timeline-range'; // [remix] Fix B2
import { formatTimecode } from './time-ruler';

// [remix] Fix B2: also dispatches UPDATE_ASSET (source marks are saved in the asset's metadata)
type SetTimeline = (a: { type: 'SET_TIMELINE'; timelineId: string; timeline: Timeline } | { type: 'UPDATE_ASSET'; asset: Partial<Asset> & { id: string } }) => void;

export interface Stage1Params {
  timeline: Timeline;
  dispatch: SetTimeline;
  selectedClipIds: Set<string>;
  setSelectedClipIds: (ids: Set<string>) => void;
  currentTime: number;
  seek: (t: number) => void;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  setSpeed: (rate: number) => void;
  /** the media-pool asset loaded in the source monitor (null when a timeline clip is loaded, or nothing) */
  sourceAsset: Asset | null;
  sourceVisible: boolean;
}

const RANGE_HINT = 'Timeline in / out: I and O when the timeline is focused, Alt+X clears. Sets the loop and export range.';
const FRAME = 1 / 24;
const typing = (t: EventTarget | null) => { const n = (t as HTMLElement | null)?.tagName?.toLowerCase(); return n === 'input' || n === 'textarea' || n === 'select' || (t as HTMLElement | null)?.isContentEditable; };

/** Track an edit goes to: the selected clip's track when it fits the asset, else the first unlocked track of the right kind. */
export function pickTargetTrack(tl: Timeline, asset: Pick<Asset, 'type'>, selected: Set<string>): string | null {
  const kind = asset.type === 'audio' ? 'audio' : 'video';
  const ok = (id: string) => { const t = tl.tracks.find((x) => x.id === id); return !!t && t.kind === kind && !t.locked; };
  const sel = tl.clips.find((c) => selected.has(c.id) && ok(c.trackId));
  return sel?.trackId ?? tl.tracks.find((t) => t.kind === kind && !t.locked)?.id ?? null;
}

export function useStage1Editing(p: Stage1Params) {
  const { timeline, dispatch, selectedClipIds, setSelectedClipIds, currentTime, seek, isPlaying, play, pause, setSpeed, sourceAsset, sourceVisible } = p;
  const [marksById, setMarksById] = useState<Record<string, SourceMarks>>({});
  const [rate, setRate] = useState(0);
  const [notice, setNotice] = useState('');
  const live = useRef({ timeline, selectedClipIds, currentTime, sourceAsset, marksById, rate, isPlaying });
  live.current = { timeline, selectedClipIds, currentTime, sourceAsset, marksById, rate, isPlaying };
  const sourceTimeRef = useRef(0);
  const rafRef = useRef(0);
  const kDown = useRef(false);

  const commit = useCallback((next: Timeline) => dispatch({ type: 'SET_TIMELINE', timelineId: live.current.timeline.id, timeline: next }), [dispatch]);
  const say = useCallback((m: string) => { setNotice(m); window.setTimeout(() => setNotice((cur) => (cur === m ? '' : cur)), 3000); }, []);

  // ---- source monitor marks + insert / overwrite
  // [remix] Fix B2: marks persist per asset (asset.metadata.sourceMarks); the session copy answers instantly, the asset copy survives reload
  const marksRef = useRef<Record<string, SourceMarks>>({});
  const marksFor = (a: Asset | null): SourceMarks | null => (a ? marksRef.current[a.id] ?? marksFromAsset(a) : null);
  const setMarks = useCallback((a: Asset, fn: (m: SourceMarks) => SourceMarks) => {
    const next = fn(marksRef.current[a.id] ?? marksFromAsset(a));
    marksRef.current = { ...marksRef.current, [a.id]: next };
    setMarksById(marksRef.current);
    dispatch({ type: 'UPDATE_ASSET', asset: { id: a.id, metadata: marksMetadataPatch(next) } });
  }, [dispatch]);
  const markIn = useCallback((t?: number) => { const a = live.current.sourceAsset; if (a) setMarks(a, (m) => setMarkIn(m, t ?? sourceTimeRef.current, a.duration ?? 0)); }, [setMarks]);
  const markOut = useCallback((t?: number) => { const a = live.current.sourceAsset; if (a) setMarks(a, (m) => setMarkOut(m, t ?? sourceTimeRef.current, a.duration ?? 0)); }, [setMarks]);
  const clearMarksNow = useCallback(() => { const a = live.current.sourceAsset; if (a) setMarks(a, clearMarks); }, [setMarks]);

  const doEdit = useCallback((kind: 'insert' | 'overwrite') => {
    const { timeline: tl, sourceAsset: a, selectedClipIds: sel, currentTime: at } = live.current;
    if (!a) return;
    const trackId = pickTargetTrack(tl, a, sel);
    if (!trackId) { say('No unlocked track to edit into.'); return; }
    const range = a.type === 'image' ? null : resolveRange(marksFor(a), a.duration ?? 0);
    const res = (kind === 'insert' ? insertEdit : overwriteEdit)(tl, { asset: a, range, trackId, at });
    if (res.error) { say(res.error); return; }
    commit(res.timeline);
    setSelectedClipIds(new Set(res.clipIds));
    const placed = res.timeline.clips.find((c) => c.id === res.clipIds[0]);
    if (placed) seek(placed.startTime + (placed.duration - placed.trimStart - placed.trimEnd) / (placed.speed || 1));
    say(kind === 'insert' ? 'Inserted' : 'Overwritten');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, seek, setSelectedClipIds, say]);

  // ---- [remix] Fix B2: timeline in / out (I / O act here when the timeline was the last thing clicked, or no source asset is open)
  const [loop, setLoop] = useState(false);
  const area = useRef<'source' | 'timeline'>('source');
  useEffect(() => {
    const down = (e: PointerEvent) => { area.current = (e.target as HTMLElement | null)?.closest?.('.timeline-editor, .time-ruler, .timeline-bottom-bar') ? 'timeline' : 'source'; };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, []);
  const sourceTarget = () => !!live.current.sourceAsset && sourceVisible && area.current !== 'timeline';
  const setRange = useCallback((fn: (r: Timeline['range'], dur: number) => NonNullable<Timeline['range']> | null) => {
    const tl = live.current.timeline; commit(withRange(tl, fn(tl.range, tl.duration)));
  }, [commit]);
  const rangeIn = useCallback((t?: number) => setRange((r, d) => setRangeIn(r, t ?? live.current.currentTime, d)), [setRange]);
  const rangeOut = useCallback((t?: number) => setRange((r, d) => setRangeOut(r, t ?? live.current.currentTime, d)), [setRange]);
  const rangeClear = useCallback(() => { if (live.current.timeline.range) { setRange(() => null); say('Range cleared'); } }, [setRange, say]);
  const activeRange = resolveTimelineRange(timeline.range, timeline.duration);
  useEffect(() => { // loop playback inside the range
    if (!loop || !isPlaying) return;
    const to = loopTarget(resolveTimelineRange(live.current.timeline.range, live.current.timeline.duration), currentTime);
    if (to !== null) seek(to);
  }, [loop, isPlaying, currentTime, seek]);

  // ---- group / compound / ramp on the selection
  const selClips = (): Clip[] => live.current.timeline.clips.filter((c) => live.current.selectedClipIds.has(c.id));
  const group = useCallback(() => {
    const r = groupClips(live.current.timeline, live.current.selectedClipIds);
    if (!r.groupId) { say('Select two or more clips to group.'); return; }
    commit(r.timeline); setSelectedClipIds(new Set(r.timeline.clips.filter((c) => c.groupId === r.groupId).map((c) => c.id))); say('Grouped');
  }, [commit, setSelectedClipIds, say]);
  const ungroup = useCallback(() => {
    const next = ungroupClips(live.current.timeline, live.current.selectedClipIds);
    if (next === live.current.timeline) { say('The selection is not grouped.'); return; }
    commit(next); say('Ungrouped');
  }, [commit, say]);
  const nest = useCallback(() => {
    const ids = selClips().map((c) => c.id);
    if (!ids.length) { say('Select clips to nest.'); return; }
    const r = createCompound(live.current.timeline, ids);
    if (!r.compoundId) return;
    commit(r.timeline); setSelectedClipIds(new Set([r.compoundId]));
    say(r.droppedTransitions ? `Nested (${r.droppedTransitions} transition${r.droppedTransitions === 1 ? '' : 's'} to outside clips removed)` : 'Nested into a compound clip');
  }, [commit, setSelectedClipIds, say]);
  const expand = useCallback(() => {
    const c = selClips().find((x) => x.compound);
    if (!c) { say('Select a compound clip to expand.'); return; }
    const r = expandCompound(live.current.timeline, c.id);
    commit(r.timeline); setSelectedClipIds(new Set(r.clipIds)); say('Expanded');
  }, [commit, setSelectedClipIds, say]);
  const ramp = useCallback((presetId: string) => {
    const preset = RAMP_PRESETS[presetId];
    const c = selClips().find((x) => !x.compound && live.current.timeline.tracks.find((t) => t.id === x.trackId)?.kind === 'video') ?? selClips().find((x) => !x.compound);
    if (!preset || !c) { say('Select a clip to ramp.'); return; }
    const r = applySpeedRamp(live.current.timeline, c.id, preset.points);
    commit(r.timeline); setSelectedClipIds(new Set(r.clipIds)); say(`Speed ramp: ${preset.label}`);
  }, [commit, setSelectedClipIds, say]);

  // ---- J K L shuttle
  const stopDriver = useCallback(() => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; } }, []);
  const applyRate = useCallback((r: number) => {
    stopDriver();
    live.current.rate = r; setRate(r);
    if (r === 0) { pause(); setSpeed(1); return; }
    if (!needsSeekDriver(r)) { setSpeed(Math.abs(r)); play(); return; }
    setSpeed(1); pause();
    let last = performance.now(); let t = live.current.currentTime;
    const max = Math.max(0, live.current.timeline.duration);
    const tick = (now: number) => {
      t = shuttleTick(t, r, (now - last) / 1000, max); last = now; seek(t);
      if ((r < 0 && t <= 0) || (r > 0 && t >= max)) { live.current.rate = 0; setRate(0); rafRef.current = 0; return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [pause, play, seek, setSpeed, stopDriver]);
  // the engine stopped by itself (end of timeline, Space): forget the shuttle; the user pressed Space during a seek-driven shuttle: hand over
  useEffect(() => {
    if (live.current.rate === 0) return;
    if (!isPlaying && !needsSeekDriver(live.current.rate)) { live.current.rate = 0; setRate(0); setSpeed(1); }
    if (isPlaying && needsSeekDriver(live.current.rate)) { stopDriver(); live.current.rate = 0; setRate(0); setSpeed(1); }
  }, [isPlaying, setSpeed, stopDriver]);
  useEffect(() => () => { stopDriver(); }, [stopDriver]);

  useEffect(() => {
    const own = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); };
    const onDown = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      // grouping (the editor's own G / Ctrl+G handler would switch tools, so these run first)
      if (mod && e.code === 'KeyG') { own(e); if (e.altKey) { if (e.shiftKey) expand(); else nest(); } else if (e.shiftKey) ungroup(); else group(); return; }
      if (mod || (e.altKey && k !== 'x')) return;
      if (e.altKey && k === 'x') { if (sourceTarget()) { own(e); clearMarksNow(); } else if (live.current.timeline.range) { own(e); rangeClear(); } return; }
      if (k === 'j' || k === 'k' || k === 'l') {
        own(e);
        if (e.repeat) return;
        if (k === 'k') { kDown.current = true; applyRate(0); return; }
        if (kDown.current) { applyRate(0); seek(Math.max(0, live.current.currentTime + (k === 'l' ? FRAME : -FRAME))); return; } // K held: frame step
        applyRate(nextShuttleRate(live.current.rate, k.toUpperCase() as ShuttleKey));
        return;
      }
      if (!sourceTarget() && (k === 'i' || k === 'o')) { own(e); if (k === 'i') rangeIn(); else rangeOut(); return; } // [remix] Fix B2
      if (live.current.sourceAsset && sourceVisible) {
        if (k === 'i') { own(e); markIn(); } else if (k === 'o') { own(e); markOut(); }
        else if (e.key === ',') { own(e); doEdit('insert'); } else if (e.key === '.') { own(e); doEdit('overwrite'); }
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'k') kDown.current = false; };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => { window.removeEventListener('keydown', onDown, true); window.removeEventListener('keyup', onUp, true); };
  }, [applyRate, clearMarksNow, doEdit, expand, group, markIn, markOut, nest, rangeClear, rangeIn, rangeOut, seek, sourceVisible, ungroup]);

  const marksUi: SourceMarksUi | null = useMemo(() => {
    if (!sourceAsset) return null;
    return {
      marks: marksById[sourceAsset.id] ?? marksFromAsset(sourceAsset),
      onSetIn: (t) => markIn(t), onSetOut: (t) => markOut(t), onClear: clearMarksNow,
      onInsert: () => doEdit('insert'), onOverwrite: () => doEdit('overwrite'),
    };
  }, [sourceAsset, marksById, markIn, markOut, clearMarksNow, doEdit]);
  const onSourceTime = useCallback((t: number) => { sourceTimeRef.current = t; }, []);

  const hasSel = selectedClipIds.size > 0;
  const selHasGroup = timeline.clips.some((c) => selectedClipIds.has(c.id) && c.groupId);
  const selHasCompound = timeline.clips.some((c) => selectedClipIds.has(c.id) && c.compound);
  const bar = (
    <div data-testid="stage1-bar" role="toolbar" aria-label="Clip tools" style={{ position: 'fixed', left: 560, bottom: 6, zIndex: 40, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(20,20,24,0.92)', color: '#eee', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, padding: '4px 8px', fontSize: 11 }}>
      <button type="button" data-testid="group-btn" disabled={selectedClipIds.size < 2} onClick={group} title="Group selected clips (Ctrl+G)">Group</button>
      <button type="button" data-testid="ungroup-btn" disabled={!selHasGroup} onClick={ungroup} title="Ungroup (Ctrl+Shift+G)">Ungroup</button>
      <button type="button" data-testid="nest-btn" disabled={!hasSel} onClick={nest} title="Nest selected clips into a compound clip (Ctrl+Alt+G)">Nest</button>
      <button type="button" data-testid="expand-btn" disabled={!selHasCompound} onClick={expand} title="Expand a compound clip (Ctrl+Alt+Shift+G)">Expand</button>
      <select data-testid="ramp-select" aria-label="Speed ramp" disabled={!hasSel} value="" onChange={(e) => { if (e.target.value) ramp(e.target.value); }}>
        <option value="">Speed ramp…</option>
        {Object.entries(RAMP_PRESETS).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
      </select>
      <span data-testid="shuttle-readout" title="J K L shuttle" style={{ minWidth: 34, textAlign: 'center', opacity: rate ? 1 : 0.6 }}>{rate === 0 ? 'JKL' : `${rate < 0 ? '◀' : '▶'} ${Math.abs(rate)}x`}</span>
      <span data-testid="range-controls" style={{ display: 'flex', gap: 4, alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.18)', paddingLeft: 6 }} title={RANGE_HINT}>
        <button type="button" data-testid="range-in" onClick={() => rangeIn()}>In</button>
        <button type="button" data-testid="range-out" onClick={() => rangeOut()}>Out</button>
        <button type="button" data-testid="range-clear" disabled={!timeline.range} onClick={rangeClear}>Clear</button>
        <label style={{ display: 'flex', gap: 2, alignItems: 'center' }}><input type="checkbox" data-testid="range-loop" checked={loop} onChange={(e) => setLoop(e.target.checked)} />Loop</label>
        <span data-testid="range-readout" style={{ opacity: activeRange ? 1 : 0.6 }}>{activeRange ? `${formatTimecode(activeRange.start)} - ${formatTimecode(activeRange.end)}` : 'no range'}</span>
        {activeRange && timeline.duration > 0 && <span data-testid="range-strip" aria-hidden style={{ position: 'relative', width: 90, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3 }}><span style={{ position: 'absolute', top: 0, bottom: 0, left: `${(activeRange.start / timeline.duration) * 100}%`, width: `${((activeRange.end - activeRange.start) / timeline.duration) * 100}%`, background: '#0fd7f1', borderRadius: 3 }} /></span>}
      </span>
      {notice && <span data-testid="stage1-notice" role="status">{notice}</span>}
    </div>
  );

  return { bar, sourceProps: { marksUi, onSourceTime } };
}
