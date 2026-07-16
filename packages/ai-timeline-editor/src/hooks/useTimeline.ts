import { useCallback } from 'react';
import { useTimelineActor } from './useTimelineContext';
import type { Clip, Track, Marker, Transition, ClipGroup, EditMode } from '../types/timeline';

// Action wrappers — every mutation goes through the XState machine so undo/redo
// history is captured (the machine `commit`s on data-changing events).

export function useTimelineActions() {
  const actor = useTimelineActor();
  const send = actor.send;

  const addTrack = useCallback(
    (track: Track) => send({ type: 'ADD_TRACK', track }),
    [send],
  );
  const removeTrack = useCallback(
    (trackId: string) => send({ type: 'REMOVE_TRACK', trackId }),
    [send],
  );
  const updateTrack = useCallback(
    (trackId: string, patch: Partial<Track>) => send({ type: 'UPDATE_TRACK', trackId, patch }),
    [send],
  );
  const addClip = useCallback((clip: Clip) => send({ type: 'ADD_CLIP', clip }), [send]);
  const moveClip = useCallback(
    (clipId: string, start: number, trackId?: string) =>
      send({ type: 'MOVE_CLIP', clipId, start, trackId }),
    [send],
  );
  const trimClip = useCallback(
    (clipId: string, p: { start?: number; duration?: number; inPoint?: number }) =>
      send({ type: 'TRIM_CLIP', clipId, ...p }),
    [send],
  );
  const removeClip = useCallback((clipId: string) => send({ type: 'REMOVE_CLIP', clipId }), [send]);
  const updateClip = useCallback(
    (clipId: string, patch: Partial<Clip>) => send({ type: 'UPDATE_CLIP', clipId, patch }),
    [send],
  );
  const setTime = useCallback((time: number) => send({ type: 'SET_TIME', time }), [send]);
  const setZoom = useCallback((zoom: number) => send({ type: 'SET_ZOOM', zoom }), [send]);
  const setEditMode = useCallback((mode: EditMode) => send({ type: 'SET_EDIT_MODE', mode }), [send]);
  const togglePlay = useCallback(() => send({ type: 'TOGGLE_PLAY' }), [send]);
  const setPlaying = useCallback((playing: boolean) => send({ type: 'SET_PLAYING', playing }), [send]);
  const setSnap = useCallback((enabled: boolean) => send({ type: 'SET_SNAP', enabled }), [send]);
  const addTransition = useCallback(
    (transition: Transition) => send({ type: 'ADD_TRANSITION', transition }),
    [send],
  );

  return {
    addTrack,
    removeTrack,
    updateTrack,
    addClip,
    moveClip,
    trimClip,
    removeClip,
    updateClip,
    setTime,
    setZoom,
    setEditMode,
    togglePlay,
    setPlaying,
    setSnap,
    addTransition,
  };
}

export function useUndoRedo() {
  const actor = useTimelineActor();
  const send = actor.send;
  const undo = useCallback(() => send({ type: 'UNDO' }), [send]);
  const redo = useCallback(() => send({ type: 'REDO' }), [send]);
  return { undo, redo };
}

export function useSelectionActions() {
  const actor = useTimelineActor();
  const send = actor.send;
  const selectClips = useCallback(
    (clipIds: string[]) => send({ type: 'SELECT_CLIPS', clipIds }),
    [send],
  );
  const selectTracks = useCallback(
    (trackIds: string[]) => send({ type: 'SELECT_TRACKS', trackIds }),
    [send],
  );
  const clearSelection = useCallback(() => send({ type: 'CLEAR_SELECTION' }), [send]);
  return { selectClips, selectTracks, clearSelection };
}

export function useMarkerActions() {
  const actor = useTimelineActor();
  const send = actor.send;
  const addMarker = useCallback((marker: Marker) => send({ type: 'ADD_MARKER', marker }), [send]);
  const removeMarker = useCallback(
    (markerId: string) => send({ type: 'REMOVE_MARKER', markerId }),
    [send],
  );
  return { addMarker, removeMarker };
}

export function useGroupActions() {
  const actor = useTimelineActor();
  const send = actor.send;
  const addGroup = useCallback((group: ClipGroup) => send({ type: 'ADD_GROUP', group }), [send]);
  return { addGroup };
}

export * from './useTimelineContext';
