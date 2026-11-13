#version 300 es
precision highp float;
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
// Adapted from Seriously.js (https://github.com/brianchirls/Seriously.js), commit 513d2b8696b76fe764b3033aa6dc7c99005acccd,
// file effects/seriously.exposure.js. Licence: MIT, Copyright (c) 2012-2014 Brian Chirls (repo LICENSE; file header carries no
// third-party notice). Port: WebGL1 GLSL -> GLSL ES 3.00, uniforms renamed to the u_* contract. Changes listed below.
// Changes: alpha preserved, result clamped to 0..1, default 0 stops = identity.
uniform float u_exposure;
void main() {
  vec4 pixel = texture(u_input, v_texCoord);
  fragColor = vec4(clamp(pow(2.0, u_exposure) * pixel.rgb, 0.0, 1.0), pixel.a);
}
