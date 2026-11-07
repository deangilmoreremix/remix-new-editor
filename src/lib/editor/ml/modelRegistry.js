/**
 * Free, in-browser AI models used by the Timeline Editor.
 *
 * Every model here runs on the viewer's own device through Transformers.js
 * (WebGPU when available, WASM otherwise). Nothing is sent to a paid API. The
 * weights download once from the Hugging Face hub and are then cached by the
 * browser (Cache API, "transformers-cache").
 *
 * Only commercially usable licences are listed (Apache-2.0 / MIT / CC-BY).
 * NLLB is deliberately absent: its weights are CC-BY-NC (non-commercial).
 *
 * sizeMB is the approximate first-download size for the dtype we load.
 */

export const LOCAL_MODELS = {
  sam: {
    id: 'Xenova/slimsam-77-uniform',
    label: 'Object masking (SlimSAM)',
    feature: 'Click or drag on a frame to cut out an object',
    sizeMB: 15,
    license: 'Apache-2.0',
  },
  clip: {
    id: 'Xenova/clip-vit-base-patch32',
    label: 'Visual search and tags (CLIP)',
    feature: 'Search footage by description; auto-tag media',
    sizeMB: 90,
    license: 'MIT',
  },
  detr: {
    id: 'Xenova/detr-resnet-50',
    label: 'Object detection (DETR)',
    feature: 'Tags the objects seen in media',
    sizeMB: 45,
    license: 'Apache-2.0',
  },
  florence: {
    id: 'onnx-community/Florence-2-base-ft',
    label: 'Describe and find objects (Florence-2)',
    feature: 'Writes prompts for Fill Gap, Extend and Music; finds objects by name for masking',
    sizeMB: 240,
    license: 'MIT',
  },
  whisper: {
    id: 'onnx-community/whisper-base_timestamped',
    label: 'Speech to text (Whisper)',
    feature: 'Transcribes clips on your device with word timestamps (Search, Cut and captions)',
    sizeMB: 150,
    license: 'MIT',
  },
  clap: {
    id: 'Xenova/clap-htsat-unfused',
    label: 'Audio understanding (CLAP)',
    feature: 'Finds music, speech, silence and applause; mood tags',
    sizeMB: 160,
    license: 'Apache-2.0',
  },
  diarize: {
    id: 'onnx-community/pyannote-segmentation-3.0',
    label: 'Speaker labels (pyannote)',
    feature: 'Labels who is speaking in captions',
    sizeMB: 6,
    license: 'MIT',
  },
  translate: {
    id: 'Xenova/m2m100_418M',
    label: 'Caption translation (M2M100)',
    feature: 'Translates captions into 100 languages',
    sizeMB: 480,
    license: 'MIT',
  },
  depth: {
    id: 'onnx-community/depth-anything-v2-small',
    label: 'Depth maps (Depth Anything V2)',
    feature: 'Background blur and 2.5D parallax',
    sizeMB: 27,
    license: 'Apache-2.0',
  },
  upscale: {
    id: 'Xenova/swin2SR-classical-sr-x2-64',
    label: 'Upscale stills 2× (Swin2SR)',
    feature: 'Sharper, larger image clips',
    sizeMB: 4,
    license: 'Apache-2.0',
  },
  kokoro: {
    id: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    label: 'Free voiceover (Kokoro)',
    feature: 'Text-to-speech voices that run on your device',
    sizeMB: 90,
    license: 'Apache-2.0',
  },
};

/** Languages offered for caption translation (M2M100 codes). */
export const TRANSLATE_LANGUAGES = [
  ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'],
  ['nl', 'Dutch'], ['pl', 'Polish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['tr', 'Turkish'],
  ['ar', 'Arabic'], ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'],
  ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['th', 'Thai'], ['sv', 'Swedish'], ['en', 'English'],
];

/** Kokoro voices (American / British English). */
export const KOKORO_VOICES = [
  ['af_heart', 'Heart (US, female)'], ['af_bella', 'Bella (US, female)'], ['af_nicole', 'Nicole (US, female)'],
  ['am_michael', 'Michael (US, male)'], ['am_fenrir', 'Fenrir (US, male)'], ['bf_emma', 'Emma (UK, female)'],
  ['bm_george', 'George (UK, male)'], ['bm_fable', 'Fable (UK, male)'],
];

export const modelKeys = () => Object.keys(LOCAL_MODELS);
export const modelInfo = (key) => LOCAL_MODELS[key] || null;
