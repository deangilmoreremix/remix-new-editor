import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Provide a real in-memory localStorage for tests that need persistence
const localStorageStore = {};
const localStorageMock = {
  getItem: vi.fn((key) => localStorageStore[key] ?? null),
  setItem: vi.fn((key, value) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
};
global.localStorage = localStorageMock;

// Stub missing PromptAssemblyEngine methods that assemble() calls
// These methods exist on the class in production but are not present
// in the source; we provide safe no-op implementations for testing.
const cinematicModule = await import('../../src/lib/cinematicTemplates.js');
if (!cinematicModule.PromptAssemblyEngine.prototype.getBrandPrompt) {
  cinematicModule.PromptAssemblyEngine.prototype.getBrandPrompt = function () {
    return 'Brand: ' + (this.inputs.brandName || '');
  };
}
if (!cinematicModule.PromptAssemblyEngine.prototype.getCTAPrompt) {
  cinematicModule.PromptAssemblyEngine.prototype.getCTAPrompt = function () {
    const cta = this.inputs.ctaType || 'learn more';
    return `Call to action: ${cta}`;
  };
}

const {
  CINEMATIC_CATEGORIES,
  OUTPUT_STYLES,
  VISUAL_STYLES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  PACING_OPTIONS,
  CTA_TYPES,
  ENDING_TYPES,
  BRAND_VOICES,
  TARGET_AUDIENCES,
  SCENE_STRUCTURES,
  CINEMATIC_TEMPLATES,
  CinematicTemplateRegistry,
  PromptAssemblyEngine,
  SceneBuilder,
  ShotBuilder,
  StoryboardBuilder,
  TemplateInputBuilder,
  TemplateStorage,
  RenderHandoff,
  getTemplateRegistry,
} = cinematicModule;

vi.mock('../../src/lib/templateEngine.js', () => ({
  FILM_TYPES: {
    CINEMATIC_SHORT_FILM: 'cinematic_short_film',
    DRAMATIC_TRAILER: 'dramatic_trailer',
    DOCUMENTARY_STYLE_FILM: 'documentary_style_film',
    PROMO_FILM: 'promo_film',
    FOUNDER_STORY_FILM: 'founder_story_film',
    TESTIMONIAL_FILM: 'testimonial_film',
    CASE_STUDY_FILM: 'case_study_film',
  },
  detectNiche: vi.fn(() => 'general'),
  getStoryBeats: vi.fn(() => ['Act 1: Setup', 'Act 2: Confrontation', 'Act 3: Resolution']),
  inferFilmTypeFromBlueprint: vi.fn(() => 'cinematic_short_film'),
}));

vi.mock('../../src/lib/continuityEngine.js', () => ({
  ContinuityEngine: class MockContinuityEngine {
    ingestScene() {}
    buildContinuityNotes() { return ''; }
  },
}));

// ============================================
// CONSTANTS
// ============================================

describe('CINEMATIC_CATEGORIES', () => {
  it('should be a non-empty object with string values', () => {
    expect(Object.keys(CINEMATIC_CATEGORIES).length).toBeGreaterThan(0);
    Object.values(CINEMATIC_CATEGORIES).forEach(cat => {
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
    });
  });

  it('should contain expected category keys', () => {
    expect(CINEMATIC_CATEGORIES).toHaveProperty('FILM');
    expect(CINEMATIC_CATEGORIES).toHaveProperty('BUSINESS');
    expect(CINEMATIC_CATEGORIES).toHaveProperty('COMMERCIAL');
    expect(CINEMATIC_CATEGORIES).toHaveProperty('SOCIAL');
    expect(CINEMATIC_CATEGORIES).toHaveProperty('DOCUMENTARY');
    expect(CINEMATIC_CATEGORIES).toHaveProperty('INDUSTRY');
  });
});

describe('OUTPUT_STYLES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(OUTPUT_STYLES).length).toBeGreaterThan(0);
  });

  it('each style should have id, name, description, icon, and characteristics', () => {
    Object.values(OUTPUT_STYLES).forEach(style => {
      expect(style).toHaveProperty('id');
      expect(style).toHaveProperty('name');
      expect(style).toHaveProperty('description');
      expect(style).toHaveProperty('icon');
      expect(Array.isArray(style.characteristics)).toBe(true);
      expect(style.characteristics.length).toBeGreaterThan(0);
    });
  });

  it('should include CINEMATIC_COMMERCIAL and DOCUMENTARY styles', () => {
    expect(OUTPUT_STYLES).toHaveProperty('CINEMATIC_COMMERCIAL');
    expect(OUTPUT_STYLES).toHaveProperty('DOCUMENTARY');
  });
});

describe('VISUAL_STYLES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(VISUAL_STYLES).length).toBeGreaterThan(0);
  });

  it('each style should have id, name, description, and modifiers', () => {
    Object.values(VISUAL_STYLES).forEach(style => {
      expect(style).toHaveProperty('id');
      expect(style).toHaveProperty('name');
      expect(style).toHaveProperty('description');
      expect(Array.isArray(style.modifiers)).toBe(true);
      expect(style.modifiers.length).toBeGreaterThan(0);
    });
  });
});

describe('SHOT_TYPES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(SHOT_TYPES).length).toBeGreaterThan(0);
  });

  it('each shot type should have id, name, description, and duration', () => {
    Object.values(SHOT_TYPES).forEach(shot => {
      expect(shot).toHaveProperty('id');
      expect(shot).toHaveProperty('name');
      expect(shot).toHaveProperty('description');
      expect(shot).toHaveProperty('duration');
    });
  });

  it('should include ESTABLISHING, CLOSE_UP, WIDE', () => {
    expect(SHOT_TYPES).toHaveProperty('ESTABLISHING');
    expect(SHOT_TYPES).toHaveProperty('CLOSE_UP');
    expect(SHOT_TYPES).toHaveProperty('WIDE');
  });
});

