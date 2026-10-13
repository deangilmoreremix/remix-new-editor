/**
 * Timeline Components Architecture - Unit Tests
 *
 * Tests for the REAL vanilla-JS components (imported through the `@/src`
 * alias): `Timeline`, `Layer` and `Clip` in src/components/ and the
 * `Component` base class in src/components/base/.
 *
 * History: this spec used to import default exports (`import Timeline from
 * …`) and assert an aspirational Timeline API (`state.pan`, a
 * `state.selectedTool` default, `onMount`, a `.timeline-editor` root,
 * `role="application"`, and direct TimelineState subscription). The modules
 * only ever exposed named exports, a different state shape
 * ({zoom, playheadPercent, timelineSeconds, tracks}), the Component
 * lifecycle (beforeMount/mounted/render/bindEvents/onUnmount), a
 * `.timeline-card` root and `props.initialState` injection. The tests below
 * assert the API the modules actually provide.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The components export CLASSES (named exports), not default exports.
import { Timeline } from '@/src/components/Timeline';
import { Layer } from '@/src/components/Layer';
import { Clip } from '@/src/components/Clip';
import { Component } from '@/components/base/Component';

/** A TimelineState-shaped tracks payload: the state Timeline renders from. */
const SAMPLE_TRACKS = [
  {
    id: 'track-1', name: 'Video 1', muted: false, solo: false, locked: false,
    clips: [
      { id: 'clip-1', name: 'Intro', type: 'video', left: 0, width: 40 },
      { id: 'clip-2', name: 'Outro', type: 'video', left: 45, width: 30 },
    ],
  },
  {
    id: 'track-2', name: 'Audio 1', muted: false, solo: false, locked: false,
    clips: [{ id: 'clip-3', name: 'Music', type: 'audio', left: 10, width: 80 }],
  },
];

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

