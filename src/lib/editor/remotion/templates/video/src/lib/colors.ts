// Shared palette for the template pack.
//
// Deliberately a clean, light editorial system (zinc neutrals + a single blue
// accent) rather than the dark-neon look. Every template pulls its defaults
// from here so the pack reads as one coherent set, and any single value can
// still be overridden per-composition via props.

export const palette = {
  // Blue accent ramp
  blue600: "#2563EB",
  blue500: "#3B82F6",
  blue400: "#60A5FA",
  sky500: "#0EA5E9",

  // Zinc neutral ramp (backgrounds → ink)
  white: "#FFFFFF",
  zinc50: "#FAFAFA",
  zinc100: "#F4F4F5",
  zinc200: "#E4E4E7",
  zinc300: "#D4D4D8",
  zinc400: "#A1A1AA",
  zinc500: "#71717A",
  zinc600: "#52525B",
  zinc700: "#3F3F46",
  zinc800: "#27272A",
  zinc900: "#18181B",
  ink: "#09090B",
} as const;

// A small categorical set for charts — distinct hues that stay legible on a
// light background. Cycled with `seriesColor(index)`.
export const chartColors: readonly string[] = [
  palette.blue600,
  palette.sky500,
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
];

export const seriesColor = (index: number): string =>
  chartColors[((index % chartColors.length) + chartColors.length) % chartColors.length];

// Parse a hex color into [r, g, b]. Accepts #RGB, #RGBA, #RRGGBB and #RRGGBBAA;
// any alpha channel is dropped (these helpers set their own alpha).
const parseHex = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "").trim();
  if (h.length === 3 || h.length === 4) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  } else {
    h = h.slice(0, 6);
  }
  const int = parseInt(h, 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

// Return an `rgba()` string for a hex color at the given alpha (0..1).
// Useful for glows, tints and shadows that must stay tied to a brand prop.
export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// Mix two hex colors by ratio t (0 = a, 1 = b). Deterministic, no DOM needed.
export const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const clamp = Math.max(0, Math.min(1, t));
  const r = Math.round(ar + (br - ar) * clamp);
  const g = Math.round(ag + (bg - ag) * clamp);
  const bl = Math.round(ab + (bb - ab) * clamp);
  return `rgb(${r}, ${g}, ${bl})`;
};
