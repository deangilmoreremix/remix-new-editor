import { setup, assign } from 'xstate';
import type {
  Clip,
  Track,
  Marker,
  Transition,
  ClipGroup,
  TimelineState,
  EditMode,
} from '../types/timeline';

// ---------------------------------------------------------------------------
// timeline-ui-machine (XState v5)
// Re-implements the upstream `timeline-ui-machine` contract: idle / selecting /
// dragging / trimming / playing states, plus an undo/redo history stack kept
// inside context so we preserve the ported `undo-redo-service` semantics.
// ---------------------------------------------------------------------------

export type TimelineEvent =
  | { type: 'ADD_TRACK'; track: Track }
  | { type: 'REMOVE_TRACK'; trackId: string }
  | { type: 'UPDATE_TRACK'; trackId: string; patch: Partial<Track> }
  | { type: 'ADD_CLIP'; clip: Clip }
  | { type: 'MOVE_CLIP'; clipId: string; start: number; trackId?: string }
  | { type: 'TRIM_CLIP'; clipId: string; start?: number; duration?: number; inPoint?: number }
  | { type: 'REMOVE_CLIP'; clipId: string }
  | { type: 'UPDATE_CLIP'; clipId: string; patch: Partial<Clip> }
  | { type: 'SELECT_CLIPS'; clipIds: string[] }
  | { type: 'SELECT_TRACKS'; trackIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_TIME'; time: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_EDIT_MODE'; mode: EditMode }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_SNAP'; enabled: boolean }
  | { type: 'ADD_MARKER'; marker: Marker }
  | { type: 'REMOVE_MARKER'; markerId: string }
  | { type: 'ADD_TRANSITION'; transition: Transition }
  | { type: 'REMOVE_TRANSITION'; transitionId: string }
  | { type: 'ADD_KEYFRAME'; clipId: string; keyframe: { id: string; time: number; value: number; easing: string; interpolation: string } }
  | { type: 'REMOVE_KEYFRAME'; clipId: string; keyframeId: string }
  | { type: 'UPDATE_KEYFRAME'; clipId: string; keyframeId: string; patch: { time?: number; value?: number } }
  | { type: 'ADD_GROUP'; group: ClipGroup }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'COMMIT' }; // snapshot current state into history

interface HistoryContext {
  past: TimelineState[];
  future: TimelineState[];
}

export interface TimelineMachineContext extends TimelineState {
  history: HistoryContext;
}

const MAX_HISTORY = 100;

function pushHistory(ctx: TimelineMachineContext): HistoryContext {
  // Snapshot only the data portion (exclude runtime UI flags handled separately).
  const snapshot: TimelineState = {
    tracks: ctx.tracks,
    clips: ctx.clips,
    transitions: ctx.transitions,
    markers: ctx.markers,
    groups: ctx.groups,
    duration: ctx.duration,
    currentTime: ctx.currentTime,
    zoom: ctx.zoom,
    editMode: ctx.editMode,
    selectedClipIds: ctx.selectedClipIds,
    selectedTrackIds: ctx.selectedTrackIds,
    playing: ctx.playing,
    snapEnabled: ctx.snapEnabled,
  };
  return {
    past: [...ctx.history.past, snapshot].slice(-MAX_HISTORY),
    future: [],
  };
}

