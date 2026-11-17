// Stage 11 (port J): export container list + capability gating, and the runner / renderer agreement.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXPORT_CONTAINERS, containerInfo, isAudioOnlyContainer, supportedContainers, type ContainerProbes } from '@cinegen/lib/export/containers';
import { isAudioOnlyContainer as rendererAudioOnly, getSupportedVideoCodecsForContainer } from '@remotion/web-renderer';

const probes = (o: { avc?: boolean; vp9?: boolean; opus?: boolean; mp3?: boolean }): ContainerProbes => ({
  videoEncoder: async (c) => (c === 'avc' ? !!o.avc : !!o.vp9),
  audioEncoder: async (c) => (c === 'opus' ? !!o.opus : c === 'mp3' ? !!o.mp3 : true),
});

describe('export containers', () => {
  it('every container we list is one the installed Remotion web renderer knows (audio-only flag and video codecs agree)', () => {
    for (const c of EXPORT_CONTAINERS) {
      expect(rendererAudioOnly(c.id)).toBe(c.audioOnly);
      if (!c.audioOnly) expect(getSupportedVideoCodecsForContainer(c.id).length).toBeGreaterThan(0);
    }
    // the H.264 containers really accept H.264 in the renderer's own table
    for (const id of ['mp4', 'mov', 'mkv'] as const) expect(getSupportedVideoCodecsForContainer(id)).toContain('h264');
    expect(getSupportedVideoCodecsForContainer('webm')).toContain('vp9');
  });

  it('gates by capability: no H.264 encoder -> no mp4 / mov / mkv, audio-only still offered; WAV always', async () => {
    const r = await supportedContainers(probes({ avc: false, vp9: true, opus: true }), true);
    expect(r).toMatchObject({ mp4: false, mov: false, mkv: false, webm: true, wav: true, mp3: true, aac: true, flac: true, ogg: true });
    const none = await supportedContainers(probes({}), false);
    expect(none).toMatchObject({ mp4: false, webm: false, wav: true, ogg: false });
    const broken = await supportedContainers({ videoEncoder: async () => { throw new Error('x'); }, audioEncoder: async () => { throw new Error('y'); } }, false);
    expect(broken.wav).toBe(true); expect(broken.mp4).toBe(false);
  });

  it('lookup helpers fall back to mp4 for unknown ids', () => {
    expect(containerInfo('nope').id).toBe('mp4');
    expect(isAudioOnlyContainer('mp3')).toBe(true); expect(isAudioOnlyContainer('mkv')).toBe(false); expect(isAudioOnlyContainer(undefined)).toBe(false);
  });

  it('the sandboxed runner accepts exactly the listed containers', () => {
    const src = readFileSync('src/export-runner/main.jsx', 'utf8');
    const m = /\['mp4', 'webm', 'mov', 'mkv'[^\]]*\]\.includes\(options\.container\)/.exec(src);
    expect(m).not.toBeNull();
    for (const c of EXPORT_CONTAINERS) expect(m![0]).toContain(`'${c.id}'`);
  });
});
