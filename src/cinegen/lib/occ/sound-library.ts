// [remix] OpenChatCut's built-in sound-effect library, hosted in the CineGen editor. Their registry (soundLibrary.ts) lists
// every effect; only the files that ship in their assets folder can play, so availability is read from SOUND_FILES.
import { SOUND_EFFECTS, soundEffectSrc, type SoundEffect } from '../../../openchatcut/audio/soundLibrary';

/** mp3 files shipped with OpenChatCut's assets/sound-effects (the registry lists more than ship). */
export const SOUND_FILES = new Set(['airy-short-whoosh', 'awkward-crow-flyby', 'camera-shutter', 'cash-register-success', 'censor-beep', 'clean-ding', 'crisp-ui-click', 'deep-impact-hit', 'deep-short-whoosh', 'gear-turn-click', 'glitchy-tv-signal', 'mouse-click', 'new-notification-ping', 'phone-notification-ping', 'record-scratch-rewind', 'record-scratch-stop', 'sent-message-ping', 'sharp-bass-riser', 'short-drum-roll-sting', 'short-shutter-click', 'simple-whoosh', 'sitcom-laugh-track', 'soft-air-whoosh', 'success-chime', 'synthetic-bubble-pop', 'tiny-bubble-pop', 'tv-switch-off-noise', 'ui-pop-up-alert', 'vintage-camera-shutter']);

export const availableSounds = (): SoundEffect[] => SOUND_EFFECTS.filter((s) => SOUND_FILES.has(s.id)).sort((a, b) => a.order - b.order);
export const missingSoundCount = (): number => SOUND_EFFECTS.length - availableSounds().length;
export { soundEffectSrc };
