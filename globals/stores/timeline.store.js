import { action, observable, reaction } from 'mobx';

import { emitter, emitterActions } from '../../lib/mitt/emitter';
import { SANTISECOND } from '../../lib/constants/project';

/**
 * Enhanced Timeline Store
 * Manages all timeline state including element editing, trimming, properties,
 * transitions, AI generation, zoom, playback, and undo/redo functionality.
 */
export default class TimelineStore {
  constructor(props) {
    this.projectStore = props.projectStore;

    // Initialize enhanced state containers
    this.elementEditingState = new Map();
    this.elementTrimState = new Map();
    this.elementPropertyState = new Map();
    this.elementTransitionState = new Map();
    this.elementAIState = new Map();
    this.elementOverlayState = new Map();

    // Zoom and view state
    this.zoomState = observable({
      zoom: 1,
      minZoom: 0.1,
      maxZoom: 5,
    });

    this.viewState = observable({
      scrollLeft: 0,
      visibleStartTime: 0,
      visibleEndTime: 60,
    });

    // Playback state
    this.playbackState = observable({
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
      loop: false,
    });

    // Undo/Redo stacks
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoStackSize = 50;
    this.isBatching = false;
    this.batchChanges = [];

    // Event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    emitter.on(emitterActions.ARRAY_DELETE, () => {
      if (!this.isActiveTimeline) {
        return null;
      }
      this.timelineSelectedItems.forEach(id => {
        this.projectStore.removeElement(id);
        this.clearElementState(id);
      });
      this.timelineSelectedItems = [];
    });

    emitter.on(emitterActions.DELETE, id => {
      if (this.timelineSelectedItems.includes(id)) {
        this.timelineSelectedItems = this.timelineSelectedItems.filter(el => el !== id) || [];
      }
      if (this.copiedItems.includes(id)) {
        this.copiedItems = this.copiedItems.filter(el => el !== id) || [];
      }
      this.clearElementState(id);
    });

    reaction(
      () => this.projectStore.elements.length,
      (elementsLength) => {
        if (elementsLength >= this.projectElementsLength) {
          this.projectElementsLength = elementsLength;
          return;
        }
        this.projectElementsLength = elementsLength;
        this.handleUpdateCopiedItems();
      },
    );
  }

  // ============================================================================
  // CORE OBSERVABLE STATE
  // ============================================================================

  @observable timelineHeight = 35;

  @observable isActiveTimeline = false;

  @observable projectElementsLength = 0;

  @observable timelineSelectedItems = [];

  @observable copiedItems = [];

  @observable activeRow = null;

  @observable timeOnClick = null;

  @observable contextMenu = {
    posX: 0,
    posY: 0,
    isClickOnRow: true,
    isOpen: false,
    buttons: [],
  };

  // ============================================================================
  // CORE ACTIONS
  // ============================================================================

  @action
  setTimelineHeight = (value = 35) => {
    this.pushUndoState({
      timelineHeight: this.timelineHeight,
    });
    this.timelineHeight = value;
    this.notifyStateChange();
  };

  @action
  setIsActiveTimeline = (value = false) => {
    this.isActiveTimeline = value;
    this.notifyStateChange();
  };

  @action
  setTimelineSelectedItems = (ids = []) => {
    this.pushUndoState({
      timelineSelectedItems: [...this.timelineSelectedItems],
    });
    this.timelineSelectedItems = ids;
    this.notifyStateChange();
  };

  @action
  setCopiedItems = () => {
    this.copiedItems = this.timelineSelectedItems;
    this.notifyStateChange();
  };

  @action
  setActiveRow = track => {
    if (track) {
      this.activeRow = track;
      this.notifyStateChange();
    }
  };

  @action
  setTimeOnClick = time => {
    this.timeOnClick = time;
    this.notifyStateChange();
  };

  @action
  setContextMenu = (data = {}) => {
    this.contextMenu = { ...this.contextMenu, ...data };
    this.notifyStateChange();
  };

  // ============================================================================
  // ELEMENT EDITING STATE
  // ============================================================================

  @action
  setElementEditingState = (elementId, state) => {
    this.elementEditingState.set(elementId, state);
    this.notifyStateChange();
  };

  @action
  setElementTrimState = (elementId, state) => {
    // Validate and normalize trim values
    const validatedState = {
      trimStart: Math.max(0, state.trimStart || 0),
      trimEnd: Math.max(0, state.trimEnd || 0),
      duration: state.duration || 0,
    };
    this.elementTrimState.set(elementId, validatedState);
    this.notifyStateChange();
  };

  @action
  updateElementTrimStart = (elementId, trimStart) => {
    const currentState = this.elementTrimState.get(elementId) || {};
    this.pushUndoState({
      elementTrim: { [elementId]: { ...currentState } },
    });
    this.setElementTrimState(elementId, {
      ...currentState,
      trimStart: Math.max(0, trimStart),
    });
  };

  @action
  updateElementTrimEnd = (elementId, trimEnd) => {
    const currentState = this.elementTrimState.get(elementId) || {};
    this.pushUndoState({
      elementTrim: { [elementId]: { ...currentState } },
    });
    this.setElementTrimState(elementId, {
      ...currentState,
      trimEnd: Math.max(0, trimEnd),
    });
  };

  @action
  handleTrimChange = (elementId, changes) => {
    this.pushUndoState({
      elementTrim: { [elementId]: { ...this.elementTrimState.get(elementId) } },
    });
    const currentState = this.elementTrimState.get(elementId) || {};
    this.setElementTrimState(elementId, {
      ...currentState,
      trimStart: changes.from !== undefined ? changes.from : currentState.trimStart,
      trimEnd: changes.end !== undefined ? changes.end : currentState.trimEnd,
    });
    
    // Sync with project store
    if (this.projectStore) {
      this.projectStore.findAndUpdate(elementId, {
        popcornOptions: {
          from: changes.from,
          to: changes.end,
        },
      });
    }
  };

  // ============================================================================
  // ELEMENT PROPERTY STATE
  // ============================================================================

  @action
  setElementPropertyState = (elementId, state) => {
    this.elementPropertyState.set(elementId, state);
    this.notifyStateChange();
  };

  @action
  updateElementProperty = (elementId, key, value) => {
    const currentState = this.elementPropertyState.get(elementId) || {};
    this.pushUndoState({
      elementProperties: { [elementId]: { ...currentState } },
    });
    this.setElementPropertyState(elementId, {
      ...currentState,
      [key]: value,
    });
    
    // Sync with project store
    if (this.projectStore) {
      this.projectStore.findAndUpdate(elementId, {
        popcornOptions: {
          [key]: value,
        },
      });
    }
  };

  @action
  handlePropertyChange = (elementId, changes) => {
    this.pushUndoState({
      elementProperties: { [elementId]: { ...this.elementPropertyState.get(elementId) } },
    });
    const currentState = this.elementPropertyState.get(elementId) || {};
    this.setElementPropertyState(elementId, {
      ...currentState,
      ...changes,
    });
    
    // Sync with project store
    if (this.projectStore) {
      this.projectStore.findAndUpdate(elementId, {
        popcornOptions: changes,
      });
    }
  };

  // ============================================================================
  // ELEMENT TRANSITION STATE
  // ============================================================================

  @action
  setElementTransitionState = (elementId, state) => {
    this.elementTransitionState.set(elementId, state);
    this.notifyStateChange();
  };

  @action
  addElementTransition = (elementId, type, transition) => {
    const currentState = this.elementTransitionState.get(elementId) || {};
    this.pushUndoState({
      elementTransitions: { [elementId]: { ...currentState } },
    });
    this.setElementTransitionState(elementId, {
      ...currentState,
      [type === 'in' ? 'transitionIn' : 'transitionOut']: transition,
    });
    
    // Sync with project store
    if (this.projectStore) {
      this.projectStore.findAndUpdate(elementId, {
        transitions: {
          ...currentState,
          [type === 'in' ? 'in' : 'out']: transition,
        },
      });
    }
  };

  @action
  updateElementTransition = (elementId, type, options) => {
    const currentState = this.elementTransitionState.get(elementId) || {};
    const key = type === 'in' ? 'transitionIn' : 'transitionOut';
    this.pushUndoState({
      elementTransitions: { [elementId]: { ...currentState } },
    });
    this.setElementTransitionState(elementId, {
      ...currentState,
      [key]: { ...currentState[key], ...options },
    });
  };

  @action
  removeElementTransition = (elementId, type) => {
    const currentState = this.elementTransitionState.get(elementId) || {};
    this.pushUndoState({
      elementTransitions: { [elementId]: { ...currentState } },
    });
    const key = type === 'in' ? 'transitionIn' : 'transitionOut';
    const newState = { ...currentState };
    delete newState[key];
    this.setElementTransitionState(elementId, newState);
  };

  // ============================================================================
  // ELEMENT OVERLAY STATE
  // ============================================================================

  @action
  setElementOverlayState = (elementId, state) => {
    this.elementOverlayState.set(elementId, state);
    this.notifyStateChange();
  };

  @action
  addElementOverlay = (elementId, overlay) => {
    const currentState = this.elementOverlayState.get(elementId) || { overlays: [] };
    this.pushUndoState({
      elementOverlays: { [elementId]: { ...currentState } },
    });
    this.setElementOverlayState(elementId, {
      ...currentState,
      overlays: [...currentState.overlays, overlay],
    });
  };

  @action
  removeElementOverlay = (elementId, overlayIndex) => {
    const currentState = this.elementOverlayState.get(elementId) || { overlays: [] };
    this.pushUndoState({
      elementOverlays: { [elementId]: { ...currentState } },
    });
    this.setElementOverlayState(elementId, {
      ...currentState,
      overlays: currentState.overlays.filter((_, i) => i !== overlayIndex),
    });
  };

  // ============================================================================
  // AI GENERATION STATE
  // ============================================================================

  @action
  setElementAIState = (elementId, state) => {
    this.elementAIState.set(elementId, state);
    this.notifyStateChange();
  };

  @action
  setElementGenerating = (elementId, isGenerating, generationId = null) => {
    const currentState = this.elementAIState.get(elementId) || {
      isGenerating: false,
      generationId: null,
      generationError: null,
      generated: false,
      assetId: null,
    };
    this.setElementAIState(elementId, {
      ...currentState,
      isGenerating,
      generationId,
      generationError: null,
    });
  };

  @action
  setElementGenerationComplete = (elementId, assetId) => {
    const currentState = this.elementAIState.get(elementId) || {};
    this.setElementAIState(elementId, {
      ...currentState,
      isGenerating: false,
      generated: true,
      assetId,
      generationError: null,
    });
  };

  @action
  setElementGenerationError = (elementId, error) => {
    const currentState = this.elementAIState.get(elementId) || {};
    this.setElementAIState(elementId, {
      ...currentState,
      isGenerating: false,
      generationError: error,
    });
  };

  @action
  clearElementAIState = (elementId) => {
    this.elementAIState.delete(elementId);
    this.notifyStateChange();
  };

  // ============================================================================
  // ELEMENT SELECTION
  // ============================================================================

  @action
  addToSelection = (itemId) => {
    if (!this.timelineSelectedItems.includes(itemId)) {
      this.pushUndoState({
        timelineSelectedItems: [...this.timelineSelectedItems],
      });
      this.timelineSelectedItems = [...this.timelineSelectedItems, itemId];
      this.notifyStateChange();
    }
  };

  @action
  removeFromSelection = (itemId) => {
    this.pushUndoState({
      timelineSelectedItems: [...this.timelineSelectedItems],
    });
    this.timelineSelectedItems = this.timelineSelectedItems.filter(id => id !== itemId);
    this.notifyStateChange();
  };

  @action
  toggleItemSelection = (itemId) => {
    if (this.timelineSelectedItems.includes(itemId)) {
      this.removeFromSelection(itemId);
    } else {
      this.addToSelection(itemId);
    }
  };

  @action
  selectAllOnLayer = (layerId) => {
    const layerElements = this.projectStore?.elements
      ?.filter(el => el.track === layerId)
      ?.map(el => el.id) || [];
    this.setTimelineSelectedItems(layerElements);
  };

  @action
  clearSelection = () => {
    this.setTimelineSelectedItems([]);
  };

  // ============================================================================
  // ZOOM AND VIEW STATE
  // ============================================================================

  @action
  setZoom = (zoom) => {
    this.pushUndoState({
      zoom: this.zoomState.zoom,
    });
    this.zoomState.zoom = Math.max(
      this.zoomState.minZoom,
      Math.min(this.zoomState.maxZoom, zoom)
    );
    this.notifyStateChange();
  };

  @action
  zoomIn = () => {
    this.setZoom(this.zoomState.zoom * 1.2);
  };

  @action
  zoomOut = () => {
    this.setZoom(this.zoomState.zoom / 1.2);
  };

  @action
  resetZoom = () => {
    this.setZoom(1);
  };

  @action
  setScrollPosition = (scrollLeft) => {
    this.viewState.scrollLeft = scrollLeft;
    this.notifyStateChange();
  };

  @action
  setVisibleTimeRange = (startTime, endTime) => {
    this.viewState.visibleStartTime = startTime;
    this.viewState.visibleEndTime = endTime;
    this.notifyStateChange();
  };

  // ============================================================================
  // PLAYBACK STATE
  // ============================================================================

  @action
  setPlaying = (isPlaying) => {
    this.playbackState.isPlaying = isPlaying;
    this.notifyStateChange();
  };

  @action
  togglePlayback = () => {
    this.playbackState.isPlaying = !this.playbackState.isPlaying;
    this.notifyStateChange();
  };

  @action
  setCurrentTime = (time) => {
    this.playbackState.currentTime = Math.max(0, time);
    this.notifyStateChange();
  };

  @action
  setPlaybackRate = (rate) => {
    this.playbackState.playbackRate = rate;
    this.notifyStateChange();
  };

  @action
  toggleLoop = () => {
    this.playbackState.loop = !this.playbackState.loop;
    this.notifyStateChange();
  };

  // ============================================================================
  // ELEMENT STATE SYNCHRONIZATION
  // ============================================================================

  @action
  syncElementState = (element) => {
    if (!element || !element.id) return;

    const { id, popcornOptions = {}, transitions = {} } = element;

    // Sync trim state
    if (popcornOptions.from !== undefined || popcornOptions.to !== undefined) {
      this.setElementTrimState(id, {
        trimStart: popcornOptions.from || 0,
        trimEnd: popcornOptions.to || popcornOptions.duration || 0,
        duration: popcornOptions.duration || 0,
      });
    }

    // Sync property state
    this.setElementPropertyState(id, {
      volume: popcornOptions.volume ?? 1.0,
      muted: popcornOptions.muted ?? false,
      hidden: popcornOptions.hidden ?? false,
      fill: popcornOptions.fill ?? false,
      startTime: popcornOptions.start || 0,
      endTime: popcornOptions.end || 0,
      audioFadeIn: popcornOptions.audioFadeIn || 0,
      audioFadeOut: popcornOptions.audioFadeOut || 0,
    });

    // Sync transition state
    this.setElementTransitionState(id, {
      transitionIn: transitions.in || null,
      transitionOut: transitions.out || null,
    });
  };

  getElementState = (elementId) => {
    return {
      editing: this.elementEditingState.get(elementId) || null,
      trim: this.elementTrimState.get(elementId) || null,
      properties: this.elementPropertyState.get(elementId) || null,
      transitions: this.elementTransitionState.get(elementId) || null,
      overlays: this.elementOverlayState.get(elementId) || null,
      ai: this.elementAIState.get(elementId) || null,
    };
  };

  @action
  clearElementState = (elementId) => {
    this.elementEditingState.delete(elementId);
    this.elementTrimState.delete(elementId);
    this.elementPropertyState.delete(elementId);
    this.elementTransitionState.delete(elementId);
    this.elementAIState.delete(elementId);
    this.elementOverlayState.delete(elementId);
    this.notifyStateChange();
  };

  @action
  clearAllEditingState = () => {
    this.elementEditingState.clear();
    this.elementTrimState.clear();
    this.elementPropertyState.clear();
    this.elementTransitionState.clear();
    this.elementOverlayState.clear();
    this.notifyStateChange();
  };

  // ============================================================================
  // UNDO/REDO
  // ============================================================================

  @action
  pushUndoState = (state) => {
    if (this.isBatching) {
      this.batchChanges.push(state);
      return;
    }

    this.undoStack.push({
      timestamp: Date.now(),
      state: { ...state },
    });

    // Clear redo stack on new action
    this.redoStack = [];

    // Limit stack size
    if (this.undoStack.length > this.maxUndoStackSize) {
      this.undoStack.shift();
    }
  };

  @action
  undo = () => {
    if (this.undoStack.length === 0) return false;

    const undoItem = this.undoStack.pop();
    this.redoStack.push(undoItem);

    // Restore state
    this.restoreState(undoItem.state);
    this.notifyStateChange();
    return true;
  };

  @action
  redo = () => {
    if (this.redoStack.length === 0) return false;

    const redoItem = this.redoStack.pop();
    this.undoStack.push(redoItem);

    // Restore state
    this.restoreState(redoItem.state);
    this.notifyStateChange();
    return true;
  };

  restoreState = (state) => {
    if (state.timelineHeight) this.timelineHeight = state.timelineHeight;
    if (state.timelineSelectedItems) this.timelineSelectedItems = state.timelineSelectedItems;
    if (state.zoom) this.zoomState.zoom = state.zoom;
    if (state.elementTrim) {
      Object.entries(state.elementTrim).forEach(([id, trimState]) => {
        this.elementTrimState.set(id, trimState);
      });
    }
    if (state.elementProperties) {
      Object.entries(state.elementProperties).forEach(([id, propState]) => {
        this.elementPropertyState.set(id, propState);
      });
    }
    if (state.elementTransitions) {
      Object.entries(state.elementTransitions).forEach(([id, transState]) => {
        this.elementTransitionState.set(id, transState);
      });
    }
  };

  // ============================================================================
  // BATCH UPDATES
  // ============================================================================

  @action
  batchUpdates = (updateFn) => {
    this.isBatching = true;
    this.batchChanges = [];

    try {
      updateFn();
    } finally {
      this.isBatching = false;
      if (this.batchChanges.length > 0) {
        // Push combined state to undo stack
        const combinedState = this.batchChanges.reduce((acc, change) => ({
          ...acc,
          ...change,
        }), {});
        this.undoStack.push({
          timestamp: Date.now(),
          state: combinedState,
        });
      }
      this.batchChanges = [];
      this.notifyStateChange();
    }
  };

  // ============================================================================
  // PUB/SUB FOR NON-MOBX COMPONENTS
  // ============================================================================

  listeners = new Set();

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  notifyStateChange = () => {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in timeline store listener:', error);
      }
    });
  };

  getState = () => ({
    timelineHeight: this.timelineHeight,
    isActiveTimeline: this.isActiveTimeline,
    timelineSelectedItems: this.timelineSelectedItems,
    copiedItems: this.copiedItems,
    activeRow: this.activeRow,
    timeOnClick: this.timeOnClick,
    contextMenu: this.contextMenu,
    zoom: this.zoomState.zoom,
    view: this.viewState,
    playback: this.playbackState,
    elementEditing: Object.fromEntries(this.elementEditingState),
    elementTrim: Object.fromEntries(this.elementTrimState),
    elementProperties: Object.fromEntries(this.elementPropertyState),
    elementTransitions: Object.fromEntries(this.elementTransitionState),
    elementOverlays: Object.fromEntries(this.elementOverlayState),
    elementAI: Object.fromEntries(this.elementAIState),
  });

  // ============================================================================
  // EXISTING METHODS (kept for compatibility)
  // ============================================================================

  handleUpdateCopiedItems = () => {
    this.copiedItems = this.copiedItems.filter(element => (
      this.projectStore.elements.some(projectElement => projectElement.id === element)
    ));

    if (!this.copiedItems.length) {
      this.setContextMenu({ buttons: [] });
    }
  };

  @action
  pasteElement = () => {
    if (!this.copiedItems.length) {
      return null;
    }

    let maxNewEnd = null;
    const updatedElements = [];
    const newItems = {};

    this.copiedItems.forEach(id => {
      const elementById = this.projectStore.getElementById(id);
      const currentLayer = this.projectStore.layers.find(item => item.id === elementById.track);

      if (!currentLayer) {
        return null;
      }

      if (!newItems[currentLayer.order]) {
        newItems[currentLayer.order] = [];
      }

      newItems[currentLayer.order].push({
        popcornOptions: { ...elementById.popcornOptions },
        type: elementById.type,
        track: elementById.track,
      });
    });

    if (!Object.keys(newItems).length) {
      return null;
    }

    const orders = [...Object.keys(newItems)];
    orders.sort((a, b) => b - a);

    orders.forEach(el => {
      newItems[el].sort((a, b) => {
        const firstElementStart = a.popcornOptions.start;
        const secondElementStart = b.popcornOptions.start;
        return firstElementStart - secondElementStart;
      });
    });

    const firstItemStart = newItems[orders[0]][0].popcornOptions.start;

    orders.forEach((order, i) => {
      let newRow;

      this.projectStore.layers.forEach((layer, j) => {
        if (layer.id === this.activeRow?.id && this.projectStore.layers[j - i]?.id) {
          newRow = this.projectStore.layers[j - i];
        }
      });

      const firstItemEndOnLayer = newItems[order][0].popcornOptions.end;

      newItems[order].forEach((copiedItem, j) => {
        const itemDuration = copiedItem.popcornOptions.end - copiedItem.popcornOptions.start;
        copiedItem.isNewItem = true;
        if (i === 0) {
          if (j === 0) {
            copiedItem.popcornOptions.start = this.timeOnClick;
            copiedItem.popcornOptions.end = this.timeOnClick + itemDuration;
          } else {
            copiedItem.popcornOptions.start = newItems[order][0].popcornOptions.end
              + (copiedItem.popcornOptions.start - firstItemEndOnLayer);
            copiedItem.popcornOptions.end = copiedItem.popcornOptions.start + itemDuration;
          }
        } else {
          let difference = 0;
          if (firstItemStart < copiedItem.popcornOptions.start) {
            difference = copiedItem.popcornOptions.start - firstItemStart;
          } else {
            difference = -(firstItemStart - copiedItem.popcornOptions.start);
          }

          if (j === 0) {
            let newStart = this.timeOnClick + difference;
            if (newStart < 0) {
              newStart = 0;
            }
            copiedItem.popcornOptions.start = newStart;
            copiedItem.popcornOptions.end = newStart + itemDuration;
          } else {
            copiedItem.popcornOptions.start = newItems[order][0].popcornOptions.end
              + (copiedItem.popcornOptions.start - firstItemEndOnLayer);
            copiedItem.popcornOptions.end = copiedItem.popcornOptions.start + itemDuration;
          }
        }

        copiedItem.track = newRow?.id || null;
        copiedItem.popcornOptions.track = newRow || null;
        maxNewEnd = copiedItem.popcornOptions.end;
      });

      const itemsOnNewRow = this.projectStore.elements.filter(element => {
        if (element.track === newRow?.id) {
          return element;
        }
        return null;
      });

      if (itemsOnNewRow?.length) {
        newItems[order].forEach(item => itemsOnNewRow.push(item));
        itemsOnNewRow.sort((a, b) => {
          if (a.popcornOptions.start < b.popcornOptions.start) {
            return -1;
          }
          if (a.popcornOptions.start > b.popcornOptions.start) {
            return 1;
          }
          if (a.popcornOptions.start === b.popcornOptions.start) {
            if (a.isNewItem) {
              return -1;
            } else {
              return 1;
            }
          }
          return 0;
        });

        itemsOnNewRow.forEach((el, k) => {
          const { start, end } = el.popcornOptions;
          const elDuration = end - start;
          if (itemsOnNewRow[k - 1] && start <= itemsOnNewRow[k - 1].popcornOptions.end) {
            const newStart = itemsOnNewRow[k - 1].popcornOptions.end + 0.01;
            const newEnd = newStart + elDuration;
            itemsOnNewRow[k].popcornOptions.start = newStart;
            itemsOnNewRow[k].popcornOptions.end = newEnd;
            if (newEnd > maxNewEnd) {
              maxNewEnd = newEnd;
            }
            if (!el.isNewItem) {
              updatedElements.push(el);
            }
          }
        });
      }
    });

    if (maxNewEnd > this.projectStore.duration / SANTISECOND) {
      this.projectStore.changeDuration(maxNewEnd);
    }

    if (updatedElements.length) {
      updatedElements.forEach((item) => {
        this.projectStore.updateStartEnd(
          item.id,
          item.popcornOptions.start,
          item.popcornOptions.end,
        );
      });
    }

    orders.forEach(order => {
      newItems[order].forEach(item => {
        this.projectStore.addElement({
          ...item.popcornOptions,
          type: item.type,
          blendMode: null,
          opacity: null,
          id: null,
        });
      });
    });

    this.setContextMenu({ isOpen: false });
  };

  @action
  releaseElement = () => {
    this.timelineSelectedItems = [];
    this.notifyStateChange();
  };
}
