/**
 * SmartVideo Studio — Schema Normalizer
 *
 * Normalizes MuAPI model schemas into SmartVideo Studio field definitions.
 */

export type SmartFieldType =
  | 'text'
  | 'textarea'
  | 'negative-prompt'
  | 'image-upload'
  | 'multi-image-upload'
  | 'video-upload'
  | 'audio-upload'
  | 'reference-image'
  | 'first-frame'
  | 'last-frame'
  | 'mask-picker'
  | 'select'
  | 'multi-select'
  | 'slider'
  | 'number'
  | 'toggle'
  | 'seed'
  | 'lora'
  | 'camera-motion'
  | 'duration'
  | 'aspect-ratio'
  | 'resolution'
  | 'quality'
  | 'output-count'
  | 'fps'
  | 'output-format'
  | 'voice'
  | 'repeater'
  | 'unknown';

export interface SmartField {
  key: string;
  rawKey: string;
  normalizedKey: string;
  type: SmartFieldType;
  label: string;
  section: string;
  advanced: boolean;
  required: boolean;
  schema: Record<string, unknown>;
  defaultValue?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  repeaterFields?: SmartField[];
  repeaterLabel?: string;
  visibleWhen?: { field: string; value: unknown }[];
}

export interface NormalizedSchema {
  fields: SmartField[];
  sections: string[];
  hasUnknownFields: boolean;
}

const RAW_TO_NORMALIZED: Record<string, string> = {
  prompt: 'prompt',
  negative_prompt: 'negative_prompt',
  reference_image: 'reference_image',
  first_frame: 'first_frame',
  last_frame: 'last_frame',
  mask: 'mask',
  duration: 'duration',
  resolution: 'resolution',
  aspect_ratio: 'aspect_ratio',
  seed: 'seed',
  guidance_scale: 'guidance_scale',
  strength: 'strength',
  steps: 'steps',
  lora: 'lora',
  lora_weight: 'lora_weight',
  camera_motion: 'camera_motion',
  fps: 'fps',
  output_format: 'output_format',
  number_of_outputs: 'number_of_outputs',
  audio_input: 'audio_input',
  video_input: 'video_input',
  voice: 'voice',
};

function getFieldLabel(normalizedKey: string, rawKey: string, schema: Record<string, unknown>): string {
  if (schema.title && typeof schema.title === 'string') return schema.title;
  if (normalizedKey === 'prompt') return 'Prompt';
  if (normalizedKey === 'negative_prompt') return 'Negative Prompt';
  const label = normalizedKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return label || rawKey;
}

function getFieldSection(normalizedKey: string, capabilities: { textInput?: boolean; imageInput?: boolean; videoInput?: boolean; audioInput?: boolean; }): string {
  if (['prompt', 'negative_prompt'].includes(normalizedKey)) return 'prompt';
  if (['reference_image', 'first_frame', 'last_frame', 'mask', 'image', 'video', 'audio'].includes(normalizedKey)) return 'media';
  if (['duration', 'resolution', 'aspect_ratio', 'fps', 'output_format', 'number_of_outputs', 'quality'].includes(normalizedKey)) return 'settings';
  return 'advanced';
}

function getSectionPriority(section: string): number {
  const order: Record<string, number> = { prompt: 0, media: 1, reference: 2, settings: 3, advanced: 4 };
  return order[section] ?? 99;
}

function inferStep(schema: Record<string, unknown>): number {
  if (schema.type === 'integer') return 1;
  if (typeof schema.min === 'number' && typeof schema.max === 'number') {
    const range = (schema.max as number) - (schema.min as number);
    if (range <= 1) return 0.01;
    if (range <= 10) return 0.1;
    if (range <= 100) return 1;
    return 10;
  }
  return 1;
}

