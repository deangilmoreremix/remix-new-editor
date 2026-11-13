#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Sobel edge detection on luma. mixOriginal blends the source back in; invert flips to dark lines on white.
uniform float u_strength; uniform float u_threshold; uniform float u_mixOriginal; uniform float u_invert; uniform vec2 u_resolution;
float L(vec2 uv) { return dot(texture(u_input, clamp(uv, 0.0, 1.0)).rgb, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  float tl = L(v_texCoord + vec2(-px.x, -px.y)); float tc = L(v_texCoord + vec2(0.0, -px.y)); float tr = L(v_texCoord + vec2(px.x, -px.y));
  float ml = L(v_texCoord + vec2(-px.x, 0.0)); float mr = L(v_texCoord + vec2(px.x, 0.0));
  float bl = L(v_texCoord + vec2(-px.x, px.y)); float bc = L(v_texCoord + vec2(0.0, px.y)); float br = L(v_texCoord + vec2(px.x, px.y));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float e = clamp((length(vec2(gx, gy)) - u_threshold) * u_strength, 0.0, 1.0);
  if (u_invert > 0.5) e = 1.0 - e;
  fragColor = vec4(mix(vec3(e), c.rgb, clamp(u_mixOriginal, 0.0, 1.0)), c.a);
}
