/**
 * Timeline rendering utilities.
 */

export function renderTrack(track) {
  const row = document.createElement('div');
  row.className = 'track-row';
  const nameEl = document.createElement('div');
  nameEl.className = 'track-name';
  nameEl.textContent = track.name || '';
  row.appendChild(nameEl);

  if (track.locked) {
    row.classList.add('locked');
  }

  return row;
}

export function renderClip(item) {
  const clip = document.createElement('div');
  clip.className = 'clip';
  if (item.type) {
    clip.classList.add(item.type);
  }
  clip.style.left = `${item.x ?? 0}%`;
  clip.style.width = `${item.width ?? 100}px`;
  return clip;
}

export function renderPlayhead(percent) {
  const el = document.createElement('div');
  el.className = 'playhead-line';
  el.style.left = `${percent}%`;
  return el;
}

export function updateTrackPositions(tracks, timelineWidth, duration) {
  if (!timelineWidth || !duration) return;
  tracks.forEach(track => {
    (track.items || []).forEach(item => {
      item.x = Math.round((item.start / duration) * timelineWidth);
      item.width = Math.round(((item.end - item.start) / duration) * timelineWidth);
    });
  });
}
