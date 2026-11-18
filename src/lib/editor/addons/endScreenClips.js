/**
 * Classic End Screen modal result → editable timeline clips. The modal edits CTA buttons (text, link, style, position) and a screen
 * style (background, text colour, duration); both are applied here, so what was configured is what lands on the timeline:
 * a background wrapper in the chosen colour, and one link button per CTA anchored to the end of the video.
 */
import { presetToClips } from './overlayPresets.js';

const POSITIONS = { center: [50, 50], 'bottom-left': [15, 80], 'bottom-right': [85, 80], 'bottom-center': [50, 80] };
const CYAN = '#22d3ee';

export function endScreenPreset(data = {}) {
  const style = data.style || {};
  const seconds = Math.max(1, Number(style.duration) || 10);
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const items = [];
  if (style.backgroundColor) {
    items.push({ type: 'overlay-background', offset: 0, duration: seconds, addon: { background: '#07090d', styles: `background: ${style.backgroundColor};`, opacity: 100, blendMode: 'normal' } });
  }
  buttons.forEach((b, i) => {
    const [x, y] = POSITIONS[b.position] || POSITIONS['bottom-center'];
    const width = 30;
    const filled = (b.style || 'filled') === 'filled';
    items.push({
      type: 'click-to-call',
      offset: Math.min(seconds - 0.5, 0.3 + i * 0.2),
      duration: Math.max(0.5, seconds - 0.3 - i * 0.2),
      flat: {
        buttonText: b.text || 'Click here',
        phoneNumber: '',
        linkUrl: b.url || '',
        animation: 'pulse',
        textColor: filled ? '#07090d' : (style.textColor || CYAN),
        style: { buttonColor: filled ? CYAN : 'transparent', posLeft: Math.max(0, x - width / 2), posTop: y, posWidth: width },
      },
    });
  });
  return { duration: seconds, items };
}

/** Clips timed to finish at the end of the video. */
export function endScreenClips(data, timelineSeconds, idBase = Date.now()) {
  const preset = endScreenPreset(data);
  const start = Math.max(0, timelineSeconds - preset.duration);
  return presetToClips(preset, start, timelineSeconds, idBase);
}
