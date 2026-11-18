// [remix] Which track a new clip should go on: the first unlocked track of that kind with nothing in the way, otherwise a new track.
// Used for sounds and voice-overs so a new sound never lands on top of audio that is already there. Pure (no React), so it is unit-tested.
import type { Timeline, TrackKind } from '@cinegen/types/timeline';
import { clipEndTime } from '@cinegen/types/timeline';
import { addTrack } from './timeline-operations';

/** True when no clip on the track overlaps [at, at + duration). */
export function isTrackFree(timeline: Timeline, trackId: string, at: number, duration: number): boolean {
  const end = at + Math.max(0.01, duration);
  return !timeline.clips.some((c) => c.trackId === trackId && c.startTime < end && clipEndTime(c) > at);
}

/**
 * The track to put a clip of `kind` on at `at` for `duration` seconds. The returned timeline already has the new track when one had to be made.
 * `addTrack` inserts video tracks before the audio tracks (so the new track is not always the last one); it is found by id.
 * Returns `trackId: null` only if a track could not be made.
 */
export function findFreeTrack(timeline: Timeline, kind: TrackKind, at: number, duration: number): { timeline: Timeline; trackId: string | null } {
  const free = timeline.tracks.find((t) => t.kind === kind && !t.locked && isTrackFree(timeline, t.id, at, duration));
  if (free) return { timeline, trackId: free.id };
  const known = new Set(timeline.tracks.map((t) => t.id));
  const withTrack = addTrack(timeline, kind);
  const added = withTrack.tracks.find((t) => !known.has(t.id));
  return added ? { timeline: withTrack, trackId: added.id } : { timeline, trackId: null };
}
