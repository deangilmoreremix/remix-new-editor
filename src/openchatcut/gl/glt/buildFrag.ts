// Adapts an upstream gl-transitions shader (spec v1: `vec4 transition(vec2 uv)`, getFromColor/getToColor,
// `progress`, `ratio`) to the two-input contract of gl/runtime.ts: GLSL ES 1.00 fragment (the runtime pairs it
// with its ES 1.00 vertex shader), samplers u_outgoing/u_incoming, varying v_texCoord, u_progress, u_aspect.
// The shader text itself is not modified; it is only wrapped.
export function buildGltFrag(glsl: string): string {
  return `precision highp float;
varying vec2 v_texCoord;
uniform sampler2D u_outgoing;
uniform sampler2D u_incoming;
uniform float u_progress;
uniform float u_aspect;
#define progress u_progress
#define ratio u_aspect
vec4 getFromColor(vec2 uv) { return texture2D(u_outgoing, uv); }
vec4 getToColor(vec2 uv) { return texture2D(u_incoming, uv); }
${glsl}
void main() { gl_FragColor = transition(v_texCoord); }
`;
}
