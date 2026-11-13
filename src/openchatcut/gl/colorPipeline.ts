// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (apps/video-agent-studio), vendored with [remix] edits only where marked.
/** Player and export both upload DOM media as sRGB bytes without browser conversion. */
export const GL_COLOR_PIPELINE = Object.freeze({
  texture: 'srgb',
  framebuffer: 'srgb',
  unpackConversion: 'none',
} as const);
