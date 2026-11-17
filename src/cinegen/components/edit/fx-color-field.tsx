// [remix] Fix C: colour picker for effect colour props (native <input type="color">; value is [r, g, b] in 0..1) and for HSV slider triples.
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type Rgb } from '../../../openchatcut/gl/fx/s9/colour';

const swatch = { width: 34, height: 22, padding: 0, border: '1px solid rgba(255,255,255,.3)', borderRadius: 4, background: 'none', cursor: 'pointer' } as const;

export function FxColorField({ label, rgb, onChange, testId }: { label: string; rgb: Rgb; onChange: (rgb: Rgb) => void; testId: string }) {
  return (
    <div className="clip-properties-panel__row">
      <span className="clip-properties-panel__label">{label}</span>
      <input type="color" data-testid={testId} aria-label={label} style={swatch} value={rgbToHex(rgb)} onChange={(e) => { const c = hexToRgb(e.target.value); if (c) onChange(c); }} />
      <span className="clip-properties-panel__value">{rgbToHex(rgb)}</span>
    </div>
  );
}

/** Colour swatch over three HSV sliders (hue 0..360, sat, val). Picking writes all three through `onChange`. */
export function FxHsvColorField({ label, h, s, v, onChange, testId }: { label: string; h: number; s: number; v: number; onChange: (hsv: { h: number; s: number; v: number }) => void; testId: string }) {
  return <FxColorField label={label} rgb={hsvToRgb(h, s, v)} testId={testId} onChange={(c) => onChange(rgbToHsv(c))} />;
}