export const timelineMachine = setup({
  types: {
    context: {} as TimelineMachineContext,
    events: {} as TimelineEvent,
  },
  actions: {
    commit: assign(({ context }) => ({ history: pushHistory(context) })),
    undo: assign(({ context }) => {
      const prev = context.history.past[context.history.past.length - 1];
      if (!prev) return {};
      const past = context.history.past.slice(0, -1);
      const future = [snapshotOf(context), ...context.history.future].slice(0, MAX_HISTORY);
      return { ...prev, history: { past, future } };
    }),
    redo: assign(({ context }) => {
      const next = context.history.future[0];
      if (!next) return {};
      const future = context.history.future.slice(1);
      const past = [...context.history.past, snapshotOf(context)].slice(-MAX_HISTORY);
      return { ...next, history: { past, future } };
    }),
  },
}).createMachine({
  id: 'timeline',
  context: {
    tracks: [],
    clips: [],
    transitions: [],
    markers: [],
    groups: [],
    duration: 60,
    currentTime: 0,
    zoom: 80, // px per second
    editMode: 'default',
    selectedClipIds: [],
    selectedTrackIds: [],
    playing: false,
    snapEnabled: true,
    history: { past: [], future: [] },
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        TOGGLE_PLAY: { target: 'playing', actions: 'commit' },
        ADD_TRACK: { actions: ['commit', assignAddTrack] },
        REMOVE_TRACK: { actions: ['commit', assignRemoveTrack] },
        UPDATE_TRACK: { actions: ['commit', assignUpdateTrack] },
        ADD_CLIP: { actions: ['commit', assignAddClip] },
        MOVE_CLIP: { actions: ['commit', assignMoveClip] },
        TRIM_CLIP: { actions: ['commit', assignTrimClip] },
        REMOVE_CLIP: { actions: ['commit', assignRemoveClip] },
        UPDATE_CLIP: { actions: ['commit', assignUpdateClip] },
        SELECT_CLIPS: { actions: assignSelectClips },
        SELECT_TRACKS: { actions: assignSelectTracks },
        CLEAR_SELECTION: { actions: assignClearSelection },
        SET_TIME: { actions: assignSetTime },
        SET_ZOOM: { actions: assignSetZoom },
        SET_DURATION: { actions: assignSetDuration },
        SET_EDIT_MODE: { actions: assignSetEditMode },
        SET_PLAYING: { actions: assignSetPlaying },
        SET_SNAP: { actions: assignSetSnap },
        ADD_MARKER: { actions: ['commit', assignAddMarker] },
        REMOVE_MARKER: { actions: ['commit', assignRemoveMarker] },
        ADD_TRANSITION: { actions: ['commit', assignAddTransition] },
        REMOVE_TRANSITION: { actions: ['commit', assignRemoveTransition] },
        ADD_KEYFRAME: { actions: ['commit', assignAddKeyframe] },
        REMOVE_KEYFRAME: { actions: ['commit', assignRemoveKeyframe] },
        UPDATE_KEYFRAME: { actions: ['commit', assignUpdateKeyframe] },
        ADD_GROUP: { actions: ['commit', assignAddGroup] },
        UNDO: { target: 'idle', actions: 'undo' },
        REDO: { target: 'idle', actions: 'redo' },
      },
    },
    playing: {
      on: {
        TOGGLE_PLAY: { target: 'idle', actions: 'commit' },
        SET_TIME: { actions: assignSetTime },
        SET_PLAYING: { actions: assignSetPlaying },
        ADD_MARKER: { actions: ['commit', assignAddMarker] },
        REMOVE_TRANSITION: { actions: ['commit', assignRemoveTransition] },
        ADD_KEYFRAME: { actions: ['commit', assignAddKeyframe] },
        REMOVE_KEYFRAME: { actions: ['commit', assignRemoveKeyframe] },
        UPDATE_KEYFRAME: { actions: ['commit', assignUpdateKeyframe] },
        UNDO: { target: 'idle', actions: 'undo' },
        REDO: { target: 'idle', actions: 'redo' },
      },
    },
  },
});

function snapshotOf(ctx: TimelineMachineContext): TimelineState {
  return {
    tracks: ctx.tracks,
    clips: ctx.clips,
    transitions: ctx.transitions,
    markers: ctx.markers,
    groups: ctx.groups,
    duration: ctx.duration,
    currentTime: ctx.currentTime,
    zoom: ctx.zoom,
    editMode: ctx.editMode,
    selectedClipIds: ctx.selectedClipIds,
    selectedTrackIds: ctx.selectedTrackIds,
    playing: ctx.playing,
    snapEnabled: ctx.snapEnabled,
  };
}

const assignAddTrack = assign({
  tracks: ({ context, event }) =>
    event.type === 'ADD_TRACK' ? [...context.tracks, event.track] : context.tracks,
});

const assignRemoveTrack = assign({
  tracks: ({ context, event }) =>
    event.type === 'REMOVE_TRACK'
      ? context.tracks.filter((t) => t.id !== event.trackId)
      : context.tracks,
  clips: ({ context, event }) =>
    event.type === 'REMOVE_TRACK'
      ? context.clips.filter((c) => c.trackId !== event.trackId)
      : context.clips,
});

const assignUpdateTrack = assign({
  tracks: ({ context, event }) =>
    event.type === 'UPDATE_TRACK'
      ? context.tracks.map((t) => (t.id === event.trackId ? { ...t, ...event.patch } : t))
      : context.tracks,
});

const assignAddClip = assign({
  clips: ({ context, event }) =>
    event.type === 'ADD_CLIP' ? [...context.clips, event.clip] : context.clips,
});

