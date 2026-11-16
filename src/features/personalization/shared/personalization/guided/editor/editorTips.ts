/**
 * Every tooltip in the editor lives here, so the copy is reviewable in one place and a test can check
 * that each control's tip exists. Each tip says what the control does and how to use it; shortcuts
 * and credit cost are separate fields so they render consistently.
 */
export interface EditorTip {
  /** What it does and how to use it. One or two short sentences. */
  text: string
  /** Keyboard shortcut or modifier, shown as a badge. */
  shortcut?: string
  /** True for actions that spend account credits (shown with a coin badge). */
  paid?: boolean
  /** True for actions that are explicitly free, so people are not left wondering. */
  free?: boolean
}

export const EDITOR_TIPS = {
  // ── toolbar ──────────────────────────────────────────────────────────
  undo: { text: 'Undo your last change to the layout, colors or text.', shortcut: '⌘Z / Ctrl+Z' },
  redo: { text: 'Redo the change you just undid.', shortcut: '⇧⌘Z / Ctrl+Shift+Z' },
  snap: { text: 'Snap layers to the frame center, thirds, safe edges and to each other while you drag. Pink lines show what it lined up with.', shortcut: 'Hold Alt to turn off while dragging' },
  restoreLayout: { text: 'Put every layer back where this layout starts. Your text, colors and images are kept.' },

  // ── live stage ───────────────────────────────────────────────────────
  livePlay: { text: 'Play or pause the live preview. Grabbing a layer pauses it so you can place it exactly.', shortcut: 'Space on the scrubber' },
  liveToggle: { text: 'Edit on the live, animated video, or switch to the still image if it is slow or the video cannot play.' },

  // ── handles on the selected layer ────────────────────────────────────
  resizeHandle: { text: 'Drag to resize. Corners and edges both keep the proportions, and the opposite side stays where it is.', shortcut: 'Arrow keys: 2% · Shift: 10%' },
  rotateHandle: { text: 'Drag to rotate the layer. Double-click to set it straight again.', shortcut: 'Shift: 15° steps · Arrows: 1°' },
  inspectorTabs: { text: 'Content is the text, image and colors. Layout is size, opacity, rotation and position. Timing is the animation and when the layer is on screen.' },
  rotationField: { text: 'Type an exact rotation in degrees. Positive turns clockwise.' },

  // ── layers list ──────────────────────────────────────────────────────
  layerReorder: { text: 'Drag to change what is in front. The top of the list is the frontmost layer.', shortcut: 'Keyboard: Space, ↑/↓, Space' },
  layerVisibility: { text: 'Show or hide this layer in the video.' },

  // ── floating layer toolbar ───────────────────────────────────────────
  layerForward: { text: 'Bring this layer one step in front of the others.' },
  layerBackward: { text: 'Send this layer one step behind the others.' },
  layerLock: { text: 'Lock the position so dragging, resizing and automatic placement leave it alone.' },
  layerHide: { text: 'Hide this layer from the video. You can show it again from the layers list.', shortcut: 'Delete' },

  // ── timeline ─────────────────────────────────────────────────────────
  timelineBar: { text: 'Drag the bar to change when this layer is on screen. Drag an edge to trim it.', shortcut: 'Arrow keys: 1 frame · Shift: 10' },

  // ── inspector ────────────────────────────────────────────────────────
  textColor: { text: 'Pick the text color. The picker shows how readable it is on your video and can choose white or dark for you.' },
  buttonColor: { text: 'Pick the button color. The label switches between dark and white so it stays readable.' },

  // ── layout quality check ─────────────────────────────────────────────
  qualityReview: { text: 'Open the full layout check: every problem found, with buttons to show it on the video or fix it.' },
  qualityFixAll: { text: 'Apply the recommended placement. Layers you placed by hand or locked are never moved.', free: true },

  // ── making the video ─────────────────────────────────────────────────
  renderBranded: { text: 'Burns your approved overlays (logo, text, call to action, end card) onto the selected video in your browser.', free: true },
  removeBranding: { text: 'Uses AI to erase logos, watermarks and captions that are already part of the video. It asks you to confirm the cost first and keeps your original video.', paid: true },
  generateAi: { text: 'Uses AI to create new imagery or footage for changes overlays cannot do. Uses your account credits.', paid: true },
} as const satisfies Record<string, EditorTip>

export type EditorTipId = keyof typeof EDITOR_TIPS
