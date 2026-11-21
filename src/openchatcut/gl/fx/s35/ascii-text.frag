#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Text-mode ASCII: each cell is replaced by one of 6 density glyphs (5x5 bitmaps, original design) chosen by cell luma.
uniform float u_cell; uniform float u_brightness; uniform float u_colored; uniform float u_invert; uniform float u_mixOriginal; uniform vec2 u_resolution;
const uint GLYPH[6] = uint[6](4096u,131200u,145536u,18157905u,11512810u,15728622u);
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec2 px = v_texCoord * u_resolution;
  float cell = max(u_cell, 4.0);
  vec2 cellId = floor(px / cell);
  vec2 centre = (cellId + 0.5) * cell / u_resolution;
  vec3 cc = texture(u_input, clamp(centre, 0.0, 1.0)).rgb;
  float l = clamp(dot(cc, vec3(0.2126, 0.7152, 0.0722)) * u_brightness, 0.0, 0.9999);
  if (u_invert > 0.5) l = 1.0 - l;
  int level = int(floor(l * 7.0)) - 1;
  vec2 f = (px - cellId * cell) / cell;
  int gx = int(floor(f.x * 6.0));
  int gy = int(floor(f.y * 6.0));
  float on = 0.0;
  if (level >= 0 && gx < 5 && gy < 5) on = float((GLYPH[level] >> uint(gy * 5 + gx)) & 1u);
  vec3 ink = u_colored > 0.5 ? cc / max(max(cc.r, max(cc.g, cc.b)), 0.2) : vec3(0.85, 1.0, 0.85);
  vec3 o = mix(vec3(0.03), ink, on);
  fragColor = vec4(mix(o, c.rgb, clamp(u_mixOriginal, 0.0, 1.0)), c.a);
}
