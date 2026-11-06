import { describe, expect, it, vi } from 'vitest';
import { compileAdapted, adaptedCodeIsEnabled } from '../lib/shotAdapter';
import { adaptFilm, adaptShot } from '../lib/adaptLoop';
import { prepareAdapted } from '../lib/adaptedRuntime';

// AI-adapted code is off until it can run isolated from the app's origin (the static check is a
// blacklist and can be bypassed), so nothing may compile or run it, and no model call is spent on it.
describe('adapted code stays off', () => {
  const benign = 'import React from "react"; export default function Shot() { return null }';
  // Reaches the global object by building the property name from parts; the static check misses it.
  const escape = "const key = ['con', 'structor'].join(''); const make = (() => {})[key]; const root = make('return this')(); export default () => root;";

  it('is off by default', () => {
    expect(adaptedCodeIsEnabled()).toBe(false);
  });

  it('refuses to compile anything, including code that would pass the static check', async () => {
    await expect(compileAdapted(benign)).rejects.toThrow('adapted code is turned off');
    await expect(compileAdapted(escape)).rejects.toThrow('adapted code is turned off');
  });

  it('the runtime falls back to the plain recipe (null) instead of running it', async () => {
    expect(await prepareAdapted(escape, 'Shot')).toBeNull();
  });

  it('the adapt loop does not ask the model to write code', async () => {
    const request = vi.fn();
    const source = vi.fn();
    const project = { clips: [] } as never;
    const out = await adaptFilm(project, {} as never, { request, source } as never, () => {});
    expect(out).toBe(project);
    expect(await adaptShot(project, { props: {} } as never, {} as never, { request, source } as never, new AbortController().signal)).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
  });
});
