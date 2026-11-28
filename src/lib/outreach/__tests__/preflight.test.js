import { describe, it, expect, vi } from 'vitest';
import { preflight, summarizePreflight, lookupFacts } from '../preflight.js';

const MR = (supported) => Object.assign(function MediaRecorder() {}, { isTypeSupported: (t) => supported.includes(t) });
const good = () => ({ isSecureContext: true, MediaRecorder: MR(['video/webm']), navigator: { mediaDevices: { getUserMedia() {} }, onLine: true } });
const facts = (over = {}) => ({ permissions: { camera: 'granted', microphone: 'granted' }, devices: [{ kind: 'videoinput' }, { kind: 'audioinput' }], storageEstimate: { quota: 5e9, usage: 1e8 }, battery: { level: 0.8, charging: false }, ...over });
const by = (items, id) => items.find((i) => i.id === id);

describe('recording preflight', () => {
  it('is all ok on a good setup', () => {
    const items = preflight(good(), facts());
    expect(summarizePreflight(items)).toMatchObject({ status: 'ok', ready: true, fail: 0, warn: 0 });
  });
  it('fails, with advice, when recording cannot work', () => {
    const items = preflight({ isSecureContext: false, navigator: {} }, facts({ devices: [{ kind: 'audioinput' }] }));
    expect(by(items, 'secure')).toMatchObject({ status: 'fail', advice: expect.stringMatching(/https/) });
    expect(by(items, 'capture').status).toBe('fail');
    expect(by(items, 'recorder').status).toBe('fail');
    expect(by(items, 'devices')).toMatchObject({ status: 'fail', advice: expect.stringMatching(/No camera found/) });
    expect(summarizePreflight(items).ready).toBe(false);
  });
  it('a blocked permission fails; "prompt" and unknown do not', () => {
    expect(by(preflight(good(), facts({ permissions: { camera: 'denied', microphone: 'prompt' } })), 'camera').status).toBe('fail');
    const items = preflight(good(), facts({ permissions: { camera: 'denied', microphone: 'prompt' } }));
    expect(by(items, 'microphone')).toMatchObject({ status: 'ok', advice: expect.stringMatching(/ask/) });
    expect(by(preflight(good(), facts({ permissions: {} })), 'camera').status).toBe('warn');
  });
  it('warns, never fails, for low space, low battery and being offline', () => {
    const e = good(); e.navigator.onLine = false;
    const items = preflight(e, facts({ storageEstimate: { quota: 3e8, usage: 2e8 }, battery: { level: 0.1, charging: false } }));
    expect(by(items, 'storage')).toMatchObject({ status: 'warn', advice: expect.stringMatching(/about 95 MB/) });
    expect(by(items, 'battery').status).toBe('warn');
    expect(by(items, 'online').status).toBe('warn');
    expect(summarizePreflight(items).ready).toBe(true);
  });
  it('a charging or healthy battery is fine, and a missing battery API is simply not listed', () => {
    expect(by(preflight(good(), facts({ battery: { level: 0.05, charging: true } })), 'battery').status).toBe('ok');
    expect(by(preflight(good(), facts({ battery: null })), 'battery')).toBeUndefined();
  });
  it('says so when facts are not known', () => {
    const items = preflight(good(), {});
    expect(by(items, 'devices')).toMatchObject({ status: 'warn', advice: expect.stringMatching(/Could not be checked/) });
    expect(by(items, 'storage').status).toBe('warn');
  });
  it('looks facts up without ever asking for the camera or microphone', async () => {
    const getUserMedia = vi.fn();
    const nav = {
      permissions: { query: async ({ name }) => ({ state: name === 'camera' ? 'granted' : 'prompt' }) },
      mediaDevices: { getUserMedia, enumerateDevices: async () => [{ kind: 'videoinput', label: 'x', deviceId: 'secret' }] },
      storage: { estimate: async () => ({ quota: 10, usage: 1 }) },
      getBattery: async () => ({ level: 0.5, charging: true }),
    };
    const f = await lookupFacts({ navigator: nav });
    expect(f.permissions).toEqual({ camera: 'granted', microphone: 'prompt' });
    expect(f.devices).toEqual([{ kind: 'videoinput' }]); // kinds only: no names or ids kept
    expect(f.storageEstimate).toEqual({ quota: 10, usage: 1 });
    expect(f.battery).toEqual({ level: 0.5, charging: true });
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it('leaves out anything the browser refuses', async () => {
    const f = await lookupFacts({ navigator: { permissions: { query: async () => { throw new Error('unsupported'); } } } });
    expect(f.permissions).toEqual({});
    expect(f).not.toHaveProperty('devices');
    expect(f).not.toHaveProperty('battery');
  });
});
