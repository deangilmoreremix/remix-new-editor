#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Pen-path mask (Fix C): bezier path flattened on the CPU into <= 128 edges (u_poly: x0, y0, x1, y1 per vec4, frame coords 0..1, y down).
// Signed distance to the polygon (non-zero winding for inside), feathered, with expand, invert, opacity and a mask transform
// (offset / scale / rotate about the path centroid). The CPU twin is maskAlphaAt() in pathMask.ts. Original GLSL.
uniform vec4 u_poly[128];
uniform float u_count; uniform float u_feather; uniform float u_expand; uniform float u_opacity; uniform float u_invert;
uniform vec2 u_center; uniform vec2 u_offset; uniform float u_scale; uniform float u_rotate;
uniform float u_aspect; uniform float u_canvas_height;
void main() {
  vec4 c = texture(u_input, v_texCoord);
  if (u_count < 3.0) { fragColor = c; return; }
  vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
  float r = -radians(u_rotate);
  float co = cos(r); float si = sin(r);
  vec2 q = vec2((uv.x - u_center.x - u_offset.x) * u_aspect, uv.y - u_center.y - u_offset.y);
  vec2 p = vec2(q.x * co - q.y * si, q.x * si + q.y * co) / u_scale;
  p += vec2(u_center.x * u_aspect, u_center.y);
  float best = 1e9; int wn = 0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= u_count) break;
    vec4 e = u_poly[i];
    vec2 a = vec2(e.x * u_aspect, e.y);
    vec2 b = vec2(e.z * u_aspect, e.w);
    vec2 ab = b - a;
    float l2 = dot(ab, ab);
    float t = l2 > 0.0 ? clamp(dot(p - a, ab) / l2, 0.0, 1.0) : 0.0;
    best = min(best, length(p - a - ab * t));
    float cr = ab.x * (p.y - a.y) - (p.x - a.x) * ab.y;
    if (a.y <= p.y) { if (b.y > p.y && cr > 0.0) wn++; }
    else if (b.y <= p.y && cr < 0.0) wn--;
  }
  float dist = best * (wn != 0 ? -1.0 : 1.0) * u_scale - u_expand;
  float f = max(u_feather, 1.5 / max(u_canvas_height, 1.0));
  float t = clamp((dist - f * 0.5) / (-f), 0.0, 1.0);
  float m = t * t * (3.0 - 2.0 * t);
  if (u_invert > 0.5) m = 1.0 - m;
  m = 1.0 - u_opacity * (1.0 - m);
  fragColor = vec4(c.rgb, c.a * m);
}
