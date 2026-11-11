// [remix] Smart Speech in the Timeline Studio Editor: the classic editor's own modal (lib/editor/agent/smartSpeechModal.js, with the
// 150 / 70 character limits, token insertion, saved voices and per-contact voices), hosted here. The generated audio becomes an asset
// plus an audio clip at the playhead; the speech settings (`tts`) are stored on the clip, separate from the audio file.
// @ts-expect-error plain JS modal
import { openSmartSpeechModal } from '../../../lib/editor/agent/smartSpeechModal.js';
// @ts-expect-error plain JS audio generation
import { generateAudio, persistAudio, probeDuration } from '../../../lib/editor/agent/audioGen.js';
// @ts-expect-error plain JS API keys
import { apiKeyManager } from '../../../lib/apiKeyManager.js';
// @ts-expect-error plain JS contact store
import * as contactStore from '../../../lib/contactStore.js';
// @ts-expect-error plain JS personalization
import { listContactProfiles } from '../../../lib/editor/personalize/perContact.js';
// @ts-expect-error plain JS token schema
import { TOKEN_DEFS } from '../../../components/personalize/tokenSchema.js';
import type { Clip } from '@cinegen/types/timeline';

export interface SmartSpeechHost {
  clips: () => Clip[];
  add: (a: { url: string; duration: number; tts: Record<string, unknown>; name: string }) => void;
  toast?: (message: string, kind?: string) => void;
}

export function openSmartSpeech(host: SmartSpeechHost) {
  return openSmartSpeechModal({
    hasKey: (provider: string) => {
      const key = provider === 'openai' ? apiKeyManager.getOpenAIKey?.() : apiKeyManager.getMuapiKey?.();
      return !!key && key !== 'dev';
    },
    listClips: () => host.clips().filter((c) => c.tts).map((c) => ({ id: c.id, name: c.name, src: '', tts: c.tts })),
    listContacts: () => listContactProfiles(contactStore),
    tokens: (TOKEN_DEFS as Array<{ key: string; label: string }>).map((d) => [d.key, d.label]),
    resolveTokens: (text: string) => text,
    toast: host.toast,
    async generate(request: unknown) {
      const remote = await generateAudio('tts', request);
      const url = await persistAudio(remote, { name: 'speech' });
      return { url, duration: (await probeDuration(url)) || 3 };
    },
    add: host.add,
  });
}