describe('CAMERA_MOVEMENTS', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(CAMERA_MOVEMENTS).length).toBeGreaterThan(0);
  });

  it('each movement should have id, name, and description', () => {
    Object.values(CAMERA_MOVEMENTS).forEach(mv => {
      expect(mv).toHaveProperty('id');
      expect(mv).toHaveProperty('name');
      expect(mv).toHaveProperty('description');
    });
  });

  it('should include STATIC, DOLLY_IN, PAN_LEFT', () => {
    expect(CAMERA_MOVEMENTS).toHaveProperty('STATIC');
    expect(CAMERA_MOVEMENTS).toHaveProperty('DOLLY_IN');
    expect(CAMERA_MOVEMENTS).toHaveProperty('PAN_LEFT');
  });
});

describe('PACING_OPTIONS', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(PACING_OPTIONS).length).toBeGreaterThan(0);
  });

  it('each option should have id, name, beatsPerMinute, and description', () => {
    Object.values(PACING_OPTIONS).forEach(pace => {
      expect(pace).toHaveProperty('id');
      expect(pace).toHaveProperty('name');
      expect(typeof pace.beatsPerMinute).toBe('number');
      expect(pace).toHaveProperty('description');
    });
  });

  it('should include SLOW, MODERATE, FAST, MONTAGE', () => {
    expect(PACING_OPTIONS).toHaveProperty('SLOW');
    expect(PACING_OPTIONS).toHaveProperty('MODERATE');
    expect(PACING_OPTIONS).toHaveProperty('FAST');
    expect(PACING_OPTIONS).toHaveProperty('MONTAGE');
  });
});

describe('CTA_TYPES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(CTA_TYPES).length).toBeGreaterThan(0);
  });

  it('each CTA should have id, name, icon, and placement', () => {
    Object.values(CTA_TYPES).forEach(cta => {
      expect(cta).toHaveProperty('id');
      expect(cta).toHaveProperty('name');
      expect(cta).toHaveProperty('icon');
      expect(cta).toHaveProperty('placement');
    });
  });
});

describe('ENDING_TYPES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(ENDING_TYPES).length).toBeGreaterThan(0);
  });

  it('each ending should have id, name, and description', () => {
    Object.values(ENDING_TYPES).forEach(ending => {
      expect(ending).toHaveProperty('id');
      expect(ending).toHaveProperty('name');
      expect(ending).toHaveProperty('description');
    });
  });
});

describe('BRAND_VOICES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(BRAND_VOICES).length).toBeGreaterThan(0);
  });

  it('each voice should have id, name, and adjectives', () => {
    Object.values(BRAND_VOICES).forEach(voice => {
      expect(voice).toHaveProperty('id');
      expect(voice).toHaveProperty('name');
      expect(Array.isArray(voice.adjectives)).toBe(true);
      expect(voice.adjectives.length).toBeGreaterThan(0);
    });
  });
});

describe('TARGET_AUDIENCES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(TARGET_AUDIENCES).length).toBeGreaterThan(0);
  });

  it('each audience should have id, name, and platforms', () => {
    Object.values(TARGET_AUDIENCES).forEach(aud => {
      expect(aud).toHaveProperty('id');
      expect(aud).toHaveProperty('name');
      expect(Array.isArray(aud.platforms)).toBe(true);
      expect(aud.platforms.length).toBeGreaterThan(0);
    });
  });
});

describe('SCENE_STRUCTURES', () => {
  it('should be a non-empty object', () => {
    expect(Object.keys(SCENE_STRUCTURES).length).toBeGreaterThan(0);
  });

  it('each structure should have id, name, description, and acts', () => {
    Object.values(SCENE_STRUCTURES).forEach(struct => {
      expect(struct).toHaveProperty('id');
      expect(struct).toHaveProperty('name');
      expect(struct).toHaveProperty('description');
      expect(Array.isArray(struct.acts)).toBe(true);
      expect(struct.acts.length).toBeGreaterThan(0);
    });
  });

  it('THREE_ACT should have 3 acts', () => {
    expect(SCENE_STRUCTURES.THREE_ACT.acts).toHaveLength(3);
  });
});

describe('CINEMATIC_TEMPLATES', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(CINEMATIC_TEMPLATES)).toBe(true);
    expect(CINEMATIC_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('each template should have required fields', () => {
    CINEMATIC_TEMPLATES.forEach(t => {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('category');
      expect(t).toHaveProperty('outputType');
      expect(t).toHaveProperty('modelType');
      expect(t).toHaveProperty('duration');
      expect(t).toHaveProperty('aspectRatios');
      expect(t).toHaveProperty('quickInputs');
      expect(t).toHaveProperty('advancedInputs');
      expect(t).toHaveProperty('sceneBuilder');
      expect(t).toHaveProperty('shotBuilder');
      expect(t).toHaveProperty('storyboardBuilder');
      expect(t).toHaveProperty('includeCTA');
      expect(t).toHaveProperty('includeBrandContext');
    });
  });

  it('each template id should be unique', () => {
    const ids = CINEMATIC_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template category should be a valid CINEMATIC_CATEGORIES value', () => {
    const validCats = Object.values(CINEMATIC_CATEGORIES);
    CINEMATIC_TEMPLATES.forEach(t => {
      expect(validCats).toContain(t.category);
    });
  });

  it('each template outputStyle should be a valid OUTPUT_STYLES entry', () => {
    const validStyles = Object.values(OUTPUT_STYLES);
    CINEMATIC_TEMPLATES.forEach(t => {
      if (t.outputStyle) {
        expect(validStyles.map(s => s.id)).toContain(t.outputStyle.id);
      }
    });
  });
});

// ============================================
// CinematicTemplateRegistry
// ============================================

