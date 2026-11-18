#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// VHS tape: horizontal tracking jitter bands, chroma bleed (R/B smear), tape noise, scanlines. Animated by u_time.
uniform float u_tracking; uniform float u_chroma; uniform float u_noise; uniform float u_scanlines; uniform float u_fade; uniform float u_time; uniform vec2 u_resolution;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = v_texCoord;
  float t = floor(u_time * 24.0);
  float band = floor(uv.y * 40.0);
  float bandR = h(vec2(band, t));
  float jitter = (bandR > 1.0 - 0.25 * u_tracking) ? (h(vec2(band + 3.0, t)) - 0.5) * 0.08 * u_tracking : 0.0;
  float roll = smoothstep(0.97, 1.0, sin(uv.y * 3.0 + u_time * 0.8)) * 0.01 * u_tracking;
  uv.x += jitter + roll;
  float cs = u_chroma;
  float r = texture(u_input, clamp(uv + vec2(cs * 2.0, 0.0), 0.0, 1.0)).r;
  vec4 g = texture(u_input, clamp(uv, 0.0, 1.0));
  float b = texture(u_input, clamp(uv - vec2(cs * 2.0, 0.0), 0.0, 1.0)).b;
  vec3 col = vec3(r, g.g, b);
  float ln = 0.5 + 0.5 * sin(v_texCoord.y * u_resolution.y * 3.14159);
  col *= 1.0 - u_scanlines * 0.5 * (1.0 - ln);
  float n = h(v_texCoord * u_resolution + t) - 0.5;
  col += n * u_noise * 0.35;
  col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), clamp(u_fade, 0.0, 1.0));
  fragColor = vec4(clamp(col, 0.0, 1.0), g.a);
}
