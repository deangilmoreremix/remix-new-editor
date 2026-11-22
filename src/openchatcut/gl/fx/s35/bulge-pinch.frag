#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Bulge (strength > 0) / pinch (strength < 0) lens around a centre, aspect-corrected. Neutral at strength 0.
uniform float u_center_x; uniform float u_center_y; uniform float u_radius; uniform float u_strength; uniform vec2 u_resolution;
void main() {
  float asp = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 ctr = vec2(u_center_x, u_center_y);
  vec2 d = (v_texCoord - ctr) * vec2(asp, 1.0);
  float r = length(d) / max(u_radius, 1e-3);
  if (r < 1.0) {
    float k = 1.0 - u_strength * 0.9 * (1.0 - r) * (1.0 - r);
    d *= k;
  }
  fragColor = texture(u_input, clamp(ctr + d / vec2(asp, 1.0), 0.0, 1.0));
}
