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
  bakedPlay: { type: 'radio', label: "The design's picture already shows a play button", options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
});

export const SLOT_DEFAULTS = { slotImage: '', slotVideo: '', bakedPlay: 'no' };
