#version 300 es
precision highp float;
// Separable box blur, pass V. Original GLSL (box kernel, radius in pixels).
uniform sampler2D u_input;
uniform float u_radius;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 fragColor;
void main() {
  int r = int(u_radius + 0.5);
  if (r < 1) { fragColor = texture(u_input, v_texCoord); return; }
  r = min(r, 48);
  vec2 step1 = vec2(0.0, 1.0) / max(u_resolution, vec2(1.0));
  vec4 acc = vec4(0.0);
  for (int i = -48; i <= 48; i++) {
    if (i < -r || i > r) continue;
    acc += texture(u_input, v_texCoord + step1 * float(i));
  }
  fragColor = acc / float(2 * r + 1);
}
