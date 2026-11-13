#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Master tone curve (5 control points, Catmull-Rom spline) + per-channel mid-point bend.
// Original GLSL; algorithm idea (point-curve LUT) from FreeCut's curves effect (MIT) — no WGSL copied.
uniform float u_p0; uniform float u_p1; uniform float u_p2; uniform float u_p3; uniform float u_p4;
uniform float u_r_mid; uniform float u_g_mid; uniform float u_b_mid;
float curve(float x) {
  x = clamp(x, 0.0, 1.0);
  float y[5] = float[5](u_p0, u_p1, u_p2, u_p3, u_p4);
  int i = min(int(x * 4.0), 3);
  float t = x * 4.0 - float(i);
  float p0 = y[i];
  float p1 = y[i + 1];
  float m0 = (i == 0) ? (p1 - p0) : (y[i + 1] - y[i - 1]) * 0.5;
  float m1 = (i == 3) ? (p1 - p0) : (y[i + 2] - y[i]) * 0.5;
  float t2 = t * t; float t3 = t2 * t;
  float v = (2.0*t3 - 3.0*t2 + 1.0) * p0 + (t3 - 2.0*t2 + t) * m0 + (-2.0*t3 + 3.0*t2) * p1 + (t3 - t2) * m1;
  return clamp(v, 0.0, 1.0);
}
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec3 o = vec3(curve(c.r), curve(c.g), curve(c.b));
  vec3 mid = vec3(u_r_mid, u_g_mid, u_b_mid);
  o += mid * 4.0 * o * (1.0 - o);
  fragColor = vec4(clamp(o, 0.0, 1.0), c.a);
}
