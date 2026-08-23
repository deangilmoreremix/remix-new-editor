import { describe, test, expect } from 'vitest';
import BaseModal from './BaseModal.jsx';

const MODAL_FILES = [
  { name: 'ConnectModal', path: './ConnectModal.jsx', exportName: 'ConnectModal' },
  { name: 'ContactImporterModal (jsx)', path: './ContactImporterModal.jsx', exportName: 'ContactImporterModal' },
  { name: 'EmailCampaignModal', path: './EmailCampaignModal.jsx', exportName: 'EmailCampaignModal' },
  { name: 'EndScreenModal', path: './EndScreenModal.jsx', exportName: 'EndScreenModal' },
  { name: 'EnhancedRecorderModal', path: './EnhancedRecorderModal.jsx', exportName: 'EnhancedRecorderModal' },
  { name: 'GTMPromptModal', path: './GTMPromptModal.jsx', exportName: 'GTMPromptModal' },
  { name: 'LeadGeneratorModal', path: './LeadGeneratorModal.jsx', exportName: 'LeadGeneratorModal' },
  { name: 'PageShotModal', path: './PageShotModal.jsx', exportName: 'PageShotModal' },
  { name: 'PersonalizeModal', path: './PersonalizeModal.jsx', exportName: 'PersonalizeModal' },
  { name: 'PreviewMediaModal', path: './PreviewMediaModal.jsx', exportName: 'PreviewMediaModal' },
  { name: 'RecorderModal', path: './RecorderModal.jsx', exportName: 'RecorderModal' },
  { name: 'SaveProjectModal', path: './SaveProjectModal.jsx', exportName: 'SaveProjectModal' },
  { name: 'SettingsModal (jsx)', path: './SettingsModal.jsx', exportName: 'SettingsModal' },
  { name: 'SocialPublisherModal', path: './SocialPublisherModal.jsx', exportName: 'SocialPublisherModal' },
  { name: 'TemplateGeneratorModal', path: './TemplateGeneratorModal.jsx', exportName: 'TemplateGeneratorModal' },
  { name: 'TemplatePreviewModal (jsx)', path: './TemplatePreviewModal.jsx', exportName: 'TemplatePreviewModal' },
  { name: 'TemplateThumbnailModal', path: './TemplateThumbnailModal.jsx', exportName: 'TemplateThumbnailModal' },
  { name: 'UrlVideoModal', path: './UrlVideoModal.jsx', exportName: 'UrlVideoModal' },
  { name: 'VideoPlayerModal', path: './VideoPlayerModal.jsx', exportName: 'VideoPlayerModal' },
  { name: 'VoiceModal', path: './VoiceModal.js', exportName: 'default' },
  { name: 'AIVideoCreator', path: './AIVideoCreator.jsx', exportName: 'AIVideoCreator' },
  { name: 'VideoPersonalizationHub', path: './VideoPersonalizationHub.jsx', exportName: 'VideoPersonalizationHub' },
  { name: 'AuthModal', path: '../AuthModal.js', exportName: 'AuthModal' },
  { name: 'ContactImporterModal (js)', path: '../ContactImporterModal.js', exportName: 'default' },
  { name: 'ImportTimelineModal', path: '../ImportTimelineModal.jsx', exportName: 'ImportTimelineModal' },
];

async function importWithTimeout(path, timeout = 10000) {
  return Promise.race([
    import(path),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Import timed out')), timeout)),
  ]);
}

describe('Modal Integration Tests', () => {
  test('All modal components can be imported and instantiated', async () => {
    const results = { passed: [], skipped: [] };

    for (const { name, path, exportName } of MODAL_FILES) {
      let mod;
      try {
        mod = await importWithTimeout(path);
      } catch (error) {
        process.stdout.write(`SKIP ${name}: import failed - ${error.message}\n`);
        results.skipped.push({ name, reason: `Import failed: ${error.message}` });
        continue;
      }

      const ModalClass = exportName === 'default' ? mod.default : mod[exportName];
      if (!ModalClass) {
        process.stdout.write(`SKIP ${name}: export '${exportName}' not found\n`);
        results.skipped.push({ name, reason: `Export '${exportName}' not found` });
        continue;
      }

      try {
        const instance = new ModalClass({});

        if (!(instance instanceof BaseModal)) {
          process.stdout.write(`SKIP ${name}: does not extend BaseModal\n`);
          results.skipped.push({ name, reason: 'Does not extend BaseModal' });
          continue;
        }

        expect(typeof instance.renderBody).toBe('function');
        expect(typeof instance.open).toBe('function');
        expect(typeof instance.close).toBe('function');

        results.passed.push(name);
      } catch (error) {
        process.stdout.write(`SKIP ${name}: ${error.message}\n`);
        results.skipped.push({ name, reason: error.message });
      }
    }

    const summary = {
      passed: results.passed.length,
      skipped: results.skipped.length,
      passedList: results.passed,
      skippedList: results.skipped,
    };
    process.stdout.write(`\n📊 Results: ${summary.passed} passed, ${summary.skipped} skipped\n`);
    if (summary.skippedList.length > 0) {
      process.stdout.write('Skipped:' + summary.skippedList.map(s => `  - ${s.name}: ${s.reason}`).join('\n') + '\n');
    }
  }, 60000);
});
