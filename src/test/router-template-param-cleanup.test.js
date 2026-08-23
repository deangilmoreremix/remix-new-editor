import { describe, it, expect } from 'vitest';
import { cleanTemplateParams } from '../lib/router.js';

describe('cleanTemplateParams', () => {
  it('strips template, academy-template, and templateId for non-template pages', () => {
    const params = {
      template: 'tiktok-video',
      'academy-template': 'academy-1',
      templateId: '123',
      other: 'keep-me',
    };

    const result = cleanTemplateParams({ ...params }, 'image');
    expect(result).toEqual({ other: 'keep-me' });
  });

  it('preserves all params for template pages', () => {
    const params = {
      template: 'tiktok-video',
      'academy-template': 'academy-1',
      templateId: '123',
      other: 'keep-me',
    };

    const result = cleanTemplateParams({ ...params }, 'template/youtube-thumbnail');
    expect(result).toEqual(params);
  });

  it('preserves all params for templates hub', () => {
    const params = {
      template: 'tiktok-video',
      other: 'keep-me',
    };

    const result = cleanTemplateParams({ ...params }, 'templates');
    expect(result).toEqual(params);
  });

  it('strips template param when navigating from template page to video studio', () => {
    const params = { template: 'tiktok-video', foo: 'bar' };
    const result = cleanTemplateParams({ ...params }, 'video');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('strips template param when navigating from template page to templates hub', () => {
    const params = { template: 'tiktok-video' };
    const result = cleanTemplateParams({ ...params }, 'templates');
    expect(result).toEqual({ template: 'tiktok-video' });
  });

  it('handles empty params object', () => {
    const result = cleanTemplateParams({}, 'image');
    expect(result).toEqual({});
  });

  it('handles undefined params', () => {
    const result = cleanTemplateParams(undefined, 'image');
    expect(result).toEqual({});
  });
});
