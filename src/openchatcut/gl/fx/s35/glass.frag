#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Frosted / reeded glass: refract by smooth value noise (amount, scale) with optional vertical reeding (ribs).
uniform float u_amount; uniform float u_scale; uniform float u_ribs; uniform float u_time; uniform float u_speed;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 p = v_texCoord * u_scale + u_time * u_speed;
  vec2 off = vec2(vnoise(p) - 0.5, vnoise(p + 17.3) - 0.5) * 2.0;
  if (u_ribs > 0.5) off.x += sin(v_texCoord.x * u_ribs * 6.2831853) ;
  fragColor = texture(u_input, clamp(v_texCoord + off * u_amount, 0.0, 1.0));
}
