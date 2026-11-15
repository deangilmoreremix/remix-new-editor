#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Curves (Fix C): per-channel 128-entry LUT built on the CPU (RGB master curve composed with the R / G / B curves, see curves.ts).
// Original GLSL; the monotone-spline idea follows FreeCut's curves effect (MIT) - no WGSL copied.
uniform vec4 u_lut[128];
float lookup(float x, int ch) {
  float f = clamp(x, 0.0, 1.0) * 127.0;
  int i = min(int(f), 126);
  float t = f - float(i);
  vec4 a = u_lut[i];
  vec4 b = u_lut[i + 1];
  return mix(a[ch], b[ch], t);
}
void main() {
  vec4 c = texture(u_input, v_texCoord);
  fragColor = vec4(lookup(c.r, 0), lookup(c.g, 1), lookup(c.b, 2), c.a);
}
