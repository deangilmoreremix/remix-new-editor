// src/lib/controls/ControlGenerator.js
// Maps ModelInput schemas to rendered DOM controls.

import { ValidatedState } from './ValidatedState.js';
import { evaluateVisibility } from './visibility.js';
import * as renderers from './renderers.js';

const TYPE_MAP = {
  string: renderers.renderTextInput,
  text: renderers.renderTextInput,
  textarea: renderers.renderTextarea,
  prompt: renderers.renderPromptInput,
  number: renderers.renderNumberInput,
  int: renderers.renderIntegerInput,
  integer: renderers.renderIntegerInput,
  slider: renderers.renderSlider,
  boolean: renderers.renderBooleanToggle,
  select: renderers.renderSelect,
  enum: renderers.renderEnumGroup,
  image: renderers.renderImageUpload,
  'image[]': renderers.renderImageArrayUpload,
  video: renderers.renderVideoUpload,
  audio: renderers.renderAudioUpload,
  color: renderers.renderColorInput,
  aspect_ratio: renderers.renderAspectRatioGrid,
  seed: renderers.renderSeedInput,
  model_selector: renderers.renderModelSelector,
};

export class ControlGenerator {
  constructor() {
    this.registry = TYPE_MAP;
  }

  // Normalize raw model input schema into ControlConfig
  normalize(key, schema, modelId) {
    const type = schema.type || 'string';
    const metadata = {
      default: schema.default,
      min: schema.minValue,
      max: schema.maxValue,
      step: schema.step,
      options: schema.enum,
      description: schema.description,
      tooltip: schema.description,
      placeholder: schema.placeholder,
      required: schema.required,
      visibleWhen: schema.visibleWhen,
      group: schema.group || (type === 'seed' || type === 'slider' || key === 'guidance_scale' || key === 'steps' ? 'advanced' : 'basic'),
      order: schema.order ?? 0,
    };

    return {
      key,
      type,
      label: schema.title || key,
      metadata,
      apiField: schema.field || key,
    };
  }

  generate(config, state) {
    const renderer = this.registry[config.type];
    if (!renderer) {
      // Fallback: render as text input
      return renderers.renderTextInput(config, state);
    }
    return renderer(config, state);
  }

  // Build all controls for a model, grouped and ordered
  buildControls(model, state, overrides = {}) {
    const inputs = model.inputs || {};
    const controls = Object.entries(inputs).map(([key, schema]) => {
      const cfg = this.normalize(key, schema, model.id);
      if (overrides[key]) Object.assign(cfg.metadata, overrides[key]);
      return cfg;
    });

    // Sort: basic first, then advanced, then custom groups
    const groupOrder = { basic: 0, advanced: 1, lora: 2 };
    controls.sort((a, b) => {
      const gA = groupOrder[a.metadata.group] ?? 99;
      const gB = groupOrder[b.metadata.group] ?? 99;
      if (gA !== gB) return gA - gB;
      return (a.metadata.order || 0) - (b.metadata.order || 0);
    });

    return controls;
  }

  // Render controls into a container, respecting visibility
  renderInto(model, state, container, options = {}) {
    const { onChange, overrides = {} } = options;
    const controls = this.buildControls(model, state, overrides);
    const rendered = new Map();

    // Clear container
    container.innerHTML = '';

    // Group containers
    const groups = {};
    controls.forEach(cfg => {
      if (!evaluateVisibility(cfg.metadata.visibleWhen || '', state)) return;

      const group = cfg.metadata.group || 'basic';
      if (!groups[group]) groups[group] = document.createElement('div');
      groups[group].className = 'flex flex-col gap-4';

      // Inject onChange so the studio can react
      const cfgWithOnChange = { ...cfg, onChange: (value) => {
        state.setValue(cfg.key, value);
        onChange?.(cfg.key, value);
      }};

      const renderer = this.registry[cfg.type] || renderers.renderTextInput;
      const ui = renderer(cfgWithOnChange, state);
      rendered.set(cfg.key, ui);

      const label = document.createElement('label');
      label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
      label.textContent = cfg.label;

      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'flex flex-col gap-1.5';
      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(ui.element);

      groups[group].appendChild(fieldWrapper);
    });

    // Append groups in order
    const groupOrder = ['basic', 'advanced', 'lora'];
    groupOrder.forEach(g => {
      if (groups[g]) container.appendChild(groups[g]);
    });

    // Return cleanup and update helpers
    return {
      rendered,
      update(newModel) {
        rendered.forEach((ui, key) => {
          const schema = newModel.inputs?.[key];
          if (!schema) return;
          const visible = evaluateVisibility(schema.visibleWhen || '', state);
          ui.element.style.display = visible ? '' : 'none';
        });
      },
      destroy() {
        rendered.forEach(ui => ui.destroy?.());
      },
    };
  }
}

export default ControlGenerator;
