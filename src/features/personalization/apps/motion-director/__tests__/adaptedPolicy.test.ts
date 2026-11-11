// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adaptedCodeEnabled } from '../lib/adaptedPolicy';
import { prepareAdapted } from '../lib/adaptedRuntime';
import { adaptFilm } from '../lib/adaptLoop';
import { compileAdapted } from '../lib/shotAdapter';

afterEach(() => vi.unstubAllEnvs());

// A recipe that rebuilds "constructor" at runtime to reach the real window: the static check accepts it.
const ESCAPE = `
import React from 'react'
const key = String.fromCharCode(99,111,110,115,116,114,117,99,116,111,114)
const g = (() => {})[key]('return this')()
;(g as any).__ESCAPED__ = typeof (g as any).localStorage
export default function Evil() { return React.createElement('div') }
`;

describe('adapted recipes are opt-in', () => {
  it('is off unless a deployment sets VITE_MOTION_ALLOW_ADAPTED_CODE=true', () => {
    expect(adaptedCodeEnabled()).toBe(false);
    vi.stubEnv('VITE_MOTION_ALLOW_ADAPTED_CODE', 'true');
    expect(adaptedCodeEnabled()).toBe(true);
  });

  it('never executes adapted source by default (the plain recipe plays)', async () => {
    delete (globalThis as { __ESCAPED__?: string }).__ESCAPED__;
    expect(await prepareAdapted(ESCAPE, 'Evil')).toBeNull();
    expect((globalThis as { __ESCAPED__?: string }).__ESCAPED__).toBeUndefined();
  });

  it('makes no model calls when adaptation is off', async () => {
    const request = vi.fn();
    const project = { tracks: [] } as never;
    expect(await adaptFilm(project, { screens: [], crops: [] }, { request, render: vi.fn() } as never, vi.fn())).toBe(project);
    expect(request).not.toHaveBeenCalled();
  });

  it('documents why: the static check alone lets the escape through when enabled', async () => {
    // If this ever starts rejecting, the sandbox/check has improved and the default can be revisited.
    // (compileAdapted itself also refuses unless adapted code is enabled, so enable it for this case.)
    vi.stubEnv('VITE_MOTION_ALLOW_ADAPTED_CODE', 'true');
    await expect(compileAdapted(ESCAPE, 'Evil')).resolves.toBeTypeOf('function');
  });
});