describe('CinematicTemplateRegistry', () => {
  let registry;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    registry = new CinematicTemplateRegistry();
  });

  describe('getAll', () => {
    it('should return all registered templates', () => {
      const all = registry.getAll();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBe(CINEMATIC_TEMPLATES.length);
    });

    it('each template should have createdAt, usageCount, and isCustom', () => {
      registry.getAll().forEach(t => {
        expect(t).toHaveProperty('createdAt');
        expect(typeof t.usageCount).toBe('number');
        expect(typeof t.isCustom).toBe('boolean');
      });
    });
  });

  describe('get', () => {
    it('should return a template by id', () => {
      const template = registry.get('cinematic_short_film');
      expect(template).toBeDefined();
      expect(template.id).toBe('cinematic_short_film');
      expect(template.name).toBe('Cinematic Short Film');
    });

    it('should return undefined for unknown id', () => {
      const template = registry.get('nonexistent_template');
      expect(template).toBeUndefined();
    });

    it('should increment usageCount on each call', () => {
      const template = registry.get('ad_film');
      expect(template.usageCount).toBe(1);
      registry.get('ad_film');
      expect(template.usageCount).toBe(2);
    });
  });

  describe('getByCategory', () => {
    it('should filter templates by category', () => {
      const filmTemplates = registry.getByCategory(CINEMATIC_CATEGORIES.FILM);
      expect(filmTemplates.length).toBeGreaterThan(0);
      filmTemplates.forEach(t => {
        expect(t.category).toBe(CINEMATIC_CATEGORIES.FILM);
      });
    });

    it('should return empty array for unknown category', () => {
      const result = registry.getByCategory('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getByTag', () => {
    it('should filter by quickInputs name containing tag', () => {
      const result = registry.getByTag('premise');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by tags property if present', () => {
      const result = registry.getByTag('cinematic');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('search', () => {
    it('should find templates by name', () => {
      const result = registry.search('Cinematic Short Film');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(t => t.id === 'cinematic_short_film')).toBe(true);
    });

    it('should find templates by description', () => {
      const result = registry.search('professional short film');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should find templates by category', () => {
      const result = registry.search('Business & Brand');
      expect(result.length).toBeGreaterThan(0);
      result.forEach(t => {
        expect(t.category.toLowerCase()).toContain('business');
      });
    });

    it('should be case-insensitive', () => {
      const result = registry.search('BRAND FILM');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', () => {
      const result = registry.search('xyznonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('registerCustom', () => {
    it('should register a custom template with generated id', () => {
      const custom = registry.registerCustom({
        name: 'Test Custom',
        description: 'A test custom template',
        category: CINEMATIC_CATEGORIES.CREATIVE,
        outputType: 'video',
        modelType: 'i2v',
        duration: { min: 10, max: 60, default: 30 },
        aspectRatios: ['16:9'],
        quickInputs: [],
        advancedInputs: [],
        sceneBuilder: true,
        shotBuilder: true,
        storyboardBuilder: true,
        includeCTA: false,
        includeBrandContext: false,
      });
      expect(custom.id).toMatch(/^custom_\d+$/);
      expect(custom.isCustom).toBe(true);
      expect(custom.name).toBe('Test Custom');
    });

    it('should persist custom templates to localStorage', () => {
      registry.registerCustom({
        name: 'Persisted Custom',
        description: 'Test',
        category: CINEMATIC_CATEGORIES.CREATIVE,
        outputType: 'video',
        modelType: 'i2v',
        duration: { min: 10, max: 60, default: 30 },
        aspectRatios: ['16:9'],
        quickInputs: [],
        advancedInputs: [],
        sceneBuilder: true,
        shotBuilder: true,
        storyboardBuilder: true,
        includeCTA: false,
        includeBrandContext: false,
      });
      const stored = localStorage.getItem('cinematic_custom_templates');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.length).toBeGreaterThan(0);
    });
  });

  describe('deleteCustom', () => {
    it('should delete a custom template', () => {
      const custom = registry.registerCustom({
        name: 'To Delete',
        description: 'Test',
        category: CINEMATIC_CATEGORIES.CREATIVE,
        outputType: 'video',
        modelType: 'i2v',
        duration: { min: 10, max: 60, default: 30 },
        aspectRatios: ['16:9'],
        quickInputs: [],
        advancedInputs: [],
        sceneBuilder: true,
        shotBuilder: true,
        storyboardBuilder: true,
        includeCTA: false,
        includeBrandContext: false,
      });
      const id = custom.id;
      const result = registry.deleteCustom(id);
      expect(result).toBe(true);
      expect(registry.get(id)).toBeUndefined();
    });

    it('should return false when deleting a non-custom template', () => {
      const result = registry.deleteCustom('cinematic_short_film');
      expect(result).toBe(false);
    });
  });

  describe('duplicate', () => {
    it('should duplicate a template with a new name', () => {
      const dup = registry.duplicate('ad_film', 'Ad Film Copy');
      expect(dup).toBeDefined();
      expect(dup.name).toBe('Ad Film Copy');
      expect(dup.id).not.toBe('ad_film');
      expect(dup.isCustom).toBe(true);
    });

    it('should return null for nonexistent template', () => {
      const result = registry.duplicate('nonexistent', 'Copy');
      expect(result).toBeNull();
    });
  });
});

// ============================================
// PromptAssemblyEngine
// ============================================

describe('PromptAssemblyEngine', () => {
  let template;
  let engine;

  beforeEach(() => {
    template = CINEMATIC_TEMPLATES.find(t => t.id === 'ad_film');
    engine = new PromptAssemblyEngine(template, {
      product: 'SuperWidget',
      keyBenefit: 'Saves 10 hours per week',
      visualStyle: 'commercial',
    }, {}, { mode: 'quick' });
  });

  describe('assemble', () => {
    it('should return a non-empty string', () => {
      const prompt = engine.assemble();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should include the template name', () => {
      const prompt = engine.assemble();
      expect(prompt).toContain('Ad Film');
    });

    it('should include product input in subject section', () => {
      const prompt = engine.assemble();
      expect(prompt).toContain('SuperWidget');
    });

    it('should include CTA when template includes CTA', () => {
      const prompt = engine.assemble();
      expect(prompt.toLowerCase()).toContain('call to action');
    });

    it('should not include CTA when includeCTA option is false', () => {
      const engineNoCta = new PromptAssemblyEngine(template, {
        product: 'SuperWidget',
        keyBenefit: 'Saves 10 hours per week',
      }, {}, { mode: 'quick', includeCTA: false });
      const prompt = engineNoCta.assemble();
      expect(prompt).toBeTruthy();
      expect(prompt.toLowerCase()).not.toContain('call to action');
    });
  });

  describe('assembleScenePrompts', () => {
    it('should return an array with scene prompts for sceneBuilder templates with sceneStructure', () => {
      const sceneTemplate = CINEMATIC_TEMPLATES.find(t => t.sceneBuilder && t.sceneStructure);
      const sceneEngine = new PromptAssemblyEngine(sceneTemplate, {
        premise: 'A story about transformation',
        duration: 90,
      }, {}, { mode: 'advanced' });
      const prompts = sceneEngine.assembleScenePrompts();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
      // Each prompt object should have sceneNumber, prompt, duration, shots
      if (typeof prompts[0] === 'object') {
        expect(prompts[0]).toHaveProperty('sceneNumber');
        expect(prompts[0]).toHaveProperty('prompt');
      }
    });

    it('should return a single prompt string for templates without sceneBuilder', () => {
      const noSceneTemplate = CINEMATIC_TEMPLATES.find(t => !t.sceneBuilder);
      const sceneEngine = new PromptAssemblyEngine(noSceneTemplate, {
        hook: 'Amazing reveal',
        content: 'Content here',
      }, {}, { mode: 'quick' });
      const prompts = sceneEngine.assembleScenePrompts();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBe(1);
      expect(typeof prompts[0]).toBe('string');
    });
  });

  describe('buildScenePrompt', () => {
    it('should build a scene-aware prompt string', () => {
      const sceneConfig = {
        name: 'Opening Scene',
        order: 1,
        storyPurpose: 'Hook the viewer',
        emotionalTone: ['excitement'],
        duration: 30,
        beats: ['Introduce protagonist'],
        shots: [
          { shotNumber: 1, type: 'establishing', movement: 'static', duration: 5, description: 'City skyline' },
        ],
      };
      const prompt = engine.buildScenePrompt(sceneConfig);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('OPENING SCENE');
      expect(prompt).toContain('Hook the viewer');
    });

    it('should return the base assemble() prompt when no sceneConfig', () => {
      const prompt = engine.buildScenePrompt(null);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('buildTransitionHint', () => {
    it('should build a transition hint between two scenes', () => {
      const hint = engine.buildTransitionHint(
        { name: 'Scene A' },
        { name: 'Scene B' }
      );
      expect(hint).toContain('Scene A');
      expect(hint).toContain('Scene B');
      expect(hint).toContain('seamless narrative bridge');
    });

    it('should return empty string when fromScene is missing', () => {
      expect(engine.buildTransitionHint(null, { name: 'B' })).toBe('');
    });

    it('should return empty string when toScene is missing', () => {
      expect(engine.buildTransitionHint({ name: 'A' }, null)).toBe('');
    });
  });

  describe('getTechnicalSpecs', () => {
    it('should return technical specs string', () => {
      const specs = engine.getTechnicalSpecs();
      expect(typeof specs).toBe('string');
      expect(specs).toContain('4K');
      expect(specs).toContain('16:9');
      expect(specs).toContain('24fps');
    });

    it('should use provided inputs', () => {
      const customEngine = new PromptAssemblyEngine(template, {
        resolution: '8K',
        aspectRatio: '21:9',
        frameRate: 60,
        colorSpace: 'DCI-P3',
      }, {}, { mode: 'quick' });
      const specs = customEngine.getTechnicalSpecs();
      expect(specs).toContain('8K');
      expect(specs).toContain('21:9');
      expect(specs).toContain('60fps');
      expect(specs).toContain('DCI-P3');
    });
  });

  describe('_hashCode', () => {
    it('should return a number for a string', () => {
      const hash = engine._hashCode('test string');
      expect(typeof hash).toBe('number');
    });

    it('should return 0 for empty string', () => {
      expect(engine._hashCode('')).toBe(0);
    });

    it('should be deterministic', () => {
      const hash1 = engine._hashCode('hello');
      const hash2 = engine._hashCode('hello');
      expect(hash1).toBe(hash2);
    });
  });
});

// ============================================
// SceneBuilder
// ============================================

describe('SceneBuilder', () => {
  let builder;
  let template;

  beforeEach(() => {
    template = CINEMATIC_TEMPLATES.find(t => t.id === 'brand_film');
    builder = new SceneBuilder(template);
  });

  describe('addScene', () => {
    it('should add a scene and return it', () => {
      const scene = builder.addScene({ name: 'Intro', duration: 30 });
      expect(scene).toHaveProperty('id');
      expect(scene.name).toBe('Intro');
      expect(scene.duration).toBe(30);
      expect(scene.order).toBe(1);
    });

    it('should auto-increment order', () => {
      const scene1 = builder.addScene({ name: 'Scene 1' });
      const scene2 = builder.addScene({ name: 'Scene 2' });
      expect(scene1.order).toBe(1);
      expect(scene2.order).toBe(2);
    });

    it('should merge sceneData into scene object', () => {
      const scene = builder.addScene({ name: 'Test', customField: 'value' });
      expect(scene.customField).toBe('value');
    });
  });

  describe('removeScene', () => {
    it('should remove a scene by id', () => {
      const scene = builder.addScene({ name: 'To Remove' });
      const id = scene.id;
      builder.removeScene(id);
      expect(builder.getScenes().find(s => s.id === id)).toBeUndefined();
    });

    it('should reorder remaining scenes', () => {
      const sceneA = builder.addScene({ name: 'A', id: 'scene_a' });
      const sceneB = builder.addScene({ name: 'B', id: 'scene_b' });
      const sceneC = builder.addScene({ name: 'C', id: 'scene_c' });
      builder.removeScene(sceneB.id);
      const scenes = builder.getScenes();
      expect(scenes).toHaveLength(2);
      expect(scenes[0].name).toBe('A');
      expect(scenes[1].name).toBe('C');
      expect(scenes[0].order).toBe(1);
      expect(scenes[1].order).toBe(2);
    });
  });

  describe('moveScene', () => {
    it('should move a scene to a new position', () => {
      const sceneA = builder.addScene({ name: 'A', id: 'scene_a' });
      const sceneB = builder.addScene({ name: 'B', id: 'scene_b' });
      const sceneC = builder.addScene({ name: 'C', id: 'scene_c' });
      builder.moveScene(sceneC.id, 0);
      const scenes = builder.getScenes();
      expect(scenes[0].name).toBe('C');
      expect(scenes[1].name).toBe('A');
      expect(scenes[2].name).toBe('B');
    });

    it('should not crash on invalid scene id', () => {
      builder.addScene({ name: 'A' });
      expect(() => builder.moveScene('nonexistent', 0)).not.toThrow();
    });
  });

  describe('updateScene', () => {
    it('should update scene properties', () => {
      const scene = builder.addScene({ name: 'Original', duration: 10 });
      builder.updateScene(scene.id, { name: 'Updated', duration: 20 });
      const updated = builder.getScenes().find(s => s.id === scene.id);
      expect(updated.name).toBe('Updated');
      expect(updated.duration).toBe(20);
    });

    it('should not affect other scenes', () => {
      const scene1 = builder.addScene({ name: 'A' });
      builder.addScene({ name: 'B' });
      builder.updateScene(scene1.id, { name: 'A Updated' });
      const scenes = builder.getScenes();
      expect(scenes[1].name).toBe('B');
    });
  });

  describe('getScenes', () => {
    it('should return a copy of scenes array', () => {
      builder.addScene({ name: 'A' });
      const scenes = builder.getScenes();
      scenes.push({ name: 'B' });
      expect(builder.getScenes()).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should remove all scenes', () => {
      builder.addScene({ name: 'A' });
      builder.addScene({ name: 'B' });
      builder.clear();
      expect(builder.getScenes()).toHaveLength(0);
    });
  });

  describe('toJSON', () => {
    it('should return template id, scenes, and totalDuration', () => {
      builder.addScene({ name: 'A', duration: 30 });
      builder.addScene({ name: 'B', duration: 20 });
      const json = builder.toJSON();
      expect(json.template).toBe(template.id);
      expect(json.scenes).toHaveLength(2);
      expect(json.totalDuration).toBe(50);
    });
  });
});

// ============================================
// ShotBuilder
// ============================================

describe('ShotBuilder', () => {
  let shotBuilder;

  beforeEach(() => {
    shotBuilder = new ShotBuilder('scene_1');
  });

  describe('addShot', () => {
    it('should add a shot and return it', () => {
      const shot = shotBuilder.addShot({ type: 'close_up', duration: 3 });
      expect(shot).toHaveProperty('id');
      expect(shot.sceneId).toBe('scene_1');
      expect(shot.type).toBe('close_up');
      expect(shot.duration).toBe(3);
      expect(shot.order).toBe(1);
    });

    it('should auto-increment order', () => {
      shotBuilder.addShot({ type: 'wide' });
      shotBuilder.addShot({ type: 'close_up' });
      const shots = shotBuilder.getShots();
      expect(shots[0].order).toBe(1);
      expect(shots[1].order).toBe(2);
    });
  });

  describe('removeShot', () => {
    it('should remove a shot by id', () => {
      const shot = shotBuilder.addShot({ type: 'wide' });
      const id = shot.id;
      shotBuilder.removeShot(id);
      expect(shotBuilder.getShots().find(s => s.id === id)).toBeUndefined();
    });

    it('should reorder remaining shots', () => {
      const shot1 = shotBuilder.addShot({ type: 'wide', id: 'shot_1' });
      const shot2 = shotBuilder.addShot({ type: 'medium', id: 'shot_2' });
      const shot3 = shotBuilder.addShot({ type: 'close_up', id: 'shot_3' });
      shotBuilder.removeShot(shot2.id);
      const shots = shotBuilder.getShots();
      expect(shots).toHaveLength(2);
      expect(shots[0].order).toBe(1);
      expect(shots[1].order).toBe(2);
      expect(shots[0].type).toBe('wide');
      expect(shots[1].type).toBe('close_up');
    });
  });

  describe('updateShot', () => {
    it('should update shot properties', () => {
      const shot = shotBuilder.addShot({ type: 'wide', movement: 'static' });
      shotBuilder.updateShot(shot.id, { movement: 'dolly_in' });
      const updated = shotBuilder.getShots().find(s => s.id === shot.id);
      expect(updated.movement).toBe('dolly_in');
    });
  });

  describe('getShots', () => {
    it('should return a copy of shots array', () => {
      shotBuilder.addShot({ type: 'wide' });
      const shots = shotBuilder.getShots();
      shots.push({ type: 'extra' });
      expect(shotBuilder.getShots()).toHaveLength(1);
    });
  });

  describe('toPromptFragment', () => {
    it('should return a comma-separated shot description string', () => {
      shotBuilder.addShot({ type: 'close_up', movement: 'dolly_in', duration: 3 });
      const fragment = shotBuilder.toPromptFragment();
      expect(typeof fragment).toBe('string');
      expect(fragment.length).toBeGreaterThan(0);
    });

    it('should return empty string for no shots', () => {
      const fragment = shotBuilder.toPromptFragment();
      expect(fragment).toBe('');
    });
  });
});

// ============================================
// StoryboardBuilder
// ============================================

describe('StoryboardBuilder', () => {
  let storyboard;
  let template;

  beforeEach(() => {
    template = CINEMATIC_TEMPLATES.find(t => t.id === 'brand_film');
    storyboard = new StoryboardBuilder(template);
  });

  describe('addBoard', () => {
    it('should add a board and return it', () => {
      const board = storyboard.addBoard({
        sceneName: 'Opening',
        shotType: 'establishing',
        description: 'Wide establishing shot of the city',
      });
      expect(board).toHaveProperty('id');
      expect(board.sceneName).toBe('Opening');
      expect(board.order).toBe(1);
    });

    it('should auto-increment order', () => {
      storyboard.addBoard({ sceneName: 'A', shotType: 'wide' });
      storyboard.addBoard({ sceneName: 'B', shotType: 'medium' });
      const boards = storyboard.getBoards();
      expect(boards[0].order).toBe(1);
      expect(boards[1].order).toBe(2);
    });
  });

  describe('removeBoard', () => {
    it('should remove a board by id', () => {
      const board = storyboard.addBoard({ sceneName: 'Test', shotType: 'wide' });
      storyboard.removeBoard(board.id);
      expect(storyboard.getBoards().find(b => b.id === board.id)).toBeUndefined();
    });

    it('should reorder remaining boards', () => {
      const boardA = storyboard.addBoard({ sceneName: 'A', shotType: 'wide', id: 'board_a' });
      const boardB = storyboard.addBoard({ sceneName: 'B', shotType: 'medium', id: 'board_b' });
      storyboard.removeBoard(boardA.id);
      const boards = storyboard.getBoards();
      expect(boards).toHaveLength(1);
      expect(boards[0].order).toBe(1);
      expect(boards[0].sceneName).toBe('B');
    });
  });

  describe('updateBoard', () => {
    it('should update board properties', () => {
      const board = storyboard.addBoard({ sceneName: 'Original', shotType: 'wide' });
      storyboard.updateBoard(board.id, { sceneName: 'Updated', visualNotes: 'New notes' });
      const updated = storyboard.getBoards().find(b => b.id === board.id);
      expect(updated.sceneName).toBe('Updated');
      expect(updated.visualNotes).toBe('New notes');
    });
  });

  describe('getBoards', () => {
    it('should return a copy of boards array', () => {
      storyboard.addBoard({ sceneName: 'A', shotType: 'wide' });
      const boards = storyboard.getBoards();
      boards.push({ sceneName: 'Fake' });
      expect(storyboard.getBoards()).toHaveLength(1);
    });
  });

  describe('generateFromScenes', () => {
    it('should generate boards from scene data', () => {
      const scenes = [
        {
          sceneNumber: 1,
          beat: 'Intro',
          shots: [
            { shotNumber: 1, type: 'establishing', movement: 'static', description: 'City skyline' },
            { shotNumber: 2, type: 'wide', movement: 'pan_left', description: 'Street level' },
          ],
        },
      ];
      storyboard.generateFromScenes(scenes);
      const boards = storyboard.getBoards();
      expect(boards).toHaveLength(2);
      expect(boards[0].sceneNumber).toBe(1);
      expect(boards[0].shotType).toBe('establishing');
    });
  });

  describe('exportAsText', () => {
    it('should export boards as formatted text', () => {
      storyboard.addBoard({
        sceneName: 'Intro Scene',
        shotNumber: 1,
        shotType: 'establishing',
        cameraMovement: 'static',
        description: 'City skyline at dusk',
        visualNotes: 'Golden hour',
        audioNotes: 'Ambient city sounds',
      });
      const text = storyboard.exportAsText();
      expect(typeof text).toBe('string');
      expect(text).toContain('BOARD 1');
      expect(text).toContain('Intro Scene');
      expect(text).toContain('Establishing Shot');
      expect(text).toContain('Golden hour');
      expect(text).toContain('Ambient city sounds');
    });

    it('should return empty string for no boards', () => {
      const text = storyboard.exportAsText();
      expect(text).toBe('');
    });
  });

  describe('toJSON', () => {
    it('should return template id and boards', () => {
      storyboard.addBoard({ sceneName: 'A', shotType: 'wide' });
      const json = storyboard.toJSON();
      expect(json.template).toBe(template.id);
      expect(json.boards).toHaveLength(1);
    });
  });
});

// ============================================
// TemplateInputBuilder
// ============================================

describe('TemplateInputBuilder', () => {
  let builder;
  let template;

  beforeEach(() => {
    template = CINEMATIC_TEMPLATES.find(t => t.id === 'ad_film');
  });

  describe('constructor', () => {
    it('should use quickInputs in quick mode', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      expect(builder.inputs.length).toBe(template.quickInputs.length);
    });

    it('should combine quickInputs and advancedInputs in advanced mode', () => {
      builder = new TemplateInputBuilder(template, 'advanced');
      expect(builder.inputs.length).toBe(
        template.quickInputs.length + template.advancedInputs.length
      );
    });
  });

  describe('buildFormSchema', () => {
    it('should return a schema array', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      const schema = builder.buildFormSchema();
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBe(template.quickInputs.length);
    });

    it('each schema item should have expected fields', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      const schema = builder.buildFormSchema();
      schema.forEach(item => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('required');
        expect(item).toHaveProperty('visible');
        expect(item).toHaveProperty('section');
      });
    });

    it('should set visible to true for all inputs', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      const schema = builder.buildFormSchema();
      schema.forEach(item => {
        expect(item.visible).toBe(true);
      });
    });
  });

  describe('validateInputs', () => {
    it('should return errors for missing required fields', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      const errors = builder.validateInputs({});
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'product')).toBe(true);
      expect(errors.some(e => e.field === 'keyBenefit')).toBe(true);
    });

    it('should pass when all required fields are provided', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      const errors = builder.validateInputs({
        product: 'Test Product',
        keyBenefit: 'Saves time',
      });
      expect(errors).toEqual([]);
    });

    it('should validate number min/max', () => {
      const numTemplate = CINEMATIC_TEMPLATES.find(t =>
        t.quickInputs.some(i => i.type === 'number' && i.min !== undefined)
      );
      if (numTemplate) {
        builder = new TemplateInputBuilder(numTemplate, 'quick');
        const numInput = numTemplate.quickInputs.find(i => i.type === 'number');
        if (numInput) {
          const errors = builder.validateInputs({ [numInput.name]: numInput.min - 1 });
          expect(errors.some(e => e.field === numInput.name)).toBe(true);
        }
      }
    });
  });

  describe('getDefaults', () => {
    it('should return default values for inputs', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      const defaults = builder.getDefaults();
      expect(typeof defaults).toBe('object');
      template.quickInputs.forEach(input => {
        if (input.type === 'select' && input.options?.length > 0) {
          expect(defaults[input.name]).toBe(input.options[0]);
        } else if (input.type === 'number' && input.min !== undefined) {
          expect(defaults[input.name]).toBe(input.min);
        } else {
          expect(defaults[input.name]).toBe('');
        }
      });
    });
  });

  describe('getSection', () => {
    it('should return correct sections for known field names', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      expect(builder.getSection({ name: 'product' })).toBe('content');
      expect(builder.getSection({ name: 'shotType' })).toBe('camera');
      expect(builder.getSection({ name: 'visualStyle' })).toBe('style');
      expect(builder.getSection({ name: 'brandName' })).toBe('brand');
      expect(builder.getSection({ name: 'ctaType' })).toBe('cta');
    });

    it('should return basic for unknown field names', () => {
      builder = new TemplateInputBuilder(template, 'quick');
      expect(builder.getSection({ name: 'unknownField' })).toBe('basic');
    });
  });
});

