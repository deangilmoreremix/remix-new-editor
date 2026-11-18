#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Corner pin (Fix C): perspective warp of the frame onto a free quad. u_h0..u_h2 are the rows of the inverse homography
// (output position in frame coords, origin top-left, y down -> source position 0..1), built on the CPU (homography.ts).
// Outside the quad the pixel is transparent. Original GLSL.
uniform vec3 u_h0; uniform vec3 u_h1; uniform vec3 u_h2; uniform float u_valid;
void main() {
  vec3 q = vec3(v_texCoord.x, 1.0 - v_texCoord.y, 1.0);
  vec3 s = vec3(dot(u_h0, q), dot(u_h1, q), dot(u_h2, q));
  if (u_valid < 0.5 || abs(s.z) < 1e-8) { fragColor = vec4(0.0); return; }
  vec2 src = s.xy / s.z;
  // one-pixel soft edge from the screen-space derivative of the source position
  vec2 w = max(fwidth(src), vec2(1e-6));
  vec2 inside = clamp(src / w + 0.5, 0.0, 1.0) * clamp((vec2(1.0) - src) / w + 0.5, 0.0, 1.0);
  float a = inside.x * inside.y;
  vec4 c = texture(u_input, vec2(clamp(src.x, 0.0, 1.0), 1.0 - clamp(src.y, 0.0, 1.0)));
  fragColor = vec4(c.rgb, c.a * a);
}
