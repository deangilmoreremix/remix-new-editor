#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Sine-wave displacement; axis 0 = horizontal waves (displace y by x), 1 = vertical (displace x by y). Animated by u_time.
uniform float u_amplitude; uniform float u_frequency; uniform float u_speed; uniform float u_axis; uniform float u_time;
void main() {
  vec2 uv = v_texCoord;
  float ph = u_time * u_speed;
  if (u_axis < 0.5) uv.y += u_amplitude * sin(uv.x * u_frequency * 6.2831853 + ph);
  else uv.x += u_amplitude * sin(uv.y * u_frequency * 6.2831853 + ph);
  fragColor = texture(u_input, clamp(uv, 0.0, 1.0));
}
