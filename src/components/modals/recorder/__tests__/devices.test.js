// Device discovery + permission handling, ported from the Recorder's get-devices.ts / DevicePermission.tsx behaviour.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDevices, getDeviceLabel, describePermissionError, hasNewDevices } from '../capture.js';

const dev = (kind, deviceId, label) => ({ kind, deviceId, label });
let getUserMedia;
let enumerate;
let stopped;

const stream = () => ({ getTracks: () => [{ stop: () => { stopped += 1; } }] });

beforeEach(() => {
  localStorage.clear();
  stopped = 0;
  getUserMedia = vi.fn(async () => stream());
  enumerate = vi.fn();
  Object.defineProperty(globalThis.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia, enumerateDevices: enumerate } });
});

describe('getDevices', () => {
  it('first visit: devices come back unlabelled, so access is requested once and the labelled list is returned', async () => {
    enumerate
      .mockResolvedValueOnce([dev('videoinput', '', ''), dev('audioinput', '', '')]) // before permission: empty ids and labels
      .mockResolvedValueOnce([dev('videoinput', 'cam1', 'FaceTime HD Camera (1C1C:B782)'), dev('audioinput', 'mic1', 'MacBook Microphone (Built-in)')]);
    const devices = await getDevices();
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(devices.map((d) => d.deviceId)).toEqual(['cam1', 'mic1']);
    expect(stopped).toBe(1); // the probe stream is released straight away
  });

  it('remembers clean labels so a later visit does not prompt again', async () => {
    enumerate
      .mockResolvedValueOnce([dev('videoinput', '', '')])
      .mockResolvedValueOnce([dev('videoinput', 'cam1', 'FaceTime HD Camera (1C1C:B782)')]);
    await getDevices();
    expect(getDeviceLabel(dev('videoinput', 'cam1', ''))).toBe('FaceTime HD Camera'); // label survives even when the browser hides it
    enumerate.mockResolvedValueOnce([dev('videoinput', 'cam1', 'FaceTime HD Camera (1C1C:B782)')]);
    getUserMedia.mockClear();
    await getDevices();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(hasNewDevices([dev('videoinput', 'cam1', 'x')])).toBe(false);
    expect(hasNewDevices([dev('videoinput', 'cam2', 'x')])).toBe(true);
  });

  it('a machine with a microphone but no camera still gets its microphone listed', async () => {
    getUserMedia
      .mockRejectedValueOnce(Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' })) // camera + mic together
      .mockRejectedValueOnce(Object.assign(new Error('Requested device not found'), { name: 'NotFoundError' })) // camera only
      .mockResolvedValueOnce(stream()); // microphone only works
    enumerate
      .mockResolvedValueOnce([dev('audioinput', '', '')])
      .mockResolvedValueOnce([dev('audioinput', 'mic1', 'USB Mic')]);
    const devices = await getDevices();
    expect(getUserMedia).toHaveBeenCalledTimes(3);
    expect(devices[0].deviceId).toBe('mic1');
  });

  it('a blocked permission is reported straight away and not retried', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
    enumerate.mockResolvedValueOnce([dev('videoinput', '', '')]);
    await expect(getDevices()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('describePermissionError', () => {
  it('explains a blocked permission and how to fix it', () => {
    expect(describePermissionError({ name: 'NotAllowedError' })).toMatch(/blocked.*Rescan devices/s);
  });
  it('explains missing hardware', () => {
    expect(describePermissionError({ name: 'NotFoundError' })).toMatch(/No camera or microphone was found/);
  });
});
