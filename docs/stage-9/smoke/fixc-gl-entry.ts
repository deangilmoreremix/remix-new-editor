// Bundled by fixc-gl-check.cjs into the headless-Chromium page: the real runtime + registry + the pure CPU twins, on window.__fx.
import { createGlRuntime } from '../../../src/openchatcut/gl/runtime';
import { ALL_FX } from '../../../src/openchatcut/gl/fx/effects';
import { fxPasses } from '../../../src/openchatcut/gl/fx/uniforms';
import { buildCurveLut, lutLookup, pointsToFlat } from '../../../src/openchatcut/gl/fx/s9/curves';
import { maskAlphaAt, ellipsePath, rectPath, pathToFlat } from '../../../src/openchatcut/gl/fx/s9/pathMask';
import { quadFromProps, propsFromQuad } from '../../../src/openchatcut/gl/fx/s9/cornerPin';
import { quadToSquare } from '../../../src/openchatcut/gl/fx/s9/homography';
(window as unknown as Record<string, unknown>).__fx = { createGlRuntime, ALL_FX, fxPasses, buildCurveLut, lutLookup, pointsToFlat, maskAlphaAt, ellipsePath, rectPath, pathToFlat, quadFromProps, propsFromQuad, quadToSquare };
