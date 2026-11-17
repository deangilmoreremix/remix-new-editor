// [remix] Host-only timeline behaviour (desktop-file drop, Library drag and drop, Alt-drag rate stretch, Smart Speech, Template Generator,
// Personalization hub) kept out of timeline-editor.tsx so that file stays close to the vendored CineGen copy (see timeline-parity.test.ts).
import { useCallback, type MutableRefObject, type RefObject } from 'react';
import type { Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { generateId } from '@cinegen/lib/utils/ids';
import { addClipToTrack, addTrack } from '@cinegen/lib/editor/timeline-operations';
import { decodeLibraryDrag, hasLibraryDrag, LIBRARY_DND, type LibraryDrag, type LibraryDropCtx } from '@cinegen/lib/occ/library-dnd';
import { applyComposition, type Composition } from '@cinegen/lib/occ/template-composition';
import { openSmartSpeech } from '@cinegen/lib/occ/smart-speech';

type Dispatch = (action: any) => void; // the workspace reducer's dispatch (actions are checked at the call sites' reducer)

/** Alt-drag edge = OpenChatCut rate stretch: speed + start change, source span stays; keyframes/fades rescale with the new length. */
export function rateStretchTimeline(tl: Timeline, clipId: string, speed: number, startTime: number): Timeline | null {
  const clip = tl.clips.find((c) => c.id === clipId);
  if (!clip) return null;
  const oldEff = clipEffectiveDuration(clip);
  const sp = Math.max(0.1, Math.min(8, speed));
  const newEff = (clip.duration - clip.trimStart - clip.trimEnd) / sp;
  const ratio = oldEff > 0 ? newEff / oldEff : 1;
  const linked = new Set([clipId, ...(clip.linkedClipIds ?? [])]);
  const delta = startTime - clip.startTime;
  return {
    ...tl,
    clips: tl.clips.map((c) => {
      if (!linked.has(c.id)) return c;
      const r = c.id === clipId ? ratio : (clipEffectiveDuration(c) > 0 ? (((c.duration - c.trimStart - c.trimEnd) / sp) / clipEffectiveDuration(c)) : 1);
      return {
        ...c,
        speed: sp,
        startTime: Math.max(0, c.startTime + delta),
        keyframes: (c.keyframes ?? []).map((k) => ({ ...k, time: k.time * r })),
        fadeIn: c.fadeIn !== undefined ? c.fadeIn * r : undefined,
        fadeOut: c.fadeOut !== undefined ? c.fadeOut * r : undefined,
      };
    }),
  };
}

interface HostActionDeps {
  dispatch: Dispatch;
  setTimeline: (timeline: Timeline) => void;
  timelineRef: MutableRefObject<Timeline>;
  assetsRef: MutableRefObject<Asset[]>;
  pxPerSecondRef: MutableRefObject<number>;
  currentTimeRef: MutableRefObject<number>;
  currentTime: number;
  assets: Asset[];
  handleDropAsset: (trackId: string, assetId: string, startTime: number) => void;
}

/** The editor's host-only handlers; returns what timeline-editor.tsx wires into its JSX. */
export function useHostTimelineActions(d: HostActionDeps) {
  const { dispatch, setTimeline, timelineRef, assetsRef, pxPerSecondRef, currentTimeRef, currentTime, assets, handleDropAsset } = d;

  // Files dragged in from the desktop: import through the media pool, then place at the drop position.
  const handleDesktopFilesDrop = useCallback((e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => /^(video|audio|image)\//.test(f.type));
    e.preventDefault(); e.stopPropagation();
    if (files.length === 0) return;
    const target = e.target as Element;
    const trackEl = target.closest?.('.track-row[data-track-id]') as HTMLElement | null;
    const clipsEl = trackEl?.querySelector('.track-row__clips') as HTMLElement | null;
    let time = clipsEl ? Math.max(0, (e.clientX - clipsEl.getBoundingClientRect().left) / pxPerSecondRef.current) : currentTimeRef.current;
    let trackId = trackEl?.getAttribute('data-track-id') ?? undefined;
    void (async () => {
      const imported = await new Promise<Asset[]>((resolve) => {
        window.dispatchEvent(new CustomEvent('remix:import-files', { detail: { files, resolve } }));
        setTimeout(() => resolve([]), 60_000);
      });
      for (const asset of imported) {
        // wait until the new asset reaches this editor's state
        for (let i = 0; i < 60 && !assetsRef.current.some((a) => a.id === asset.id); i += 1) await new Promise((r) => setTimeout(r, 50));
        const tl = timelineRef.current;
        const wantKind = asset.type === 'audio' ? 'audio' : 'video';
        const track = tl.tracks.find((t) => t.id === trackId && !t.locked) ?? tl.tracks.find((t) => t.kind === wantKind && !t.locked);
        if (!track) continue;
        handleDropAsset(track.id, asset.id, time);
        time += asset.duration && asset.duration > 0 ? asset.duration : 5;
        trackId = track.id;
      }
    })();
  }, [handleDropAsset, pxPerSecondRef, currentTimeRef, assetsRef, timelineRef]);

  const handleRateStretch = useCallback((clipId: string, speed: number, startTime: number) => {
    const next = rateStretchTimeline(timelineRef.current, clipId, speed, startTime);
    if (next) setTimeline(next);
  }, [setTimeline, timelineRef]);

  // Smart Speech (classic editor's modal): generated audio -> asset + audio clip at the playhead, settings kept on the clip
  const handleOpenSpeech = useCallback(() => {
    openSmartSpeech({
      clips: () => timelineRef.current.clips,
      add: ({ url, duration, tts, name }) => {
        const asset: Asset = { id: generateId(), name, type: 'audio', url, duration, createdAt: new Date().toISOString() };
        dispatch({ type: 'ADD_ASSET', asset });
        let tl = timelineRef.current;
        // a free audio track at the playhead (the narration must not sit on top of the footage's own audio); add one when none is free
        const dur = asset.duration ?? 3;
        const free = (t: { id: string; kind: string; locked?: boolean }) => t.kind === 'audio' && !t.locked && !tl.clips.some((c) => c.trackId === t.id && c.startTime < currentTime + dur && clipEndTime(c) > currentTime);
        let track = tl.tracks.find(free);
        if (!track) { tl = addTrack(tl, 'audio'); track = tl.tracks[tl.tracks.length - 1]; }
        const next = addClipToTrack(tl, track.id, asset, currentTime);
        const added = next.clips.find((c) => c.assetId === asset.id);
        setTimeline({ ...next, clips: next.clips.map((c) => (c === added ? { ...c, tts } : c)) });
      },
    });
  }, [dispatch, setTimeline, timelineRef, currentTime]);

  // Template Generator (classic editor's wizard): its composition is placed on this timeline in one undo step
  const handleOpenGenerator = useCallback(async () => {
    const { TemplateGeneratorModal } = await import('../../../components/modals/TemplateGeneratorModal.jsx');
    const modal = new TemplateGeneratorModal({
      onConfirm: (result: { composition?: Composition }) => {
        if (!result?.composition) return;
        const applied = applyComposition(timelineRef.current, result.composition);
        applied.assets.forEach((asset) => dispatch({ type: 'ADD_ASSET', asset }));
        applied.overlays.forEach((overlay) => dispatch({ type: 'ADD_OVERLAY', overlay }));
        setTimeline(applied.timeline);
      },
    });
    // "My Media" in the wizard lists the project's own clips and images (as it listed the classic editor's media)
    (modal as unknown as { data: { media: unknown[] } }).data.media = assets
      .filter((x) => x.type === 'video' || x.type === 'image')
      .map((x) => ({ id: x.id, assetId: x.id, type: x.type, name: x.name, url: x.url, duration: x.duration, thumbnail: x.thumbnailUrl ?? x.url, width: x.width, height: x.height }));
    modal.open();
  }, [dispatch, setTimeline, timelineRef, assets]);

  // Personalization hub (contacts, tokens, per-contact generation) — the classic editor's own window
  const handleOpenPersonalization = useCallback(async () => {
    const { VideoPersonalizationHub } = await import('../../../components/modals/VideoPersonalizationHub.jsx');
    new VideoPersonalizationHub({ onComplete: () => {}, onError: (e: unknown) => console.warn('Personalization error', e) }).open();
  }, []);

  return { handleDesktopFilesDrop, handleRateStretch, handleOpenSpeech, handleOpenGenerator, handleOpenPersonalization };
}

/** Capture-phase drag handlers of the editor root: Library cards and desktop files dropped on the timeline. */
export function libraryDropHandlers(opts: {
  editorRef: RefObject<HTMLDivElement | null>;
  timelineRef: MutableRefObject<Timeline>;
  pxPerSecondRef: MutableRefObject<number>;
  currentTime: number;
  onLibraryDrop?: (drag: LibraryDrag, ctx: LibraryDropCtx) => void;
  handleDesktopFilesDrop: (e: React.DragEvent) => void;
}) {
  const { editorRef, timelineRef, pxPerSecondRef, currentTime, onLibraryDrop, handleDesktopFilesDrop } = opts;
  const clearTargets = () => editorRef.current?.querySelectorAll('.lib-drop-target').forEach((n) => n.classList.remove('lib-drop-target'));
  return {
    onDragOverCapture: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; return; } // desktop files
      if (!hasLibraryDrag(e.dataTransfer.types)) return;
      if ((e.target as Element).closest?.('.overlay-track')) return; // the Overlays row handles its own drops
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      const el = (e.target as Element).closest?.('.clip-card, .track-row[data-track-id]') as HTMLElement | null;
      editorRef.current?.querySelectorAll('.lib-drop-target').forEach((n) => { if (n !== el) n.classList.remove('lib-drop-target'); });
      el?.classList.add('lib-drop-target');
    },
    onDragLeaveCapture: (e: React.DragEvent) => { if (!editorRef.current?.contains(e.relatedTarget as Node | null)) clearTargets(); },
    onDropCapture: (e: React.DragEvent) => {
      if (e.dataTransfer.files.length > 0 && !hasLibraryDrag(e.dataTransfer.types)) { handleDesktopFilesDrop(e); return; }
      if (!hasLibraryDrag(e.dataTransfer.types)) return;
      const target = e.target as Element;
      clearTargets();
      if (target.closest?.('.overlay-track')) return;
      const drag = decodeLibraryDrag(e.dataTransfer.getData(LIBRARY_DND));
      if (!drag || !onLibraryDrop) return;
      e.preventDefault(); e.stopPropagation(); // not an asset / clip drop: keep CineGen's own drop handler out of it
      const trackEl = target.closest('.track-row[data-track-id]') as HTMLElement | null;
      const trackId = trackEl?.getAttribute('data-track-id') ?? undefined;
      const clipEl = target.closest('.clip-card') as HTMLElement | null;
      const clipId = clipEl?.getAttribute('data-clip-id') ?? undefined;
      const clipsEl = trackEl?.querySelector('.track-row__clips') as HTMLElement | null;
      const time = clipsEl ? Math.max(0, (e.clientX - clipsEl.getBoundingClientRect().left) / pxPerSecondRef.current) : currentTime;
      const trackKind = trackId ? timelineRef.current.tracks.find((t) => t.id === trackId)?.kind : undefined;
      onLibraryDrop(drag, { time, clipId, trackId, trackKind });
    },
  };
}