describe('Timeline Component Architecture', () => {
  describe('Component base class', () => {
    it('Component.js exists and is importable', () => {
      expect(Component).toBeDefined();
      expect(typeof Component).toBe('function');
    });

    it('Component provides mount/unmount/render lifecycle', () => {
      const methods = Object.getOwnPropertyNames(Component.prototype);
      expect(methods).toContain('mount');
      expect(methods).toContain('unmount');
      expect(methods).toContain('render');
      expect(methods).toContain('setState');
    });

    it('Component.render throws until a subclass implements it', () => {
      const bare = new Component({});
      expect(() => bare.render()).toThrow('Subclasses must implement render() method');
    });
  });

  describe('Timeline.js', () => {
    it('imports without errors', () => {
      expect(Timeline).toBeDefined();
      expect(typeof Timeline).toBe('function');
    });

    it('extends Component base class', () => {
      const timeline = new Timeline({});
      expect(timeline instanceof Component).toBe(true);
    });

    it('initializes with correct default state', () => {
      const timeline = new Timeline({});
      expect(timeline.state).toEqual({
        zoom: 1,
        playheadPercent: 32,
        timelineSeconds: 60,
        tracks: [],
      });
    });

    it('honours initialState overrides from props', () => {
      const timeline = new Timeline({
        initialState: { zoom: 2.5, playheadPercent: 50, timelineSeconds: 120, tracks: SAMPLE_TRACKS },
      });
      expect(timeline.state.zoom).toBe(2.5);
      expect(timeline.state.playheadPercent).toBe(50);
      expect(timeline.state.timelineSeconds).toBe(120);
      expect(timeline.state.tracks).toHaveLength(2);
    });

    it('exposes render/bindEvents/track rendering lifecycle methods', () => {
      const timeline = new Timeline({});
      expect(typeof timeline.render).toBe('function');
      expect(typeof timeline.bindEvents).toBe('function');
      expect(typeof timeline.renderTracks).toBe('function');
      expect(typeof timeline.renderTools).toBe('function');
      expect(typeof timeline.renderPills).toBe('function');
      expect(typeof timeline.updatePlayhead).toBe('function');
      expect(typeof timeline.onUnmount).toBe('function');
    });

    it('mounts the timeline card into its container', () => {
      const timeline = new Timeline({ initialState: { tracks: SAMPLE_TRACKS } });
      timeline.mount(container);

      const card = container.querySelector('.timeline-card');
      expect(card).not.toBeNull();
      expect(container.querySelector('.timeline-top')).not.toBeNull();
      expect(container.querySelector('#trackRows')).not.toBeNull();
      expect(container.querySelector('#playheadLine')).not.toBeNull();
    });

    it('renders one row per track with clips positioned in percent', () => {
      const timeline = new Timeline({ initialState: { tracks: SAMPLE_TRACKS } });
      timeline.mount(container);

      const rows = container.querySelectorAll('.track-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].dataset.trackId).toBe('track-1');

      const clips = container.querySelectorAll('.track-row[data-track-id="track-1"] .clip');
      expect(clips).toHaveLength(2);
      expect(clips[0].dataset.clipId).toBe('clip-1');
      expect(clips[0].style.left).toBe('0%');
      expect(clips[0].style.width).toBe('40%');
      expect(clips[1].dataset.clipId).toBe('clip-2');
    });

    it('renders the eight editing tools and the AI pills', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      expect(container.querySelectorAll('.tool-btn')).toHaveLength(8);
      expect(container.querySelectorAll('.pill')).toHaveLength(10);
    });

    it('positions the playhead from state', () => {
      const timeline = new Timeline({ initialState: { playheadPercent: 50 } });
      timeline.mount(container);

      // render() runs before the element is in the document, so updatePlayhead
      // (called again once attached) is what writes the position.
      timeline.updatePlayhead();
      expect(document.getElementById('playheadLine').style.left).toBe('50%');
      expect(document.getElementById('playheadKnob').style.left).toBe('calc(50% - 4px)');
    });

    it('unmounts cleanly', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      timeline.unmount();
      expect(container.innerHTML).toBe('');
      expect(container.hasChildNodes()).toBe(false);
    });
  });

  describe('Timeline interaction', () => {
    it('binds tracked event listeners on mount and removes them on unmount', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      expect(timeline.eventListeners.length).toBeGreaterThan(0);

      timeline.unmount();
      expect(timeline.eventListeners).toHaveLength(0);
    });

    it('zoom buttons clamp zoom between 0.5 and 2', () => {
      const timeline = new Timeline({});
      timeline.state.zoom = 0.5;
      timeline.handleZoomOut();
      expect(timeline.state.zoom).toBe(0.5);
      timeline.state.zoom = 2;
      timeline.handleZoomIn();
      expect(timeline.state.zoom).toBe(2);
      timeline.state.zoom = 1;
      timeline.handleZoomIn();
      expect(timeline.state.zoom).toBeCloseTo(1.1, 5);
    });

    it('tool and clip handlers write selection state', () => {
      const timeline = new Timeline({});
      timeline.handleToolSelect('Blade');
      expect(timeline.state.selectedTool).toBe('Blade');
      timeline.handleClipClick('clip-7');
      expect(timeline.state.selectedClipId).toBe('clip-7');
    });

    it('adds a track through the toolbar handler', () => {
      const timeline = new Timeline({});
      timeline.handleAddTrack('Video');
      expect(timeline.state.tracks).toHaveLength(1);
      expect(timeline.state.tracks[0].name).toBe('Video');
      expect(timeline.state.tracks[0].clips).toEqual([]);
    });

    it('re-renders into a new element when state changes after mount', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      const firstElement = container.firstElementChild;

      timeline.setState({ zoom: 2 });

      expect(timeline.state.zoom).toBe(2);
      expect(container.firstElementChild).not.toBe(firstElement);
      expect(container.querySelector('.timeline-card')).not.toBeNull();
    });

    it('merges arbitrary state updates (studio-style external updates)', () => {
      const timeline = new Timeline({});
      timeline.setState({ zoom: 2.0, pan: 100, selectedTool: 'Cut' });
      expect(timeline.state.zoom).toBe(2.0);
      expect(timeline.state.pan).toBe(100);
      expect(timeline.state.selectedTool).toBe('Cut');
    });

    it('tool button clicks select the tool through event delegation', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      const bladeBtn = Array.from(container.querySelectorAll('.tool-btn')).find((b) => b.title === 'Blade');
      bladeBtn.click();
      expect(timeline.state.selectedTool).toBe('Blade');
    });
  });

  describe('Layer.js', () => {
    it('imports without errors', () => {
      expect(Layer).toBeDefined();
    });

    it('extends Component base class', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' } });
      expect(layer instanceof Component).toBe(true);
    });

    it('requires layer prop', () => {
      expect(() => new Layer({})).toThrow('layer required');
    });

    it('manages visibility/lock/solo state with sane defaults', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' } });
      expect(layer.isVisible).toBe(true);
      expect(layer.isLocked).toBe(false);
      expect(layer.isSolo).toBe(false);
      expect(layer.opacity).toBe(1.0);
    });

    it('honours layer flags from props', () => {
      const layer = new Layer({ layer: { id: 'L2', name: 'L2', visible: false, locked: true, solo: true, opacity: 0.4 } });
      expect(layer.isVisible).toBe(false);
      expect(layer.isLocked).toBe(true);
      expect(layer.isSolo).toBe(true);
      expect(layer.opacity).toBe(0.4);
    });

    it('toggles visibility', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' } });
      layer.toggleVisibility();
      expect(layer.isVisible).toBe(false);
      layer.toggleVisibility();
      expect(layer.isVisible).toBe(true);
    });

    it('toggles lock and solo', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' } });
      layer.toggleLock();
      expect(layer.isLocked).toBe(true);
      layer.toggleSolo();
      expect(layer.isSolo).toBe(true);
    });

    it('sets opacity', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' } });
      layer.setOpacity(0.5);
      expect(layer.opacity).toBe(0.5);
    });

    it('clamps opacity to 0-1 range', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' } });
      layer.setOpacity(1.5);
      expect(layer.opacity).toBe(1);
      layer.setOpacity(-0.5);
      expect(layer.opacity).toBe(0);
    });

    it('renders DOM structure with an accessible visibility control', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Test Layer' }, container });
      layer.mount();

      const layerEl = container.querySelector('.layer');
      expect(layerEl).not.toBeNull();
      expect(layerEl.textContent).toContain('Test Layer');
      expect(container.querySelector('.visibility-btn').getAttribute('aria-label')).toContain('visibility');
    });

    it('updates reflect in DOM after setState', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Original' }, container });
      layer.mount();

      layer.setState({ name: 'Updated' });

      expect(container.textContent).toContain('Updated');
    });
  });

  describe('Clip.js', () => {
    it('imports without errors', () => {
      expect(Clip).toBeDefined();
    });

    it('extends Component base class', () => {
      const clip = new Clip({ clip: { id: 'clip-1', start: 0, end: 100, trackId: 'track-1' } });
      expect(clip instanceof Component).toBe(true);
    });

    it('requires clip data and parent timeline reference', () => {
      expect(() => new Clip({})).toThrow('clip and timeline required');
    });

    it('tracks selection state', () => {
      const mockTimeline = { selectClip: vi.fn() };
      const clip = new Clip({ clip: { id: 'clip-1', start: 0, end: 100, trackId: 'track-1' }, timeline: mockTimeline });
      expect(clip.isSelected).toBe(false);

      clip.select();
      expect(clip.isSelected).toBe(true);
      expect(mockTimeline.selectClip).toHaveBeenCalledWith('clip-1', false);
    });

    it('deselects clip', () => {
      const mockTimeline = { deselectClip: vi.fn() };
      const clip = new Clip({ clip: { id: 'clip-1', start: 0, end: 100, trackId: 'track-1' }, timeline: mockTimeline });
      clip.isSelected = true;
      clip.deselect();
      expect(clip.isSelected).toBe(false);
      expect(mockTimeline.deselectClip).toHaveBeenCalledWith('clip-1');
    });

    it('calculates position from timeline zoom', () => {
      const mockTimeline = { getZoom: () => 2.0 };
      const clip = new Clip({ clip: { start: 0, end: 100, duration: 100 }, timeline: mockTimeline });
      expect(clip.getPosition()).toBe(0);
      clip.state.start = 50;
      expect(clip.getPosition()).toBe(100);
    });

    it('triggers callback on click', () => {
      const onClick = vi.fn();
      const clip = new Clip({ clip: { id: 'clip-1', start: 0, end: 100, trackId: 'track-1' }, timeline: {}, onClick });
      clip.handleClick();
      expect(onClick).toHaveBeenCalledWith(clip);
    });

    it('renders as a focusable DOM element', () => {
      const clip = new Clip({ clip: { id: 'C1', start: 0, end: 100, trackId: 'T1' }, container, timeline: { getZoom: () => 1 } });
      clip.mount();

      const clipEl = container.querySelector('.clip');
      expect(clipEl).not.toBeNull();
      expect(clipEl.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('No React dependencies', () => {
    it('Timeline.js does not import React', async () => {
      const source = await import('@/src/components/Timeline.js?raw');
      expect(typeof source.default).toBe('string');
      expect(source.default).not.toMatch(/from ['"]react['"]/);
      expect(source.default).not.toMatch(/React\.createElement/);
    });

    it('Layer.js does not import React', async () => {
      const source = await import('@/src/components/Layer.js?raw');
      expect(source.default).not.toMatch(/from ['"]react['"]/);
    });

    it('Clip.js does not import React', async () => {
      const source = await import('@/src/components/Clip.js?raw');
      expect(source.default).not.toMatch(/from ['"]react['"]/);
    });

    it('none of these files contain JSX syntax in source', async () => {
      const jsxPattern = /<[A-Z][a-zA-Z0-9]*\s*[^>]*>/;
      const timelineSource = await import('@/src/components/Timeline.js?raw');
      const layerSource = await import('@/src/components/Layer.js?raw');
      const clipSource = await import('@/src/components/Clip.js?raw');
      expect(timelineSource.default).not.toMatch(jsxPattern);
      expect(layerSource.default).not.toMatch(jsxPattern);
      expect(clipSource.default).not.toMatch(jsxPattern);
    });
  });

  describe('Component encapsulation', () => {
    it('Timeline renders into its container element', () => {
      const timeline = new Timeline({ container });
      timeline.mount(container);
      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('.timeline-card')).not.toBeNull();
    });

    it('Timeline unmounts cleanly', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      timeline.unmount();
      expect(container.innerHTML).toBe('');
    });

    it('Layer renders DOM structure', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Test Layer' }, container });
      layer.mount();
      expect(container.querySelector('.layer')).not.toBeNull();
    });

    it('Clip renders as DOM element', () => {
      const clip = new Clip({ clip: { id: 'C1', start: 0, end: 100, trackId: 'T1' }, container, timeline: { getZoom: () => 1 } });
      clip.mount();
      expect(container.querySelector('.clip')).not.toBeNull();
    });

    it('mount rejects an invalid container', () => {
      const timeline = new Timeline({});
      expect(() => timeline.mount(null)).toThrow('Container must be a valid HTMLElement');
      expect(() => timeline.mount('not-an-element')).toThrow('Container must be a valid HTMLElement');
    });
  });

  describe('Event handling integration', () => {
    it('Timeline binds event listeners on mount', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      expect(timeline.eventListeners.length).toBeGreaterThan(0);
    });

    it('Timeline removes event listeners on unmount', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      timeline.unmount();
      expect(timeline.eventListeners).toHaveLength(0);
    });

    it('Track toggle buttons mute/solo/lock through delegation', () => {
      const timeline = new Timeline({ initialState: { tracks: SAMPLE_TRACKS } });
      timeline.mount(container);

      const muteBtn = container.querySelector('.track-row[data-track-id="track-1"] [data-toggle="mute"]');
      muteBtn.click();
      expect(timeline.state.tracks[0].muted).toBe(true);
    });
  });

  describe('State synchronization', () => {
    it('Timeline accepts external state updates', () => {
      const timeline = new Timeline({});
      timeline.setState({ zoom: 2.0, pan: 100, selectedTool: 'Cut' });
      expect(timeline.state.zoom).toBe(2.0);
      expect(timeline.state.pan).toBe(100);
      expect(timeline.state.selectedTool).toBe('Cut');
    });

    it('Timeline setState triggers a re-render', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      const initialElement = timeline.element;
      timeline.setState({ zoom: 2.0 });
      expect(timeline.element).not.toBe(initialElement);
    });

    it('Layer updates reflect in DOM after setState', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Original' }, container });
      layer.mount();
      layer.setState({ name: 'Updated' });
      expect(container.textContent).toContain('Updated');
    });

    it('Timeline renders tracks injected through props.initialState', () => {
      // The Timeline receives its data via props.initialState — it does NOT
      // subscribe to a TimelineState instance itself (the owning editor wires
      // that). State injected here must reach the rendered rows.
      const timeline = new Timeline({
        initialState: { tracks: [{ id: 't9', name: 'Injected', muted: false, solo: false, locked: false, clips: [] }] },
      });
      timeline.mount(container);
      const row = container.querySelector('.track-row[data-track-id="t9"]');
      expect(row).not.toBeNull();
      expect(row.textContent).toContain('Injected');
    });
  });

  describe('Error boundaries', () => {
    it('Timeline catches render errors, records them and re-throws', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const timeline = new Timeline({});
      timeline.render = () => { throw new Error('Test error'); };

      expect(() => timeline.mount(container)).toThrow('Test error');
      expect(timeline.error).toBeInstanceOf(Error);
      expect(timeline.error.message).toBe('Test error');
      expect(consoleError).toHaveBeenCalled();
      // mount() failed before appending, so nothing leaked into the container.
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('Timeline controls carry accessible labels and tooltips', () => {
      const timeline = new Timeline({});
      timeline.mount(container);

      const toolButtons = Array.from(container.querySelectorAll('.tool-btn'));
      expect(toolButtons.length).toBeGreaterThan(0);
      toolButtons.forEach((btn) => {
        expect(btn.title).toBeTruthy();
        expect(btn.dataset.tooltip).toBeTruthy();
      });

      const zoomIn = container.querySelector('[data-action="zoom-in"]');
      expect(zoomIn.title).toBe('Zoom in on the timeline');
    });

    it('Clip elements are keyboard focusable', () => {
      const clip = new Clip({ clip: { id: 'clip-1', start: 0, end: 100 }, timeline: {}, container });
      clip.mount();
      const el = container.querySelector('.clip');
      expect(el.getAttribute('tabindex')).toBe('0');
    });

    it('Layer controls have accessible labels', () => {
      const layer = new Layer({ layer: { id: 'L1', name: 'Layer 1' }, container });
      layer.mount();
      const visibilityBtn = container.querySelector('.visibility-btn');
      expect(visibilityBtn.getAttribute('aria-label')).toContain('visibility');
      expect(visibilityBtn.getAttribute('aria-label')).toContain('Layer 1');
    });
  });

  describe('Memory management', () => {
    it('Component unsubscribes from stores on unmount', () => {
      const unsubscribe = vi.fn();
      const store = { subscribe: () => unsubscribe };
      const timeline = new Timeline({});
      timeline.subscribeToStore(store, () => {});
      expect(timeline.subscriptions).toHaveLength(1);

      timeline.mount(container);
      timeline.unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(timeline.subscriptions).toHaveLength(0);
    });

    it('removes all DOM nodes on unmount', () => {
      const timeline = new Timeline({});
      timeline.mount(container);
      timeline.unmount();
      expect(container.innerHTML).toBe('');
      expect(container.hasChildNodes()).toBe(false);
    });
  });

  describe('Cross-browser compatibility', () => {
    it('uses feature-safe DOM utilities', () => {
      const component = new Component({});
      const el = component.createElementFromHTML('<b id="probe">hi</b>');
      expect(el.id).toBe('probe');

      // safeInterpolate escapes HTML instead of interpolating raw markup.
      expect(component.safeInterpolate('<i>${name}</i>', { name: '<script>' })).not.toContain('<script>');
    });
  });
});
