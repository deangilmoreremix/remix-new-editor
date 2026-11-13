// Bundled by fx-gl-check.cjs into the headless-Chromium page: exposes the real runtime + registry on window.__fx.
import { createGlRuntime } from '../../../src/openchatcut/gl/runtime';
import { ALL_FX } from '../../../src/openchatcut/gl/fx/effects';
import { fxPasses } from '../../../src/openchatcut/gl/fx/uniforms';
import { S35_META } from '../../../src/openchatcut/gl/fx/s35Effects';
(window as unknown as Record<string, unknown>).__fx = { createGlRuntime, ALL_FX, fxPasses, S35_META };
