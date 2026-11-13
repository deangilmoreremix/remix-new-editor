#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Adapted from Seriously.js (https://github.com/brianchirls/Seriously.js), commit 513d2b8696b76fe764b3033aa6dc7c99005acccd,
// file effects/seriously.emboss.js. Licence: MIT, Copyright (c) 2012-2014 Brian Chirls (repo LICENSE; file header carries no
// third-party notice). Port: WebGL1 GLSL -> GLSL ES 3.00, uniforms renamed to the u_* contract. Changes listed below.
// Changes: `texCoord ± 1/resolution` offsets are computed in the fragment shader (no custom vertex shader), alpha preserved,
// added u_blend (0 = upstream emboss, 1 = original image) and u_distance (tap offset in px).
uniform float u_amount; uniform float u_distance; uniform float u_blend; uniform vec2 u_resolution;
const vec3 average = vec3(1.0 / 3.0);
void main() {
  vec4 src = texture(u_input, v_texCoord);
  vec2 offset = u_distance / max(u_resolution, vec2(1.0));
  vec4 pixel = vec4(0.5, 0.5, 0.5, 1.0);
  pixel -= texture(u_input, v_texCoord - offset) * u_amount;
  pixel += texture(u_input, v_texCoord + offset) * u_amount;
  pixel.rgb = vec3(dot(pixel.rgb, average));
  fragColor = vec4(mix(clamp(pixel.rgb, 0.0, 1.0), src.rgb, clamp(u_blend, 0.0, 1.0)), src.a);
}
