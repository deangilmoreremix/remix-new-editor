/**
 * Timeline event binding and drag handling utilities.
 */

export function bindTrackEvents(element, track, state, renderer) {
  if (!element) return;
  element.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-toggle="mute"]');
    if (btn) {
      track.muted = !track.muted;
      if (typeof renderer?.renderTracks === 'function') renderer.renderTracks();
    }
  });
}

export function bindClipEvents(element, item, state, renderer) {
  if (!element) return;
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    if (typeof state?.selectItem === 'function') state.selectItem(item.id);
  });
}

export function bindTimelineEvents(element, state) {
  if (!element) return;
  element.addEventListener('click', (event) => {
    const rect = element.getBoundingClientRect?.() || { left: 0, width: 1000 };
    const x = event.clientX - rect.left;
    const percent = Math.round((x / rect.width) * 100);
    if (typeof state?.updatePlayhead === 'function') state.updatePlayhead(percent);
  });
}

export function handleClipDrag(item, phase, event, dragData) {
  if (phase === 'start') {
    return {
      startX: event.clientX,
      originalX: item.x || 0,
    };
  }

  if (phase === 'move' && dragData) {
    const deltaX = event.clientX - dragData.startX;
    return {
      newX: dragData.originalX + deltaX,
    };
  }

  return {};
}

export function handlePlayheadDrag(event, timelineWidth) {
  if (!timelineWidth) return 0;
  const rect = { left: 0, width: timelineWidth };
  const x = event.clientX - rect.left;
  return Math.round((x / rect.width) * 100);
}
