#version 300 es
precision highp float;
// Pixel Sort, one odd-even transposition step. Every pixel looks at exactly one neighbour along the sort axis:
// pixels whose index s along the axis satisfies (s + parity) even are the FIRST of a pair (partner s+1), the others the second
// (partner s-1). A pair is compared only when BOTH pixels are inside the threshold mask; then the pair is swapped if its keys are
// out of order. Because swaps only happen between masked pixels, a pixel's own mask test (key in [low, high], alpha > 0) is the
// same before and after every step, so no extra mask texture is needed and unmasked pixels are never written.
uniform sampler2D u_input;
uniform float u_axis;      // 0 = horizontal runs (index grows rightwards), 1 = vertical runs (index grows downwards)
uniform float u_key;       // 0 luma, 1 hue, 2 saturation, 3 brightness (max channel)
uniform float u_low;
uniform float u_high;
uniform float u_invert;    // 1 = sort the pixels OUTSIDE [low, high]
uniform float u_ascending; // 1 = key grows along the axis, 0 = key shrinks
uniform float u_parity;    // pass number & 1 (set per pass by the effect pipeline)
out vec4 fragColor;

float keyOf(vec3 c) {
  int k = int(u_key + 0.5);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  if (k == 0) return dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (k == 3) return mx;
  if (k == 2) return mx > 0.0 ? d / mx : 0.0;
  if (d < 1e-6) return 0.0;
  float h;
  if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return h / 6.0;
}
bool masked(vec4 px, float key) {
  bool inside = key >= u_low && key <= u_high;
  return px.a > 0.0 && (u_invert > 0.5 ? !inside : inside);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(u_input, 0);
  bool vert = u_axis > 0.5;
  int len = vert ? sz.y : sz.x;
  int s = vert ? (sz.y - 1 - p.y) : p.x;
  bool first = ((s + int(u_parity + 0.5)) & 1) == 0;
  int ps = first ? s + 1 : s - 1;
  vec4 me = texelFetch(u_input, p, 0);
  if (ps < 0 || ps >= len) { fragColor = me; return; }
  ivec2 q = vert ? ivec2(p.x, sz.y - 1 - ps) : ivec2(ps, p.y);
  vec4 other = texelFetch(u_input, q, 0);
  float km = keyOf(me.rgb);
  float ko = keyOf(other.rgb);
  if (!(masked(me, km) && masked(other, ko))) { fragColor = me; return; }
  float ka = first ? km : ko; // key at the lower index of the pair
  float kb = first ? ko : km;
  bool swap = u_ascending > 0.5 ? ka > kb : ka < kb;
  fragColor = swap ? other : me;
}
