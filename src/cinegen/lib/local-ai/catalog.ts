// [remix] Port I1: catalogue of the local (in-browser) AI models. Nothing is bundled; every model is downloaded on demand from the upstream
// Hugging Face repo after explicit user consent (see consent.ts). Licences were read from the upstream model cards / repo files on 2026-11-15
// (`curl https://huggingface.co/<repo>/raw/main/README.md` and `/api/models/<repo>`); the "how" of each check is stored in `licence.how` and shown in the UI.
// FreeCut (MIT) names the same repos in src/shared/utils/browser-whisper-models.ts, infrastructure/analysis/embeddings/clip-worker.ts and lfm/gemma workers.

export type ModelKind = 'asr' | 'embedding' | 'caption';
export type LicenceStatus =
  /** Licence declared on the exact repo that is downloaded. */
  | 'verified'
  /** The downloaded repo (an ONNX conversion) declares no licence of its own; the upstream base model's card declares a permissive one. */
  | 'verified-base'
  /** Licence could not be determined. Never enabled. */
  | 'unverified'
  /** Licence restricts commercial use / has a revenue threshold. Shipped disabled. */
  | 'restricted';
export type Backend = 'webgpu' | 'wasm';

export interface ModelLicence {
  name: string;
  spdx?: string;
  url: string;
  status: LicenceStatus;
  /** what was checked, shown to the user */
  how: string;
  checkedOn: string;
}

export interface ModelEntry {
  id: string;
  kind: ModelKind;
  name: string;
  purpose: string;
  /** Hugging Face repo that is downloaded (transformers.js loads `https://huggingface.co/<repo>/resolve/main/...`). */
  repo: string;
  sourceUrl: string;
  /** approximate download size per backend, bytes (sum of the ONNX files that backend downloads, from the repo file listing) */
  sizeBytes: { wasm: number; webgpu: number };
  languages: 'en' | 'multilingual';
  licence: ModelLicence;
  /** Offered for download at all. False = listed with an explanation, no download button. */
  enabled: boolean;
  /** why it is disabled (restricted licence, size, ...) */
  disabledReason?: string;
  /** Whisper only: word-level timestamps need the `_timestamped` export (cross-attention outputs). */
  wordTimestamps?: boolean;
}

const MB = 1024 * 1024;
const CHECKED = '2026-11-15';

