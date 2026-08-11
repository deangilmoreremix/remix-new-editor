/**
 * Effect Studio Parameter Validation
 *
 * Production-ready validation for all effect generation parameters.
 * Centralizes validation logic so it can be reused in UI, API client,
 * and tests. Every parameter has explicit bounds, defaults, and error messages.
 */

// ─── Validation Error Type ───────────────────────────────────────────────
export class EffectParamError extends Error {
  constructor(message, field, code) {
    super(message);
    this.name = 'EffectParamError';
    this.field = field;
    this.code = code;
  }
}

// ─── Parameter Schemas ───────────────────────────────────────────────────
export const EFFECT_PARAM_SCHEMA = {
  prompt: {
    type: 'string',
    required: false,
    maxLength: 4096,
    description: 'Text prompt describing the desired effect',
  },
  negative_prompt: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'What to exclude from generation',
  },
  seed: {
    type: 'integer',
    required: false,
    min: -1,
    max: 4_294_967_295,
    default: null,
    description: 'Random seed for reproducibility (-1 or null = random)',
  },
  guidance_scale: {
    type: 'float',
    required: false,
    min: 1.0,
    max: 20.0,
    default: 7.5,
    step: 0.5,
    description: 'Classifier-free guidance scale (prompt adherence)',
  },
  steps: {
    type: 'integer',
    required: false,
    min: 1,
    max: 50,
    default: 20,
    description: 'Number of diffusion denoising steps',
  },
  denoise_strength: {
    type: 'float',
    required: false,
    min: 0.0,
    max: 1.0,
    default: 0.7,
    step: 0.05,
    description: 'How much to change from source (0 = preserve, 1 = regenerate)',
  },
  effect_strength: {
    type: 'float',
    required: false,
    min: 0.0,
    max: 1.0,
    default: 1.0,
    step: 0.05,
    description: 'Effect application strength (0 = none, 1 = full)',
  },
  aspect_ratio: {
    type: 'enum',
    required: false,
    values: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'],
    default: '16:9',
    description: 'Output aspect ratio',
  },
  resolution: {
    type: 'enum',
    required: false,
    values: ['480p', '720p', '1080p', '1440p', '2160p'],
    default: '720p',
    description: 'Output resolution tier',
  },
  duration: {
    type: 'float',
    required: false,
    min: 1,
    max: 15,
    default: 5,
    step: 1,
    description: 'Video duration in seconds',
  },
  fps: {
    type: 'enum',
    required: false,
    values: [15, 24, 25, 30, 60],
    default: 24,
    description: 'Frames per second',
  },
  output_format: {
    type: 'enum',
    required: false,
    values: ['mp4', 'webm'],
    default: 'mp4',
    description: 'Output container format',
  },
  model: {
    type: 'string',
    required: false,
    description: 'Model identifier (set by caller before validation)',
  },
  name: {
    type: 'string',
    required: false,
    description: 'Effect preset name (required for effect endpoints)',
  },
  image_url: {
    type: 'url',
    required: false,
    description: 'Source image URL',
  },
  cfg_scale: {
    type: 'float',
    required: false,
    min: 0.0,
    max: 7.0,
    default: 0.5,
    step: 0.1,
    description: 'Kling-style CFG scale (0-7)',
  },
  prompt_extend: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Enable AI prompt rewriting',
  },
};

