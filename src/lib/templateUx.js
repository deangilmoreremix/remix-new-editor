// Small client-side helpers that make the template studios easier to use:
// "Try an example", remembered inputs, and required-field checks. Nothing
// here calls an API; saved inputs live in localStorage.

const STORAGE_PREFIX = 'template_last_inputs:';
const FORM_TYPES = new Set(['text', 'textarea', 'select']);

/** CSS.escape with a fallback (older browsers, jsdom). */
export function cssEscape(value) {
  const str = String(value);
  return (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(str) : str.replace(/["\\\]\[]/g, '\\$&');
}

const isFormInput = (input) => !!input && !!input.name && FORM_TYPES.has(input.type);

function safeStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** Sample value for one input, or null when it should be left alone. */
export function exampleValueFor(input) {
  if (!isFormInput(input)) return null;
  if (input.type === 'select') {
    const options = input.options || [];
    return options.length ? options[Math.min(1, options.length - 1)] : null;
  }
  const placeholder = String(input.placeholder || '').trim();
  if (placeholder) return placeholder.replace(/^(e\.g\.?|for example|ex:)\s*/i, '').trim();
  return `Sample ${String(input.label || input.name).toLowerCase()}`;
}

/** { name: sampleValue } for every text / textarea / select input. */
export function buildExampleValues(inputs = []) {
  const values = {};
  inputs.forEach((input) => {
    const v = exampleValueFor(input);
    if (v) values[input.name] = v;
  });
  return values;
}

/** Remember the user's text / select inputs for a template (media is never stored). */
export function saveTemplateInputs(templateId, inputs = [], values = {}) {
  const store = safeStorage();
  if (!store || !templateId) return;
  const out = {};
  inputs.filter(isFormInput).forEach((input) => {
    const v = values[input.name];
    if (typeof v === 'string' && v.trim()) out[input.name] = v;
  });
  try {
    if (Object.keys(out).length) store.setItem(STORAGE_PREFIX + templateId, JSON.stringify(out));
    else store.removeItem(STORAGE_PREFIX + templateId);
  } catch { /* quota or private mode: remembering is optional */ }
}

/** Saved values for a template, limited to inputs that still exist (select values must still be options). */
export function loadTemplateInputs(templateId, inputs = []) {
  const store = safeStorage();
  if (!store || !templateId) return {};
  let saved;
  try { saved = JSON.parse(store.getItem(STORAGE_PREFIX + templateId) || 'null'); } catch { return {}; }
  if (!saved || typeof saved !== 'object') return {};
  const out = {};
  inputs.filter(isFormInput).forEach((input) => {
    const v = saved[input.name];
    if (typeof v !== 'string' || !v) return;
    if (input.type === 'select' && !(input.options || []).includes(v)) return;
    out[input.name] = v;
  });
  return out;
}

/** Required text / select inputs that are empty, in form order. */
export function missingRequiredInputs(inputs = [], values = {}) {
  return inputs.filter((input) => isFormInput(input) && input.required
    && !String(values[input.name] ?? '').trim());
}

/**
 * Write values into the rendered fields (matched by data-input-name or name) and fire
 * input/change so the studio's own handlers update their state.
 * @returns {number} how many fields were filled
 */
export function applyValuesToForm(root, values = {}) {
  let filled = 0;
  Object.entries(values).forEach(([name, value]) => {
    const n = cssEscape(name);
    const el = root.querySelector(`[data-input-name="${n}"], [name="${n}"]`);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    filled++;
  });
  return filled;
}

/** Mark / unmark a field as invalid for assistive tech and sighted users. */
export function setFieldInvalid(el, invalid) {
  if (!el) return;
  if (invalid) {
    el.setAttribute('aria-invalid', 'true');
    el.classList.add('border-red-400/60');
  } else {
    el.removeAttribute('aria-invalid');
    el.classList.remove('border-red-400/60');
  }
}

/** True for Ctrl/Cmd+Enter. */
export function isGenerateShortcut(event) {
  return !!(event && event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey);
}
