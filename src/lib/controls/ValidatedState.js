// src/lib/controls/ValidatedState.js
// Lightweight state container for dynamic controls.

export class ValidatedState {
  constructor(modelId = '') {
    this.modelId = modelId;
    this.values = {};
    this.errors = {};
    this.dirty = new Set();
  }

  setValue(key, value) {
    this.values[key] = value;
    this.dirty.add(key);
    this._clearError(key);
  }

  getValue(key, fallback = undefined) {
    return key in this.values ? this.values[key] : fallback;
  }

  setError(key, message) {
    this.errors[key] = message;
  }

  _clearError(key) {
    delete this.errors[key];
  }

  validate(model) {
    this.errors = {};
    const inputs = model.inputs || {};

    // Required string fields
    for (const [key, schema] of Object.entries(inputs)) {
      if (schema.required !== false && schema.type !== 'image' && schema.type !== 'video' && schema.type !== 'audio') {
        const val = this.values[key];
        if (val === undefined || val === null || String(val).trim() === '') {
          this.errors[key] = `${schema.title || key} is required.`;
        }
      }
    }

    // Numeric bounds
    for (const [key, schema] of Object.entries(inputs)) {
      const val = this.values[key];
      if (typeof val === 'number' && !isNaN(val)) {
        if (schema.minValue != null && val < schema.minValue) {
          this.errors[key] = `${schema.title || key} must be at least ${schema.minValue}.`;
        }
        if (schema.maxValue != null && val > schema.maxValue) {
          this.errors[key] = `${schema.title || key} must be at most ${schema.maxValue}.`;
        }
        if (schema.step != null && schema.step !== 1 && val % schema.step !== 0) {
          this.errors[key] = `${schema.title || key} must be a multiple of ${schema.step}.`;
        }
      }
    }

    return this.errors;
  }

  isValid() {
    return Object.keys(this.errors).length === 0;
  }

  toJSON() {
    return {
      modelId: this.modelId,
      values: { ...this.values },
      errors: { ...this.errors },
      dirty: Array.from(this.dirty),
    };
  }
}
