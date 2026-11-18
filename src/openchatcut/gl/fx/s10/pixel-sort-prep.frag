#version 300 es
precision highp float;
// Pixel Sort, pass 0: copy the incoming picture into a canvas-sized texture (also the "original" for the strength mix).
// Original GLSL ES 3.00; the sorting idea (threshold-masked runs sorted by a colour key) is inspired by FreeCut's pixel-sort
// effect (MIT, https://github.com/walterlow/freecut @ 5ceeeb388eef5423640b7db157706274bf1b8165), whose code is a WGSL compute
// shader and was not copied or adapted. This implementation is an odd-even transposition sort over ping-pong fragment passes.
uniform sampler2D u_input;
in vec2 v_texCoord;
out vec4 fragColor;
void main() { fragColor = texture(u_input, v_texCoord); }
