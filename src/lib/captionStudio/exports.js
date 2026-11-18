/** Caption file formats: TXT and ASS (SRT/VTT live in model.js). ASS opens in Aegisub / VLC / FFmpeg+libass with per-word karaoke timing. */
import { captionPages, sortCaptions } from './model.js';

/** Plain transcript, one line per caption page (what the viewer reads at once). */
export function captionsToTxt(captions, { combineMs = 2600 } = {}) {
  return captionPages(sortCaptions(captions), { combineMs }).map((p) => p.text.trim()).filter(Boolean).join('\n') + '\n';
}

const assTime = (ms) => {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000); const m = Math.floor((cs % 360000) / 6000); const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
/** CSS colour → ASS &HAABBGGRR& (alpha 00 = opaque). */
export function assColor(css, fallback = '#FFFFFF') {
  const m = /^#([0-9a-f]{6})$/i.exec(css || '') || /^#([0-9a-f]{6})$/i.exec(fallback);
  const [r, g, b] = [0, 2, 4].map((i) => m[1].slice(i, i + 2));
  const rgba = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/i.exec(css || '');
  if (rgba) {
    const hx = (n) => Number(n).toString(16).padStart(2, '0').toUpperCase();
    const a = rgba[4] == null ? 0 : Math.round((1 - Number(rgba[4])) * 255);
    return `&H${hx(a)}${hx(rgba[3])}${hx(rgba[2])}${hx(rgba[1])}`;
  }
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Animated ASS subtitles: one event per page, every word tagged with \k so libass wipes the highlight colour word by word.
 * @param {{ width?: number, height?: number }} size  the video's frame size (font size, outline and margin scale from it)
 */
export function captionsToAss(captions, style = {}, { width = 1080, height = 1920 } = {}) {
  const pages = captionPages(sortCaptions(captions), style);
  const px = Math.round((Math.max(1, Number(style.fontSize) || 6) / 100) * height);
  const outline = style.stroke ? Math.max(1, Math.round(px * 0.06)) : 0;
  const posY = Number.isFinite(style.positionY) ? style.positionY : { top: 0.08, middle: 0.5, bottom: 0.82 }[style.position] ?? 0.82;
  const boxed = style.background && !style.boxed;
  const field = (v) => String(v).replace(/[,\r\n]/g, ' ');
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // In karaoke the PrimaryColour is the already-spoken colour and SecondaryColour the not-yet-spoken one.
    `Style: Default,${field(style.fontFamily || 'Inter')},${px},${assColor(style.highlightColor, '#FFE14D')},${assColor(style.color)},${assColor(style.strokeColor, '#000000')},${assColor(style.backgroundColor || 'rgba(0,0,0,0.6)')},${style.bold ? -1 : 0},${style.italic ? -1 : 0},0,0,100,100,0,0,${boxed ? 3 : 1},${boxed ? Math.round(px * 0.18) : outline},${boxed ? 0 : 1},8,${Math.round(width * 0.06)},${Math.round(width * 0.06)},0,1`,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  pages.forEach((p) => {
    const text = p.tokens.map((t) => {
      const w = (style.uppercase ? t.text.toUpperCase() : t.text).replace(/[{}\\]/g, '');
      return `{\\k${Math.max(1, Math.round((t.toMs - t.fromMs) / 10))}}${w}`;
    }).join('');
    const end = p.tokens.length ? p.tokens[p.tokens.length - 1].toMs : p.startMs + p.durationMs;
    // \an8 = top-centre anchored; \pos puts the block's top edge so the block is centred on positionY.
    lines.push(`Dialogue: 0,${assTime(p.startMs)},${assTime(end)},Default,,0,0,0,,{\\an8\\pos(${Math.round(width / 2)},${Math.round(posY * height - px * 0.65)})}${text.trim()}`);
  });
  return `${lines.join('\n')}\n`;
}
