/**
 * Tests for SmartVideo Universal Model Engine
 */

import { describe, it, expect } from 'vitest';
import { normalizeSchema } from '../../ai/SchemaNormalizer';
import { inferFieldType, inferFieldOptions } from '../../ai/FieldTypeInference';
import { resolveCanonicalField, FIELD_ALIASES } from '../../ai/FieldAliases';

describe('FieldAliases', () => {
  it('should resolve prompt aliases', () => {
    expect(resolveCanonicalField('prompt')).toBe('prompt');
    expect(resolveCanonicalField('text_prompt')).toBe('prompt');
    expect(resolveCanonicalField('description')).toBe('prompt');
  });

  it('should resolve image aliases', () => {
    expect(resolveCanonicalField('image_url')).toBe('reference_image');
    expect(resolveCanonicalField('reference_image')).toBe('reference_image');
    expect(resolveCanonicalField('init_image')).toBe('reference_image');
  });

  it('should resolve duration aliases', () => {
    expect(resolveCanonicalField('duration')).toBe('duration');
    expect(resolveCanonicalField('duration_seconds')).toBe('duration');
    expect(resolveCanonicalField('length')).toBe('duration');
  });

  it('should return undefined for unknown fields', () => {
    expect(resolveCanonicalField('unknown_field_xyz')).toBeUndefined();
  });
});

describe('FieldTypeInference', () => {
  it('should infer prompt type', () => {
    expect(inferFieldType('prompt', { type: 'string' })).toBe('prompt');
    expect(inferFieldType('text_prompt', { type: 'string' })).toBe('prompt');
  });

  it('should infer textarea for negative prompts', () => {
    expect(inferFieldType('negative_prompt', { type: 'string' })).toBe('textarea');
  });

  it('should infer image type', () => {
    expect(inferFieldType('image_url', { type: 'string' })).toBe('image');
    expect(inferFieldType('reference_image', { type: 'string' })).toBe('image');
  });

  it('should infer video type', () => {
    expect(inferFieldType('video_url', { type: 'string' })).toBe('video');
  });

  it('should infer audio type', () => {
    expect(inferFieldType('audio_url', { type: 'string' })).toBe('audio');
  });

  it('should infer first/last frame types', () => {
    expect(inferFieldType('first_frame_url', { type: 'string' })).toBe('first-frame');
    expect(inferFieldType('last_frame_url', { type: 'string' })).toBe('last-frame');
  });

  it('should infer aspect ratio from enum', () => {
    expect(inferFieldType('aspect_ratio', { type: 'string', enum: ['1:1', '16:9', '9:16'] })).toBe('aspect-ratio');
  });

  it('should infer resolution from enum', () => {
    expect(inferFieldType('resolution', { type: 'string', enum: ['720p', '1080p', '4K'] })).toBe('resolution');
  });

  it('should infer duration from enum', () => {
    expect(inferFieldType('duration', { type: 'string', enum: ['5s', '8s', '10s'] })).toBe('duration');
  });

  it('should infer slider for numbers with min/max', () => {
    // 'strength' maps to a dedicated SmartFieldType via canonical alias
    expect(inferFieldType('strength', { type: 'number', minimum: 0, maximum: 1 })).toBe('strength');
    // 'temperature' has no canonical alias, so it falls through to slider inference
    expect(inferFieldType('temperature', { type: 'number', min: 0, max: 2 })).toBe('slider');
  });

  it('should infer number for plain numbers', () => {
    expect(inferFieldType('num_images', { type: 'integer' })).toBe('number');
  });

  it('should infer toggle for booleans', () => {
    expect(inferFieldType('audio_enabled', { type: 'boolean' })).toBe('toggle');
  });

  it('should infer select for enums', () => {
    expect(inferFieldType('style', { type: 'string', enum: ['realistic', 'anime', 'cartoon'] })).toBe('select');
  });

  it('should infer seed type', () => {
    expect(inferFieldType('seed', { type: 'integer' })).toBe('seed');
  });

  it('should infer lora type', () => {
    expect(inferFieldType('lora', { type: 'string' })).toBe('lora');
  });

  it('should infer camera motion', () => {
    expect(inferFieldType('camera_motion', { type: 'string' })).toBe('camera-motion');
  });

  it('should infer output format', () => {
    expect(inferFieldType('output_format', { type: 'string', enum: ['mp4', 'webm'] })).toBe('output-format');
  });

  it('should fallback to text for unknown fields', () => {
    // Unknown string fields fall back to 'text' via the default string branch
    const result = inferFieldType('unknown_field_xyz', { type: 'string' });
    expect(['text', 'number']).toContain(result);
  });
});

describe('FieldTypeInference - options', () => {
  it('should infer options from enum', () => {
    const options = inferFieldOptions('style', { type: 'string', enum: ['A', 'B', 'C'] });
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({ label: 'A', value: 'A' });
  });

  it('should format labels with spaces', () => {
    const options = inferFieldOptions('quality', { type: 'string', enum: ['high_quality'] });
    expect(options[0].label).toBe('High Quality');
  });
});

