// Curated gl-transitions subset (category -> upstream shader names). Changing this list and re-running
// scripts/gen-gl-transitions-catalog.mjs is the only way shaders enter the product.
export const CURATED = {
  Wipe: ['DirectionalWipe', 'RadialWipe', 'ClockWipe', 'PlusWipe', 'StarWipe', 'HeartWipe', 'BandWipe', 'ShutterWipe', 'WindowBlinds', 'WaveWipe', 'WedgeWipe', 'ApertureWipe', 'Curtains', 'CircleOpen', 'HorizontalOpen', 'SpiralWipe', 'CurvedWipe', 'ArrowWipe', 'SpotlightWipe', 'RingsWipe', 'LeafWipe'],
  Slide: ['Directional', 'DirectionalWarp', 'Slides', 'SplitSlideInHorizontal', 'WindowSlices'],
  '3D': ['Cube', 'InsideCube', 'BookFlip', 'SimpleFlip', 'Doorway', 'Fold', 'PaperFold', 'FallOver', 'Revolve', 'CylinderRoll', 'Rolls', 'CardSwipe'],
  'Blur & Zoom': ['CrossZoom', 'SimpleZoom', 'SimpleZoomOut', 'TangentMotionBlur', 'DefocusBlur', 'Funnel', 'Squeeze'],
  Distortion: ['CrossWarp', 'Ripple', 'Swirl', 'Morph', 'Wind', 'Fisheye', 'WaterDrop', 'HeatHaze', 'Kaleidoscope', 'Refraction', 'Vortex', 'GravityLens', 'Prisms'],
  'Glitch & Retro': ['GlitchMemories', 'GlitchDisplace', 'GlitchBands', 'TvStatic', 'TvLostSignal', 'VhsTracking'],
  'Dissolve & Pixel': ['Pixelize', 'Mosaic', 'Hexagonalize', 'RandomSquares', 'SquaresWipe', 'DitherDissolve', 'PerlinDissolve', 'CellDissolve'],
  'Light & Color': ['FilmBurn', 'LightRays', 'ColorPhase', 'DuotoneFade', 'LensFlare'],
};

// Skipped on purpose; anything else not curated reads "not in curated set".
export const EXCLUDED_REASONS = {
  Fade: 'duplicate of built-in cross-dissolve',
  FadeColor: 'duplicate of built-in dip-to-color',
  FadeGrayscale: 'near-duplicate of dip-to-color',
  WhipPan: 'duplicate of built-in whip-pan',
  InvertedPageCurl: 'duplicate of built-in page-curl (BSD-3, hence not worth the extra notice)',
  DisplacementMap: 'needs an extra texture',
  LumaWipe: 'needs an extra texture',
};
