#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Water ripple (original implementation, not derived from Seriously): concentric sine waves displace the lookup along the radius.
uniform float u_center_x; uniform float u_center_y; uniform float u_frequency; uniform float u_amplitude; uniform float u_speed; uniform float u_falloff; uniform float u_time; uniform vec2 u_resolution;
void main() {
  float asp = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 ctr = vec2(u_center_x, u_center_y);
  vec2 d = (v_texCoord - ctr) * vec2(asp, 1.0);
  float r = length(d);
  vec2 dir = r > 1e-5 ? d / r : vec2(0.0);
  float w = sin(r * u_frequency * 6.2831853 - u_time * u_speed) * u_amplitude * exp(-r * u_falloff);
  fragColor = texture(u_input, clamp(v_texCoord + dir * w / vec2(asp, 1.0), 0.0, 1.0));
}
