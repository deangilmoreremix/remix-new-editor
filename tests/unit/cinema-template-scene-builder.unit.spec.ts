import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cinemaStudioPath = path.join(root, 'src/components/CinemaTemplateStudio.js');
const cinematicTemplatesPath = path.join(root, 'src/lib/cinematicTemplates.js');

// ──────────────────────────────────────────────────────────────
// PromptAssemblyEngine.buildScenes guard tests
// ──────────────────────────────────────────────────────────────
import { PromptAssemblyEngine } from '../../src/lib/cinematicTemplates.js';

describe('PromptAssemblyEngine.buildScenes guards', () => {
  const emptyTemplate = { id: 'empty', name: 'Empty', sceneStructure: null };

  it('returns [] when template has no sceneStructure', () => {
    const engine = new PromptAssemblyEngine(emptyTemplate, {});
    expect(engine.buildScenes()).toEqual([]);
  });

  it('returns [] when sceneStructure.acts is not an array', () => {
    const engine = new PromptAssemblyEngine(
      { id: 'bad-acts', name: 'Bad', sceneStructure: { acts: 'not-array' } },
      {}
    );
    expect(engine.buildScenes()).toEqual([]);
  });

  it('returns [] when sceneStructure.acts is an empty array', () => {
    const engine = new PromptAssemblyEngine(
      { id: 'no-acts', name: 'None', sceneStructure: { acts: [] } },
      {}
    );
    expect(engine.buildScenes()).toEqual([]);
  });

  it('returns scenes when acts have beats', () => {
    const engine = new PromptAssemblyEngine(
      {
        id: 'with-acts',
        name: 'With Acts',
        sceneStructure: {
          acts: [
            { act: 1, name: 'Act 1', duration: 5000, beats: ['hook', 'reveal'] },
          ],
        },
      },
      { duration: 60 }
    );
    const scenes = engine.buildScenes();
    expect(scenes.length).toBe(2);
    expect(scenes[0].beat).toBe('hook');
    expect(scenes[1].beat).toBe('reveal');
  });

  it('skips acts with no beats and still returns scenes from other acts', () => {
    const engine = new PromptAssemblyEngine(
      {
        id: 'mixed-acts',
        name: 'Mixed',
        sceneStructure: {
          acts: [
            { act: 1, name: 'Act 1', duration: 5000, beats: [] },
            { act: 2, name: 'Act 2', duration: 5000, beats: ['payoff'] },
          ],
        },
      },
      { duration: 60 }
    );
    const scenes = engine.buildScenes();
    expect(scenes.length).toBe(1);
    expect(scenes[0].beat).toBe('payoff');
  });

  it('does not throw when act.beats is undefined (treats as empty)', () => {
    const engine = new PromptAssemblyEngine(
      {
        id: 'no-beats',
        name: 'No Beats',
        sceneStructure: {
          acts: [
            { act: 1, name: 'Act 1', duration: 5000 },
          ],
        },
      },
      { duration: 60 }
    );
    expect(() => engine.buildScenes()).not.toThrow();
    expect(engine.buildScenes()).toEqual([]);
  });
});

describe('CinemaTemplateStudio scene-builder wiring', () => {
  const cinemaSrc = fs.readFileSync(cinemaStudioPath, 'utf8');
  const templatesSrc = fs.readFileSync(cinematicTemplatesPath, 'utf8');

  it('renders an Add Scene button with the expected id', () => {
    expect(cinemaSrc).toContain('id="add-scene-btn"');
    expect(cinemaSrc).toContain('+ Add Scene');
  });

  it('wires the Add Scene button to sceneBuilder.addScene() and re-renders', () => {
    expect(cinemaSrc).toContain("container.querySelector('#add-scene-btn').onclick");
    expect(cinemaSrc).toContain('sceneBuilder.addScene(');
    expect(cinemaSrc).toContain('renderSceneBuilder();');
    expect(cinemaSrc).toContain('renderSceneTimeline();');
  });

  it('guards Add Scene with try/catch and surfaces errors via showToast', () => {
    expect(cinemaSrc).toContain("try {");
    expect(cinemaSrc).toContain("showToast('Failed to add scene', 'error');");
  });

  it('guards scene delete with try/catch and surfaces errors via showToast', () => {
    expect(cinemaSrc).toContain("list.querySelectorAll('.delete-scene-btn').forEach(btn => {");
    expect(cinemaSrc).toContain("showToast('Failed to remove scene', 'error');");
  });

  it('guards scene move with try/catch and surfaces errors via showToast', () => {
    expect(cinemaSrc).toContain("list.querySelectorAll('.move-scene-btn').forEach(btn => {");
    expect(cinemaSrc).toContain("showToast('Failed to move scene', 'error');");
  });

  it('uses valid scene defaults matching cinematicTemplates enums', () => {
    expect(cinemaSrc).toContain("type: 'MEDIUM'");
    expect(cinemaSrc).toContain("movement: 'STATIC'");
    expect(templatesSrc).toContain('export const SHOT_TYPES');
    expect(templatesSrc).toContain('export const CAMERA_MOVEMENTS');
  });
});

describe('SceneBuilder class structure', () => {
  const templatesSrc = fs.readFileSync(cinematicTemplatesPath, 'utf8');

  it('exports SceneBuilder', () => {
    expect(templatesSrc).toContain('export class SceneBuilder');
  });

  it('constructs with template and empty scenes array', () => {
    expect(templatesSrc).toContain('constructor(template) {');
    expect(templatesSrc).toContain('this.template = template;');
    expect(templatesSrc).toContain('this.scenes = [];');
  });

  it('adds scenes with id, order, and spread sceneData', () => {
    expect(templatesSrc).toContain('addScene(sceneData) {');
    expect(templatesSrc).toContain('id: `scene_${Date.now()}`');
    expect(templatesSrc).toContain('order: this.scenes.length + 1');
    expect(templatesSrc).toContain('...sceneData');
  });

  it('removes scenes by id and reorders', () => {
    expect(templatesSrc).toContain('removeScene(sceneId) {');
    expect(templatesSrc).toContain('this.scenes = this.scenes.filter(s => s.id !== sceneId);');
    expect(templatesSrc).toContain('reorderScenes();');
  });

  it('moves scenes by id and newOrder', () => {
    expect(templatesSrc).toContain('moveScene(sceneId, newOrder) {');
    expect(templatesSrc).toContain('this.scenes.splice(newOrder, 0, scene);');
  });

  it('returns a copy of scenes from getScenes', () => {
    expect(templatesSrc).toContain('getScenes() {');
    expect(templatesSrc).toContain('return [...this.scenes];');
  });

  it('clears all scenes', () => {
    expect(templatesSrc).toContain('clear() {');
    expect(templatesSrc).toContain('this.scenes = [];');
  });
});
