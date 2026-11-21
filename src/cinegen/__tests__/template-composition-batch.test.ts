// [remix] Template Generator: starts at the playhead, and the whole insert is ONE undo step (a BATCH action).
import { describe, it, expect } from 'vitest';
import type { Timeline, Track } from '@cinegen/types/timeline';
import { applyComposition } from '@cinegen/lib/occ/template-composition';
import { createInitialWorkspaceState } from '@cinegen/lib/mcp/workspace-state';
import { historyReducer } from '@cinegen/components/workspace/workspace-history';

const track = (id: string, kind: 'video' | 'audio'): Track => ({ id, name: id, kind, color: '#fff', muted: false, solo: false, locked: false, visible: true, volume: 1 } as Track);
const tl = (over: Partial<Timeline> = {}): Timeline => ({ id: 't1', name: 'T', tracks: [track('v1', 'video'), track('a1', 'audio')], clips: [], duration: 0, transitions: [], markers: [], ...over });
const comp = { tracks: [{ type: 'video', clips: [{ type: 'video', duration: 4, startTime: 0, asset: { id: 'x', type: 'video', name: 'X', url: 'https://example.com/x.webm', duration: 4 } }, { type: 'text', text: 'Hello', duration: 3, startTime: 1 }] }] };

describe('applyComposition start', () => {
  it('goes after the existing timeline by default (unchanged)', () => {
    const r = applyComposition(tl({ duration: 20 }), comp);
    expect(r.timeline.clips.find((c) => c.assetId === 'x')?.startTime).toBe(20);
  });
  it('starts at the playhead when given', () => {
    const r = applyComposition(tl({ duration: 20 }), comp, 6);
    expect(r.timeline.clips.find((c) => c.assetId === 'x')?.startTime).toBe(6);
    expect(r.overlays[0].start).toBe(7); // text starts 1s into the composition
  });
});

describe('BATCH is one undo step', () => {
  it('applies every inner action, and a single UNDO reverts all of them', () => {
    const state = createInitialWorkspaceState();
    const timeline = tl();
    const withTl = { ...state, timelines: [timeline], activeTimelineId: timeline.id } as typeof state;
    const history0 = { current: withTl, past: [] as typeof withTl[], future: [] as typeof withTl[], lastPushTime: 0, lastPushType: null };
    const applied = applyComposition(timeline, comp, 0);
    const batch = { type: 'BATCH' as const, actions: [
      ...applied.assets.map((asset) => ({ type: 'ADD_ASSET' as const, asset })),
      ...applied.overlays.map((overlay) => ({ type: 'ADD_OVERLAY' as const, overlay })),
      { type: 'SET_TIMELINE' as const, timelineId: timeline.id, timeline: applied.timeline },
    ] };
    const after = historyReducer(history0, batch);
    expect(after.past).toHaveLength(1); // ONE history entry for the whole insert
    expect(after.current.assets.length).toBe(1);
    expect(after.current.overlays.length).toBe(1);
    expect(after.current.timelines.find((t) => t.id === timeline.id)!.clips.length).toBeGreaterThan(0);
    const undone = historyReducer(after, { type: 'UNDO' });
    expect(undone.current.assets.length).toBe(0);
    expect(undone.current.overlays.length).toBe(0);
    expect(undone.current.timelines.find((t) => t.id === timeline.id)!.clips.length).toBe(0);
  });
});
