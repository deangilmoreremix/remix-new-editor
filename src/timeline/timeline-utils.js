/**
 * Timeline utility functions used by timeline tests.
 */

export function formatTime(seconds) {
  const safe = Number(seconds) || 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const cents = Math.floor((safe - Math.floor(safe)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`;
}

export function pixelsToTime(pixels, timelineWidth, durationSeconds) {
  if (!timelineWidth || !durationSeconds) return 0;
  return (pixels / timelineWidth) * durationSeconds;
}

export function timeToPixels(timeSeconds, timelineWidth, durationSeconds) {
  if (!timelineWidth || !durationSeconds) return 0;
  return (timeSeconds / durationSeconds) * timelineWidth;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
