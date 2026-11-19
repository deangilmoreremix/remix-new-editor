#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Adapted from Seriously.js (https://github.com/brianchirls/Seriously.js), commit 513d2b8696b76fe764b3033aa6dc7c99005acccd,
// file effects/seriously.polar.js. Licence: MIT, Copyright (c) 2012-2014 Brian Chirls (repo LICENSE; file header carries no
// third-party notice). Port: WebGL1 GLSL -> GLSL ES 3.00, uniforms renamed to the u_* contract. Changes listed below.
// Changes: added u_amount (0 = original, 1 = full polar mapping); coordinates clamped; alpha preserved.
uniform float u_angle; uniform float u_amount;
const float PI = 3.14159265358979;
void main() {
  vec4 src = texture(u_input, v_texCoord);
  vec2 norm = (1.0 - v_texCoord) * 2.0 - 1.0;
  float theta = mod(PI + atan(norm.x, norm.y) - u_angle * (PI / 180.0), PI * 2.0);
  vec2 polar = vec2(theta / (2.0 * PI), length(norm));
  vec4 p = texture(u_input, clamp(polar, 0.0, 1.0));
  fragColor = vec4(mix(src.rgb, p.rgb, clamp(u_amount, 0.0, 1.0)), src.a);
}
