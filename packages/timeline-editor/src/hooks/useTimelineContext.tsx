import { createContext, useContext, type ReactNode } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { timelineMachine, type TimelineMachineContext } from '../services/timelineMachine';
import type { Clip, Track, Marker, Transition, ClipGroup, EditMode } from '../types/timeline';

// Actor ref shared by all timeline hooks (XState v5).
export type TimelineActorRef = ReturnType<typeof useActorRef<typeof timelineMachine>>;

const TimelineContext = createContext<TimelineActorRef | null>(null);

export function TimelineProvider({
  children,
  initialDuration = 60,
}: {
  children: ReactNode;
  initialDuration?: number;
}) {
  const actorRef = useActorRef(timelineMachine, {
    input: undefined,
    snapshot: undefined,
  });
  // Seed initial duration once.
  actorRef.send({ type: 'SET_DURATION', duration: initialDuration });
  return <TimelineContext.Provider value={actorRef}>{children}</TimelineContext.Provider>;
}

export function useTimelineActor(): TimelineActorRef {
  const ref = useContext(TimelineContext);
  if (!ref) throw new Error('useTimelineActor must be used within <TimelineProvider>');
  return ref;
}

// ---- Selector hooks (fine-grained, avoid re-rendering the whole tree) ----

export function useClips(): Clip[] {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.clips);
}

export function useTracks(): Track[] {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.tracks);
}

export function useMarkers(): Marker[] {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.markers);
}

export function useTransitions(): Transition[] {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.transitions);
}

export function useGroups(): ClipGroup[] {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.groups);
}

export function useDuration(): number {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.duration);
}

export function useCurrentTime(): number {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.currentTime);
}

export function useZoom(): number {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.zoom);
}

export function useEditMode(): EditMode {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.editMode);
}

export function useSelectedClipIds(): string[] {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.selectedClipIds);
}

export function usePlaying(): boolean {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.playing);
}

export function useSnapEnabled(): boolean {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.snapEnabled);
}

export function useCanUndo(): boolean {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.history.past.length > 0);
}

export function useCanRedo(): boolean {
  const ref = useTimelineActor();
  return useSelector(ref, (s) => s.context.history.future.length > 0);
}

export type { TimelineMachineContext };
