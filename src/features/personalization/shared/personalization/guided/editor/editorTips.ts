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

  keyframes: { text: 'Keyframes change a layer over time: move, resize, fade or tilt it between moments you choose. Add one at the playhead, add another later, and change a value. Your layer\'s own position and animation stay as they are.' },
  keyframeDiamond: { text: 'A keyframe. Click to jump to it, drag to move it in time.', shortcut: 'Arrow keys: 1 frame · Shift: 10' },

  // ── timeline ─────────────────────────────────────────────────────────
  timelineBar: { text: 'Drag the bar to change when this layer is on screen. Drag an edge to trim it.', shortcut: 'Arrow keys: 1 frame · Shift: 10' },

  // ── inspector ────────────────────────────────────────────────────────
  textColor: { text: 'Pick the text color. The picker shows how readable it is on your video and can choose white or dark for you.' },
  buttonColor: { text: 'Pick the button color. The label switches between dark and white so it stays readable.' },

  // ── color and look ───────────────────────────────────────────────────
  lookPresets: { text: 'One-click film looks. They only set the sliders below, so you can keep adjusting. Reset look puts the video back to normal.', free: true },
  lookLight: { text: 'Exposure makes the video brighter or darker (in camera stops), contrast separates light from dark, and the vignette darkens the corners.' },
  lookColor: { text: 'Saturation sets how colorful the video is (0 is black and white). Temperature and tint shift it warmer or cooler, greener or pinker.' },
  lookOverlay: { text: 'Pick a color and a strength to wash over the video, or use it for a glow around a layer.' },
  lookBlur: { text: 'Softens the whole video, for example behind a busy headline.' },
  layerEffects: { text: 'Effects for this layer only: brighten, darken, recolor, blur, or add a drop shadow or colored glow. Reset effects removes them.' },
  // ── presenter background ─────────────────────────────────────────────
  cutoutRemove: { text: 'Cut the person out of your video so they can stand on a different background. It runs in your browser, uses no credits, and your original video is kept.', free: true },
  cutoutRestore: { text: 'Go back to your original video, background included. Your background choices are kept if you turn it on again.' },
  cutoutBackground: { text: 'What appears behind the presenter: nothing, a color, a blurred copy of the video, one of your images, or another video.' },
  cutoutPresenter: { text: 'Where the presenter stands in the frame and how big they are. Use a preset or fine-tune the size, position and tilt.' },
  cutoutEdge: { text: 'Clean up the outline. Soften blends the edge; Edge shrinks it to remove a halo or grows it to bring back hair.' },
  cutoutColor: { text: 'Pick the background color.' },

  // ── audio mix ────────────────────────────────────────────────────────
  audioVideoSound: { text: 'The sound that is already in your video. Turn it down to let music or a voiceover come through, mute it, or solo it to hear only the video.' },
  audioAdd: { text: 'Add your own music or a voiceover. Each track has its own volume, fades, start time and mute and solo. Free, no credits.', free: true },

  // ── captions ─────────────────────────────────────────────────────────

  // ── layout quality check ─────────────────────────────────────────────
  qualityReview: { text: 'Open the full layout check: every problem found, with buttons to show it on the video or fix it.' },
  qualityFixAll: { text: 'Apply the recommended placement. Layers you placed by hand or locked are never moved.', free: true },

  // ── saved styles ─────────────────────────────────────────────────────
  savedStyles: { text: 'Save how this text looks (color, font, size, effects, animation) under a name and apply it to other text in one click. The words and position are never changed.', free: true },
  savedStylesBrowser: { text: 'Styles saved in this browser from other projects. Add one to this project to use it here. Brand colors follow this project.' },

  // ── making the video ─────────────────────────────────────────────────
  renderBranded: { text: 'Burns your approved overlays (logo, text, call to action, end card) onto the selected video in your browser.', free: true },
  removeBranding: { text: 'Uses AI to erase logos, watermarks and captions that are already part of the video. It asks you to confirm the cost first and keeps your original video.', paid: true },
  generateAi: { text: 'Uses AI to create new imagery or footage for changes overlays cannot do. Uses your account credits.', paid: true },
} as const satisfies Record<string, EditorTip>

export type EditorTipId = keyof typeof EDITOR_TIPS
