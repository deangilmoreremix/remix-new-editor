import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('landing historical composition regression', () => {
  it('keeps the intentionally removed interactive demos off the landing page', () => {
    const landing = read('src/components/landing/LandingPage.jsx');
    expect(landing).not.toContain('DemosSection');
    expect(landing).not.toContain("section-' + 'demos'");
    expect(landing).not.toContain('appendChild(demos)');

    for (const path of [
      'src/components/landing/sections/DemosSection.jsx',
      'src/components/landing/demos/ImageGenDemo.jsx',
      'src/components/landing/demos/VideoGenDemo.jsx',
      'src/components/landing/demos/CharacterDemo.jsx',
    ]) {
      expect(existsSync(resolve(root, path))).toBe(false);
    }
  });

  it('preserves the intended landing section composition', () => {
    const landing = read('src/components/landing/LandingPage.jsx');
    for (const section of [
      'ScrollingAppStrip.jsx',
      'HookSection.jsx',
      'MinimaxWorkflowSection.jsx',
      'SixEnginesSection.jsx',
      'AppsGridSection.jsx',
      'MadeWithSmartVideo.jsx',
      'UGCDemoShowcase.jsx',
      'FeaturesSection.jsx',
      'AIVideoGallery.jsx',
      'AcademyVideoShowcase.jsx',
      'ShowcaseRepoVideo.jsx',
      'ProblemSection.jsx',
      'WorkflowSection.jsx',
      'ComparisonSection.jsx',
      'ValueStackSection.jsx',
      'AgencySection.jsx',
      'OfferSection.jsx',
      'FinalCTASection.jsx',
    ]) {
      expect(landing).toContain(section);
    }
  });

  it('keeps marketing app cards thumbnail-free', () => {
    const apps = read('src/components/landing/sections/AppsGridSection.jsx');
    expect(apps).not.toContain('<img');
    expect(apps).not.toContain('getStudioThumbnail');
    expect(apps).not.toContain('getToolThumbnail');
    expect(apps).not.toContain('Historical studio thumbnail');
    expect(apps).not.toContain('Before/After Tool Previews');
  });

  it('does not restore the historical thumbnail enhancement layer', () => {
    for (const path of [
      'src/components/landing/sections/HeroSection.jsx',
      'src/components/landing/sections/HookSection.jsx',
      'src/components/landing/sections/SixEnginesSection.jsx',
      'src/components/landing/sections/ProblemSection.jsx',
      'src/components/landing/sections/WorkflowSection.jsx',
      'src/components/landing/sections/AgencySection.jsx',
      'src/components/landing/sections/OfferSection.jsx',
    ]) {
      const source = read(path);
      expect(source).not.toContain('Historical thumbnails added as visual enhancement');
      expect(source).not.toContain('historical thumbnails added as enhancement');
      expect(source).not.toContain('historical category thumbnails added as enhancement');
      expect(source).not.toContain('Historical sample gallery added as visual enhancement');
      expect(source).not.toContain('Historical template previews added as visual enhancement');
    }
  });
});
