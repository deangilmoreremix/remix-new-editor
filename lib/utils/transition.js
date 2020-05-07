import createTexture from 'gl-texture2d';
import createTransition from 'gl-transition';
import transitions from 'gl-transitions';

export const makeTransition = ({ canvas, from, to, kind }) => {
  try {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 4, 4, -1]), // see a-big-triangle
      gl.STATIC_DRAW,
    );
    gl.viewport(0, 0, canvas.width, canvas.height);

    const fromTexture = createTexture(gl, from);
    fromTexture.minFilter = gl.LINEAR;
    fromTexture.magFilter = gl.LINEAR;

    const toTexture = createTexture(gl, to);
    toTexture.minFilter = gl.LINEAR;
    toTexture.magFilter = gl.LINEAR;

    const transition = createTransition(gl, transitions.find(t => t.name === kind));
    // https://github.com/gl-transitions/gl-transitions/blob/master/transitions/cube.glsl

    return { transition, from: fromTexture, to: toTexture };
  } catch (e) {
    console.error(e);
  }
};

export const playTransition = ({ canvas, transition, from, to, duration, callback }) => {
  let startTime = null;

  const loop = (t) => {
    if (!startTime) {
      startTime = t;
    }
    const diff = t - startTime;

    const durationMs = duration * 1000;

    if (diff < durationMs - 10) {
      requestAnimationFrame(loop);
    } else if (typeof callback === 'function') {
      callback();
    }

    const progress = (diff / durationMs) % 1;

    transition.draw(
      progress,
      from,
      to,
      canvas.width,
      canvas.height,
      { persp: 1.5, unzoom: 0.6 },
    );
  };
  requestAnimationFrame(loop);
};
