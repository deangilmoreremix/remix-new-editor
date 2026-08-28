/**
 * Field Type Inference
 *
 * Infers SmartVideo SmartFieldType from provider schema field definitions.
 * Always provides a generic fallback so unknown fields still render.
 */

import type { SmartFieldType, SmartFieldOption } from '../../types/ai';
import { resolveCanonicalField } from './FieldAliases';

// ── Type Guards ──────────────────────────────────────────────────────────────

function isString(val: unknown): val is string {
  return typeof val === 'string';
}

function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val);
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean';
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every(isString);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function hasAnyAlias(fieldName: string, aliases: string[]): boolean {
  const normalized = normalizeName(fieldName);
  return aliases.some(
    (a) => normalized === normalizeName(a) || normalized.includes(normalizeName(a))
  );
}

// Canonical field → SmartFieldType mapping
const CANONICAL_TO_SMART_TYPE: Record<string, SmartFieldType> = {
  prompt: 'prompt',
  negative_prompt: 'textarea',
  reference_image: 'image',
  reference_images: 'images',
  reference_video: 'video',
  reference_audio: 'audio',
  first_frame: 'first-frame',
  last_frame: 'last-frame',
  duration: 'duration',
  aspect_ratio: 'aspect-ratio',
  resolution: 'resolution',
  number_of_images: 'number',
  quality: 'select',
  mode: 'select',
  seed: 'seed',
  camera_motion: 'camera-motion',
  lora: 'lora',
  audio_enabled: 'toggle',
  strength: 'strength',
  output_format: 'output-format',
};

// ── Inference Logic ──────────────────────────────────────────────────────────

export function inferFieldType(
  fieldName: string,
  schema: Record<string, unknown>
): SmartFieldType {
  const name = String(fieldName);
  const normalized = normalizeName(name);
  const type = String(schema.type || '').toLowerCase();

  // Check canonical aliases first
  const canonical = resolveCanonicalField(name);
  if (canonical && CANONICAL_TO_SMART_TYPE[canonical]) {
    return CANONICAL_TO_SMART_TYPE[canonical];
  }

  // Check enums
  if (isStringArray(schema.enum)) {
    if (
      normalized.includes('ratio') ||
      schema.enum.every((v) => /^\d+:\d+$/.test(v))
    ) {
      return 'aspect-ratio';
    }
    if (
      normalized.includes('format') ||
      schema.enum.some((v) => ['mp4', 'webm', 'mov', 'avi', 'png', 'jpg', 'jpeg', 'webp'].includes(v))
    ) {
      return 'output-format';
    }
    if (normalized.includes('resolution') || schema.enum.some((v) => /^\d+p$/.test(v))) {
      return 'resolution';
    }
    if (normalized.includes('duration') || schema.enum.some((v) => /^\d+s$/.test(v))) {
      return 'duration';
    }
    if (normalized.includes('quality')) {
      return 'select';
    }
    return 'select';
  }

  // Image fields
  if (
    hasAnyAlias(name, ['image', 'img', 'thumbnail', 'cover', 'poster']) &&
    !normalized.includes('images') &&
    !normalized.includes('video')
  ) {
    return 'image';
  }

  // Multiple images
  if (
    hasAnyAlias(name, ['images', 'image_urls', 'references']) ||
    (normalized.includes('image') && normalized.includes('list'))
  ) {
    return 'images';
  }

  // Video fields
  if (hasAnyAlias(name, ['video', 'clip', 'footage'])) {
    return 'video';
  }

  // Audio fields
  if (hasAnyAlias(name, ['audio', 'sound', 'music', 'voice'])) {
    return 'audio';
  }

  // First/last frame
  if (hasAnyAlias(name, ['first_frame', 'start_frame', 'init_frame'])) {
    return 'first-frame';
  }
  if (hasAnyAlias(name, ['last_frame', 'end_frame', 'final_frame'])) {
    return 'last-frame';
  }

  // Aspect ratio
  if (normalized.includes('aspect_ratio') || normalized.includes('ar')) {
    return 'aspect-ratio';
  }

  // Resolution
  if (normalized.includes('resolution') || normalized.includes('width_height')) {
    return 'resolution';
  }

  // Duration
  if (normalized.includes('duration') || normalized.includes('length') || normalized.includes('seconds')) {
    return 'duration';
  }

  // Number of images/outputs
  if (
    hasAnyAlias(name, ['num_images', 'num_outputs', 'batch_size', 'n']) ||
    normalized.includes('num_') ||
    normalized.includes('number_of_')
  ) {
    return 'number';
  }

  // Seed
  if (normalized.includes('seed')) {
    return 'seed';
  }

  // LoRA
  if (normalized.includes('lora')) {
    return 'lora';
  }

  // Camera motion
  if (hasAnyAlias(name, ['camera_motion', 'camera', 'motion'])) {
    return 'camera-motion';
  }

  // Strength / guidance
  if (
    hasAnyAlias(name, ['strength', 'denoising', 'cfg', 'guidance', 'prompt_strength'])
  ) {
    return 'strength';
  }

  // Output format
  if (normalized.includes('output_format') || normalized.includes('file_format')) {
    return 'output-format';
  }

  // Audio enabled toggle
  if (normalized.includes('audio_enabled') || normalized.includes('enable_audio')) {
    return 'toggle';
  }

  // Boolean fields
  if (type === 'boolean') {
    return 'toggle';
  }

  // Number with min/max → slider
  if (
    (type === 'integer' || type === 'number') &&
    (isNumber(schema.minimum) || isNumber(schema.min) || isNumber(schema.maximum) || isNumber(schema.max))
  ) {
    return 'slider';
  }

  // Integer/number without range
  if (type === 'integer' || type === 'number') {
    return 'number';
  }

  // Array type
  if (type === 'array') {
    return 'images';
  }

  // Prompt / text
  if (
    hasAnyAlias(name, ['prompt', 'description', 'text_prompt']) ||
    normalized.includes('prompt')
  ) {
    return 'prompt';
  }

  // Long text
  if (normalized.includes('negative') || normalized.includes('description') || normalized.includes('content')) {
    return 'textarea';
  }

  // Default string
  if (type === 'string') {
    return 'text';
  }

  // Fallback
  return 'text';
}

/**
 * Infer SmartField options from a JSON Schema enum or object structure.
 */
export function inferFieldOptions(
  fieldName: string,
  schema: Record<string, unknown>
): SmartFieldOption[] {
  const enumValues = schema.enum;

  if (isStringArray(enumValues)) {
    return enumValues.map((val) => ({
      label: formatLabel(String(val)),
      value: val,
    }));
  }

  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const options = Array.isArray(schema.oneOf) ? schema.oneOf : schema.anyOf;
    return options
      .map((opt: Record<string, unknown>) => {
        if (isString(opt.const)) {
          return { label: formatLabel(opt.const), value: opt.const };
        }
        if (isString(opt.title)) {
          return { label: opt.title, value: opt.title };
        }
        return null;
      })
      .filter(Boolean) as SmartFieldOption[];
  }

  return [];
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
