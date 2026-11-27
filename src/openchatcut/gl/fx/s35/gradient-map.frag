#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Gradient map: luminance -> 3-stop colour ramp (shadow / mid / highlight), stops given as HSV.
uniform float u_shadowHue; uniform float u_shadowSat; uniform float u_shadowVal;
uniform float u_midHue; uniform float u_midSat; uniform float u_midVal;
uniform float u_highHue; uniform float u_highSat; uniform float u_highVal;
uniform float u_midPos; uniform float u_intensity;
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h / 60.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
void main() {
  vec4 c = texture(u_input, v_texCoord);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 a = hsv(u_shadowHue, u_shadowSat, u_shadowVal);
  vec3 b = hsv(u_midHue, u_midSat, u_midVal);
  vec3 d = hsv(u_highHue, u_highSat, u_highVal);
  float mp = clamp(u_midPos, 0.05, 0.95);
  vec3 g = l < mp ? mix(a, b, l / mp) : mix(b, d, (l - mp) / (1.0 - mp));
  fragColor = vec4(mix(c.rgb, g, clamp(u_intensity, 0.0, 1.0)), c.a);
}
