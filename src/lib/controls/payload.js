// src/lib/controls/payload.js
// Build API payload from ValidatedState and model schema.

export function buildApiPayload(state, model, exclude = new Set()) {
  const payload = { model: model.id };
  const inputs = model.inputs || {};

  for (const [inputName, inputDef] of Object.entries(inputs)) {
    if (exclude.has(inputName)) continue;
    const apiField = inputDef.field || inputName;
    const value = state.values[inputName];

    if (value === undefined || value === null || value === '') continue;

    // Seed special case: -1 means random / omit
    if (inputName === 'seed' && value === -1) continue;

    // Image array special case: send images_list (primary) + image_url (backward compat)
    if (Array.isArray(value) && inputDef.type === 'image[]') {
      payload.images_list = value;
      if (value.length > 0) payload.image_url = value[0];
      continue;
    }

    payload[apiField] = value;
  }

  return payload;
}
