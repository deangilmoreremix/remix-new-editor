// src/lib/photoStudio.js
// AI Photo Studio — 6 categories × 5 styles = 30 product-photography presets.
// Port of Open-Pomelli's photo-studio.ts and photo-styles.ts.

import { muapi } from './muapi.js';
import { generateId } from './brandStore.js';

export const PHOTO_CATEGORIES = [
  { id: 'studio', label: 'Studio White', prompt: 'professional product photography on a clean white studio background, soft shadow, commercial lighting' },
  { id: 'marble', label: 'Marble Clean', prompt: 'luxury product photography on a polished white marble surface, soft natural light, high-end editorial look' },
  { id: 'urban', label: 'Urban Street', prompt: 'product photography on an urban street backdrop, gritty texture, neon reflections, street style' },
  { id: 'golden', label: 'Golden Hour', prompt: 'product photography during golden hour, warm sunlight, outdoor lifestyle, natural shadows' },
  { id: 'restaurant', label: 'Restaurant Plated', prompt: 'food photography on a restaurant table setting, Michelin-star plating, warm ambient light' },
  { id: 'scandi', label: 'Scandi Living', prompt: 'product photography in a scandinavian living room, minimal decor, natural light, cozy aesthetic' },
  { id: 'dark', label: 'Dark Techy', prompt: 'product photography on a dark tech surface, LED accents, cyberpunk aesthetic, dramatic lighting' },
  { id: 'nature', label: 'Nature Organic', prompt: 'product photography in a natural outdoor setting, organic textures, soft bokeh, eco-friendly aesthetic' },
];

export const PHOTO_STYLES = [
  { id: 'clean', label: 'Clean', prompt: 'clean minimal composition, centered product, no distractions' },
  { id: 'dramatic', label: 'Dramatic', prompt: 'dramatic side lighting, deep shadows, high contrast, cinematic mood' },
  { id: 'flatlay', label: 'Flat Lay', prompt: 'flat lay top-down view, styled props, balanced composition' },
  { id: 'lifestyle', label: 'Lifestyle', prompt: 'in-context lifestyle photography, human element, natural interaction' },
  { id: 'macro', label: 'Macro', prompt: 'extreme close-up macro detail, texture focus, shallow depth of field' },
];

export async function generateProductPhoto({ productImageUrl, logoUrl, category, style }) {
  const categoryMeta = PHOTO_CATEGORIES.find(c => c.id === category) || PHOTO_CATEGORIES[0];
  const styleMeta = PHOTO_STYLES.find(s => s.id === style) || PHOTO_STYLES[0];

  const prompt = `${categoryMeta.prompt}, ${styleMeta.prompt}, brand-aware, high resolution, commercial quality`;

  const imagesList = [productImageUrl];
  if (logoUrl) imagesList.push(logoUrl);

  // Use nano-banana-2-edit for brand-aware product photography
  const imageUrl = await muapi.imageEdit2(prompt, imagesList, {
    aspectRatio: '1:1',
    resolution: '2k',
    outputFormat: 'png',
  });

  if (!imageUrl) throw new Error('Photo studio returned no image');

  return {
    id: generateId(),
    productImageUrl,
    category,
    styleId: style,
    styleLabel: styleMeta.label,
    prompt,
    imageUrl,
    aspect: '1:1',
    resolution: '2k',
    createdAt: new Date().toISOString(),
  };
}
