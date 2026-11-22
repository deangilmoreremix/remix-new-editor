// [remix] Port I2: registry of the local (in-browser) audio-generation models. Standalone on purpose: it has the same shape as the
// Local AI model manager (id, name, purpose, sizeMB, licence, sourceUrl, loader) so it can be merged into that list later.
// Licences below were read from the upstream model cards / package manifests (see `licence.how`) on 2026-11-15. Weights are never
// bundled: they are fetched from Hugging Face on demand, after explicit consent (audio-manager.ts).

export type AudioModelPurpose = 'tts' | 'music';

export interface ModelLicence {
  /** SPDX-ish id as printed on the model card, or 'unknown'. */
  id: string;
  /** true only when the licence text/id was read from the upstream card or manifest (never guessed). */
  verified: boolean;
  /** true when the licence allows commercial use of the weights and their output. */
  commercialUse: boolean;
  /** where / how it was checked (shown to the end user). */
  how: string;
  /** link to the licence text or the card */
  url: string;
  /** extra obligations / caveats shown next to the licence */
  note?: string;
}

/** What loads the model. `kind` selects the code in audio-runtime.ts; the rest is data. */
export interface AudioModelLoader {
  kind: 'kokoro' | 'musicgen';
  repo: string;
  dtype: string | Record<string, string>;
  /** device preference order; the first one the browser supports is used */
  devices: ('webgpu' | 'wasm')[];
  /** URL fragments (lower case) of this model's files in the browser Cache Storage. The first one is the weights file: its presence means "installed"; removing deletes every match. */
  cacheFragments: string[];
}

export interface AudioModel {
  id: string;
  name: string;
  purpose: AudioModelPurpose;
  /** download size shown to the user (MB, 1 MB = 1e6 bytes; measured from the HF file listing) */
  sizeMB: number;
  licence: ModelLicence;
  sourceUrl: string;
  loader: AudioModelLoader;
  /** false = listed and explained but cannot be installed until the user opts in (non-commercial / unverified licence) */
  enabledByDefault: boolean;
  /** clip limits for music */
  durationSeconds?: { min: number; max: number; default: number };
  description: string;
}

const KOKORO_LICENCE: ModelLicence = {
  id: 'apache-2.0', verified: true, commercialUse: true,
  how: 'YAML front matter `license: apache-2.0` of huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX and of the base model hexgrad/Kokoro-82M (README says "Apache-licensed weights ... deployed in commercial APIs").',
  url: 'https://huggingface.co/hexgrad/Kokoro-82M',
  note: 'The kokoro-js / phonemizer runtime packages declare Apache-2.0; phonemizer embeds eSpeak NG (GPL-3.0) compiled to WASM, which the project owner should confirm is acceptable for distribution.',
};

export const AUDIO_MODELS: readonly AudioModel[] = [
  {
    id: 'kokoro-82m-q8', name: 'Kokoro 82M (compact, 8-bit)', purpose: 'tts', sizeMB: 93,
    licence: KOKORO_LICENCE, sourceUrl: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX',
    loader: { kind: 'kokoro', repo: 'onnx-community/Kokoro-82M-v1.0-ONNX', dtype: 'q8', devices: ['webgpu', 'wasm'], cacheFragments: ['onnx-community/kokoro-82m-v1.0-onnx/resolve/main/onnx/model_quantized.onnx'] },
    enabledByDefault: true,
    description: 'English narration, 28 voices. onnx/model_quantized.onnx (92.4 MB) + tokenizer; a voice file (about 0.5 MB) is fetched on first use of that voice.',
  },
  {
    id: 'kokoro-82m-fp32', name: 'Kokoro 82M (best quality, fp32)', purpose: 'tts', sizeMB: 326,
    licence: KOKORO_LICENCE, sourceUrl: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX',
    loader: { kind: 'kokoro', repo: 'onnx-community/Kokoro-82M-v1.0-ONNX', dtype: 'fp32', devices: ['webgpu', 'wasm'], cacheFragments: ['onnx-community/kokoro-82m-v1.0-onnx/resolve/main/onnx/model.onnx'] },
    enabledByDefault: true,
    description: 'Same voices at full precision (onnx/model.onnx, 325.5 MB). Best quality; slower on the WASM fallback.',
  },
  {
    id: 'musicgen-small', name: 'MusicGen Small (non-commercial)', purpose: 'music', sizeMB: 742,
    licence: {
      id: 'cc-by-nc-4.0', verified: true, commercialUse: false,
      how: 'YAML front matter `license: cc-by-nc-4.0` of huggingface.co/Xenova/musicgen-small and of the base model facebook/musicgen-small (HF API tags: license:cc-by-nc-4.0).',
      url: 'https://creativecommons.org/licenses/by-nc/4.0/',
      note: 'Non-commercial only: the weights (and music made with them) may not be used in commercial work. No permissive browser-runnable text-to-music model was found: facebook/musicgen-* and Xenova/musicgen-small are CC-BY-NC-4.0, cvssp/audioldm* are CC-BY-NC-SA-4.0, stabilityai/stable-audio-* use the Stability community licence ("other") and have no transformers.js build.',
    },
    sourceUrl: 'https://huggingface.co/Xenova/musicgen-small',
    loader: {
      kind: 'musicgen', repo: 'Xenova/musicgen-small', devices: ['webgpu', 'wasm'], cacheFragments: ['/xenova/musicgen-small/'],
      dtype: { text_encoder: 'q8', decoder_model_merged: 'q8', decoder_with_past_model: 'q8', encodec_decode: 'fp32', build_delay_pattern_mask: 'fp32' },
    },
    enabledByDefault: false, durationSeconds: { min: 2, max: 30, default: 8 },
    description: 'Mono 32 kHz music from a text prompt (FreeCut default). Disabled until you confirm non-commercial use.',
  },
];

export const getAudioModel = (id: string): AudioModel | undefined => AUDIO_MODELS.find((m) => m.id === id);

/** Why a model cannot be installed right now, or null when it can. `optedIn` = the user ticked the non-commercial acknowledgement. */
export function blockedReason(m: AudioModel, optedIn: boolean): string | null {
  if (!m.licence.verified) return 'Licence unverified: this model stays disabled until its licence is confirmed.';
  if (!m.licence.commercialUse && !optedIn) return `Licence ${m.licence.id} allows non-commercial use only. Confirm that your use is non-commercial to enable it.`;
  if (!m.enabledByDefault && m.licence.commercialUse && !optedIn) return 'Disabled by default: enable it explicitly.';
  return null;
}
