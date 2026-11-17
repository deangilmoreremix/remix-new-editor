/**
 * Canvas caption painter. One implementation draws captions for BOTH the modal's live preview and the burned-in export,
 * so what you see is what you render. It mirrors the timeline's CaptionsLayer: font height = fontSize % of the frame
 * height, block centred at 8 / 50 / 82 % for top / middle / bottom, word highlight, boxed words and karaoke wipe,
 * plus the Capite looks' scale / pop / bounce / glow motion.
 */
import { captionPages, pageAt } from '../editor/remotion/captions.js';
import { capiteStyleById } from '../../features/personalization/shared/personalization/captions/capiteStyles';

const POSITION_Y = { top: 0.08, middle: 0.5, bottom: 0.82 };
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const easeOutBack = (t) => { const c = 1.70158; const x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

/** Which Capite motion a style uses ('highlight' | 'scale' | 'pop' | 'bounce' | 'glow' | 'box' | 'karaoke'). */
export function captionAnimation(style = {}) {
  if (style.karaoke || style.preset === 'karaoke') return 'karaoke';
  if (style.boxed || style.preset === 'box') return 'box';
  const id = typeof style.preset === 'string' && style.preset.startsWith('capite-') ? style.preset.slice(7) : null;
  return (id && capiteStyleById(id)?.animationType) || 'highlight';
}

export const captionFont = (style, px) => `${style.italic ? 'italic ' : ''}${style.bold ? 800 : 500} ${px}px "${style.fontFamily || 'Inter'}", Arial, sans-serif`;

/** Word-wrap a page's tokens into lines that fit maxWidth. Pure given a `measure(text) => width`. */
export function layoutWords(tokens, measure, maxWidth, uppercase) {
  const words = tokens.map((t) => ({ token: t, text: uppercase ? t.text.trim().toUpperCase() : t.text.trim() })).filter((w) => w.text);
  const space = measure(' ');
  const lines = [];
  let line = null;
  words.forEach((w) => {
    w.width = measure(w.text);
    if (!line || line.width + space + w.width > maxWidth) { line = { words: [], width: 0 }; lines.push(line); }
    line.width += (line.words.length ? space : 0) + w.width;
    line.words.push(w);
  });
  return { lines, space };
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/**
 * Draw the caption page showing at `ms` (relative to the video start) onto ctx.
 * @returns {boolean} true when something was drawn
 */
export function paintCaptions(ctx, W, H, captions, style = {}, ms = 0, { pages } = {}) {
  const page = pageAt(pages || captionPages(captions, style), ms);
  if (!page) return false;
  const fontSize = (Math.max(1, Number(style.fontSize) || 6) / 100) * H;
  const anim = captionAnimation(style);
  const boxed = anim === 'box';
  const lineBg = style.background && !boxed ? (style.backgroundColor || 'rgba(0,0,0,0.6)') : null;
  const base = style.color || '#FFFFFF';
  const hi = style.highlightColor || '#FFE14D';
  const lineH = fontSize * 1.25;

  ctx.save();
  ctx.font = captionFont(style, fontSize);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  const { lines, space } = layoutWords(page.tokens, (t) => ctx.measureText(t).width, W * 0.88, !!style.uppercase);
  if (!lines.length) { ctx.restore(); return false; }

  const blockH = lines.length * lineH;
  let top = (POSITION_Y[style.position] ?? POSITION_Y.bottom) * H - blockH / 2;
  top = Math.max(H * 0.02, Math.min(H * 0.98 - blockH, top));

  lines.forEach((line, li) => {
    const cy = top + li * lineH + lineH / 2;
    let x = (W - line.width) / 2;
    if (lineBg) {
      ctx.fillStyle = lineBg;
      roundRect(ctx, x - fontSize * 0.35, cy - lineH / 2 + fontSize * 0.06, line.width + fontSize * 0.7, lineH - fontSize * 0.12, fontSize * 0.18);
      ctx.fill();
    }
    line.words.forEach((w) => {
      const { fromMs, toMs } = w.token;
      const active = style.highlightActive !== false && ms >= fromMs && ms < toMs;
      const spoken = anim === 'karaoke' && ms >= fromMs;
      const progress = clamp01((ms - fromMs) / Math.max(1, Math.min(240, toMs - fromMs)));
      let scale = 1; let dy = 0;
      if (active) {
        if (anim === 'scale') scale = 1 + 0.15 * progress;
        else if (anim === 'pop') scale = 0.85 + 0.3 * easeOutBack(progress);
        else if (anim === 'bounce') dy = -Math.sin(progress * Math.PI) * fontSize * 0.18;
      }
      const wx = x + w.width / 2;
      ctx.save();
      ctx.translate(wx, cy + dy);
      ctx.scale(scale, scale);
      const lx = -w.width / 2;

      if (boxed) {
        ctx.fillStyle = active ? hi : (style.backgroundColor || 'rgba(0,0,0,0.6)');
        roundRect(ctx, lx - fontSize * 0.15, -lineH / 2 + fontSize * 0.1, w.width + fontSize * 0.3, lineH - fontSize * 0.2, fontSize * 0.15);
        ctx.fill();
      }
      const fill = boxed ? '#FFFFFF' : (active || spoken) && anim !== 'karaoke' ? hi : base;
      const outline = !lineBg && !boxed && style.stroke;
      const draw = (color, clipFraction) => {
        ctx.save();
        if (clipFraction != null) { ctx.beginPath(); ctx.rect(lx, -lineH, w.width * clipFraction, lineH * 2); ctx.clip(); }
        if (outline) {
          ctx.lineWidth = fontSize * 0.12;
          ctx.strokeStyle = style.strokeColor || '#000000';
          ctx.shadowColor = 'transparent';
          ctx.strokeText(w.text, lx, 0);
        }
        if (!lineBg && !boxed) { ctx.shadowColor = anim === 'glow' && active ? hi : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = anim === 'glow' && active ? fontSize * 0.5 : fontSize * 0.2; ctx.shadowOffsetY = anim === 'glow' && active ? 0 : 2; }
        ctx.fillStyle = color;
        ctx.fillText(w.text, lx, 0);
        ctx.restore();
      };
      if (anim === 'karaoke') {
        draw(base);
        const f = ms >= toMs ? 1 : ms >= fromMs ? clamp01((ms - fromMs) / Math.max(1, toMs - fromMs)) : 0;
        if (f > 0) draw(hi, f);
      } else draw(fill);
      ctx.restore();
      x += w.width + space;
    });
  });
  ctx.restore();
  return true;
}

const loaded = new Set();
/**
 * Make sure the caption font can be drawn on a canvas (canvas never waits for a web font). Google Fonts are loaded on demand;
 * a font that cannot be loaded falls back to Arial instead of blocking the render.
 */
export async function ensureCaptionFont(style = {}) {
  const family = style.fontFamily || 'Inter';
  const key = `${family}|${style.bold ? 1 : 0}|${style.italic ? 1 : 0}`;
  if (loaded.has(key) || typeof document === 'undefined' || !document.fonts) return;
  try {
    if (!document.fonts.check(`16px "${family}"`)) {
      const id = `csm-font-${family.replace(/\W+/g, '-')}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id; link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@0,500;0,800;1,500;1,800&display=swap`;
        document.head.appendChild(link);
      }
    }
    await Promise.race([document.fonts.load(captionFont(style, 32)), new Promise((r) => setTimeout(r, 4000))]);
  } catch { /* fall back to the system font */ }
  loaded.add(key);
}
