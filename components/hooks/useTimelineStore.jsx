import { useState, useEffect, useCallback, useRef } from 'react';
import useStores from './useStores';

/**
 * Enhanced useTimelineStore hook
 * Provides full access to timeline state and actions
 * Includes reactive updates and helper methods for components
 */
export default () => {
  const { timelineStore } = useStores();
  const [localState, setLocalState] = useState(() => 
    timelineStore ? timelineStore.getState() : {}
  );
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!timelineStore) return;

    // Subscribe to store changes
    unsubscribeRef.current = timelineStore.subscribe((newState) => {
      setLocalState(newState);
    });

    // Initial state
    setLocalState(timelineStore.getState());

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [timelineStore]);

  // Core state accessors
  const timelineHeight = localState?.timelineHeight ?? 35;
  const isActiveTimeline = localState?.isActiveTimeline ?? false;
  const timelineSelectedItems = localState?.timelineSelectedItems ?? [];
  const copiedItems = localState?.copiedItems ?? [];
  const activeRow = localState?.activeRow ?? null;
  const timeOnClick = localState?.timeOnClick ?? null;
  const contextMenu = localState?.contextMenu ?? { isOpen: false, buttons: [] };
  const zoom = localState?.zoom ?? 1;
  const view = localState?.view ?? { scrollLeft: 0, visibleStartTime: 0, visibleEndTime: 60 };
  const playback = localState?.playback ?? { isPlaying: false, currentTime: 0, playbackRate: 1, loop: false };
  const elementEditing = localState?.elementEditing ?? {};
  const elementTrim = localState?.elementTrim ?? {};
  const elementProperties = localState?.elementProperties ?? {};
  const elementTransitions = localState?.elementTransitions ?? {};
  const elementOverlays = localState?.elementOverlays ?? {};
  const elementAI = localState?.elementAI ?? {};

  // Core actions (memoized)
  const setTimelineHeight = useCallback((value) => {
    timelineStore?.setTimelineHeight?.(value);
  }, [timelineStore]);

  const setIsActiveTimeline = useCallback((value) => {
    timelineStore?.setIsActiveTimeline?.(value);
  }, [timelineStore]);

  const setTimelineSelectedItems = useCallback((ids) => {
    timelineStore?.setTimelineSelectedItems?.(ids);
  }, [timelineStore]);

  const setCopiedItems = useCallback(() => {
    timelineStore?.setCopiedItems?.();
  }, [timelineStore]);

  const setActiveRow = useCallback((track) => {
    timelineStore?.setActiveRow?.(track);
  }, [timelineStore]);

  const setTimeOnClick = useCallback((time) => {
    timelineStore?.setTimeOnClick?.(time);
  }, [timelineStore]);

  const setContextMenu = useCallback((data) => {
    timelineStore?.setContextMenu?.(data);
  }, [timelineStore]);

  const releaseElement = useCallback(() => {
    timelineStore?.releaseElement?.();
  }, [timelineStore]);

  // Element editing actions
  const setElementEditingState = useCallback((elementId, state) => {
    timelineStore?.setElementEditingState?.(elementId, state);
  }, [timelineStore]);

  const setElementTrimState = useCallback((elementId, state) => {
    timelineStore?.setElementTrimState?.(elementId, state);
  }, [timelineStore]);

  const updateElementTrimStart = useCallback((elementId, trimStart) => {
    timelineStore?.updateElementTrimStart?.(elementId, trimStart);
  }, [timelineStore]);

  const updateElementTrimEnd = useCallback((elementId, trimEnd) => {
    timelineStore?.updateElementTrimEnd?.(elementId, trimEnd);
  }, [timelineStore]);

  const handleTrimChange = useCallback((elementId, changes) => {
    timelineStore?.handleTrimChange?.(elementId, changes);
  }, [timelineStore]);

  // Property management actions
  const setElementPropertyState = useCallback((elementId, state) => {
    timelineStore?.setElementPropertyState?.(elementId, state);
  }, [timelineStore]);

  const updateElementProperty = useCallback((elementId, key, value) => {
    timelineStore?.updateElementProperty?.(elementId, key, value);
  }, [timelineStore]);

  const handlePropertyChange = useCallback((elementId, changes) => {
    timelineStore?.handlePropertyChange?.(elementId, changes);
  }, [timelineStore]);

  // Transition actions
  const setElementTransitionState = useCallback((elementId, state) => {
    timelineStore?.setElementTransitionState?.(elementId, state);
  }, [timelineStore]);

  const addElementTransition = useCallback((elementId, type, transition) => {
    timelineStore?.addElementTransition?.(elementId, type, transition);
  }, [timelineStore]);

  const updateElementTransition = useCallback((elementId, type, options) => {
    timelineStore?.updateElementTransition?.(elementId, type, options);
  }, [timelineStore]);

  const removeElementTransition = useCallback((elementId, type) => {
    timelineStore?.removeElementTransition?.(elementId, type);
  }, [timelineStore]);

  // Overlay actions
  const setElementOverlayState = useCallback((elementId, state) => {
    timelineStore?.setElementOverlayState?.(elementId, state);
  }, [timelineStore]);

  const addElementOverlay = useCallback((elementId, overlay) => {
    timelineStore?.addElementOverlay?.(elementId, overlay);
  }, [timelineStore]);

  const removeElementOverlay = useCallback((elementId, overlayIndex) => {
    timelineStore?.removeElementOverlay?.(elementId, overlayIndex);
  }, [timelineStore]);

  // AI generation actions
  const setElementAIState = useCallback((elementId, state) => {
    timelineStore?.setElementAIState?.(elementId, state);
  }, [timelineStore]);

  const setElementGenerating = useCallback((elementId, isGenerating, generationId) => {
    timelineStore?.setElementGenerating?.(elementId, isGenerating, generationId);
  }, [timelineStore]);

  const setElementGenerationComplete = useCallback((elementId, assetId) => {
    timelineStore?.setElementGenerationComplete?.(elementId, assetId);
  }, [timelineStore]);

  const setElementGenerationError = useCallback((elementId, error) => {
    timelineStore?.setElementGenerationError?.(elementId, error);
  }, [timelineStore]);

  const clearElementAIState = useCallback((elementId) => {
    timelineStore?.clearElementAIState?.(elementId);
  }, [timelineStore]);

  // Selection actions
  const addToSelection = useCallback((itemId) => {
    timelineStore?.addToSelection?.(itemId);
  }, [timelineStore]);

  const removeFromSelection = useCallback((itemId) => {
    timelineStore?.removeFromSelection?.(itemId);
  }, [timelineStore]);

  const toggleItemSelection = useCallback((itemId) => {
    timelineStore?.toggleItemSelection?.(itemId);
  }, [timelineStore]);

  const selectAllOnLayer = useCallback((layerId) => {
    timelineStore?.selectAllOnLayer?.(layerId);
  }, [timelineStore]);

  const clearSelection = useCallback(() => {
    timelineStore?.clearSelection?.();
  }, [timelineStore]);

  // Zoom actions
  const setZoom = useCallback((zoom) => {
    timelineStore?.setZoom?.(zoom);
  }, [timelineStore]);

  const zoomIn = useCallback(() => {
    timelineStore?.zoomIn?.();
  }, [timelineStore]);

  const zoomOut = useCallback(() => {
    timelineStore?.zoomOut?.();
  }, [timelineStore]);

  const resetZoom = useCallback(() => {
    timelineStore?.resetZoom?.();
  }, [timelineStore]);

  const setScrollPosition = useCallback((scrollLeft) => {
    timelineStore?.setScrollPosition?.(scrollLeft);
  }, [timelineStore]);

  const setVisibleTimeRange = useCallback((startTime, endTime) => {
    timelineStore?.setVisibleTimeRange?.(startTime, endTime);
  }, [timelineStore]);

  // Playback actions
  const setPlaying = useCallback((isPlaying) => {
    timelineStore?.setPlaying?.(isPlaying);
  }, [timelineStore]);

  const togglePlayback = useCallback(() => {
    timelineStore?.togglePlayback?.();
  }, [timelineStore]);

  const setCurrentTime = useCallback((time) => {
    timelineStore?.setCurrentTime?.(time);
  }, [timelineStore]);

  const setPlaybackRate = useCallback((rate) => {
    timelineStore?.setPlaybackRate?.(rate);
  }, [timelineStore]);

  const toggleLoop = useCallback(() => {
    timelineStore?.toggleLoop?.();
  }, [timelineStore]);

  // State sync actions
  const syncElementState = useCallback((element) => {
    timelineStore?.syncElementState?.(element);
  }, [timelineStore]);

  const getElementState = useCallback((elementId) => {
    return timelineStore?.getElementState?.(elementId);
  }, [timelineStore]);

  const clearElementState = useCallback((elementId) => {
    timelineStore?.clearElementState?.(elementId);
  }, [timelineStore]);

  const clearAllEditingState = useCallback(() => {
    timelineStore?.clearAllEditingState?.();
  }, [timelineStore]);

  // Undo/Redo actions
  const pushUndoState = useCallback((state) => {
    timelineStore?.pushUndoState?.(state);
  }, [timelineStore]);

  const undo = useCallback(() => {
    return timelineStore?.undo?.();
  }, [timelineStore]);

  const redo = useCallback(() => {
    return timelineStore?.redo?.();
  }, [timelineStore]);

  const batchUpdates = useCallback((updateFn) => {
    timelineStore?.batchUpdates?.(updateFn);
  }, [timelineStore]);

  // Helper methods
  const isElementSelected = useCallback((elementId) => {
    return timelineSelectedItems.includes(elementId);
  }, [timelineSelectedItems]);

  const getElementTrimState = useCallback((elementId) => {
    return elementTrim[elementId] || null;
  }, [elementTrim]);

  const getElementPropertyState = useCallback((elementId) => {
    return elementProperties[elementId] || null;
  }, [elementProperties]);

  const getElementTransitionState = useCallback((elementId) => {
    return elementTransitions[elementId] || null;
  }, [elementTransitions]);

  const getElementAIState = useCallback((elementId) => {
    return elementAI[elementId] || null;
  }, [elementAI]);

  const isElementGenerating = useCallback((elementId) => {
    return elementAI[elementId]?.isGenerating ?? false;
  }, [elementAI]);

  const hasElementGenerationError = useCallback((elementId) => {
    return elementAI[elementId]?.generationError ?? null;
  }, [elementAI]);

  const isElementGenerated = useCallback((elementId) => {
    return elementAI[elementId]?.generated ?? false;
  }, [elementAI]);

  // Legacy paste action
  const pasteElement = useCallback(() => {
    timelineStore?.pasteElement?.();
  }, [timelineStore]);

  return {
    // Core state
    timelineStore,
    timelineHeight,
    isActiveTimeline,
    timelineSelectedItems,
    copiedItems,
    activeRow,
    timeOnClick,
    contextMenu,
    zoom,
    view,
    playback,
    elementEditing,
    elementTrim,
    elementProperties,
    elementTransitions,
    elementOverlays,
    elementAI,

    // Core actions
    setTimelineHeight,
    setIsActiveTimeline,
    setTimelineSelectedItems,
    setCopiedItems,
    setActiveRow,
    setTimeOnClick,
    setContextMenu,
    releaseElement,

    // Element editing
    setElementEditingState,
    setElementTrimState,
    updateElementTrimStart,
    updateElementTrimEnd,
    handleTrimChange,

    // Property management
    setElementPropertyState,
    updateElementProperty,
    handlePropertyChange,

    // Transitions
    setElementTransitionState,
    addElementTransition,
    updateElementTransition,
    removeElementTransition,

    // Overlays
    setElementOverlayState,
    addElementOverlay,
    removeElementOverlay,

    // AI generation
    setElementAIState,
    setElementGenerating,
    setElementGenerationComplete,
    setElementGenerationError,
    clearElementAIState,

    // Selection
    addToSelection,
    removeFromSelection,
    toggleItemSelection,
    selectAllOnLayer,
    clearSelection,
    isElementSelected,

    // Zoom
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setScrollPosition,
    setVisibleTimeRange,

    // Playback
    setPlaying,
    togglePlayback,
    setCurrentTime,
    setPlaybackRate,
    toggleLoop,

    // State sync
    syncElementState,
    getElementState,
    clearElementState,
    clearAllEditingState,

    // Undo/Redo
    pushUndoState,
    undo,
    redo,
    batchUpdates,

    // Helpers
    getElementTrimState,
    getElementPropertyState,
    getElementTransitionState,
    getElementAIState,
    isElementGenerating,
    hasElementGenerationError,
    isElementGenerated,

    // Legacy
    pasteElement,
  };
};
