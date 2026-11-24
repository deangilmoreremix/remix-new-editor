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

  // `exclude` names model inputs the studio owns (drawn by its own UI or set
  // from its own state): don't render them here either, only strip them from
  // the payload. Inputs the studio passes in `extraInputs` are its own on
  // purpose, so they still render even when excluded from the payload.
  const renderInputs = {};
  for (const [key, schema] of Object.entries(model.inputs || {})) {
    if (!exclude.has(key)) renderInputs[key] = schema;
  }
  const renderModel = { ...model, inputs: { ...renderInputs, ...extraInputs } };

  const rendered = generator.renderInto(renderModel, panelState, container, {
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
