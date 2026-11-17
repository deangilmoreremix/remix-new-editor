/**
 * AI Captions — the phone preview and the style chips' text. Pure string builders on the editor's caption style model
 * (`captionStyleFor`, Capite's 27 looks among them), drawn with the same builders as the Template Generator's wizard.
 */
import { captionSampleHTML, captionTextCss } from '../template-generator/captionPreview.js';

export const POSITIONS = [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']];
/** Where the caption's bottom edge sits, in percent of the frame height measured from the bottom (the slider; 5–90). */
export const POSITION_PERCENT = { bottom: 8, middle: 50, top: 88 };
export const MIN_POS = 5;
export const MAX_POS = 90;

export const clampPos = (n) => Math.min(MAX_POS, Math.max(MIN_POS, Math.round(Number.isFinite(Number(n)) ? Number(n) : POSITION_PERCENT.bottom)));
/** The preset a slider value belongs to (the nearest one). */
export const presetFor = (pct) => POSITIONS.map(([id]) => id).sort((x, y) => Math.abs(POSITION_PERCENT[x] - pct) - Math.abs(POSITION_PERCENT[y] - pct))[0];
export const positionStyle = (percent) => `bottom:${clampPos(percent)}%`;

/** A real photo that ships with the app: shown behind the sample captions until a video is picked (never a made-up placeholder). */
export const FALLBACK_FRAME = '/library-previews/sample-in.jpg';
export const BACKGROUNDS = [['frame', 'Your video frame', ''], ['cinema', 'Cinematic', 'linear-gradient(180deg,#0b1020,#000)'], ['glass', 'Dark glass', 'linear-gradient(135deg,#1b1f2a,#0a0a0a)'], ['light', 'Light', 'linear-gradient(180deg,#e5e7eb,#9ca3af)'], ['grid', 'Grid', 'repeating-linear-gradient(0deg,#0a0a0a 0 23px,#1c1c1c 23px 24px),repeating-linear-gradient(90deg,transparent 0 23px,#1c1c1c 23px 24px)']];

const cssUrl = (u) => `url('${String(u).replace(/["'\\\n()]/g, '')}')`;   // single quotes: this goes inside a style="…" attribute
/** CSS background for a preview screen: the real frame of the picked video (or the bundled photo), or one of the plain backdrops. */
export function screenBackground(background, frame) {
  if (background === 'frame' || !background) return `${cssUrl(frame || FALLBACK_FRAME)} center/cover no-repeat`;
  return (BACKGROUNDS.find((b) => b[0] === background) || BACKGROUNDS[1])[2];
}

/** The phone with "SAMPLE TEXT" (or any text) in the chosen style and place, over a real frame. */
export function phonePreviewHTML(style, { percent = POSITION_PERCENT.bottom, background = 'frame', text = 'SAMPLE TEXT', frame = '' } = {}) {
  return `<div class="cap-phone" data-testid="cap-phone"><div class="cap-phone-notch"></div><div class="cap-phone-screen" style="background:${screenBackground(background, frame)}">`
    + `<div class="cap-phone-caption" data-testid="cap-phone-caption" style="${positionStyle(percent)};${captionTextCss(style, 340)}">${captionSampleHTML(style, text)}</div>`
    + '<div class="cap-phone-hint">Drag to reposition</div></div></div>';
}