export const MODEL_CATALOG: readonly ModelEntry[] = [
  {
    id: 'whisper-tiny-en', kind: 'asr', name: 'Whisper tiny (English)', repo: 'onnx-community/whisper-tiny.en_timestamped',
    purpose: 'Speech to text with word timestamps (captions). English only, fastest.',
    sourceUrl: 'https://huggingface.co/onnx-community/whisper-tiny.en_timestamped',
    sizeBytes: { wasm: 41 * MB, webgpu: 120 * MB }, languages: 'en', wordTimestamps: true, enabled: true,
    licence: { name: 'Apache-2.0 (base model openai/whisper-tiny.en)', spdx: 'Apache-2.0', url: 'https://huggingface.co/openai/whisper-tiny.en', status: 'verified-base',
      how: 'The ONNX repo declares no licence field; its base_model openai/whisper-tiny.en declares license: apache-2.0 on the model card (the Whisper code and weights repo on GitHub is MIT).', checkedOn: CHECKED },
  },
  {
    id: 'whisper-tiny', kind: 'asr', name: 'Whisper tiny (multilingual)', repo: 'onnx-community/whisper-tiny_timestamped',
    purpose: 'Speech to text with word timestamps in ~99 languages. Fast, lower accuracy.',
    sourceUrl: 'https://huggingface.co/onnx-community/whisper-tiny_timestamped',
    sizeBytes: { wasm: 41 * MB, webgpu: 120 * MB }, languages: 'multilingual', wordTimestamps: true, enabled: true,
    licence: { name: 'Apache-2.0 (base model openai/whisper-tiny)', spdx: 'Apache-2.0', url: 'https://huggingface.co/openai/whisper-tiny', status: 'verified-base',
      how: 'The ONNX repo declares no licence field; its base_model openai/whisper-tiny declares license: apache-2.0 on the model card.', checkedOn: CHECKED },
  },
  {
    id: 'whisper-base', kind: 'asr', name: 'Whisper base (multilingual)', repo: 'onnx-community/whisper-base_timestamped',
    purpose: 'Speech to text with word timestamps in ~99 languages. Better accuracy than tiny (the editor\'s previous default).',
    sourceUrl: 'https://huggingface.co/onnx-community/whisper-base_timestamped',
    sizeBytes: { wasm: 77 * MB, webgpu: 206 * MB }, languages: 'multilingual', wordTimestamps: true, enabled: true,
    licence: { name: 'Apache-2.0 (base model openai/whisper-base)', spdx: 'Apache-2.0', url: 'https://huggingface.co/openai/whisper-base', status: 'verified-base',
      how: 'The ONNX repo declares no licence field; its base_model openai/whisper-base declares license: apache-2.0 on the model card.', checkedOn: CHECKED },
  },
  {
    id: 'clip-vit-b32', kind: 'embedding', name: 'CLIP ViT-B/32 (image + text)', repo: 'Xenova/clip-vit-base-patch32',
    purpose: 'Semantic scene search: type "a person on a beach" and rank scene thumbnails. Runs on thumbnails only.',
    sourceUrl: 'https://huggingface.co/Xenova/clip-vit-base-patch32',
    sizeBytes: { wasm: 154 * MB, webgpu: 154 * MB }, languages: 'en', enabled: true,
    licence: { name: 'MIT', spdx: 'MIT', url: 'https://huggingface.co/Xenova/clip-vit-base-patch32', status: 'verified',
      how: 'Model card front matter of the downloaded repo says license: mit (base_model openai/CLIP, GitHub LICENSE is MIT).', checkedOn: CHECKED },
  },
  {
    id: 'smolvlm-256m', kind: 'caption', name: 'SmolVLM 256M Instruct (scene captions)', repo: 'HuggingFaceTB/SmolVLM-256M-Instruct',
    purpose: 'Writes a one-sentence description of each scene thumbnail; the text becomes searchable. English.',
    sourceUrl: 'https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct',
    sizeBytes: { wasm: 260 * MB, webgpu: 260 * MB }, languages: 'en', enabled: true,
    licence: { name: 'Apache-2.0', spdx: 'Apache-2.0', url: 'https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct', status: 'verified',
      how: 'Model card front matter of the downloaded repo says license: apache-2.0 (bases SmolLM2-135M-Instruct and SigLIP are Apache-2.0).', checkedOn: CHECKED },
  },
  {
    id: 'lfm2.5-vl-450m', kind: 'caption', name: 'LFM2.5-VL 450M (FreeCut\'s captioner)', repo: 'LiquidAI/LFM2.5-VL-450M-ONNX',
    purpose: 'Scene captioning model that FreeCut uses. NOT offered here.',
    sourceUrl: 'https://huggingface.co/LiquidAI/LFM2.5-VL-450M-ONNX',
    sizeBytes: { wasm: 0, webgpu: 0 }, languages: 'multilingual', enabled: false,
    disabledReason: 'Non-permissive licence: LFM Open License v1.0 allows commercial use only below USD 10M annual revenue (non-profit / research exempt). Left disabled; enable only after legal review.',
    licence: { name: 'LFM Open License v1.0', url: 'https://huggingface.co/LiquidAI/LFM2.5-VL-450M/raw/main/LICENSE', status: 'restricted',
      how: 'Model card front matter: license: other, license_name: lfm1.0; the LICENSE file defines "Threshold" = USD 10,000,000 annual revenue and a Commercial Use limitation (section 5).', checkedOn: CHECKED },
  },
  {
    id: 'gemma-4-e4b', kind: 'caption', name: 'Gemma 4 E4B (FreeCut\'s verifier)', repo: 'onnx-community/gemma-4-E4B-it-ONNX',
    purpose: 'Large multimodal model FreeCut uses for scene verification. NOT offered here.',
    sourceUrl: 'https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX',
    sizeBytes: { wasm: 0, webgpu: 0 }, languages: 'multilingual', enabled: false,
    disabledReason: 'Too large for a browser download (the repo is ~74 GB of ONNX variants) and its licence link points to Google\'s Gemma terms, which carry use restrictions beyond the Apache-2.0 tag. Not enabled.',
    licence: { name: 'Apache-2.0 tag + Gemma terms link', spdx: 'Apache-2.0', url: 'https://ai.google.dev/gemma/docs/gemma_4_license', status: 'unverified',
      how: 'Card says license: apache-2.0 with license_link to the Gemma licence page; the two were not reconciled, so it is treated as unverified.', checkedOn: CHECKED },
  },
] as const;

export const modelById = (id: string): ModelEntry | undefined => MODEL_CATALOG.find((m) => m.id === id);

/** A model can be downloaded only if the catalogue enables it and its licence is verified (never `unverified` / `restricted`). */
export function isDownloadable(m: ModelEntry): boolean {
  return m.enabled && (m.licence.status === 'verified' || m.licence.status === 'verified-base');
}

export const LICENCE_STATUS_LABEL: Record<LicenceStatus, string> = {
  verified: 'Licence verified on the downloaded repo',
  'verified-base': 'Licence verified on the upstream base model',
  unverified: 'Licence unverified',
  restricted: 'Restricted licence',
};

export function estimateBytes(m: ModelEntry, backend: Backend): number { return m.sizeBytes[backend]; }
