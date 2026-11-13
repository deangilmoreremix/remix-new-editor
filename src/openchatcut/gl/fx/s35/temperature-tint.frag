#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// White-balance style temperature (blue<->amber) and tint (green<->magenta) as per-channel gains, optional luma preserve.
uniform float u_temperature; uniform float u_tint; uniform float u_preserveLuma;
void main() {
  vec4 c = texture(u_input, v_texCoord);
  vec3 gain = vec3(1.0 + 0.30 * u_temperature + 0.10 * u_tint,
                   1.0 - 0.20 * u_tint,
                   1.0 - 0.30 * u_temperature + 0.10 * u_tint);
  vec3 o = c.rgb * gain;
  float l0 = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float l1 = max(dot(o, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  o = mix(o, o * (l0 / l1), clamp(u_preserveLuma, 0.0, 1.0));
  fragColor = vec4(clamp(o, 0.0, 1.0), c.a);
}
