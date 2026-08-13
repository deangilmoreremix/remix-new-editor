import { describe, it, expect, beforeEach } from 'vitest';
import { TimelineState } from '../TimelineState.js';

describe('TimelineState multi-timeline support', () => {
  let ts;

  beforeEach(() => {
    ts = new TimelineState({ autopersist: false, storage: null });
  });

  describe('default state', () => {
    it('includes a timelines map with timeline-1', () => {
      const state = ts.getState();
      expect(state.timelines).toBeDefined();
      expect(state.timelines['timeline-1']).toBeDefined();
    });

    it('sets activeTimelineId to timeline-1', () => {
      const state = ts.getState();
      expect(state.activeTimelineId).toBe('timeline-1');
    });

    it('exposes state.timeline as the active timeline', () => {
      const state = ts.getState();
      expect(state.timeline).toBe(state.timelines['timeline-1']);
    });

    it('active timeline has tracks derived from project.tracks', () => {
      const state = ts.getState();
      const tl = state.timelines['timeline-1'];
      expect(tl.tracks.length).toBeGreaterThan(0);
      expect(tl.id).toBe('timeline-1');
    });
  });

  describe('getActiveTimeline', () => {
    it('returns the active timeline', () => {
      const tl = ts.getActiveTimeline();
      expect(tl).toBeDefined();
      expect(tl.id).toBe('timeline-1');
    });

    it('returns null when no timelines', () => {
      ts._state.timelines = {};
      ts._state.activeTimelineId = null;
      expect(ts.getActiveTimeline()).toBeNull();
    });
  });

  describe('setActiveTimeline', () => {
    it('switches the active timeline', () => {
      ts._state.timelines = {
        'timeline-1': { id: 'timeline-1', name: 'A', tracks: [], clips: [] },
        'timeline-2': { id: 'timeline-2', name: 'B', tracks: [], clips: [] },
      };
      ts.setActiveTimeline('timeline-2');
      expect(ts._state.activeTimelineId).toBe('timeline-2');
      expect(ts.getActiveTimeline().name).toBe('B');
    });

    it('ignores invalid ids', () => {
      ts._state.timelines = { 'timeline-1': { id: 'timeline-1', tracks: [], clips: [] } };
      ts._state.activeTimelineId = 'timeline-1';
      ts.setActiveTimeline('no-such-id');
      expect(ts._state.activeTimelineId).toBe('timeline-1');
    });
  });

  describe('addTimeline', () => {
    it('creates a new timeline and switches to it', () => {
      const id = ts.addTimeline('Second');
      expect(id).toBeDefined();
      expect(ts._state.activeTimelineId).toBe(id);
      expect(ts.getActiveTimeline().name).toBe('Second');
      expect(ts._state.timelines[id]).toBeDefined();
    });

    it('auto-names when no name provided', () => {
      const id = ts.addTimeline();
      expect(ts.getActiveTimeline().name).toMatch(/Timeline \d/);
    });
  });

  describe('removeTimeline', () => {
    it('removes a non-active timeline', () => {
      ts._state.timelines = {
        'timeline-1': { id: 'timeline-1', name: 'A', tracks: [], clips: [] },
        'timeline-2': { id: 'timeline-2', name: 'B', tracks: [], clips: [] },
      };
      ts._state.activeTimelineId = 'timeline-1';
      const result = ts.removeTimeline('timeline-2');
      expect(result).toBe(true);
      expect(ts._state.timelines['timeline-2']).toBeUndefined();
      expect(ts._state.activeTimelineId).toBe('timeline-1');
    });

    it('refuses to remove the last timeline', () => {
      ts._state.timelines = {
        'timeline-1': { id: 'timeline-1', name: 'A', tracks: [], clips: [] },
      };
      ts._state.activeTimelineId = 'timeline-1';
      const result = ts.removeTimeline('timeline-1');
      expect(result).toBe(false);
      expect(ts._state.timelines['timeline-1']).toBeDefined();
    });

    it('switches to another timeline when removing the active one', () => {
      ts._state.timelines = {
        'timeline-1': { id: 'timeline-1', name: 'A', tracks: [], clips: [] },
        'timeline-2': { id: 'timeline-2', name: 'B', tracks: [], clips: [] },
      };
      ts._state.activeTimelineId = 'timeline-1';
      ts.removeTimeline('timeline-1');
      expect(ts._state.activeTimelineId).toBe('timeline-2');
    });
  });

  describe('renameTimeline', () => {
    it('renames a timeline', () => {
      ts._state.timelines = {
        'timeline-1': { id: 'timeline-1', name: 'Old', tracks: [], clips: [] },
      };
      ts.renameTimeline('timeline-1', 'New');
      expect(ts._state.timelines['timeline-1'].name).toBe('New');
    });
  });

  describe('backward compatibility', () => {
    it('derives timelines from project.tracks when missing', () => {
      ts._state.timelines = undefined;
      ts._state.activeTimelineId = undefined;
      ts._state.project.tracks = [
        { id: 'v1', type: 'video', name: 'V1', items: [], clips: [] }
      ];
      ts._deriveTimelinesFromProject();
      expect(ts._state.timelines).toBeDefined();
      expect(ts._state.timelines['timeline-1']).toBeDefined();
      expect(ts._state.activeTimelineId).toBe('timeline-1');
    });
  });
});