function inferSmartFieldType(
  rawKey: string,
  normalizedKey: string,
  schema: Record<string, unknown>,
  capabilities: { textInput?: boolean; imageInput?: boolean; multipleImages?: boolean; firstFrame?: boolean; lastFrame?: boolean; seed?: boolean; lora?: boolean; cameraMotion?: boolean; }
): SmartFieldType {
  const conceptTypeMap: Partial<Record<string, SmartFieldType>> = {
    reference_image: capabilities.imageInput ? 'reference-image' : 'image-upload',
    first_frame: capabilities.firstFrame ? 'first-frame' : 'image-upload',
    last_frame: capabilities.lastFrame ? 'last-frame' : 'image-upload',
    mask: 'mask-picker',
    prompt: 'textarea',
    negative_prompt: 'negative-prompt',
    duration: 'duration',
    resolution: 'resolution',
    aspect_ratio: 'aspect-ratio',
    seed: 'seed',
    guidance_scale: 'slider',
    strength: 'slider',
    steps: 'number',
    lora: 'lora',
    lora_weight: 'slider',
    camera_motion: 'camera-motion',
    fps: 'fps',
    output_format: 'output-format',
    number_of_outputs: 'output-count',
    audio_input: 'audio-upload',
    video_input: 'video-upload',
    voice: 'voice',
  };

  if (conceptTypeMap[normalizedKey]) {
    return conceptTypeMap[normalizedKey]!;
  }

  const rawType = schema.type as string | undefined;

  if (rawType === 'string' || rawType === 'text') {
    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length <= 8) return 'select';
    if (normalizedKey === 'prompt') return 'textarea';
    return 'text';
  }

  if (rawType === 'integer' || rawType === 'number') {
    if (schema.enum && Array.isArray(schema.enum)) return 'select';
    if (normalizedKey === 'seed') return 'seed';
    if (typeof schema.min === 'number' && typeof schema.max === 'number') return 'slider';
    return 'number';
  }

  if (rawType === 'boolean') return 'toggle';

  if (rawType === 'array' || Array.isArray(schema.enum)) {
    if (normalizedKey.includes('image') && capabilities.multipleImages) return 'multi-image-upload';
    if (normalizedKey.includes('image')) return 'image-upload';
    if (normalizedKey.includes('video')) return 'video-upload';
    if (normalizedKey.includes('audio')) return 'audio-upload';
    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length <= 8) return 'multi-select';
    return 'select';
  }

  if (rawType === 'object') {
    if (normalizedKey.includes('image')) return 'image-upload';
    if (normalizedKey.includes('video')) return 'video-upload';
    if (normalizedKey.includes('audio')) return 'audio-upload';
  }

  return 'unknown';
}

function extractRepeaterFields(parentKey: string, itemSchema: Record<string, unknown>): SmartField[] {
  const repeaterFields: SmartField[] = [];
  const properties = itemSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return repeaterFields;

  for (const [subKey, subSchema] of Object.entries(properties)) {
    const normalizedSubKey = `${parentKey}.${subKey}`;
    const type = inferSmartFieldType(subKey, normalizedSubKey, subSchema, { imageInput: true, multipleImages: true, firstFrame: true, lastFrame: true, seed: true, lora: true, cameraMotion: true });
    const label = (subSchema.description as string) || subKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    repeaterFields.push({
      key: normalizedSubKey,
      rawKey: subKey,
      normalizedKey: normalizedSubKey,
      type,
      label,
      section: 'settings',
      advanced: false,
      required: subSchema.required === true,
      schema: subSchema,
      defaultValue: subSchema.default,
      options: Array.isArray(subSchema.enum) ? subSchema.enum : undefined,
      min: typeof subSchema.min === 'number' ? subSchema.min : undefined,
      max: typeof subSchema.max === 'number' ? subSchema.max : undefined,
      step: inferStep(subSchema),
    });
  }

  return repeaterFields;
}

export function normalizeSchema(
  inputSchema: Record<string, unknown>,
  capabilities: { textInput?: boolean; imageInput?: boolean; multipleImages?: boolean; firstFrame?: boolean; lastFrame?: boolean; seed?: boolean; lora?: boolean; cameraMotion?: boolean; }
): NormalizedSchema {
  const fields: SmartField[] = [];
  const unknownFields: string[] = [];

  for (const [rawKey, schema] of Object.entries(inputSchema)) {
    const normalizedKey = RAW_TO_NORMALIZED[rawKey] || rawKey;
    const type = inferSmartFieldType(rawKey, normalizedKey, schema as Record<string, unknown>, capabilities);
    const label = getFieldLabel(normalizedKey, rawKey, schema as Record<string, unknown>);
    const section = getFieldSection(normalizedKey, capabilities);
    const advanced = section === 'advanced';

    if (type === 'unknown') {
      unknownFields.push(rawKey);
    }

    const field: SmartField = {
      key: normalizedKey,
      rawKey,
      normalizedKey,
      type,
      label,
      section,
      advanced,
      required: (schema as Record<string, unknown>).required === true,
      schema: schema as Record<string, unknown>,
      defaultValue: (schema as Record<string, unknown>).default,
      options: Array.isArray((schema as Record<string, unknown>).enum) ? (schema as Record<string, unknown>).enum as string[] : undefined,
      min: typeof (schema as Record<string, unknown>).min === 'number' ? (schema as Record<string, unknown>).min as number : undefined,
      max: typeof (schema as Record<string, unknown>).max === 'number' ? (schema as Record<string, unknown>).max as number : undefined,
      step: inferStep(schema as Record<string, unknown>),
    };

    if (type === 'repeater' && (schema as Record<string, unknown>).items && typeof (schema as Record<string, unknown>).items === 'object' && (schema as Record<string, unknown>).items.properties) {
      const repeaterLabel = label.replace(/s$/, '').replace(/\[\]$/, '').trim();
      field.repeaterLabel = repeaterLabel || label;
      field.repeaterFields = extractRepeaterFields(normalizedKey, (schema as Record<string, unknown>).items as Record<string, unknown>);
    }

    fields.push(field);
  }

  fields.sort((a, b) => getSectionPriority(a.section) - getSectionPriority(b.section));

  const sections = Array.from(new Set(fields.map(f => f.section)));

  return {
    fields,
    sections,
    hasUnknownFields: unknownFields.length > 0,
  };
}
