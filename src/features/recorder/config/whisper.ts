// Browser version: Whisper runs in the browser (src/lib/editor/remotion/transcribe.worker.js)
// instead of Whisper.cpp. Recorder used "medium.en"; the browser models are smaller ONNX ones
// with word timestamps.
export const WHISPER_MODEL = "onnx-community/whisper-base_timestamped";
// null = detect the language.
export const TRANSCRIPTION_LANGUAGE: string | null = null;
