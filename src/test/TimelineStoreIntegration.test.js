import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TimelineStore from '../../globals/stores/timeline.store';

// Mock MobX
vi.mock('mobx', () => ({
  observable: () => {},
  action: () => (target, key, descriptor) => descriptor,
  reaction: () => () => {},
  makeObservable: () => {},
  computed: () => () => {},
}));

// Mock emitter
vi.mock('../../lib/mitt/emitter', () => ({
  emitter: {
    on: vi.fn(),
    emit: vi.fn(),
  },
  emitterActions: {
    ARRAY_DELETE: 'array-delete',
    DELETE: 'delete',
    SELECT: 'select',
  },
}));

describe('Deep Timeline Store Integration', () => {
  let timelineStore;
  let mockProjectStore;

  beforeEach(() => {
    mockProjectStore = {
      elements: [],
      layers: [
        { id: 'layer1', order: 0 },
        { id: 'layer2', order: 1 },
      ],
      duration: 600,
      removeElement: vi.fn(),
      getElementById: vi.fn(),
      updateStartEnd: vi.fn(),
      addElement: vi.fn(),
      changeDuration: vi.fn(),
      updateElement: vi.fn(),
      findAndUpdate: vi.fn(),
    };

    timelineStore = new TimelineStore({ projectStore: mockProjectStore });
    
    // Initialize enhanced state containers
    timelineStore.elementEditingState = new Map();
    timelineStore.elementTrimState = new Map();
    timelineStore.elementPropertyState = new Map();
    timelineStore.elementTransitionState = new Map();
    timelineStore.elementAIState = new Map();
    timelineStore.elementOverlayState = new Map();
    timelineStore.undoStack = [];
    timelineStore.redoStack = [];
    timelineStore.maxUndoStackSize = 50;
    timelineStore.zoomState = { zoom: 1, minZoom: 0.1, maxZoom: 5 };
    timelineStore.viewState = { scrollLeft: 0, visibleStartTime: 0, visibleEndTime: 60 };
    timelineStore.playbackState = { isPlaying: false, currentTime: 0, playbackRate: 1, loop: false };
    timelineStore.listeners = new Set();
    
    // Mock notifyStateChange
    timelineStore.notifyStateChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Timeline State Management', () => {
    it('should initialize with default state', () => {
      expect(timelineStore.timelineHeight).toBe(35);
      expect(timelineStore.isActiveTimeline).toBe(false);
      expect(timelineStore.timelineSelectedItems).toEqual([]);
      expect(timelineStore.copiedItems).toEqual([]);
      expect(timelineStore.activeRow).toBeNull();
      expect(timelineStore.timeOnClick).toBeNull();
    });

    it('should set timeline height', () => {
      timelineStore.setTimelineHeight(100);
      expect(timelineStore.timelineHeight).toBe(100);
    });

    it('should set active timeline state', () => {
      timelineStore.setIsActiveTimeline(true);
      expect(timelineStore.isActiveTimeline).toBe(true);
    });

    it('should set selected items', () => {
      const items = ['item1', 'item2'];
      timelineStore.setTimelineSelectedItems(items);
      expect(timelineStore.timelineSelectedItems).toEqual(items);
    });

    it('should set active row', () => {
      const row = { id: 'layer1', order: 0 };
      timelineStore.setActiveRow(row);
      expect(timelineStore.activeRow).toEqual(row);
    });

    it('should set time on click', () => {
      timelineStore.setTimeOnClick(15.5);
      expect(timelineStore.timeOnClick).toBe(15.5);
    });

    it('should update context menu', () => {
      timelineStore.setContextMenu({ isOpen: true, posX: 100, posY: 200 });
      expect(timelineStore.contextMenu.isOpen).toBe(true);
      expect(timelineStore.contextMenu.posX).toBe(100);
      expect(timelineStore.contextMenu.posY).toBe(200);
    });

    it('should copy selected items', () => {
      const items = ['item1', 'item2'];
      timelineStore.setTimelineSelectedItems(items);
      timelineStore.setCopiedItems();
      expect(timelineStore.copiedItems).toEqual(items);
    });
  });

  describe('Element Editing State', () => {
    it('should set element editing state', () => {
      const elementId = 'elem1';
      const editingState = { isEditing: true, mode: 'trim' };
      
      timelineStore.setElementEditingState(elementId, editingState);
      
      expect(timelineStore.elementEditingState.get(elementId)).toEqual(editingState);
    });

    it('should set element trim state', () => {
      const elementId = 'elem1';
      const trimState = {
        trimStart: 2.5,
        trimEnd: 8.0,
        duration: 10.0,
      };
      
      timelineStore.setElementTrimState(elementId, trimState);
      
      expect(timelineStore.elementTrimState.get(elementId)).toBeDefined();
      expect(timelineStore.elementTrimState.get(elementId).trimStart).toBe(2.5);
      expect(timelineStore.elementTrimState.get(elementId).trimEnd).toBe(8.0);
    });

    it('should update element trim start', () => {
      const elementId = 'elem1';
      timelineStore.setElementTrimState(elementId, { trimStart: 0, trimEnd: 10, duration: 10 });
      
      timelineStore.updateElementTrimStart(elementId, 2.5);
      
      expect(timelineStore.elementTrimState.get(elementId).trimStart).toBe(2.5);
    });

    it('should update element trim end', () => {
      const elementId = 'elem1';
      timelineStore.setElementTrimState(elementId, { trimStart: 0, trimEnd: 10, duration: 10 });
      
      timelineStore.updateElementTrimEnd(elementId, 8.0);
      
      expect(timelineStore.elementTrimState.get(elementId).trimEnd).toBe(8.0);
    });

    it('should set element property state', () => {
      const elementId = 'elem1';
      const propertyState = {
        volume: 0.8,
        muted: false,
        hidden: false,
        fill: true,
      };
      
      timelineStore.setElementPropertyState(elementId, propertyState);
      
      expect(timelineStore.elementPropertyState.get(elementId)).toEqual(propertyState);
    });

    it('should update specific element property', () => {
      const elementId = 'elem1';
      timelineStore.setElementPropertyState(elementId, { volume: 1.0, muted: false });
      
      timelineStore.updateElementProperty(elementId, 'volume', 0.5);
      
      expect(timelineStore.elementPropertyState.get(elementId).volume).toBe(0.5);
    });

    it('should set element transition state', () => {
      const elementId = 'elem1';
      const transitionState = {
        transitionIn: { type: 'fade', duration: 0.5 },
        transitionOut: { type: 'slide', duration: 0.5 },
      };
      
      timelineStore.setElementTransitionState(elementId, transitionState);
      
      expect(timelineStore.elementTransitionState.get(elementId)).toEqual(transitionState);
    });

    it('should add transition to element', () => {
      const elementId = 'elem1';
      const transition = { type: 'zoom', duration: 0.5 };
      
      timelineStore.addElementTransition(elementId, 'in', transition);
      
      expect(timelineStore.elementTransitionState.get(elementId).transitionIn).toEqual(transition);
    });
  });

  describe('AI Generation State', () => {
    it('should set AI generation state for element', () => {
      const elementId = 'elem1';
      const aiState = {
        isGenerating: true,
        generationId: 'gen123',
        generationError: null,
        generated: false,
      };
      
      timelineStore.setElementAIState(elementId, aiState);
      
      expect(timelineStore.elementAIState.get(elementId)).toEqual(aiState);
    });

    it('should mark element as generating', () => {
      const elementId = 'elem1';
      
      timelineStore.setElementGenerating(elementId, true, 'gen123');
      
      const state = timelineStore.elementAIState.get(elementId);
      expect(state.isGenerating).toBe(true);
      expect(state.generationId).toBe('gen123');
    });

    it('should mark generation as completed', () => {
      const elementId = 'elem1';
      timelineStore.setElementGenerating(elementId, true, 'gen123');
      
      timelineStore.setElementGenerationComplete(elementId, 'asset123');
      
      const state = timelineStore.elementAIState.get(elementId);
      expect(state.isGenerating).toBe(false);
      expect(state.generated).toBe(true);
      expect(state.assetId).toBe('asset123');
    });

    it('should set generation error', () => {
      const elementId = 'elem1';
      timelineStore.setElementGenerating(elementId, true, 'gen123');
      
      timelineStore.setElementGenerationError(elementId, 'Network error');
      
      const state = timelineStore.elementAIState.get(elementId);
      expect(state.isGenerating).toBe(false);
      expect(state.generationError).toBe('Network error');
    });

    it('should clear AI state for element', () => {
      const elementId = 'elem1';
      timelineStore.setElementAIState(elementId, { isGenerating: true });
      
      timelineStore.clearElementAIState(elementId);
      
      expect(timelineStore.elementAIState.has(elementId)).toBe(false);
    });
  });

  describe('Element Selection and Bulk Operations', () => {
    it('should add item to selection', () => {
      timelineStore.addToSelection('item1');
      expect(timelineStore.timelineSelectedItems).toContain('item1');
      
      timelineStore.addToSelection('item2');
      expect(timelineStore.timelineSelectedItems).toContain('item1');
      expect(timelineStore.timelineSelectedItems).toContain('item2');
    });

    it('should remove item from selection', () => {
      timelineStore.setTimelineSelectedItems(['item1', 'item2', 'item3']);
      
      timelineStore.removeFromSelection('item2');
      
      expect(timelineStore.timelineSelectedItems).not.toContain('item2');
      expect(timelineStore.timelineSelectedItems).toContain('item1');
      expect(timelineStore.timelineSelectedItems).toContain('item3');
    });

    it('should toggle item selection', () => {
      timelineStore.toggleItemSelection('item1');
      expect(timelineStore.timelineSelectedItems).toContain('item1');
      
      timelineStore.toggleItemSelection('item1');
      expect(timelineStore.timelineSelectedItems).not.toContain('item1');
    });

    it('should select all items on a layer', () => {
      const layerId = 'layer1';
      const layerElements = ['elem1', 'elem2', 'elem3'];
      mockProjectStore.elements = layerElements.map(id => ({ id, track: layerId }));
      
      timelineStore.selectAllOnLayer(layerId);
      
      expect(timelineStore.timelineSelectedItems).toEqual(layerElements);
    });

    it('should clear selection', () => {
      timelineStore.setTimelineSelectedItems(['item1', 'item2']);
      
      timelineStore.clearSelection();
      
      expect(timelineStore.timelineSelectedItems).toEqual([]);
    });
  });

  describe('Timeline Zoom and View State', () => {
    it('should set zoom level', () => {
      timelineStore.setZoom(2);
      expect(timelineStore.zoomState.zoom).toBe(2);
    });

    it('should clamp zoom to min value', () => {
      timelineStore.setZoom(0.01);
      expect(timelineStore.zoomState.zoom).toBe(0.1);
    });

    it('should clamp zoom to max value', () => {
      timelineStore.setZoom(10);
      expect(timelineStore.zoomState.zoom).toBe(5);
    });

    it('should zoom in', () => {
      const initialZoom = timelineStore.zoomState.zoom;
      timelineStore.zoomIn();
      expect(timelineStore.zoomState.zoom).toBeGreaterThan(initialZoom);
    });

    it('should zoom out', () => {
      timelineStore.setZoom(2);
      const initialZoom = timelineStore.zoomState.zoom;
      timelineStore.zoomOut();
      expect(timelineStore.zoomState.zoom).toBeLessThan(initialZoom);
    });

    it('should reset zoom', () => {
      timelineStore.setZoom(3);
      timelineStore.resetZoom();
      expect(timelineStore.zoomState.zoom).toBe(1);
    });

    it('should set view scroll position', () => {
      timelineStore.setScrollPosition(100);
      expect(timelineStore.viewState.scrollLeft).toBe(100);
    });

    it('should set visible time range', () => {
      timelineStore.setVisibleTimeRange(10, 70);
      expect(timelineStore.viewState.visibleStartTime).toBe(10);
      expect(timelineStore.viewState.visibleEndTime).toBe(70);
    });
  });

  describe('Playback State', () => {
    it('should set playing state', () => {
      timelineStore.setPlaying(true);
      expect(timelineStore.playbackState.isPlaying).toBe(true);
    });

    it('should toggle playback', () => {
      expect(timelineStore.playbackState.isPlaying).toBe(false);
      timelineStore.togglePlayback();
      expect(timelineStore.playbackState.isPlaying).toBe(true);
      timelineStore.togglePlayback();
      expect(timelineStore.playbackState.isPlaying).toBe(false);
    });

    it('should set current time', () => {
      timelineStore.setCurrentTime(25.5);
      expect(timelineStore.playbackState.currentTime).toBe(25.5);
    });

    it('should set playback rate', () => {
      timelineStore.setPlaybackRate(1.5);
      expect(timelineStore.playbackState.playbackRate).toBe(1.5);
    });

    it('should toggle loop', () => {
      expect(timelineStore.playbackState.loop).toBe(false);
      timelineStore.toggleLoop();
      expect(timelineStore.playbackState.loop).toBe(true);
    });
  });

  describe('Element State Synchronization', () => {
    it('should synchronize element state from project store', () => {
      const element = {
        id: 'elem1',
        popcornOptions: {
          start: 5,
          end: 15,
          from: 2,
          to: 12,
          volume: 0.8,
          muted: false,
        },
        transitions: {
          in: { type: 'fade', duration: 0.5 },
        },
      };
      
      timelineStore.syncElementState(element);
      
      expect(timelineStore.elementTrimState.get('elem1')).toBeDefined();
      expect(timelineStore.elementPropertyState.get('elem1')).toBeDefined();
      expect(timelineStore.elementTransitionState.get('elem1')).toBeDefined();
    });

    it('should get complete element state', () => {
      const elementId = 'elem1';
      timelineStore.setElementTrimState(elementId, { trimStart: 2, trimEnd: 8, duration: 10 });
      timelineStore.setElementPropertyState(elementId, { volume: 0.8 });
      
      const state = timelineStore.getElementState(elementId);
      
      expect(state.trim).toBeDefined();
      expect(state.properties).toBeDefined();
    });

    it('should clear all element state', () => {
      timelineStore.setElementTrimState('elem1', { trimStart: 0, trimEnd: 10, duration: 10 });
      timelineStore.setElementPropertyState('elem1', { volume: 1 });
      
      timelineStore.clearElementState('elem1');
      
      expect(timelineStore.elementTrimState.has('elem1')).toBe(false);
      expect(timelineStore.elementPropertyState.has('elem1')).toBe(false);
    });

    it('should clear all editing state', () => {
      timelineStore.setElementTrimState('elem1', {});
      timelineStore.setElementTrimState('elem2', {});
      timelineStore.setElementPropertyState('elem1', {});
      
      timelineStore.clearAllEditingState();
      
      expect(timelineStore.elementTrimState.size).toBe(0);
      expect(timelineStore.elementPropertyState.size).toBe(0);
      expect(timelineStore.elementTransitionState.size).toBe(0);
    });
  });

  describe('Undo/Redo Integration', () => {
    it('should push state to undo stack', () => {
      const state = { selectedItems: ['item1'], zoom: 1 };
      timelineStore.pushUndoState(state);
      
      expect(timelineStore.undoStack).toHaveLength(1);
      expect(timelineStore.undoStack[0].state).toEqual(state);
    });

    it('should limit undo stack size', () => {
      timelineStore.maxUndoStackSize = 3;
      
      timelineStore.pushUndoState({ state: 1 });
      timelineStore.pushUndoState({ state: 2 });
      timelineStore.pushUndoState({ state: 3 });
      timelineStore.pushUndoState({ state: 4 });
      
      expect(timelineStore.undoStack).toHaveLength(3);
      expect(timelineStore.undoStack[0].state).toEqual({ state: 2 });
    });

    it('should undo last action', () => {
      timelineStore.pushUndoState({ selectedItems: [], zoom: 1 });
      timelineStore.setTimelineSelectedItems(['item1']);
      timelineStore.pushUndoState({ selectedItems: ['item1'], zoom: 1 });
      
      const undone = timelineStore.undo();
      
      expect(undone).toBe(true);
      expect(timelineStore.redoStack).toHaveLength(1);
    });

    it('should redo last undone action', () => {
      timelineStore.pushUndoState({ selectedItems: [] });
      timelineStore.pushUndoState({ selectedItems: ['item1'] });
      timelineStore.undo();
      
      const redone = timelineStore.redo();
      
      expect(redone).toBe(true);
      expect(timelineStore.undoStack).toHaveLength(2);
    });

    it('should clear redo stack on new action', () => {
      timelineStore.pushUndoState({ state: 1 });
      timelineStore.pushUndoState({ state: 2 });
      timelineStore.undo();
      timelineStore.redoStack = [{ state: 'old', timestamp: Date.now() }];
      
      timelineStore.pushUndoState({ state: 3 });
      
      expect(timelineStore.redoStack).toHaveLength(0);
    });
  });

  describe('Store Integration with Components', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      timelineStore.subscribe(listener);
      
      timelineStore.setTimelineHeight(100);
      
      expect(timelineStore.notifyStateChange).toHaveBeenCalled();
    });

    it('should allow unsubscribing listeners', () => {
      const listener = vi.fn();
      const unsubscribe = timelineStore.subscribe(listener);
      
      unsubscribe();
      
      expect(timelineStore.listeners.has(listener)).toBe(false);
    });

    it('should batch multiple updates', () => {
      const listener = vi.fn();
      timelineStore.subscribe(listener);
      timelineStore.isBatching = false;
      
      timelineStore.batchUpdates(() => {
        timelineStore.setTimelineHeight(100);
        timelineStore.setIsActiveTimeline(true);
        timelineStore.setTimelineSelectedItems(['item1']);
      });
      
      // Should notify after batch completes
      expect(timelineStore.batchChanges).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle setting trim with invalid values', () => {
      const elementId = 'elem1';
      
      timelineStore.setElementTrimState(elementId, { trimStart: -5, trimEnd: 100 });
      
      // Should normalize invalid values
      const state = timelineStore.elementTrimState.get(elementId);
      expect(state.trimStart).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing element state gracefully', () => {
      const state = timelineStore.getElementState('nonexistent');
      
      expect(state).toEqual({
        editing: null,
        trim: null,
        properties: null,
        transitions: null,
        overlays: null,
        ai: null,
      });
    });

    it('should handle undo when stack is empty', () => {
      const result = timelineStore.undo();
      
      expect(result).toBe(false);
    });

    it('should handle redo when stack is empty', () => {
      const result = timelineStore.redo();
      
      expect(result).toBe(false);
    });

    it('should handle rapid state updates', () => {
      const elementId = 'elem1';
      
      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        timelineStore.updateElementTrimStart(elementId, i);
      }
      
      const state = timelineStore.elementTrimState.get(elementId);
      expect(state.trimStart).toBe(99);
    });
  });
});
