// Audio Studio: which "delivery" controls a model really supports (pure, unit-testable).
// Tone, Emotion and Pitch used to be shown for every model but were never sent anywhere.
// They now appear only for a model whose input schema has the matching field, and are
// then sent; otherwise the studio shows DELIVERY_HINT instead of a control that does nothing.

export const modelHasField = (model, name) => Boolean(model?.inputs) && Object.prototype.hasOwnProperty.call(model.inputs, name);

export const DELIVERY_HINT = 'Tone, emotion and pitch aren\'t supported by this model. Describe the delivery in your prompt instead (for example: "in a warm, slow, cheerful voice").';

/** Request fields for the delivery controls, only for fields this model's schema has. */
export function deliveryParams(model, { tone, emotion, pitch } = {}) {
  const out = {};
  if (modelHasField(model, 'tone') && tone && tone !== 'neutral') out.tone = tone;
  if (modelHasField(model, 'emotion') && emotion && emotion !== 'none') out.emotion = emotion;
  if (modelHasField(model, 'pitch') && pitch !== undefined) out.pitch = pitch;
  return out;
}

/**
 * Schema fields the studio draws with its own controls (so the generic schema renderer skips them).
 * `speed` is hardcoded only for speech (tts) models: a model like elevenlabs-tts-turbo-2-5 has no
 * `type` but its own `speed` field, which must render and be sent like any other schema field.
 */
export function hardcodedAudioKeys(model) {
  const keys = ['prompt', 'style', 'duration', 'voice', 'tone', 'emotion', 'pitch'];
  if (model?.type === 'tts') keys.push('speed');
  return keys;
}
