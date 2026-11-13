# Third-party notice: Stage 5 shaders adapted from Seriously.js

Four fragment shaders in this directory (`exposure.frag`, `emboss.frag`, `scanlines.frag`, `polar.frag`) are adapted from
**Seriously.js** (https://github.com/brianchirls/Seriously.js), commit `513d2b8696b76fe764b3033aa6dc7c99005acccd`, files

- `effects/seriously.exposure.js`
- `effects/seriously.emboss.js`
- `effects/seriously.scanlines.js`
- `effects/seriously.polar.js`

Licence: MIT. Copyright (c) 2012-2014 Brian Chirls. The files' own headers carry no other licence or third-party credit.

```
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

(Standard MIT text; verified against the first lines of `Seriously.js/LICENSE` at the commit above.)

Changes are listed in each shader's header (WebGL1 -> GLSL ES 3.00, `u_*` uniform names, alpha preserved, extra blend/amount
parameters; for `scanlines` an upstream bug where `width` was never bound is fixed by using `u_size`).

## Not vendored (deliberately)

`blur`, `directionblur`, `bleach-bypass`, `opticalflow` (CC BY-NC-SA 3.0), `filmgrain` (CC BY 3.0, attribution), `lut` (BBC R&D,
no licence text), `blend` (credit TODO), `tvglitch`, `freeze`, `accumulator`, `throttle`, `expression` (multi-pass / runtime).
`nightvision`, `sketch` and `ripple` have third-party references in their upstream headers ("based on" / "inspired by"), so the
versions here are independent implementations that do not use the upstream code.

## FreeCut

FreeCut (MIT, commit 5ceeeb388eef5423640b7db157706274bf1b8165) was used only as an algorithm reference for curves, gradient map,
vibrance and similar colour tools. Its effects are WGSL/WebGPU; no WGSL source was copied. All Stage 3 shaders are original GLSL.
