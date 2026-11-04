/**
 * Minimal WebGL renderer for gl-transitions (https://gl-transitions.com,
 * MIT / BSD shaders, the `gl-transitions` npm package already in
 * package.json). Replaces upstream's videoTransition plugin, which also
 * used gl-transitions, without its Popcorn/jQuery wiring.
 *
 * renderer.render(fromSource, toSource, progress) draws one frame; sources
 * are <video>, <img> or <canvas> elements (or null for black).
 */

let transitionsPromise = null;
/** Lazy-load the shader catalogue (≈200 KB) the first time it's needed. */
export function loadGlTransitions() {
  if (!transitionsPromise) {
    transitionsPromise = import('gl-transitions/gl-transitions.json').then((m) => m.default || m);
  }
  return transitionsPromise;
}

const VERTEX = `
attribute vec2 _p;
varying vec2 _uv;
void main() {
  gl_Position = vec4(_p, 0.0, 1.0);
  _uv = vec2(0.5, 0.5) * (_p + vec2(1.0, 1.0));
}`;

/** Fragment shader wrapping a gl-transition's `vec4 transition(vec2 uv)`. */
export function fragmentFor(transition) {
  return `
precision highp float;
varying vec2 _uv;
uniform sampler2D from, to;
uniform float progress, ratio, _fromR, _toR;
vec4 getFromColor(vec2 uv) { return texture2D(from, uv); }
vec4 getToColor(vec2 uv) { return texture2D(to, uv); }
${transition.glsl}
void main() { gl_FragColor = transition(_uv); }`;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
}

function setParam(gl, loc, type, value) {
  if (loc == null || value == null) return;
  switch (type) {
    case 'float': gl.uniform1f(loc, value); break;
    case 'int': case 'bool': gl.uniform1i(loc, Number(value)); break;
    case 'vec2': gl.uniform2fv(loc, value); break;
    case 'vec3': gl.uniform3fv(loc, value); break;
    case 'vec4': gl.uniform4fv(loc, value); break;
    case 'ivec2': gl.uniform2iv(loc, value); break;
    default: break;
  }
}

const sourceSize = (s) => ({
  w: s?.videoWidth || s?.naturalWidth || s?.width || 0,
  h: s?.videoHeight || s?.naturalHeight || s?.height || 0,
});

export function createTransitionRenderer(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: false })
    || canvas.getContext('experimental-webgl');
  if (!gl) throw new Error('WebGL is not available');

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const black = new Uint8Array([0, 0, 0, 255]);

  const makeTexture = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
    return tex;
  };
  const texFrom = makeTexture();
  const texTo = makeTexture();

  let program = null;
  let current = null;

  function setTransition(transition) {
    if (current === transition) return;
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentFor(transition));
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
    if (program) gl.deleteProgram(program);
    program = p;
    current = transition;
  }

  function upload(tex, unit, source) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const { w, h } = sourceSize(source);
    if (source && w && h && (source.readyState === undefined || source.readyState >= 2)) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      // Throws a SecurityError for cross-origin media without CORS.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      return w / h;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
    return 1;
  }

  function render(fromSource, toSource, progress, params = {}) {
    if (!program) return;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    const fromR = upload(texFrom, 0, fromSource);
    const toR = upload(texTo, 1, toSource);
    const u = (name) => gl.getUniformLocation(program, name);
    gl.uniform1i(u('from'), 0);
    gl.uniform1i(u('to'), 1);
    gl.uniform1f(u('progress'), Math.max(0, Math.min(1, progress)));
    gl.uniform1f(u('ratio'), canvas.width / (canvas.height || 1));
    gl.uniform1f(u('_fromR'), fromR);
    gl.uniform1f(u('_toR'), toR);
    const types = current.paramsTypes || {};
    const values = { ...(current.defaultParams || {}), ...params };
    Object.keys(types).forEach((k) => setParam(gl, u(k), types[k], values[k]));
    const pos = gl.getAttribLocation(program, '_p');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return {
    setTransition,
    render,
    destroy() {
      try {
        if (program) gl.deleteProgram(program);
        gl.deleteTexture(texFrom);
        gl.deleteTexture(texTo);
        gl.deleteBuffer(buffer);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch { /* context already gone */ }
    },
  };
}
