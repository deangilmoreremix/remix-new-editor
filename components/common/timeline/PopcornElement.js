import React, { useState, useCallback } from 'react';
import { TIMELINE_COMPONENTS } from '../../../lib/constants/timeline';
import DefaultElement from './elements/DefaultElement.js';
import LineDuration from '../../../media/LineDuration';
import ClipEditor from '../../../settings/video-settings/tabs/ClipEditor';
import VideoTransitionSettings from '../../../settings/video-transition-settings/VideoTransitionSettings';
import OverlayListTransitions from '../../../media/OverlayListTransitions';
import useProjectStore from '../../../hooks/useProjectStore';

const PopcornElement = ({ item, onChange, fields, element }) => {
  const [editingMode, setEditingMode] = useState(false);
  const [selectedTransitionElement, setSelectedTransitionElement] = useState(null);

  const {
    findAndUpdate,
    updateVideoDuration,
    elements,
    projectData,
    duration: clipDuration,
    updateElementFromTimeline,
    removeTransition,
  } = useProjectStore();

  const ElementClass = TIMELINE_COMPONENTS[item.type] || DefaultElement;

  if (!ElementClass) {
    return null;
  }

  const elementInstance = new ElementClass({
    item,
    className: `timeline-popcorn-${item.type}`,
  });

  const handleClipChange = useCallback((changes) => {
    onChange && onChange(changes);
  }, [onChange]);

  const handleTransitionUpdate = useCallback((options) => {
    findAndUpdate(selectedTransitionElement.id, options);
  }, [selectedTransitionElement, findAndUpdate]);

  const handleTransitionFind = useCallback((id) => {
    return elements.find(el => el.id === id);
  }, [elements]);

  const toggleEditing = () => {
    setEditingMode(!editingMode);
  };

  return (
    <div className="popcorn-element-container">
      <div className="popcorn-element-base" onClick={toggleEditing}>
        {elementInstance.render()}
      </div>
      {editingMode && (
        <div className="popcorn-element-editor">
          {/* Visual Clip Trimming */}
          <div className="editor-section trimming">
            <h4>Trim Clip</h4>
            <LineDuration
              duration={item.popcornOptions?.duration || 0}
              from={item.popcornOptions?.from || 0}
              to={item.popcornOptions?.to || (item.popcornOptions?.duration || 0)}
              changeFrom={(field) => handleClipChange({ from: field.from })}
              changeOut={(field) => handleClipChange({ end: field.out })}
              updateFrom={(field) => handleClipChange(field)}
            />
          </div>

          {/* Clip Property Management */}
          <div className="editor-section properties">
            <h4>Clip Properties</h4>
            <ClipEditor
              values={item.popcornOptions || {}}
              fields={fields || {}}
              element={element || item}
              onChange={handleClipChange}
            />
          </div>

          {/* Transition Creation */}
          {selectedTransitionElement && (
            <div className="editor-section transitions">
              <h4>Create Transition</h4>
              <VideoTransitionSettings
                element={selectedTransitionElement}
                update={handleTransitionUpdate}
                find={handleTransitionFind}
                fields={{}}
              />
            </div>
          )}

          {/* Overlay Transitions */}
          <div className="editor-section overlays">
            <h4>Overlay Transitions</h4>
            <OverlayListTransitions />
          </div>
        </div>
      )}
    </div>
  );
};

export default PopcornElement;