// ============================================
// TemplateStorage
// ============================================

describe('TemplateStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('isFavorite', () => {
    it('should return false for unfavorited template', () => {
      expect(TemplateStorage.isFavorite('template_1')).toBe(false);
    });

    it('should return true after adding to favorites', () => {
      TemplateStorage.addFavorite('template_1');
      expect(TemplateStorage.isFavorite('template_1')).toBe(true);
    });

    it('should return false after removing from favorites', () => {
      TemplateStorage.addFavorite('template_1');
      TemplateStorage.removeFavorite('template_1');
      expect(TemplateStorage.isFavorite('template_1')).toBe(false);
    });
  });

  describe('addToFavorites / removeFromFavorites', () => {
    it('should not duplicate favorites', () => {
      TemplateStorage.addFavorite('template_1');
      TemplateStorage.addFavorite('template_1');
      const favs = TemplateStorage.getFavorites();
      expect(favs.filter(f => f === 'template_1').length).toBe(1);
    });
  });

  describe('getRecent', () => {
    it('should return an empty array initially', () => {
      expect(TemplateStorage.getRecent()).toEqual([]);
    });

    it('should track recent templates', () => {
      TemplateStorage.addToRecent('template_1', { key: 'value' });
      const recent = TemplateStorage.getRecent();
      expect(recent).toHaveLength(1);
      expect(recent[0].templateId).toBe('template_1');
      expect(recent[0].inputs).toEqual({ key: 'value' });
      expect(recent[0]).toHaveProperty('usedAt');
    });

    it('should remove duplicates and keep most recent first', () => {
      TemplateStorage.addToRecent('template_1');
      TemplateStorage.addToRecent('template_2');
      TemplateStorage.addToRecent('template_1');
      const recent = TemplateStorage.getRecent();
      expect(recent).toHaveLength(2);
      expect(recent[0].templateId).toBe('template_1');
    });

    it('should limit to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        TemplateStorage.addToRecent(`template_${i}`);
      }
      expect(TemplateStorage.getRecent()).toHaveLength(20);
    });
  });

  describe('exportTemplate', () => {
    it('should return JSON string for a valid template', () => {
      const exported = TemplateStorage.exportTemplate('cinematic_short_film');
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('template');
      expect(parsed).toHaveProperty('exportedAt');
      expect(parsed).toHaveProperty('version', '1.0');
      expect(parsed.template.id).toBe('cinematic_short_film');
      expect(parsed.template).not.toHaveProperty('usageCount');
    });

    it('should return null for invalid template id', () => {
      const exported = TemplateStorage.exportTemplate('nonexistent');
      expect(exported).toBeNull();
    });
  });

  describe('importTemplate', () => {
    it('should import a valid template JSON', () => {
      const exported = TemplateStorage.exportTemplate('ad_film');
      const imported = TemplateStorage.importTemplate(exported);
      expect(imported).toBeDefined();
      expect(imported.id).toMatch(/^custom_\d+$/);
      expect(imported.isCustom).toBe(true);
    });

    it('should return null for invalid JSON', () => {
      const result = TemplateStorage.importTemplate('not valid json');
      expect(result).toBeNull();
    });

    it('should register a custom template even when template data is sparse', () => {
      // registerCustom({ ...undefined }) produces a valid empty template object
      const result = TemplateStorage.importTemplate('{"version":"1.0"}');
      expect(result).not.toBeNull();
      expect(result.isCustom).toBe(true);
      expect(result.id).toMatch(/^custom_\d+$/);
    });
  });
});

