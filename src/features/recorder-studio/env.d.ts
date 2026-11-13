// Untyped editor modules used for optional cloud transcription.
declare module "*/whisper-client.js" {
  export const whisperService: {
    transcribe(
      audio: Blob,
      options?: Record<string, unknown>,
    ): Promise<{ segments?: { words?: { word: string; start: number; end: number; confidence?: number }[] }[] }>;
  };
}
declare module "*/apiKeyManager.js" {
  export const apiKeyManager: { hasOpenAIKey?: () => boolean };
}
