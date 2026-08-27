/**
 * React Panel Bridge — Wires React-based timeline-editor panels
 * into the vanilla JS TimelineEditorPage.
 *
 * Features:
 * 9.11 Wire React panels (ClipPropertiesPanel, AssetsPanel, TimelineEditingPanel)
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClipPropertiesPanel } from '../timeline-editor/ClipPropertiesPanel.tsx';
import { AssetsPanel } from '../timeline-editor/AssetsPanel.tsx';
import { TimelineEditingPanel } from '../timeline-editor/TimelineEditingPanel.tsx';

// Store roots for cleanup
const roots = new Map();

/**
 * Mount ClipPropertiesPanel into a container
 */
export function mountClipPropertiesPanel(container, props) {
  if (!container) return;

  // Clean up existing root
  if (roots.has(container)) {
    roots.get(container).unmount();
  }

  const root = createRoot(container);
  roots.set(container, root);

  root.render(
    React.createElement(ClipPropertiesPanel, {
      selectedClip: props.selectedClip || null,
      tracks: props.tracks || [],
      rightPanelWidth: props.rightPanelWidth || 320,
      onUpdateClip: props.onUpdateClip || (() => {}),
      onDeleteClip: props.onDeleteClip || (() => {})
    })
  );

  return root;
}

/**
 * Mount AssetsPanel into a container
 */
export function mountAssetsPanel(container, props) {
  if (!container) return;

  if (roots.has(container)) {
    roots.get(container).unmount();
  }

  const root = createRoot(container);
  roots.set(container, root);

  root.render(
    React.createElement(AssetsPanel, {
      assets: props.assets || [],
      onImport: props.onImport || (() => {}),
      onGenerate: props.onGenerate || (() => {})
    })
  );

  return root;
}

/**
 * Mount TimelineEditingPanel into a container
 */
export function mountTimelineEditingPanel(container, props) {
  if (!container) return;

  if (roots.has(container)) {
    roots.get(container).unmount();
  }

  const root = createRoot(container);
  roots.set(container, root);

  root.render(
    React.createElement(TimelineEditingPanel, {
      tracks: props.tracks || [],
      selectedClipId: props.selectedClipId || null,
      zoom: props.zoom || 1,
      playheadPercent: props.playheadPercent || 0,
      onSelectClip: props.onSelectClip || (() => {}),
      onUpdateTrack: props.onUpdateTrack || (() => {}),
      onZoomChange: props.onZoomChange || (() => {})
    })
  );

  return root;
}

/**
 * Unmount a specific panel
 */
export function unmountPanel(container) {
  if (roots.has(container)) {
    roots.get(container).unmount();
    roots.delete(container);
  }
}

/**
 * Unmount all panels
 */
export function unmountAllPanels() {
  roots.forEach(root => root.unmount());
  roots.clear();
}

export default {
  mountClipPropertiesPanel,
  mountAssetsPanel,
  mountTimelineEditingPanel,
  unmountPanel,
  unmountAllPanels
};