const assignMoveClip = assign({
  clips: ({ context, event }) =>
    event.type === 'MOVE_CLIP'
      ? context.clips.map((c) =>
          c.id === event.clipId
            ? { ...c, start: Math.max(0, event.start), trackId: event.trackId ?? c.trackId }
            : c,
        )
      : context.clips,
});

const assignTrimClip = assign({
  clips: ({ context, event }) =>
    event.type === 'TRIM_CLIP'
      ? context.clips.map((c) =>
          c.id === event.clipId
            ? {
                ...c,
                start: event.start ?? c.start,
                duration: event.duration ?? c.duration,
                inPoint: event.inPoint ?? c.inPoint,
              }
            : c,
        )
      : context.clips,
});

const assignRemoveClip = assign({
  clips: ({ context, event }) =>
    event.type === 'REMOVE_CLIP'
      ? context.clips.filter((c) => c.id !== event.clipId)
      : context.clips,
});

const assignUpdateClip = assign({
  clips: ({ context, event }) =>
    event.type === 'UPDATE_CLIP'
      ? context.clips.map((c) => (c.id === event.clipId ? ({ ...c, ...event.patch } as Clip) : c))
      : context.clips,
});

const assignSelectClips = assign({
  selectedClipIds: ({ event }) => (event.type === 'SELECT_CLIPS' ? event.clipIds : []),
});

const assignSelectTracks = assign({
  selectedTrackIds: ({ event }) => (event.type === 'SELECT_TRACKS' ? event.trackIds : []),
});

const assignClearSelection = assign({
  selectedClipIds: [],
  selectedTrackIds: [],
});

const assignSetTime = assign({
  currentTime: ({ event }) => (event.type === 'SET_TIME' ? event.time : 0),
});

const assignSetZoom = assign({
  zoom: ({ event }) => (event.type === 'SET_ZOOM' ? Math.max(8, Math.min(600, event.zoom)) : 80),
});

const assignSetDuration = assign({
  duration: ({ event }) => (event.type === 'SET_DURATION' ? event.duration : 60),
});

const assignSetEditMode = assign({
  editMode: ({ event }) => (event.type === 'SET_EDIT_MODE' ? event.mode : 'default'),
});

const assignSetPlaying = assign({
  playing: ({ event }) => (event.type === 'SET_PLAYING' ? event.playing : false),
});

const assignSetSnap = assign({
  snapEnabled: ({ event }) => (event.type === 'SET_SNAP' ? event.enabled : true),
});

const assignAddMarker = assign({
  markers: ({ context, event }) =>
    event.type === 'ADD_MARKER' ? [...context.markers, event.marker] : context.markers,
});

const assignRemoveMarker = assign({
  markers: ({ context, event }) =>
    event.type === 'REMOVE_MARKER'
      ? context.markers.filter((m) => m.id !== event.markerId)
      : context.markers,
});

const assignAddTransition = assign({
  transitions: ({ context, event }) =>
    event.type === 'ADD_TRANSITION' ? [...context.transitions, event.transition] : context.transitions,
});

const assignAddGroup = assign({
  groups: ({ context, event }) =>
    event.type === 'ADD_GROUP' ? [...context.groups, event.group] : context.groups,
});

const assignRemoveTransition = assign({
  transitions: ({ context, event }) =>
    event.type === 'REMOVE_TRANSITION'
      ? context.transitions.filter((t) => t.id !== event.transitionId)
      : context.transitions,
});

const assignAddKeyframe = assign({
  clips: ({ context, event }) =>
    event.type === 'ADD_KEYFRAME'
      ? context.clips.map((c) =>
          c.id === event.clipId
            ? {
                ...c,
                keyframes: [...(c.keyframes || []), { ...event.keyframe, clipId: event.clipId }],
              }
            : c,
        )
      : context.clips,
});

const assignRemoveKeyframe = assign({
  clips: ({ context, event }) =>
    event.type === 'REMOVE_KEYFRAME'
      ? context.clips.map((c) =>
          c.id === event.clipId
            ? { ...c, keyframes: (c.keyframes || []).filter((k) => k.id !== event.keyframeId) }
            : c,
        )
      : context.clips,
});

const assignUpdateKeyframe = assign({
  clips: ({ context, event }) =>
    event.type === 'UPDATE_KEYFRAME'
      ? context.clips.map((c) =>
          c.id === event.clipId
            ? {
                ...c,
                keyframes: (c.keyframes || []).map((k) =>
                  k.id === event.keyframeId ? { ...k, ...event.patch } : k,
                ),
              }
            : c,
        )
      : context.clips,
});
