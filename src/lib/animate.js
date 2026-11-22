// src/lib/animate.js
// Default motion prompts and animation constants for the Animate studio.

export const DEFAULT_PROMPTS = [
  'Slow pan across the scene with subtle motion',
  'Zoom into the subject with gentle focus pull',
  'Drift camera to the right with parallax',
  'Fade in from black with soft light bloom',
  'Particle dust floating in light beams',
];

/** Default motion prompt per source (port of Open-Pomelli's DEFAULT_PROMPTS). */
export const SOURCE_PROMPTS = {
  asset: 'Subtle hero motion: slow camera push-in toward the focal subject, gentle parallax on background elements, ambient light shifts. Brand-consistent mood. Preserve typography and composition.',
  photoshoot: 'Slow rotational camera move around the product, soft light play across the surface, premium reveal feel. Preserve product geometry, color and shadows.',
  image: 'Cinematic motion that suits the image. Subtle camera move, gentle ambient motion in environmental elements. Preserve subject geometry.',
};