export function validateField(value, rules) {
  if (rules.required && (value === undefined || value === null || value === '')) {
    return { valid: false, value: rules.default, error: `${rules.description || 'Field'} is required` };
  }
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: rules.default, error: null };
  }
  switch (rules.type) {
    case 'string': {
      const str = String(value).trim();
      if (rules.maxLength && str.length > rules.maxLength) {
        return { valid: false, value: str, error: `${rules.description} must not exceed ${rules.maxLength} characters` };
      }
      if (rules.minLength && str.length < rules.minLength) {
        return { valid: false, value: str, error: `${rules.description} must be at least ${rules.minLength} characters` };
      }
      return { valid: true, value: str, error: null };
    }
    case 'integer': {
      const num = Number(value);
      if (!Number.isInteger(num)) {
        return { valid: false, value: null, error: `${rules.description} must be an integer` };
      }
      if (rules.min !== undefined && num < rules.min) {
        return { valid: false, value: num, error: `${rules.description} must be >= ${rules.min}` };
      }
      if (rules.max !== undefined && num > rules.max) {
        return { valid: false, value: num, error: `${rules.description} must be <= ${rules.max}` };
      }
      return { valid: true, value: num, error: null };
    }
    case 'float': {
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, value: null, error: `${rules.description} must be a number` };
      }
      if (rules.min !== undefined && num < rules.min) {
        return { valid: false, value: num, error: `${rules.description} must be >= ${rules.min}` };
      }
      if (rules.max !== undefined && num > rules.max) {
        return { valid: false, value: num, error: `${rules.description} must be <= ${rules.max}` };
      }
      if (rules.step) {
        const rounded = Math.round(num / rules.step) * rules.step;
        return { valid: true, value: parseFloat(rounded.toFixed(2)), error: null };
      }
      return { valid: true, value: num, error: null };
    }
    case 'enum': {
      const str = String(value);
      if (!rules.values.includes(str)) {
        return { valid: false, value: str, error: `${rules.description} must be one of: ${rules.values.join(', ')}` };
      }
      return { valid: true, value: str, error: null };
    }
    case 'url': {
      const str = String(value).trim();
      try {
        new URL(str);
        return { valid: true, value: str, error: null };
      } catch {
        return { valid: false, value: str, error: `${rules.description} must be a valid URL` };
      }
    }
    case 'boolean': {
      return { valid: true, value: Boolean(value), error: null };
    }
    default:
      return { valid: true, value, error: null };
  }
}
export function validateEffectParams(params, schema = EFFECT_PARAM_SCHEMA) {
  const errors = [];
  const sanitized = {};
  for (const [key, rules] of Object.entries(schema)) {
    const result = validateField(params[key], rules);
    if (!result.valid) {
      errors.push({ field: key, message: result.error, code: 'INVALID_PARAM' });
    }
    if (result.value !== undefined) {
      sanitized[key] = result.value;
    }
  }
  return { valid: errors.length === 0, errors, sanitized };
}
export function validateEffectName(name, allowedNames) {
  if (!name || typeof name !== 'string') {
    throw new EffectParamError('Effect name is required', 'name', 'MISSING_NAME');
  }
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (allowedNames && !allowedNames.has(trimmed)) {
    throw new EffectParamError(`Effect "${trimmed}" is not supported`, 'name', 'UNKNOWN_EFFECT');
  }
  return trimmed;
}

export function validateResolution(resolution, allowed = ['480p', '720p']) {
  if (!resolution) return '720p';
  const lower = String(resolution).toLowerCase();
  if (!allowed.includes(lower)) {
    return allowed[allowed.length - 1];
  }
  return lower;
}

export function validateQuality(quality, allowed = ['medium', 'high']) {
  if (!quality) return 'medium';
  const lower = String(quality).toLowerCase();
  if (!allowed.includes(lower)) {
    return 'medium';
  }
  return lower;
}

export function createSliderControl(config) {
  const { id, label, min, max, step, value, description = '', onChange } = config;
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-1.5';
  const labelRow = document.createElement('div');
  labelRow.className = 'flex items-center justify-between';
  const labelEl = document.createElement('label');
  labelEl.className = 'text-[10px] font-bold text-secondary uppercase tracking-wider';
  labelEl.textContent = label;
  labelEl.setAttribute('for', id);
  const valueEl = document.createElement('span');
  valueEl.className = 'text-[10px] font-bold text-primary tabular-nums';
  valueEl.id = `${id}-value`;
  valueEl.textContent = typeof value === 'number' ? (value.toFixed ? parseFloat(value.toFixed(2)).toString() : String(value)) : String(value);
  labelRow.appendChild(labelEl);
  labelRow.appendChild(valueEl);
  wrapper.appendChild(labelRow);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = id;
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);
  slider.className = 'w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-colors';
  wrapper.appendChild(slider);
  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'text-[10px] text-muted leading-relaxed';
    descEl.textContent = description;
    wrapper.appendChild(descEl);
  }
  slider.oninput = (e) => {
    const raw = parseFloat(e.target.value);
    const rounded = Math.round(raw / step) * step;
    const display = parseFloat(rounded.toFixed(2)).toString();
    valueEl.textContent = display;
    if (onChange) onChange(rounded, e);
  };
  wrapper.getValue = () => parseFloat(slider.value);
  wrapper.setValue = (v) => {
    const clamped = Math.max(min, Math.min(max, v));
    slider.value = String(clamped);
    valueEl.textContent = parseFloat((Math.round(clamped / step) * step).toFixed(2)).toString();
  };
  return wrapper;
}

export function createAdvancedSection(container, { buttonLabel = 'Advanced', defaultOpen = false } = {}) {
  const section = document.createElement('div');
  section.className = 'border border-white/5 rounded-xl overflow-hidden';
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'w-full px-4 py-2.5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors';
  toggleBtn.innerHTML = `
    <span class="text-[10px] font-bold text-secondary uppercase tracking-wider">${buttonLabel}</span>
    <span id="adv-toggle-icon" class="text-muted text-xs transition-transform duration-200">▼</span>
  `;
  const content = document.createElement('div');
  content.className = `p-4 flex flex-col gap-4 ${defaultOpen ? '' : 'hidden'}`;
  content.id = 'advanced-controls-content';
  toggleBtn.onclick = () => {
    const isHidden = content.classList.toggle('hidden');
    const icon = toggleBtn.querySelector('#adv-toggle-icon');
    icon.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
  };
  section.appendChild(toggleBtn);
  section.appendChild(content);
  container.appendChild(section);
  return { section, content, toggleBtn };
}
