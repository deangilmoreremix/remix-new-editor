/**
 * The "video slot" fields every design with a video card offers in the page editor:
 *   slotImage  any https picture (a personalized image, a thumbnail, a graphic): shown as the video's picture,
 *              or on its own when the page has no video
 *   slotVideo  any https video you made (instead of the page's video)
 *   bakedPlay  the design's own picture already shows a play button (no second one is drawn over it)
 * Labels contain "picture" / "video you made" so withImagePickers() swaps in the library-aware fields.
 */
export const slotFields = () => ({
  slotImage: { type: 'text', label: 'Picture in the video slot (e.g. a personalized image)' },
  slotVideo: { type: 'text', label: 'Video in the video slot (a video you made)' },
  viewerType: { type: 'radio', label: 'Viewer shows', options: [{ label: 'Auto', value: 'auto' }, { label: 'Video', value: 'video' }, { label: 'Still only', value: 'still' }] },
  viewerAlt: { type: 'text', label: 'Screen-reader description of the viewer (alt text)' },
  viewerAspect: { type: 'select', label: 'Viewer shape', options: [{ label: 'Design default', value: '' }, { label: 'Wide 16:9', value: '16 / 9' }, { label: 'Classic 4:3', value: '4 / 3' }, { label: 'Square 1:1', value: '1 / 1' }, { label: 'Tall 9:16', value: '9 / 16' }] },
  viewerControls: { type: 'radio', label: 'Video controls', options: [{ label: 'Show', value: 'yes' }, { label: 'Hide', value: 'no' }] },
  viewerAutoplay: { type: 'radio', label: 'Start playing by itself (muted, live page only)', options: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] },
  viewerLoop: { type: 'radio', label: 'Play again when it ends', options: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] },
  viewerCaption: { type: 'text', label: 'Caption under the viewer' },
  bakedPlay: { type: 'radio', label: "The design's picture already shows a play button", options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
});

export const SLOT_DEFAULTS = { slotImage: '', slotVideo: '', bakedPlay: 'no', viewerType: 'auto', viewerAlt: '', viewerAspect: '', viewerControls: 'yes', viewerAutoplay: 'no', viewerLoop: 'no', viewerCaption: '' };
