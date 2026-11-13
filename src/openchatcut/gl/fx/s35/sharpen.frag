#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Unsharp mask: c + amount * (c - gaussian3x3(c, radius)), with a noise-gate threshold.
uniform float u_amount; uniform float u_radius; uniform float u_threshold; uniform vec2 u_resolution;
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec2 px = u_radius / max(u_resolution, vec2(1.0));
  vec3 b = c.rgb * 4.0;
  b += texture(u_input, v_texCoord + vec2(px.x, 0.0)).rgb * 2.0;
  b += texture(u_input, v_texCoord - vec2(px.x, 0.0)).rgb * 2.0;
  b += texture(u_input, v_texCoord + vec2(0.0, px.y)).rgb * 2.0;
  b += texture(u_input, v_texCoord - vec2(0.0, px.y)).rgb * 2.0;
  b += texture(u_input, v_texCoord + px).rgb;
  b += texture(u_input, v_texCoord - px).rgb;
  b += texture(u_input, v_texCoord + vec2(px.x, -px.y)).rgb;
  b += texture(u_input, v_texCoord + vec2(-px.x, px.y)).rgb;
  b /= 16.0;
  vec3 d = c.rgb - b;
  float m = max(abs(d.r), max(abs(d.g), abs(d.b)));
  float gate = smoothstep(u_threshold, u_threshold + 0.02, m);
  fragColor = vec4(clamp(c.rgb + d * u_amount * gate, 0.0, 1.0), c.a);
}
