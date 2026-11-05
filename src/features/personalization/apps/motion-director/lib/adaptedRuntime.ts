import * as Brand from '../demosrc/_fixtures/Brand';
import * as ExportMode from '../demosrc/_fixtures/ExportMode';
import * as Fixtures from '../demosrc/_fixtures/Fixtures';
import * as Look from '../demosrc/_fixtures/Look';
import * as Motion from '../demosrc/_fixtures/Motion';
import * as PageCam2D from '../demosrc/_fixtures/PageCam2D';
import * as Polish from '../demosrc/_fixtures/Polish';
import * as liveTexture from '../demosrc/_fixtures/liveTexture';
import { compileAdapted, registerAdaptedFixtures, type AdaptedComponent } from './shotAdapter';

/**
 * Where adapted recipes are compiled and kept. A clip carries the adapted source (`adaptedCode`);
 * the demo wrapper asks for its component here, so preview, stills and export all play the same code.
 */
registerAdaptedFixtures({ Brand, ExportMode, Fixtures, Look, Motion, PageCam2D, Polish, liveTexture });

/** A short stable key for a piece of source. */
export const hashCode = (code: string): string => {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) | 0;
  return `${code.length.toString(36)}-${(h >>> 0).toString(36)}`;
};

const done = new Map<string, AdaptedComponent | null>();
const pending = new Map<string, Promise<AdaptedComponent | null>>();

/** The compiled component, if it is ready (null: compile failed, so the plain recipe plays; undefined: not tried yet). */
export const adaptedNow = (code: string): AdaptedComponent | null | undefined => done.get(hashCode(code));

/** Compile once per source; failures are remembered so one bad shot never retries on every frame. */
export const prepareAdapted = (code: string, stem: string): Promise<AdaptedComponent | null> => {
  const key = hashCode(code);
  if (done.has(key)) return Promise.resolve(done.get(key) ?? null);
  let p = pending.get(key);
  if (!p) {
    p = compileAdapted(code, stem)
      .then((c) => c, () => null)
      .then((c) => {
        done.set(key, c);
        pending.delete(key);
        return c;
      });
    pending.set(key, p);
  }
  return p;
};
