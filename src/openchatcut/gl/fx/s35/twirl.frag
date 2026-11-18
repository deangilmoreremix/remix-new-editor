#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Twirl: rotate pixels around a centre by an angle that falls off to 0 at the radius (aspect-corrected).
uniform float u_center_x; uniform float u_center_y; uniform float u_radius; uniform float u_angle; uniform vec2 u_resolution;
void main() {
  float asp = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 ctr = vec2(u_center_x, u_center_y);
  vec2 d = (v_texCoord - ctr) * vec2(asp, 1.0);
  float r = length(d);
  float k = clamp(1.0 - r / max(u_radius, 1e-3), 0.0, 1.0);
  float a = u_angle * k * k;
  float s = sin(a); float co = cos(a);
  vec2 q = vec2(d.x * co - d.y * s, d.x * s + d.y * co);
  fragColor = texture(u_input, clamp(ctr + q / vec2(asp, 1.0), 0.0, 1.0));
}
