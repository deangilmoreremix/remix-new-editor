import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('PopcornElement Enhancement Integration', () => {
  it('should integrate LineDuration for visual clip trimming', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify LineDuration import and usage
    expect(popcornElementContent).toContain('import LineDuration from \'../../../media/LineDuration\'');
    expect(popcornElementContent).toContain('<LineDuration');
    expect(popcornElementContent).toContain('duration={item.popcornOptions?.duration || 0}');
    expect(popcornElementContent).toContain('from={item.popcornOptions?.from || 0}');
    expect(popcornElementContent).toContain('to={item.popcornOptions?.to || (item.popcornOptions?.duration || 0)}');
  });

  it('should integrate ClipEditor for clip property management', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify ClipEditor import and usage
    expect(popcornElementContent).toContain('import ClipEditor from \'../../../settings/video-settings/tabs/ClipEditor\'');
    expect(popcornElementContent).toContain('<ClipEditor');
    expect(popcornElementContent).toContain('values={item.popcornOptions || {}}');
    expect(popcornElementContent).toContain('onChange={handleClipChange}');
  });

  it('should integrate VideoTransitionSettings for transition creation', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify VideoTransitionSettings import and usage
    expect(popcornElementContent).toContain('import VideoTransitionSettings from \'../../../settings/video-transition-settings/VideoTransitionSettings\'');
    expect(popcornElementContent).toContain('<VideoTransitionSettings');
    expect(popcornElementContent).toContain('element={selectedTransitionElement}');
    expect(popcornElementContent).toContain('update={handleTransitionUpdate}');
    expect(popcornElementContent).toContain('find={handleTransitionFind}');
  });

  it('should integrate OverlayListTransitions for overlay transitions', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify OverlayListTransitions import and usage
    expect(popcornElementContent).toContain('import OverlayListTransitions from \'../../../media/OverlayListTransitions\'');
    expect(popcornElementContent).toContain('<OverlayListTransitions />');
  });

  it('should have editing mode toggle functionality', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify editing mode state and toggle
    expect(popcornElementContent).toContain('const [editingMode, setEditingMode] = useState(false);');
    expect(popcornElementContent).toContain('const toggleEditing = () => {');
    expect(popcornElementContent).toContain('setEditingMode(!editingMode);');
    expect(popcornElementContent).toContain('onClick={toggleEditing}');
    expect(popcornElementContent).toContain('{editingMode && (');
  });

  it('should handle clip changes with callback', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify handleClipChange callback
    expect(popcornElementContent).toContain('const handleClipChange = useCallback((changes) => {');
    expect(popcornElementContent).toContain('onChange && onChange(changes);');
  });

  it('should integrate useProjectStore for project operations', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify useProjectStore usage
    expect(popcornElementContent).toContain('import useProjectStore from \'../../../hooks/useProjectStore\'');
    expect(popcornElementContent).toContain('const {');
    expect(popcornElementContent).toContain('findAndUpdate,');
    expect(popcornElementContent).toContain('updateVideoDuration,');
    expect(popcornElementContent).toContain('} = useProjectStore();');
  });

  it('should maintain backward compatibility with original element rendering', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify original ElementClass logic is preserved
    expect(popcornElementContent).toContain('const ElementClass = TIMELINE_COMPONENTS[item.type] || DefaultElement;');
    expect(popcornElementContent).toContain('const elementInstance = new ElementClass({');
    expect(popcornElementContent).toContain('item,');
    expect(popcornElementContent).toContain('className: `timeline-popcorn-${item.type}`,');
    expect(popcornElementContent).toContain('{elementInstance.render()}');
  });

  it('should be a functional React component', () => {
    const popcornElementPath = path.join(__dirname, '../../components/common/timeline/PopcornElement.js');
    const popcornElementContent = fs.readFileSync(popcornElementPath, 'utf8');

    // Verify it's a functional component
    expect(popcornElementContent).toContain('const PopcornElement = ({ item, onChange, fields, element }) => {');
    expect(popcornElementContent).toContain('import React, { useState, useCallback } from \'react\';');
    expect(popcornElementContent).toContain('export default PopcornElement;');
  });
});