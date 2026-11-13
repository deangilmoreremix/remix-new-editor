#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Night vision (original implementation, not derived from Seriously): luma amplification, phosphor-green tint,
// sensor noise (animated by u_time), goggle vignette.
uniform float u_amplification; uniform float u_threshold; uniform float u_noise; uniform float u_goggle; uniform float u_time; uniform vec2 u_resolution;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 c = texture(u_input, v_texCoord);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float n = h(v_texCoord * u_resolution + floor(u_time * 30.0)) - 0.5;
  l = max(l - u_threshold, 0.0) / max(1.0 - u_threshold, 1e-3);
  l = clamp(l * u_amplification + n * u_noise, 0.0, 1.0);
  vec3 col = l * vec3(0.12, 1.0, 0.25);
  float d = length((v_texCoord - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0));
  col *= mix(1.0, smoothstep(0.85, 0.45, d), u_goggle);
  fragColor = vec4(col, c.a);
}
