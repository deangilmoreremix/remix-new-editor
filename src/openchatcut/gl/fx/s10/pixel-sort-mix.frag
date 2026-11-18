#version 300 es
precision highp float;
// Pixel Sort, final pass (only emitted when strength < 1): blend the original (pass 0) with the sorted picture (u_input).
uniform sampler2D u_input;
uniform sampler2D u_orig;
uniform float u_strength;
in vec2 v_texCoord;
out vec4 fragColor;
void main() { fragColor = mix(texture(u_orig, v_texCoord), texture(u_input, v_texCoord), clamp(u_strength, 0.0, 1.0)); }
