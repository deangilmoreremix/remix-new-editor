import { describe, it, expect, vi } from 'vitest';
import { buildWriterPrompt, parseWriterReply, writeWithAI } from '../aiWriter.js';

describe('AI writer', () => {
  it('asks for a timed script that starts with the greeting pause, in the chosen language', () => {
    const { prompt } = buildWriterPrompt('script', { audience: 'dentists', message: 'book more patients', language: 'Spanish', seconds: 30 });
    expect(prompt).toContain('Audience: dentists');
    expect(prompt).toContain('Write in Spanish');
    expect(prompt).toContain('about 69 words');
    expect(prompt).toContain('[pause]');
    expect(prompt).toContain('Do not use any {{tokens}}');
    expect(prompt).toContain('greeting with their name is added at [pause]');
    expect(buildWriterPrompt('email', {}).prompt).toContain('{{firstname}}');
    expect(buildWriterPrompt('email', { useName: false }).prompt).toContain('Do not address the prospect by name');
    expect(buildWriterPrompt('script', { language: 'Klingon' }).prompt).toContain('Write in English');
  });

  it('email and page replies are JSON; the email always carries {{link}}', () => {
    expect(parseWriterReply('email', 'Sure! {"subject":"For {{firstname}}","body":"Hi {{firstname}},\\\\nQuick video:"}')).toEqual({ subject: 'For {{firstname}}', body: 'Hi {{firstname}},\nQuick video:\n\n{{link}}' });
    expect(parseWriterReply('page', '{"header":"Hi {{firstname}}","message":"Watch this.","cta":"Book a call"}')).toEqual({ header: 'Hi {{firstname}}', message: 'Watch this.', cta: 'Book a call' });
    expect(() => parseWriterReply('email', 'no json here')).toThrow(/usable email/);
    expect(parseWriterReply('script', '```\n[pause]\nHello\n```')).toEqual({ script: '[pause]\nHello' });
  });

  it('writes through the injected request', async () => {
    const generate = vi.fn(async () => '[pause]\nHi {{firstname}}');
    expect(await writeWithAI('script', { audience: 'x' }, { generate })).toEqual({ script: '[pause]\nHi {{firstname}}' });
    expect(generate.mock.calls[0][0]).toContain('Audience: x');
    await expect(writeWithAI('poem', {}, { generate })).rejects.toThrow(/Unknown/);
  });
});
