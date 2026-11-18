#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Vibrance: boost low-saturation colours more than saturated ones, with skin-tone protection; plus global saturation.
uniform float u_vibrance; uniform float u_saturation; uniform float u_protectSkin;
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec3 rgb = c.rgb;
  float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(rgb.r, max(rgb.g, rgb.b));
  float mn = min(rgb.r, min(rgb.g, rgb.b));
  float sat = mx - mn;
  // skin hue region (orange): r > g > b with moderate saturation
  float skin = step(rgb.g, rgb.r) * step(rgb.b, rgb.g) * smoothstep(0.05, 0.25, sat) * (1.0 - smoothstep(0.55, 0.8, sat));
  float w = (1.0 - sat) * (1.0 - u_protectSkin * skin);
  float k = u_vibrance >= 0.0 ? 1.0 + u_vibrance * 2.0 * w : 1.0 + u_vibrance;
  rgb = mix(vec3(l), rgb, k);
  rgb = mix(vec3(l), rgb, 1.0 + u_saturation);
  fragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}
