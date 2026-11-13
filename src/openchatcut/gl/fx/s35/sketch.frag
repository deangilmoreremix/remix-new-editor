#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Pencil sketch (original implementation, not derived from Seriously): Sobel outline + luma cross-hatching on paper.
uniform float u_lineStrength; uniform float u_hatch; uniform float u_colorMix; uniform float u_hatchScale; uniform vec2 u_resolution;
float L(vec2 uv) { return dot(texture(u_input, clamp(uv, 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  float tl = L(v_texCoord + vec2(-px.x, -px.y)); float tc = L(v_texCoord + vec2(0.0, -px.y)); float tr = L(v_texCoord + vec2(px.x, -px.y));
  float ml = L(v_texCoord + vec2(-px.x, 0.0)); float mr = L(v_texCoord + vec2(px.x, 0.0));
  float bl = L(v_texCoord + vec2(-px.x, px.y)); float bc = L(v_texCoord + vec2(0.0, px.y)); float br = L(v_texCoord + vec2(px.x, px.y));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = clamp(length(vec2(gx, gy)) * u_lineStrength, 0.0, 1.0);
  float l = L(v_texCoord);
  vec2 p = v_texCoord * u_resolution / max(u_hatchScale, 1.0);
  float h1 = step(0.5, fract((p.x + p.y) * 0.25)) * step(l, 0.7);
  float h2 = step(0.5, fract((p.x - p.y) * 0.25)) * step(l, 0.4);
  float hatch = clamp(h1 * 0.5 + h2 * 0.5, 0.0, 1.0) * u_hatch;
  float paper = 0.96 - edge * 0.85 - hatch * 0.45;
  vec3 col = mix(vec3(paper), c.rgb * paper, clamp(u_colorMix, 0.0, 1.0));
  fragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}
