// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { createCameraAngleControl, cameraTransform, CAMERA_LIMITS } from '../components/edit/cameraAngleControl.js';

function setup(defaults = { rotation: 0, tilt: 0, zoom: 0 }) {
  const container = document.createElement('div');
  const inputs = {};
  for (const key of ['rotation', 'tilt', 'zoom']) {
    const input = document.createElement('input');
    input.type = 'range';
    input.dataset.controlKey = `adj_${key}`;
    input.dataset.default = String(defaults[key]);
    input.min = String(CAMERA_LIMITS[key][0]);
    input.max = String(CAMERA_LIMITS[key][1]);
    input.value = String(defaults[key]);
    container.appendChild(input);
    inputs[key] = input;
  }
  const widget = createCameraAngleControl();
  container.appendChild(widget.element);
  document.body.innerHTML = '';
  document.body.appendChild(container);
  widget.bind(container);
  const stage = widget.element.querySelector('[data-camera-stage]');
  stage.getBoundingClientRect = () => ({ width: 270, height: 135, left: 0, top: 0, right: 270, bottom: 135 });
  return { widget, inputs, stage };
}
const ptr = (type, x, y, id = 1) => Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerId: id });
const val = (inputs) => ({ rotation: +inputs.rotation.value, tilt: +inputs.tilt.value, zoom: +inputs.zoom.value });

describe('cameraTransform', () => {
  test('is neutral at 0/0/0 and follows the Angles conventions', () => {
    expect(cameraTransform({})).toBe('scale(1.000) rotateX(0deg) rotateY(0deg)');
    // camera to the right -> right edge toward the viewer; camera above -> top edge away
    expect(cameraTransform({ rotation: 45, tilt: 30, zoom: 100 })).toBe('scale(1.500) rotateX(30deg) rotateY(-45deg)');
    expect(cameraTransform({ zoom: -100 })).toContain('scale(0.500)');
  });
  test('clamps out-of-range values', () => {
    expect(cameraTransform({ rotation: 999, tilt: -999, zoom: 999 })).toBe('scale(1.500) rotateX(-90deg) rotateY(-180deg)');
  });
});

describe('camera angle control', () => {
  test('dragging changes rotation and tilt through the sliders and fires their input events', () => {
    const { inputs, stage } = setup();
    const seen = vi.fn();
    inputs.rotation.addEventListener('input', seen);
    stage.dispatchEvent(ptr('pointerdown', 100, 100));
    stage.dispatchEvent(ptr('pointermove', 100 + 27, 100)); // 27px of 270px = 27 degrees
    stage.dispatchEvent(ptr('pointermove', 127, 100 - 13.5)); // 13.5px up of 135px = +13.5 tilt
    stage.dispatchEvent(ptr('pointerup', 127, 86));
    expect(val(inputs)).toMatchObject({ rotation: 27, tilt: 14 });
    expect(seen).toHaveBeenCalled();
  });

  test('values clamp to the slider limits', () => {
    const { inputs, stage } = setup();
    stage.dispatchEvent(ptr('pointerdown', 0, 0));
    stage.dispatchEvent(ptr('pointermove', 5000, -5000));
    expect(val(inputs)).toMatchObject({ rotation: 180, tilt: 90 });
  });

  test('wheel zooms in and out, within range', () => {
    const { inputs, stage } = setup();
    const up = new window.WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    stage.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
    expect(val(inputs).zoom).toBe(10);
    for (let i = 0; i < 30; i++) stage.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    expect(val(inputs).zoom).toBe(-100);
  });

  test('two-finger pinch changes zoom', () => {
    const { inputs, stage } = setup();
    stage.dispatchEvent(ptr('pointerdown', 100, 100, 1));
    stage.dispatchEvent(ptr('pointerdown', 140, 100, 2)); // 40px apart
    stage.dispatchEvent(ptr('pointermove', 180, 100, 2)); // now 80px apart = ratio 2 -> +100
    expect(val(inputs).zoom).toBe(100);
  });

  test('keyboard nudges, Shift takes bigger steps, Home resets', () => {
    const { inputs, stage } = setup();
    const key = (k, extra = {}) => stage.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
    key('ArrowRight'); key('ArrowUp'); key('+');
    expect(val(inputs)).toEqual({ rotation: 5, tilt: 5, zoom: 10 });
    key('ArrowLeft', { shiftKey: true });
    expect(val(inputs).rotation).toBe(-10);
    key('Home');
    expect(val(inputs)).toEqual({ rotation: 0, tilt: 0, zoom: 0 });
  });

  test('Reset all returns to each slider\'s own default', () => {
    const { widget, inputs } = setup({ rotation: 0, tilt: 10, zoom: 0 });
    inputs.rotation.value = '90'; inputs.tilt.value = '-30'; inputs.zoom.value = '50';
    widget.element.querySelector('[data-camera-reset]').click();
    expect(val(inputs)).toEqual({ rotation: 0, tilt: 10, zoom: 0 });
  });

  test('moving a slider (or a preset) moves the card and the readout', () => {
    const { widget, inputs } = setup();
    inputs.rotation.value = '45'; inputs.zoom.value = '20';
    inputs.rotation.dispatchEvent(new Event('input', { bubbles: true }));
    expect(widget.element.querySelector('[data-camera-card]').style.transform).toBe('scale(1.100) rotateX(0deg) rotateY(-45deg)');
    expect(widget.element.querySelector('[data-camera-readout]').textContent).toBe('Rotation 45° · Tilt 0° · Zoom 20');
  });

  test('shows the user\'s photo, and a placeholder without one', () => {
    const { widget } = setup();
    const img = widget.element.querySelector('img');
    expect(img.classList.contains('hidden')).toBe(true);
    widget.setImage('https://x/a.png');
    expect(img.getAttribute('src')).toBe('https://x/a.png');
    expect(img.classList.contains('hidden')).toBe(false);
    widget.setImage(null);
    expect(img.hasAttribute('src')).toBe(false);
    expect(img.classList.contains('hidden')).toBe(true);
  });

  test('is keyboard reachable and labelled', () => {
    const { stage } = setup();
    expect(stage.tabIndex).toBe(0);
    expect(stage.getAttribute('aria-label')).toMatch(/drag/i);
  });
});
