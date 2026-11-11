// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (apps/video-agent-studio), vendored.
const MIN_PREVIEW_ZOOM = 1;
const MAX_PREVIEW_ZOOM = 4;
const PREVIEW_ZOOM_STEP = 1.12;

export function nextTrackingZoom(current: number, deltaY: number): number {
  const factor = deltaY < 0 ? PREVIEW_ZOOM_STEP : 1 / PREVIEW_ZOOM_STEP;
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, current * factor));
}

export const INITIAL_TRACKING_ZOOM = MIN_PREVIEW_ZOOM;
