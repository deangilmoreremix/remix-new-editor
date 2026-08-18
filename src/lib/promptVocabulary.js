// Prompt vocabulary: camera, lighting, and structured prompt builder.

export const CAMERA_VOCABULARY = [
  'Wide Shot',
  'Medium Shot',
  'Close-Up',
  'Extreme Close-Up',
  'POV',
  'Overhead',
  'Low Angle',
  'Drone Shot',
  'Tracking Shot',
  'Dolly Zoom'
];

export const LIGHTING_VOCABULARY = [
  'Natural Light',
  'Golden Hour',
  'Blue Hour',
  'Studio Lighting',
  'Soft Light',
  'Hard Light',
  'Backlight',
  'Rim Light',
  'Cinematic Lighting',
  'Neon Lighting',
  'Candlelight',
  'Moonlight'
];

export function buildStructuredPrompt({ basePrompt = '', camera, lighting, style, negativePrompt = '' } = {}) {
  const parts = [basePrompt];
  if (camera) parts.push(`Camera: ${camera}`);
  if (lighting) parts.push(`Lighting: ${lighting}`);
  if (style) parts.push(`Style: ${style}`);
  if (negativePrompt) parts.push(`Negative: ${negativePrompt}`);
  return parts.join(' | ');
}
