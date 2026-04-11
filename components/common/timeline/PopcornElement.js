import React, { useState, useCallback, useEffect } from 'react';
import { TIMELINE_COMPONENTS } from '../../../lib/constants/timeline';
import DefaultElement from './elements/DefaultElement.js';
import LineDuration from '../../../media/LineDuration';
import ClipEditor from '../../../settings/video-settings/tabs/ClipEditor';
import VideoTransitionSettings from '../../../settings/video-transition-settings/VideoTransitionSettings';
import OverlayListTransitions from '../../../media/OverlayListTransitions';
import useProjectStore from '../../../hooks/useProjectStore';
import useTimelineStore from '../../../hooks/useTimelineStore';

/**
 * Enhanced PopcornElement with deep timeline store integration
 * Fully synchronized state management for trimming, properties, transitions, and AI generation
 */
const PopcornElement = ({ item, onChange, fields, element }) => {
  const [localEditingMode, setLocalEditingMode] = useState(false);
  const [selectedTransitionElement, setSelectedTransitionElement] = useState(null);

  // Get project store
  const {
    findAndUpdate,
    updateVideoDuration,
    elements,
    projectData,
    duration: clipDuration,
    updateElementFromTimeline,
    removeTransition,
  } = useProjectStore();

  // Get timeline store with full state and actions
  const {
    // Element state
    getElementTrimState,
    getElementPropertyState,
    getElementTransitionState,
    getElementAIState,
    
    // Actions
    setElementEditingState,
    handleTrimChange,
    handlePropertyChange,
    addElementTransition,
    updateElementTransition,
    removeElementTransition,
    setElementGenerating,
    setElementGenerationComplete,
    setElementGenerationError,
    setElementOverlayState,
    addElementOverlay,
    removeElementOverlay,
    syncElementState,
    clearElementState,
    
    // Selection
    isElementSelected,
    addToSelection,
    removeFromSelection,
    
    // Undo
    pushUndoState,
  } = useTimelineStore();

  const elementId = item?.i || item?.id;
  const isSelected = isElementSelected(elementId);

  // Sync element state with timeline store on mount
  useEffect(() => {
    if (elementId && element) {
      syncElementState({
        id: elementId,
        ...element,
      });
    }

    return () => {
      if (elementId) {
        clearElementState(elementId);
      }
    };
  }, [elementId]);

  // Get synchronized state from timeline store
  const trimState = getElementTrimState(elementId);
  const propertyState = getElementPropertyState(elementId);
  const transitionState = getElementTransitionState(elementId);
  const aiState = getElementAIState(elementId);

  const ElementClass = TIMELINE_COMPONENTS[item.type] || DefaultElement;

  if (!ElementClass) {
    return null;
  }

  const elementInstance = new ElementClass({
    item,
    className: `timeline-popcorn-${item.type}`,
  });

  // ============================================================================
  // EDITING MODE HANDLERS
  // ============================================================================

  const toggleEditing = useCallback(() => {
    const newMode = !localEditingMode;
    setLocalEditingMode(newMode);
    setElementEditingState(elementId, { isEditing: newMode, mode: newMode ? 'full' : null });
  }, [localEditingMode, elementId, setElementEditingState]);

  const setEditingMode = useCallback((mode) => {
    setLocalEditingMode(mode);
    setElementEditingState(elementId, { isEditing: mode, mode: mode ? 'full' : null });
  }, [elementId, setElementEditingState]);

  // ============================================================================
  // TRIMMING HANDLERS (synced with timeline store)
  // ============================================================================

  const handleClipChange = useCallback((changes) => {
    // Push undo state before change
    pushUndoState({
      elementTrim: { [elementId]: trimState },
    });
    
    // Update timeline store (which syncs with project store)
    handleTrimChange(elementId, changes);
    
    // Call original onChange if provided
    onChange && onChange(changes);
  }, [elementId, onChange, handleTrimChange, pushUndoState, trimState]);

  const handleTrimStart = useCallback((from) => {
    handleClipChange({ from });
  }, [handleClipChange]);

  const handleTrimEnd = useCallback((end) => {
    handleClipChange({ end });
  }, [handleClipChange]);

  // ============================================================================
  // PROPERTY HANDLERS (synced with timeline store)
  // ============================================================================

  const handlePropertyUpdate = useCallback((changes) => {
    // Push undo state before change
    pushUndoState({
      elementProperties: { [elementId]: propertyState },
    });
    
    // Update timeline store (which syncs with project store)
    handlePropertyChange(elementId, changes);
    
    // Call original onChange if provided
    onChange && onChange(changes);
  }, [elementId, onChange, handlePropertyChange, pushUndoState, propertyState]);

  // ============================================================================
  // TRANSITION HANDLERS (synced with timeline store)
  // ============================================================================

  const handleTransitionCreate = useCallback((type, transition) => {
    pushUndoState({
      elementTransitions: { [elementId]: transitionState },
    });
    
    addElementTransition(elementId, type, transition);
    setSelectedTransitionElement({
      id: elementId,
      type: transition.type,
      ...transition,
    });
  }, [elementId, addElementTransition, pushUndoState, transitionState]);

  const handleTransitionUpdate = useCallback((options) => {
    if (!selectedTransitionElement) return;
    
    pushUndoState({
      elementTransitions: { [elementId]: transitionState },
    });
    
    const type = selectedTransitionElement.type === 'in' ? 'in' : 'out';
    updateElementTransition(elementId, type, options);
    findAndUpdate(selectedTransitionElement.id, options);
  }, [selectedTransitionElement, elementId, updateElementTransition, findAndUpdate, pushUndoState, transitionState]);

  const handleTransitionRemove = useCallback((type) => {
    pushUndoState({
      elementTransitions: { [elementId]: transitionState },
    });
    
    removeElementTransition(elementId, type);
    removeTransition();
  }, [elementId, removeElementTransition, removeTransition, pushUndoState, transitionState]);

  const handleTransitionFind = useCallback((id) => {
    return elements.find(el => el.id === id);
  }, [elements]);

  // ============================================================================
  // OVERLAY HANDLERS (synced with timeline store)
  // ============================================================================

  const handleOverlayAdd = useCallback((overlay) => {
    const currentOverlays = item?.overlays || [];
    pushUndoState({
      elementOverlays: { [elementId]: { overlays: currentOverlays } },
    });
    
    addElementOverlay(elementId, overlay);
    findAndUpdate(elementId, {
      overlays: [...currentOverlays, overlay],
    });
  }, [elementId, item?.overlays, addElementOverlay, findAndUpdate, pushUndoState]);

  const handleOverlayRemove = useCallback((index) => {
    const currentOverlays = item?.overlays || [];
    pushUndoState({
      elementOverlays: { [elementId]: { overlays: currentOverlays } },
    });
    
    removeElementOverlay(elementId, index);
    findAndUpdate(elementId, {
      overlays: currentOverlays.filter((_, i) => i !== index),
    });
  }, [elementId, item?.overlays, removeElementOverlay, findAndUpdate, pushUndoState]);

  // ============================================================================
  // AI GENERATION HANDLERS (synced with timeline store)
  // ============================================================================

  const handleAIGenerationStart = useCallback((generationId) => {
    setElementGenerating(elementId, true, generationId);
  }, [elementId, setElementGenerating]);

  const handleAIGenerationComplete = useCallback((assetId) => {
    setElementGenerationComplete(elementId, assetId);
  }, [elementId, setElementGenerationComplete]);

  const handleAIGenerationError = useCallback((error) => {
    setElementGenerationError(elementId, error);
  }, [elementId, setElementGenerationError]);

  // ============================================================================
  // SELECTION HANDLERS
  // ============================================================================

  const handleElementClick = useCallback((e) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      if (isSelected) {
        removeFromSelection(elementId);
      } else {
        addToSelection(elementId);
      }
    } else {
      // Single selection
      // Note: This would be handled by the parent component
    }
  }, [elementId, isSelected, addToSelection, removeFromSelection]);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const editingMode = localEditingMode;
  const trimDuration = trimState?.duration || item.popcornOptions?.duration || 0;
  const trimFrom = trimState?.trimStart ?? item.popcornOptions?.from ?? 0;
  const trimTo = trimState?.trimEnd ?? item.popcornOptions?.to ?? trimDuration;
  const properties = propertyState || item.popcornOptions || {};
  const transitionIn = transitionState?.transitionIn || item.transitions?.in || null;
  const transitionOut = transitionState?.transitionOut || item.transitions?.out || null;
  const isGenerating = aiState?.isGenerating || false;
  const generationError = aiState?.generationError || null;
  const isGenerated = aiState?.generated || item.generated || false;

  return (
    <div 
      className={`popcorn-element-container ${isSelected ? 'selected' : ''}`}
      data-element-id={elementId}
    >
      <div 
        className="popcorn-element-base" 
        onClick={handleElementClick}
        onDoubleClick={toggleEditing}
      >
        {elementInstance.render()}
        {isSelected && <div className="selection-indicator" />}
        {isGenerated && <span className="ai-indicator">🤖</span>}
      </div>
      
      {editingMode && (
        <div className="popcorn-element-editor">
          {/* Visual Clip Trimming */}
          <div className="editor-section trimming">
            <h4>Trim Clip</h4>
            <LineDuration
              duration={trimDuration}
              from={trimFrom}
              to={trimTo}
              changeFrom={(field) => handleTrimStart(field.from)}
              changeOut={(field) => handleTrimEnd(field.out)}
              updateFrom={(field) => handleClipChange(field)}
            />
          </div>

          {/* Clip Property Management */}
          <div className="editor-section properties">
            <h4>Clip Properties</h4>
            <ClipEditor
              values={properties}
              fields={fields || {}}
              element={element || item}
              onChange={handlePropertyUpdate}
            />
          </div>

          {/* Transition Creation */}
          {(selectedTransitionElement || transitionIn || transitionOut) && (
            <div className="editor-section transitions">
              <h4>Transitions</h4>
              {transitionIn && (
                <div className="transition-item">
                  <span>In: {transitionIn.type}</span>
                  <button onClick={() => handleTransitionRemove('in')}>Remove</button>
                </div>
              )}
              {transitionOut && (
                <div className="transition-item">
                  <span>Out: {transitionOut.type}</span>
                  <button onClick={() => handleTransitionRemove('out')}>Remove</button>
                </div>
              )}
              {selectedTransitionElement && (
                <VideoTransitionSettings
                  element={selectedTransitionElement}
                  update={handleTransitionUpdate}
                  find={handleTransitionFind}
                  fields={{}}
                />
              )}
              <div className="transition-buttons">
                <button onClick={() => handleTransitionCreate('in', { type: 'fade', duration: 0.5 })}>
                  Add In Transition
                </button>
                <button onClick={() => handleTransitionCreate('out', { type: 'fade', duration: 0.5 })}>
                  Add Out Transition
                </button>
              </div>
            </div>
          )}

          {/* Overlay Transitions */}
          <div className="editor-section overlays">
            <h4>Overlay Transitions</h4>
            <OverlayListTransitions 
              onOverlaySelect={handleOverlayAdd}
              currentOverlays={item?.overlays || []}
              onOverlayRemove={handleOverlayRemove}
            />
          </div>

          {/* AI Generation Status */}
          {isGenerating && (
            <div className="editor-section ai-status">
              <h4>AI Generation</h4>
              <div className="generating-indicator">Generating...</div>
            </div>
          )}
          
          {generationError && (
            <div className="editor-section ai-error">
              <h4>Generation Error</h4>
              <div className="error-message">{generationError}</div>
            </div>
          )}

          {/* Close Editor Button */}
          <button className="close-editor-btn" onClick={toggleEditing}>
            Close Editor
          </button>
        </div>
      )}
    </div>
  );
};

export default PopcornElement;
