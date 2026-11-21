// [remix] Stage 11 (port J): output containers the export can offer. The Remotion web renderer (renderMediaOnWeb, mediabunny underneath) writes
// mp4 / mov / mkv / webm video and wav / mp3 / aac / flac / ogg audio-only files; this file is the one place that lists them and decides, from
// capability probes, which are offered in THIS browser. FreeCut's own export types list the same set (src/types/export.ts: video mp4/mov/webm/mkv,
// audio mp3/aac/wav) but its encoder pipeline is not used: only the idea of the list is.
export type ExportContainer = 'mp4' | 'mov' | 'mkv' | 'webm' | 'wav' | 'mp3' | 'aac' | 'flac' | 'ogg';

export interface ContainerInfo { id: ExportContainer; label: string; ext: string; mime: string; audioOnly: boolean; note?: string }

export const EXPORT_CONTAINERS: ContainerInfo[] = [
  { id: 'mp4', label: 'MP4 video (H.264 + AAC)', ext: 'mp4', mime: 'video/mp4', audioOnly: false },
  { id: 'mov', label: 'MOV video (H.264 + AAC)', ext: 'mov', mime: 'video/quicktime', audioOnly: false },
  { id: 'mkv', label: 'MKV video (H.264 + AAC)', ext: 'mkv', mime: 'video/x-matroska', audioOnly: false },
  { id: 'webm', label: 'WebM video (VP9 + Opus)', ext: 'webm', mime: 'video/webm', audioOnly: false },
  { id: 'wav', label: 'WAV audio only (lossless)', ext: 'wav', mime: 'audio/wav', audioOnly: true },
  { id: 'mp3', label: 'MP3 audio only', ext: 'mp3', mime: 'audio/mpeg', audioOnly: true },
  { id: 'aac', label: 'AAC audio only (.aac)', ext: 'aac', mime: 'audio/aac', audioOnly: true },
  { id: 'flac', label: 'FLAC audio only (lossless)', ext: 'flac', mime: 'audio/flac', audioOnly: true },
  { id: 'ogg', label: 'Ogg audio only (Opus)', ext: 'ogg', mime: 'audio/ogg', audioOnly: true },
];

export const containerInfo = (id: string | undefined): ContainerInfo => EXPORT_CONTAINERS.find((c) => c.id === id) ?? EXPORT_CONTAINERS[0];
export const isAudioOnlyContainer = (id: string | undefined): boolean => !!EXPORT_CONTAINERS.find((c) => c.id === id)?.audioOnly;
export const isExportContainer = (id: unknown): id is ExportContainer => typeof id === 'string' && EXPORT_CONTAINERS.some((c) => c.id === id);

/** What the browser can do. Injected so the decision logic is testable; `browserProbes()` fills it in the real page. */
export interface ContainerProbes {
  /** WebCodecs video encoder for 'avc' | 'vp9' */
  videoEncoder: (codec: 'avc' | 'vp9') => Promise<boolean>;
  /** mediabunny audio encoder (native WebCodecs or a registered one) */
  audioEncoder: (codec: 'opus' | 'aac' | 'mp3' | 'flac' | 'pcm-s16') => Promise<boolean>;
}

/**
 * Which containers are offered. WAV is always possible (PCM is written directly). MP3, AAC and FLAC fall back to the WASM encoders the renderer bundles
 * (@mediabunny/{mp3,aac,flac}-encoder), so they are offered whenever the page can run WebAssembly. H.264-based video containers need a WebCodecs H.264
 * encoder, WebM a VP9 one, Ogg an Opus one.
 */
export async function supportedContainers(p: ContainerProbes, hasWasm = typeof WebAssembly === 'object'): Promise<Record<ExportContainer, boolean>> {
  const safe = async (f: () => Promise<boolean>) => { try { return !!(await f()); } catch { return false; } };
  const [avc, vp9, opus] = await Promise.all([safe(() => p.videoEncoder('avc')), safe(() => p.videoEncoder('vp9')), safe(() => p.audioEncoder('opus'))]);
  const wasmAudio = hasWasm;
  return { mp4: avc, mov: avc, mkv: avc, webm: vp9 && opus, wav: true, mp3: wasmAudio || (await safe(() => p.audioEncoder('mp3'))), aac: wasmAudio || (await safe(() => p.audioEncoder('aac'))), flac: wasmAudio || (await safe(() => p.audioEncoder('flac'))), ogg: opus };
}

export async function browserProbes(): Promise<ContainerProbes> {
  const mb = await import('mediabunny');
  return {
    videoEncoder: async (codec) => {
      if (typeof VideoEncoder !== 'function') return false;
      const cfg = codec === 'avc' ? { codec: 'avc1.640028', width: 1280, height: 720, bitrate: 4_000_000 } : { codec: 'vp09.00.10.08', width: 1280, height: 720, bitrate: 4_000_000 };
      return !!(await VideoEncoder.isConfigSupported(cfg)).supported;
    },
    audioEncoder: async (codec) => (codec === 'pcm-s16' ? true : mb.canEncodeAudio(codec)),
  };
}
