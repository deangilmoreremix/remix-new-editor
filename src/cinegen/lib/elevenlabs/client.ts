import type { ElevenLabsAudioRequest, ElevenLabsAudioResult, ElevenLabsPreview, ElevenLabsVoice } from './types';
// [remix] CineGen reaches ElevenLabs through its own cloud account. Here the same client surface is served by MuAPI
// (the user's own key): speech -> MuAPI ElevenLabs, sound effects -> Suno sounds, enhancer -> OpenAI. See adapters/web-elevenlabs.ts.
export async function elevenLabsRpc<T>(method: string, params?: unknown): Promise<T> {
  const { elevenLabsWeb } = await import('@cinegen/adapters/web-elevenlabs');
  return await elevenLabsWeb(method, params) as T;
}
export const elevenLabs = {
  enhance: (params: { requestId: string; kind: 'voice' | 'direction' | 'sound'; text: string; feedback?: string }) => elevenLabsRpc<{ status: 'running' | 'complete' | 'error'; text?: string; error?: string }>('enhance', params),
  status: () => elevenLabsRpc<{ connected: boolean; connection?: 'mcp' | 'api-key' }>('accountStatus'),
  authLogin: () => elevenLabsRpc<{ attempt: string; authorizationUrl: string }>('authLogin'),
  authCancel: (attempt: string) => elevenLabsRpc('authCancel', { attempt }),
  authStatus: (attempt: string) => elevenLabsRpc<{ connected: boolean; error?: string }>('authStatus', { attempt }),
  connect: (secret: string) => elevenLabsRpc<{ connected: boolean }>('connect', { secret }),
  disconnect: () => elevenLabsRpc('disconnect'),
  voices: (search = '', cursor?: string) => elevenLabsRpc<{ voices: ElevenLabsVoice[]; cursor?: string }>('voices', { search, cursor }),
  generate: (params: ElevenLabsAudioRequest) => elevenLabsRpc<ElevenLabsAudioResult>('generate', params),
  job: (requestId: string) => elevenLabsRpc<ElevenLabsAudioResult>('job', { requestId }),
  design: (description: string, text?: string, language?: string) => elevenLabsRpc<{ previews: ElevenLabsPreview[]; text: string }>('design', { description, text, language }),
  saveVoice: (id: string, name: string, description: string, viewStateId?: string) => elevenLabsRpc<ElevenLabsVoice>('saveVoice', { id, name, description, viewStateId }),
};
