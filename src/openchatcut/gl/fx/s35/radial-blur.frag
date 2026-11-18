#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Radial blur: mode 0 = zoom blur (samples along rays to the centre), mode 1 = spin blur (samples along arcs).
uniform float u_mode; uniform float u_amount; uniform float u_center_x; uniform float u_center_y; uniform vec2 u_resolution;
const int N = 24;
void main() {
  vec2 ctr = vec2(u_center_x, u_center_y);
  vec2 d = v_texCoord - ctr;
  float asp = u_resolution.x / max(u_resolution.y, 1.0);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < N; i++) {
    float t = float(i) / float(N - 1) - 0.5;
    vec2 uv;
    if (u_mode < 0.5) {
      uv = ctr + d * (1.0 - u_amount * (t + 0.5));
    } else {
      float a = u_amount * 0.5 * t;
      vec2 q = vec2(d.x * asp, d.y);
      float s = sin(a); float co = cos(a);
      q = vec2(q.x * co - q.y * s, q.x * s + q.y * co);
      uv = ctr + vec2(q.x / asp, q.y);
    }
    acc += texture(u_input, clamp(uv, 0.0, 1.0));
  }
  fragColor = acc / float(N);
}
