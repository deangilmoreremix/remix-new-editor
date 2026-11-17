/**
 * Auto-captions engine. There is ONE implementation of in-browser Whisper (Transformers.js, WebGPU → WebAssembly) and it lives in the
 * shared Caption Studio core (src/lib/captionStudio). This module only keeps the old import path alive for CineGen, the
 * personalization editor and the Timeline editor's agent API.
 */
export { WHISPER_MODELS, decodeAudio, transcribeInBrowser } from '../../captionStudio/transcribeClient.js';
