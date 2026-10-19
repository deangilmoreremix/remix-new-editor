/**
 * Timeline State Management - Unit Tests
 *
 * Tests for the REAL `TimelineState` contract in
 * `src/lib/editor/TimelineState.js` (imported through the `@/src` alias).
 *
 * History: this spec used to encode an aspirational API (getProject(),
 * getZoom()/setPan(), undo/redo stacks, named snapshots, trajectoryCamera
 * maps, batchUpdate, a `timeline-state-<id>` storage key) that the module
 * never implemented. It now tests the API the module actually exposes:
 * getState/getRawState/setState, subscribe(previous, current), clamped
 * zoom/playhead/pan, track and clip CRUD keyed by (trackId, clipId), the
 * track.items/track.clips alias, multi-timeline helpers, persistence with
 * an injectable storage backend, and legacy import/export.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimelineState } from '@/src/lib/editor/TimelineState';

/** Hermetic storage backend: a Map with the Storage surface TimelineState uses. */
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    _map: map,
  };
}

function newState(options = {}) {
  return new TimelineState({ autopersist: false, ...options });
}

describe('TimelineState', () => {
  describe('constructor', () => {
    it('initializes the default editor state', () => {
      const state = newState();
      const raw = state.getRawState();

      expect(raw.project.fps).toBe(30);
      expect(raw.project.duration).toBe(60);
      expect(raw.project.aspectRatio).toBe('16:9');
      expect(raw.projectTitle).toBe('Untitled Project');
      expect(raw.zoom).toBe(1);
      expect(raw.pan).toBe(0);
      expect(raw.playheadPercent).toBe(0);
      expect(raw.selectedTool).toBe('select');
      expect(raw.isTimelineOpen).toBe(true);
      expect(raw.timelineSeconds).toBe(60);
      expect(raw.timelineHeight).toBe(300);
      expect(raw.snapEnabled).toBe(true);
      expect(raw.autoScrollEnabled).toBe(true);
      expect(raw.showRuler).toBe(true);
      expect(raw.selectedClipId).toBeNull();
      expect(raw.selectedClipIds).toBeInstanceOf(Set);
    });

    it('seeds the project with four default tracks and one timeline', () => {
      const raw = newState().getRawState();
      expect(raw.project.tracks.map((t) => t.id)).toEqual(['video-1', 'audio-1', 'text-1', 'broll-1']);
      expect(raw.activeTimelineId).toBe('timeline-1');
      expect(Object.keys(raw.timelines)).toEqual(['timeline-1']);
      expect(raw.timelines['timeline-1'].name).toBe('Main Timeline');
      // The seeded project ships a fixed 60s duration; it is only recalculated
      // from clip ends by updateClip (covered below).
      expect(raw.project.duration).toBe(60);
    });

    it('accepts a custom storage backend and key', () => {
      const storage = fakeStorage();
      const state = new TimelineState({ storage, storageKey: 'custom-key', autopersist: false });
      state.setZoom(2);
      state.persist();
      expect(storage._map.has('custom-key')).toBe(true);
      expect(JSON.parse(storage._map.get('custom-key')).zoom).toBe(2);
    });
  });

  describe('getState / getRawState', () => {
    it('getState returns a detached clone with compatibility fields', () => {
      const state = newState();
      const snapshot = state.getState();

      expect(snapshot.zoom).toBe(1);
      // Backward-compat fields layered onto the clone…
      expect(snapshot.tracks).toEqual(snapshot.project.tracks);
      expect(snapshot.duration).toBe(snapshot.project.duration);
      expect(snapshot.timeline.name).toBe('Main Timeline');

      // …and it is a CLONE: mutating it cannot corrupt the live state.
      snapshot.project.tracks.push({ id: 'injected' });
      snapshot.zoom = 99;
      expect(state.getRawState().project.tracks.some((t) => t.id === 'injected')).toBe(false);
      expect(state.getRawState().zoom).toBe(1);
    });

    it('getRawState exposes the live reference', () => {
      const state = newState();
      expect(state.getRawState()).toBe(state.getRawState());
    });
  });

  describe('subscribe / setState notification', () => {
    it('notifies subscribers with (previous, current)', () => {
      const state = newState();
      const callback = vi.fn();
      state.subscribe(callback);

      state.setZoom(2.5);

      expect(callback).toHaveBeenCalledTimes(1);
      const [previous, current] = callback.mock.calls[0];
      expect(previous.zoom).toBe(1);
      expect(current.zoom).toBe(2.5);
    });

    it('returns a working unsubscribe function', () => {
      const state = newState();
      const callback = vi.fn();
      const unsubscribe = state.subscribe(callback);

      state.setZoom(1.5);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      state.setZoom(2.0);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports multiple subscribers', () => {
      const state = newState();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      state.subscribe(cb1);
      state.subscribe(cb2);

      state.setSelectedTool('blade');

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('rejects non-function subscribers', () => {
      const state = newState();
      expect(() => state.subscribe('nope')).toThrow('callback must be a function');
    });

    it('skips notification for no-op updates', () => {
      const state = newState();
      const callback = vi.fn();
      state.subscribe(callback);

      state.setZoom(1); // already 1
      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores unknown top-level keys', () => {
      const state = newState();
      state.setState({ bogusKey: 'nope' });
      expect(state.getRawState().bogusKey).toBeUndefined();
    });

    it('merges immutably: the previous snapshot stays untouched', () => {
      const state = newState();
      const before = state.getState();
      state.setZoom(3);
      expect(before.zoom).toBe(1);
      expect(state.getState().zoom).toBe(3);
    });

    it('destroy() clears subscribers and ignores later updates', () => {
      const state = newState();
      const callback = vi.fn();
      state.subscribe(callback);
      state.destroy();

      state.setZoom(5); // guard: state is null
      expect(callback).not.toHaveBeenCalled();
      expect(state.getRawState()).toBeNull();
    });
  });

  describe('zoom / pan / playhead clamping', () => {
    it('clamps zoom to 0.1 - 10', () => {
      const state = newState();
      state.setZoom(0.01);
      expect(state.getRawState().zoom).toBe(0.1);
      state.setZoom(100);
      expect(state.getRawState().zoom).toBe(10);
    });

    it('zoomIn / zoomOut step by 0.1 and respect the clamps', () => {
      const state = newState();
      state.zoomIn();
      expect(state.getRawState().zoom).toBeCloseTo(1.1, 5);
      state.zoomOut();
      state.zoomOut();
      expect(state.getRawState().zoom).toBeCloseTo(0.9, 5);

      state.setZoom(0.1);
      state.zoomOut();
      expect(state.getRawState().zoom).toBe(0.1);
      state.setZoom(10);
      state.zoomIn();
      expect(state.getRawState().zoom).toBe(10);
    });

    it('clamps playheadPercent to 0 - 100', () => {
      const state = newState();
      state.updatePlayhead(-5);
      expect(state.getRawState().playheadPercent).toBe(0);
      state.updatePlayhead(150);
      expect(state.getRawState().playheadPercent).toBe(100);
      state.updatePlayhead(42);
      expect(state.getRawState().playheadPercent).toBe(42);
    });

    it('clamps pan to >= 0', () => {
      const state = newState();
      state.setState({ pan: -10 });
      expect(state.getRawState().pan).toBe(0);
      state.setState({ pan: 250 });
      expect(state.getRawState().pan).toBe(250);
    });

    it('selects the active tool', () => {
      const state = newState();
      state.setSelectedTool('blade');
      expect(state.getRawState().selectedTool).toBe('blade');
    });
  });

  describe('track operations', () => {
    it('adds a track with defaults and returns its id', () => {
      const state = newState();
      const id = state.addTrack({ type: 'video', name: 'Overlay' });
      const track = state.getRawState().project.tracks.find((t) => t.id === id);

      expect(track).toBeDefined();
      expect(id).toBe(track.id);
      expect(track.type).toBe('video');
      expect(track.name).toBe('Overlay');
      expect(track.visible).toBe(true);
      expect(track.locked).toBe(false);
      expect(track.items).toEqual([]);
    });

    it('generates ids and names for bare track data', () => {
      const state = newState();
      const id = state.addTrack({ type: 'audio' });
      const track = state.getRawState().project.tracks.find((t) => t.id === id);
      expect(id).toMatch(/^audio-\d+$/);
      expect(track.name).toBe('audio Track');
    });

    it('removes a track by id and reports failure for unknown ids', () => {
      const state = newState();
      expect(state.removeTrack('video-1')).toBe(true);
      expect(state.getRawState().project.tracks.some((t) => t.id === 'video-1')).toBe(false);
      expect(state.removeTrack('missing')).toBe(false);
    });

    it('updates track properties', () => {
      const state = newState();
      state.updateTrack('video-1', { name: 'Renamed', locked: true });
      const track = state.getRawState().project.tracks.find((t) => t.id === 'video-1');
      expect(track.name).toBe('Renamed');
      expect(track.locked).toBe(true);
    });
  });

  describe('clip operations', () => {
    it('adds a clip to a track and returns its id', () => {
      const state = newState();
      const id = state.addClip('video-1', { id: 'clip-1', start: 0, end: 10, type: 'video', name: 'Clip 1' });
      const clip = state.getClip('video-1', id);

      expect(id).toBe('clip-1');
      expect(clip).toMatchObject({ id: 'clip-1', start: 0, end: 10, type: 'video', name: 'Clip 1' });
      expect(clip.volume).toBe(1);
      expect(clip.opacity).toBe(1);
      expect(clip.effects).toEqual([]);
    });

    it('derives end from duration and trims from source bounds', () => {
      const state = newState();
      state.addClip('video-1', { id: 'clip-dur', start: 2, duration: 5 });
      const clip = state.getClip('video-1', 'clip-dur');
      expect(clip.end).toBe(7);
      expect(clip.sourceEnd).toBe(5);
    });

    it('keeps track.clips and track.items as the same array (alias)', () => {
      const state = newState();
      state.addClip('video-1', { id: 'clip-1', start: 0, end: 10 });
      const track = state.getRawState().project.tracks.find((t) => t.id === 'video-1');
      expect(track.clips).toBe(track.items);
      expect(track.clips.map((c) => c.id)).toContain('clip-1');
    });

    it('removes a clip and reports failure for unknown clips/tracks', () => {
      const state = newState();
      expect(state.removeClip('video-1', 'nope')).toBe(false);
      expect(state.removeClip('missing-track', 'x')).toBe(false);
      state.addClip('video-1', { id: 'clip-1', start: 0, end: 10 });
      expect(state.removeClip('video-1', 'clip-1')).toBe(true);
      expect(state.getClip('video-1', 'clip-1')).toBeNull();
    });

    it('updates clip properties and recalculates project duration', () => {
      const state = newState();
      state.updateClip('video-1', 1, { end: 50 });
      const clip = state.getClip('video-1', 1);
      expect(clip.end).toBe(50);
      expect(state.getRawState().project.duration).toBe(50);

      // Unknown track -> false; known track + unknown clip -> true (documented
      // quirk: the change check only verifies the track exists).
      expect(state.updateClip('missing-track', 1, { end: 1 })).toBe(false);
      expect(state.updateClip('video-1', 'no-such-clip', { end: 1 })).toBe(true);
    });

    it('getClip returns null for an unknown track', () => {
      const state = newState();
      expect(state.getClip('missing', 'x')).toBeNull();
    });
  });

  describe('multi-timeline helpers', () => {
    it('adds a timeline and switches to it', () => {
      const state = newState();
      const id = state.addTimeline('Second');
      expect(state.getRawState().activeTimelineId).toBe(id);
      expect(state.getActiveTimeline().name).toBe('Second');
      expect(Object.keys(state.getRawState().timelines)).toHaveLength(2);
    });

    it('renames a timeline', () => {
      const state = newState();
      state.renameTimeline('timeline-1', 'Edited');
      expect(state.getActiveTimeline().name).toBe('Edited');
    });

    it('removes a timeline but refuses to remove the last one', () => {
      const state = newState();
      expect(state.removeTimeline('timeline-1')).toBe(false); // last one
      const second = state.addTimeline('Second');
      expect(state.removeTimeline(second)).toBe(true);
      expect(state.removeTimeline(second)).toBe(false); // already gone
    });

    it('setActiveTimeline ignores unknown ids', () => {
      const state = newState();
      state.setActiveTimeline('missing');
      expect(state.getRawState().activeTimelineId).toBe('timeline-1');
    });
  });

  describe('persistence', () => {
    let storage;
    beforeEach(() => {
      storage = fakeStorage();
    });

    it('auto-persists on change when enabled', () => {
      const state = new TimelineState({ storage, autopersist: true });
      state.setZoom(2.0);
      const saved = JSON.parse(storage._map.get('timeline-state'));
      expect(saved.zoom).toBe(2.0);
    });

    it('does not persist when autopersist is off', () => {
      const state = new TimelineState({ storage, autopersist: false });
      state.setZoom(2.0);
      expect(storage._map.size).toBe(0);
    });

    it('hydrates from persisted state on construction', () => {
      const first = new TimelineState({ storage, autopersist: true });
      first.setZoom(2.0);
      first.updatePlayhead(25);

      const second = new TimelineState({ storage, autopersist: true });
      expect(second.getRawState().zoom).toBe(2.0);
      expect(second.getRawState().playheadPercent).toBe(25);
    });

    it('clearPersistence removes the stored record', () => {
      const state = new TimelineState({ storage, autopersist: true });
      state.setZoom(2.0);
      state.clearPersistence();
      expect(storage._map.has('timeline-state')).toBe(false);
    });

    it('falls back to defaults when stored JSON is corrupt', () => {
      const storage = fakeStorage({ 'timeline-state': 'not valid json' });
      const state = new TimelineState({ storage, autopersist: true });
      expect(state.getRawState().zoom).toBe(1);
    });

    it('defaults to localStorage when no storage is injected', () => {
      vi.stubGlobal('localStorage', fakeStorage());
      const state = new TimelineState({ autopersist: true });
      state.setZoom(2.0);
      expect(JSON.parse(localStorage.getItem('timeline-state')).zoom).toBe(2.0);
      vi.unstubAllGlobals();
    });
  });

  describe('legacy import / export', () => {
    it('imports a legacy project (left/width clips become items)', () => {
      const state = newState();
      state.importLegacyProject({
        tracks: [{ id: 'legacy-1', name: 'Legacy', clips: [{ id: 'c1', left: 8, width: 18, type: 'video' }] }],
      });

      const track = state.getRawState().project.tracks.find((t) => t.id === 'legacy-1');
      expect(track.items).toHaveLength(1);
      expect(track.items[0]).toMatchObject({ id: 'c1', start: 8, end: 26 });
      expect(track.clips).toBe(track.items);
    });

    it('exports legacy format with root-level fields and clips', () => {
      const state = newState();
      state.setZoom(1.5);
      const legacy = state.exportForLegacy();

      expect(legacy.zoom).toBe(1.5);
      expect(legacy.timelineSeconds).toBe(60);
      expect(Array.isArray(legacy.tracks)).toBe(true);
      expect(legacy.tracks[0].clips.length).toBeGreaterThan(0);
      expect(legacy.tracks[0].items).toBeUndefined();
      expect(legacy.project.tracks).toEqual([]);
    });

    it('convertClipFormat maps left/width to start/end', () => {
      const state = newState();
      const clip = state.convertClipFormat({ id: 'c9', left: 8, width: 18, type: 'video' });
      expect(clip).toMatchObject({ id: 'c9', start: 8, end: 26, type: 'video' });
      expect(clip.sourceEnd).toBe(18);
    });
  });
});