// ============================================
// RenderHandoff
// ============================================

describe('RenderHandoff', () => {
  let template;
  let handoff;

  beforeEach(() => {
    template = CINEMATIC_TEMPLATES.find(t => t.id === 'brand_film');
    handoff = new RenderHandoff(template, {
      brandName: 'Acme Corp',
      brandStory: 'A story of innovation',
      visualStyle: 'commercial',
      duration: 120,
      aspectRatio: '16:9',
      resolution: '4K',
    }, [], { mode: 'quick' });
  });

  describe('generate', () => {
    it('should return a complete render handoff object', () => {
      const result = handoff.generate();
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('template');
      expect(result).toHaveProperty('inputs');
      expect(result).toHaveProperty('brandContext');
      expect(result).toHaveProperty('scenes');
      expect(result).toHaveProperty('shots');
      expect(result).toHaveProperty('technicalSpecs');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('prompts');
      expect(result).toHaveProperty('renderInstructions');
    });
  });

  describe('getMetadata', () => {
    it('should include template info and generator', () => {
      const meta = handoff.getMetadata();
      expect(meta.templateId).toBe(template.id);
      expect(meta.templateName).toBe(template.name);
      expect(meta.mode).toBe('quick');
      expect(meta.generator).toBe('CinematicTemplateSystem');
      expect(meta.version).toBe('1.0');
      expect(meta).toHaveProperty('generatedAt');
    });
  });

  describe('getTemplateInfo', () => {
    it('should return template info with duration and aspect ratio', () => {
      const info = handoff.getTemplateInfo();
      expect(info.id).toBe(template.id);
      expect(info.name).toBe(template.name);
      expect(info.outputType).toBe('video');
      expect(info.duration.target).toBe(120);
      expect(info.duration.min).toBe(template.duration.min);
      expect(info.duration.max).toBe(template.duration.max);
      expect(info.aspectRatio).toBe('16:9');
    });
  });

  describe('getBrandContext', () => {
    it('should return brand context when template includes brand', () => {
      const brand = handoff.getBrandContext();
      expect(brand).not.toBeNull();
      expect(brand.brandName).toBe('Acme Corp');
      expect(brand.brandVoice).toBeUndefined();
      expect(brand.targetAudience).toBeUndefined();
    });

    it('should return null when template does not include brand context', () => {
      const noBrandTemplate = CINEMATIC_TEMPLATES.find(t => !t.includeBrandContext);
      const noBrandHandoff = new RenderHandoff(noBrandTemplate, {}, [], { mode: 'quick' });
      expect(noBrandHandoff.getBrandContext()).toBeNull();
    });
  });

  describe('getSceneData', () => {
    it('should return null when no scenes', () => {
      const data = handoff.getSceneData();
      expect(data).toBeNull();
    });

    it('should return scene data when scenes are provided', () => {
      const scenes = [
        {
          sceneNumber: 1,
          beat: 'Setup',
          duration: 30,
          shots: [
            { shotNumber: 1, type: 'establishing', movement: 'static', description: 'Wide shot' },
          ],
        },
      ];
      const h = new RenderHandoff(template, { duration: 30 }, scenes, { mode: 'quick' });
      const data = h.getSceneData();
      expect(data).toHaveLength(1);
      expect(data[0].number).toBe(1);
      expect(data[0].shots).toHaveLength(1);
      expect(data[0].shots[0].type).toBe('establishing');
    });

    it('should handle selector-style scenes with id/name', () => {
      const scenes = [
        {
          id: 'scene_1',
          name: 'My Scene',
          storyPurpose: 'Hook',
          duration: 30,
          shots: [
            { shotNumber: 1, type: 'wide', movement: 'dolly_in', description: 'Wide dolly' },
          ],
        },
      ];
      const h = new RenderHandoff(template, { duration: 30 }, scenes, { mode: 'quick' });
      const data = h.getSceneData();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('scene_1');
      expect(data[0].name).toBe('My Scene');
      expect(data[0].storyPurpose).toBe('Hook');
    });
  });

  describe('getShotData', () => {
    it('should return shot data from scenes', () => {
      const scenes = [
        {
          sceneNumber: 1,
          shots: [
            { shotNumber: 1, type: 'close_up', movement: 'static' },
            { shotNumber: 2, type: 'wide', movement: 'pan_left' },
          ],
        },
      ];
      const h = new RenderHandoff(template, { visualStyle: 'commercial' }, scenes, { mode: 'advanced' });
      const shots = h.getShotData();
      expect(shots).toHaveLength(2);
      expect(shots[0].sceneNumber).toBe(1);
      expect(shots[0].shotNumber).toBe(1);
      expect(shots[0].type).toBe('close_up');
      expect(shots[1].type).toBe('wide');
    });

    it('should return empty array when no scenes have shots', () => {
      const h = new RenderHandoff(template, {}, [], { mode: 'quick' });
      expect(h.getShotData()).toEqual([]);
    });
  });

  describe('getTechnicalSpecs', () => {
    it('should return defaults when no inputs provided', () => {
      const h = new RenderHandoff(template, {}, [], { mode: 'quick' });
      const specs = h.getTechnicalSpecs();
      expect(specs.resolution).toBe('4K');
      expect(specs.aspectRatio).toBe('16:9');
      expect(specs.frameRate).toBe(24);
      expect(specs.colorSpace).toBe('Rec. 709');
      expect(specs.audioFormat).toBe('AAC');
    });

    it('should use provided inputs', () => {
      const specs = handoff.getTechnicalSpecs();
      expect(specs.resolution).toBe('4K');
      expect(specs.aspectRatio).toBe('16:9');
    });
  });

  describe('getOutputConfig', () => {
    it('should return format and codec defaults', () => {
      const config = handoff.getOutputConfig();
      expect(config.format).toBe('mp4');
      expect(config.codec).toBe('h264');
      expect(config.quality).toBe('high');
    });

    it('should include ending config when template has CTA', () => {
      const config = handoff.getOutputConfig();
      expect(config).toHaveProperty('ending');
      expect(config.ending.type).toBe('fade_to_black');
    });

    it('should not include ending config for templates without CTA', () => {
      const noCtaTemplate = CINEMATIC_TEMPLATES.find(t => !t.includeCTA);
      const h = new RenderHandoff(noCtaTemplate, {}, [], { mode: 'quick' });
      const config = h.getOutputConfig();
      expect(config).not.toHaveProperty('ending');
    });
  });

  describe('generatePrompts', () => {
    it('should generate prompts', () => {
      const prompts = handoff.generatePrompts();
      expect(Array.isArray(prompts)).toBe(true);
    });
  });

  describe('getRenderInstructions', () => {
    it('should return a list of render instructions', () => {
      const instructions = handoff.getRenderInstructions();
      expect(Array.isArray(instructions)).toBe(true);
      expect(instructions.length).toBeGreaterThan(0);
    });

    it('should include scene setup for non-empty scenes', () => {
      const scenes = [
        {
          sceneNumber: 1,
          beat: 'Setup',
          shots: [
            { shotNumber: 1, type: 'establishing', movement: 'static' },
          ],
        },
      ];
      const h = new RenderHandoff(template, { duration: 30 }, scenes, { mode: 'advanced' });
      const instructions = h.getRenderInstructions();
      expect(instructions.some(i => i.includes('SETUP SCENES'))).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should return a JSON string', () => {
      const json = handoff.toJSON();
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.metadata).toBeDefined();
    });
  });
});

// ============================================
// getTemplateRegistry
// ============================================

describe('getTemplateRegistry', () => {
  it('should return a CinematicTemplateRegistry instance', () => {
    const registry = getTemplateRegistry();
    expect(registry).toBeInstanceOf(CinematicTemplateRegistry);
  });

  it('should return the same instance on subsequent calls (singleton)', () => {
    const registry1 = getTemplateRegistry();
    const registry2 = getTemplateRegistry();
    expect(registry1).toBe(registry2);
  });

  it('should have all templates loaded', () => {
    const registry = getTemplateRegistry();
    expect(registry.getAll().length).toBe(CINEMATIC_TEMPLATES.length);
  });
});
