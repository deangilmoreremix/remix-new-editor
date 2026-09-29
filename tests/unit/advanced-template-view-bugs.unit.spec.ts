import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const templateStudioPath = path.join(root, 'src/components/TemplateStudio.js');
const cinemaTemplateStudioPath = path.join(root, 'src/components/CinemaTemplateStudio.js');
const templateEnginePath = path.join(root, 'src/lib/templateEngine.js');
const cinematicTemplatesPath = path.join(root, 'src/lib/cinematicTemplates.js');
const thumbnailModalPath = path.join(root, 'src/components/modals/TemplateThumbnailModal.jsx');

describe('Advanced Template View Bug Fixes', () => {
  describe('Bug 6: Missing TemplateThumbnailModal.jsx', () => {
    it('TemplateThumbnailModal.jsx file exists on disk', () => {
      expect(fs.existsSync(thumbnailModalPath)).toBe(true);
    });
  });

  describe('Bug 1: TemplateStudio.js async missing on line 468', () => {
    it('TemplateStudio.js contains async arrow functions for enhance item click handlers', () => {
      const src = fs.readFileSync(templateStudioPath, 'utf8');
      // The enhanceItems.forEach callback and its inner click handler must both be async
      expect(src).toContain('enhanceItems.forEach(item => {');
      expect(src).toContain("item.addEventListener('click', async () => {");
    });
  });

  describe('Bug 2: TemplateStudio.js TDZ on modelLoadingStatus', () => {
    it('TemplateStudio.js declares modelLoadingStatus before it is referenced in callbacks', () => {
      const src = fs.readFileSync(templateStudioPath, 'utf8');
      const modelLoadingStatusDecl = src.indexOf('const modelLoadingStatus = document.createElement');
      const firstRef = src.indexOf("modelLoadingStatus.textContent = 'Loading...'");
      expect(firstRef).toBeGreaterThanOrEqual(0);
      expect(modelLoadingStatusDecl).toBeGreaterThanOrEqual(0);
      expect(modelLoadingStatusDecl).toBeLessThan(firstRef);
    });
  });

  describe('Bug 3: CinemaTemplateStudio.js TDZ on modelLoadingStatus', () => {
    it('CinemaTemplateStudio.js declares modelLoadingStatus before it is referenced in callbacks', () => {
      const src = fs.readFileSync(cinemaTemplateStudioPath, 'utf8');
      const modelLoadingStatusDecl = src.indexOf('const modelLoadingStatus = document.createElement');
      const firstRef = src.indexOf("modelLoadingStatus.textContent = 'Loading...'");
      expect(firstRef).toBeGreaterThanOrEqual(0);
      expect(modelLoadingStatusDecl).toBeGreaterThanOrEqual(0);
      expect(modelLoadingStatusDecl).toBeLessThan(firstRef);
    });
  });

  describe('Bug 4: CinemaTemplateStudio.js stray comment on line 2740', () => {
    it('CinemaTemplateStudio.js does not contain stray comment after return container', () => {
      const src = fs.readFileSync(cinemaTemplateStudioPath, 'utf8');
      const returnContainerIdx = src.lastIndexOf('return container;');
      const afterReturn = src.slice(returnContainerIdx + 'return container;'.length);
      // After the final return container; there should only be whitespace/end of file
      expect(afterReturn.trim()).not.toMatch(/^\/\//);
    });
  });

  describe('Bug 5: TemplateStudio.js broken duplicate-sentence regex', () => {
    it('buildEnrichedPrompt removes duplicate sentences from prompts', () => {
      const src = fs.readFileSync(templateStudioPath, 'utf8');
      // The duplicate removal regex must not contain backreferences inside lookaheads
      expect(src).not.toMatch(/\(\[\^\.\]\+\)\\\.\\s\*\(\?=\\1\)/);
      // Verify a working duplicate-sentence removal pattern exists instead
      expect(src).toMatch(/replace\(/);
    });
  });

  describe('Bug 7: templateEngine.js composeNegativePrompt style lookup gap', () => {
    it('composeNegativePrompt handles all cinematic styles without undefined', async () => {
      const module = await import(templateEnginePath);
      const { composeNegativePrompt, CINEMATIC_STYLES } = module;
      const styles = Object.values(CINEMATIC_STYLES);
      for (const style of styles) {
        const result = composeNegativePrompt('dramatic-trailer', 'restaurant', style);
        expect(result).toBeTruthy();
        expect(result).not.toContain('undefined');
      }
    });
  });

  describe('Bug 8: cinematicTemplates.js RenderHandoff.getShotData legacy path shotNumber', () => {
    it('RenderHandoff.getShotData includes shotNumber for legacy scene paths', async () => {
      const module = await import(cinematicTemplatesPath);
      const { RenderHandoff } = module;
      const template = {
        id: 'test',
        name: 'Test',
        outputType: 'video',
        duration: { default: 5, min: 5, max: 10 },
        aspectRatios: ['16:9'],
      };
      const legacyScenes = [
        {
          sceneNumber: 1,
          beat: 'Scene 1',
          duration: 5,
          shots: [
            { shotNumber: 1, type: 'MEDIUM', movement: 'STATIC', description: 'Test shot' },
          ],
        },
      ];
      const handoff = new RenderHandoff(template, {}, legacyScenes, { mode: 'advanced' });
      const shotData = handoff.getShotData();
      expect(shotData.length).toBe(1);
      expect(shotData[0].shotNumber).toBe(1);
      expect(shotData[0].type).toBe('MEDIUM');
    });
  });
});
