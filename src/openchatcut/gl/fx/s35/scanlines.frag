#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Adapted from Seriously.js (https://github.com/brianchirls/Seriously.js), commit 513d2b8696b76fe764b3033aa6dc7c99005acccd,
// file effects/seriously.scanlines.js. Licence: MIT, Copyright (c) 2012-2014 Brian Chirls (repo LICENSE; file header carries no
// third-party notice). Port: WebGL1 GLSL -> GLSL ES 3.00, uniforms renamed to the u_* contract. Changes listed below.
// Changes: upstream declares uniform `width` but binds input `size`, so `width` was never set; here u_size is used in its place.
// Alpha preserved (upstream forced 1.0). Intensity 0 = identity.
uniform float u_lines; uniform float u_size; uniform float u_intensity;
void main() {
  vec4 pixel = texture(u_input, v_texCoord);
  float darken = 2.0 * abs(fract(v_texCoord.y * u_lines / 2.0) - 0.5);
  darken = clamp(darken - u_size + 0.5, 0.0, 1.0);
  darken = 1.0 - ((1.0 - darken) * u_intensity);
  fragColor = vec4(pixel.rgb * darken, pixel.a);
}
