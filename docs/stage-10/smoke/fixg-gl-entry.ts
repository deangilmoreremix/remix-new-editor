// Bundled by fixg-gl-check.cjs into the headless-Chromium page: the real runtime + registry + the CPU reference, on window.__fx.
import { createGlRuntime } from '../../../src/openchatcut/gl/runtime';
import { ALL_FX } from '../../../src/openchatcut/gl/fx/effects';
import { fxPasses } from '../../../src/openchatcut/gl/fx/uniforms';
import { pixelSortCpu, sortKey, isMasked } from '../../../src/openchatcut/gl/fx/s10/pixelSortRef';
(window as unknown as Record<string, unknown>).__fx = { createGlRuntime, ALL_FX, fxPasses, pixelSortCpu, sortKey, isMasked };