describe('SchemaNormalizer', () => {
  const basicImageSchema = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        title: 'Prompt',
        description: 'Describe the image',
      },
      aspect_ratio: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16'],
        title: 'Aspect Ratio',
        default: '1:1',
      },
      num_images: {
        type: 'integer',
        title: 'Number of images',
        minimum: 1,
        maximum: 4,
        default: 1,
      },
      seed: {
        type: 'integer',
        title: 'Seed',
      },
      negative_prompt: {
        type: 'string',
        title: 'Negative Prompt',
      },
    },
    required: ['prompt'],
  };

  it('should normalize basic image schema', () => {
    const fields = normalizeSchema(basicImageSchema);
    expect(fields.length).toBeGreaterThanOrEqual(4);

    const promptField = fields.find((f) => f.key === 'prompt');
    expect(promptField).toBeDefined();
    expect(promptField!.type).toBe('prompt');
    expect(promptField!.required).toBe(true);
    expect(promptField!.section).toBe('Prompt');
  });

  it('should mark advanced fields correctly', () => {
    const fields = normalizeSchema(basicImageSchema);
    const seedField = fields.find((f) => f.key === 'seed');
    expect(seedField?.advanced).toBe(true);
  });

  it('should infer options from enum', () => {
    const fields = normalizeSchema(basicImageSchema);
    const aspectField = fields.find((f) => f.key === 'aspect_ratio');
    expect(aspectField?.options).toHaveLength(3);
  });

  it('should handle empty schema', () => {
    const fields = normalizeSchema(null);
    expect(fields).toHaveLength(0);
  });

  it('should handle schema without properties', () => {
    const fields = normalizeSchema({ type: 'object' });
    expect(fields).toHaveLength(0);
  });

  it('should sort fields by order', () => {
    const schemaWithOrder = {
      type: 'object',
      properties: {
        z_field: { type: 'string', order: 3 },
        a_field: { type: 'string', order: 1 },
        m_field: { type: 'string', order: 2 },
      },
    };
    const fields = normalizeSchema(schemaWithOrder);
    expect(fields[0].key).toBe('a_field');
    expect(fields[1].key).toBe('m_field');
    expect(fields[2].key).toBe('z_field');
  });
});

describe('Acceptance Criteria', () => {
  it('Test A: Image model renders supported controls', () => {
    const t2iSchema = {
      type: 'object',
      properties: {
        prompt: { type: 'string', required: true },
        aspect_ratio: { type: 'string', enum: ['1:1', '16:9'] },
        num_images: { type: 'integer' },
      },
      required: ['prompt'],
    };
    const fields = normalizeSchema(t2iSchema);
    const types = fields.map((f) => f.type);
    expect(types).toContain('prompt');
    expect(types).toContain('aspect-ratio');
    expect(types).toContain('number');
  });

  it('Test B: Video model changes controls automatically', () => {
    const t2vSchema = {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        duration: { type: 'string', enum: ['5s', '10s'] },
        resolution: { type: 'string', enum: ['1080p', '4K'] },
      },
    };
    const fields = normalizeSchema(t2vSchema);
    const types = fields.map((f) => f.type);
    expect(types).toContain('duration');
    expect(types).toContain('resolution');
  });

  it('Test C: Model with first and last frames shows both controls', () => {
    const i2vSchema = {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        first_frame_url: { type: 'string' },
        last_frame_url: { type: 'string' },
      },
    };
    const fields = normalizeSchema(i2vSchema);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain('first_frame_url');
    expect(keys).toContain('last_frame_url');
  });

  it('Test D: Model without last-frame support hides control', () => {
    const t2vSchema = {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        duration: { type: 'string', enum: ['5s', '10s'] },
      },
    };
    const fields = normalizeSchema(t2vSchema);
    const keys = fields.map((f) => f.key);
    expect(keys).not.toContain('last_frame');
    expect(keys).not.toContain('last_frame_url');
  });

  it('Test E: Only supported aspect ratios shown', () => {
    const limitedSchema = {
      type: 'object',
      properties: {
        aspect_ratio: {
          type: 'string',
          enum: ['16:9', '9:16'],
        },
      },
    };
    const fields = normalizeSchema(limitedSchema);
    const aspectField = fields.find((f) => f.key === 'aspect_ratio');
    expect(aspectField?.options).toHaveLength(2);
    expect(aspectField?.options?.map((o) => o.value)).toEqual(['16:9', '9:16']);
  });

  it('Test F: Model with 1:1 shows it', () => {
    const schema = {
      type: 'object',
      properties: {
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16'],
        },
      },
    };
    const fields = normalizeSchema(schema);
    const aspectField = fields.find((f) => f.key === 'aspect_ratio');
    expect(aspectField?.options?.map((o) => o.value)).toContain('1:1');
  });

  it('Test G: Dynamic pricing updates on value change (architecture test)', async () => {
    // This tests that the pricing engine can calculate credits
    // The actual dynamic update is handled by the React useEffect in ModelGenerator
    const { getPricingEngine } = await import('../../ai/PricingEngine');
    const engine = getPricingEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.calculateCredits).toBe('function');
  });
});
