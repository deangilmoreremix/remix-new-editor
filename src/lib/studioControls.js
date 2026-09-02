// src/lib/studioControls.js
// Helper to integrate the dynamic control engine into existing studios.
// Renders model-specific advanced controls into a container.

import { ControlGenerator } from './controls/ControlGenerator.js';
import { ValidatedState } from './controls/ValidatedState.js';
import { buildApiPayload } from './controls/payload.js';

export function createAdvancedControls({ model, state, container, extraInputs = {}, onChange, exclude = new Set() }) {
  if (!model) return;
  const generator = new ControlGenerator();

  // Seed defaults from model inputs
  const panelState = new ValidatedState(model.id);
  for (const [key, schema] of Object.entries(model.inputs || {})) {
    if (schema.default !== undefined) {
      panelState.setValue(key, schema.default);
    }
  }

  // Patched model with extra studio-specific inputs
  const patchedModel = {
    ...model,
    inputs: { ...model.inputs, ...extraInputs },
  };

  const rendered = generator.renderInto(patchedModel, panelState, container, {
    onChange: (key, value) => {
      onChange?.(key, value);
    },
  });

  return {
    state: panelState,
    update(newModel) {
      rendered.update(newModel);
    },
    destroy() {
      rendered.destroy();
    },
    getPayload(extra = {}) {
      const payload = buildApiPayload(panelState, patchedModel, exclude);
      return { ...payload, ...extra };
    },
    validate() {
      return panelState.validate(patchedModel);
    },
    getValue(key) {
      return panelState.getValue(key);
    },
    setValue(key, value) {
      panelState.setValue(key, value);
    },
  };
}
