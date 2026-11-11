/**
 * Export mode. The preview can afford every effect; the web renderer draws each frame by
 * walking the page, so a motion-blur recipe that draws its world 8–12 times per frame makes
 * an export many times slower than the same film without blur. While exporting, such recipes
 * ask `blurSamples(n)` for their sample count and get far fewer. Set by `renderVideoOnWeb`
 * around a render; the live preview never sets it.
 */
let exporting = false;

export const setExportMode = (on: boolean): void => {
  exporting = on;
};

export const isExporting = (): boolean => exporting;

/**
 * True while the web renderer draws a frame (export or still), false in the live preview (the browser's
 * own CSS). For the few places where the renderer draws something differently from the browser.
 */
let webRendering = false;
export const setWebRendering = (on: boolean): void => {
  webRendering = on;
};
export const isWebRendering = (): boolean => webRendering;

/** Motion-blur samples to draw: all of them in the preview, about a third (at least 3) while exporting. */
export const blurSamples = (n: number): number => (exporting && n > 3 ? Math.max(3, Math.ceil(n / 3)) : n);
