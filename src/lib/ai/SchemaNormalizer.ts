/**
 * Schema Normalizer
 *
 * Converts MuAPI input_schema into SmartVideo SmartField[].
 * Inspects field names, types, enums, min/max, defaults, descriptions,
 * required state, and array structures.
 */

import type { SmartField, SmartFieldOption } from '../../types/ai';
import { inferFieldType, inferFieldOptions } from './FieldTypeInference';
import { FIELD_ALIASES, resolveCanonicalField } from './FieldAliases';

// ── Default Sections ─────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: Record<string, string> = {
  prompt: 'Prompt',
  negative_prompt: 'Prompt',
  reference_image: 'Reference',
  reference_images: 'Reference',
  reference_video: 'Reference',
  reference_audio: 'Reference',
  first_frame: 'Reference',
  last_frame: 'Reference',
  aspect_ratio: 'Generation',
  resolution: 'Generation',
  duration: 'Generation',
  number_of_images: 'Generation',
  quality: 'Generation',
  mode: 'Generation',
  seed: 'Advanced',
  camera_motion: 'Camera',
  lora: 'Advanced',
  audio_enabled: 'Audio',
  strength: 'Advanced',
  output_format: 'Output',
};

// ── Advanced Fields ──────────────────────────────────────────────────────────

const ADVANCED_FIELDS = new Set([
  'seed',
  'cfg_scale',
  'guidance_scale',
  'strength',
  'denoising_strength',
  'steps',
  'sampler',
  'cfg',
  'clip_skip',
  'eta',
  'noise_schedule',
  'lora',
  'lora_model',
  'style_model',
  'audio_enabled',
  'enable_audio',
  'advanced_audio_settings',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function isNumberArray(val: unknown): val is number[] {
  return Array.isArray(val) && val.every(isNumber);
}

function pickFirstNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (isNumber(v)) return v;
  }
  return undefined;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// ── Normalizer ───────────────────────────────────────────────────────────────

export interface NormalizeSchemaOptions {
  requiredFields?: string[];
  fieldOverrides?: Map<string, Partial<SmartField>>;
}

/**
 * Convert a MuAPI-style input_schema object into SmartField[].
 *
 * Expected schema shape (JSON Schema-like):
 * {
 *   type: 'object',
 *   properties: { ... },
 *   required: ['prompt', ...]
 * }
 */
export function normalizeSchema(
  schema: unknown,
  options: NormalizeSchemaOptions = {}
): SmartField[] {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const root = schema as Record<string, unknown>;
  const properties = root.properties || root.inputs || root.fields || root.parameters || {};
  const required = new Set(
    (Array.isArray(root.required) ? root.required : []) as string[]
  );

  if (options.requiredFields) {
    options.requiredFields.forEach((f) => required.add(f));
  }

  const fields: SmartField[] = [];
  const entries = Object.entries(properties as Record<string, unknown>);

  for (const [fieldName, fieldSchema] of entries) {
    const schemaObj = (fieldSchema || {}) as Record<string, unknown>;
    const field = buildSmartField(fieldName, schemaObj, required, options);
    if (field) {
      fields.push(field);
    }
  }

  // Sort by order then by section then by label
  fields.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    const sectionA = a.section || '';
    const sectionB = b.section || '';
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);
    return a.label.localeCompare(b.label);
  });

  return fields;
}

function buildSmartField(
  fieldName: string,
  schema: Record<string, unknown>,
  required: Set<string>,
  options: NormalizeSchemaOptions
): SmartField | null {
  const type = String(schema.type || 'string').toLowerCase();
  const normalizedName = normalizeName(fieldName);
  const description = isString(schema.description) ? schema.description : undefined;
  const title = isString(schema.title) ? schema.title : undefined;
  const isReq = required.has(fieldName);

  // Resolve canonical field
  const canonical = resolveCanonicalField(fieldName);
  const smartType = inferFieldType(fieldName, schema);

  // Determine section
  let section = DEFAULT_SECTIONS[canonical || normalizedName];
  if (!section) {
    if (isReq) section = 'Input';
    else if (ADVANCED_FIELDS.has(normalizedName)) section = 'Advanced';
    else section = 'Generation';
  }

  // Build options
  const fieldOptions: SmartFieldOption[] = inferFieldOptions(fieldName, schema);

  // Build field
  const field: SmartField = {
    key: fieldName,
    providerField: fieldName,
    canonicalField: canonical,
    label: title || formatLabel(fieldName),
    type: smartType,
    required: isReq,
    description,
    defaultValue: schema.default ?? undefined,
    options: fieldOptions.length > 0 ? fieldOptions : undefined,
    min: pickFirstNumber(schema.minimum, schema.min),
    max: pickFirstNumber(schema.maximum, schema.max),
    step: isNumber(schema.multipleOf) ? schema.multipleOf : undefined,
    section,
    advanced: section === 'Advanced',
    order: isNumber(schema.order) ? schema.order : undefined,
    rawSchema: schema,
  };

  // Apply overrides (highest priority)
  if (options.fieldOverrides) {
    const override = options.fieldOverrides.get(fieldName);
    if (override) {
      Object.assign(field, override);
    }
  }

  // Conditional visibility from schema
  if (schema.visibleWhen && typeof schema.visibleWhen === 'object') {
    field.visibleWhen = schema.visibleWhen as SmartField['visibleWhen'];
  }

  return field;
}

function formatLabel(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
