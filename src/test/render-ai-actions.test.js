import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/whisper-client.js', () => {
  const mockTranscribe = vi.fn();
  return {
    WhisperService: vi.fn(),
    whisperService: { transcribe: mockTranscribe },
  };
});

vi.mock('../lib/services/aiService.js', () => ({
  aiService: { muapi: { generateAudio: vi.fn() } },
}));

import { whisperService } from '../services/whisper-client.js';

import {
  generateSubtitles,
  generateHighlights,
  generateVoiceover,
  createShorts,
  runAiAutoEdit,
} from '../lib/editor/renderAiActions.js';

function toSrtTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const rawMillis = Math.round((seconds % 1) * 1000);
  const millis = rawMillis >= 1000 ? 0 : rawMillis;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function toVttTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const rawMillis = Math.round((seconds % 1) * 1000);
  const millis = rawMillis >= 1000 ? 0 : rawMillis;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function segmentsToSrt(segments) {
  return segments.map((seg, idx) => {
    const index = idx + 1;
    const start = toSrtTimestamp(seg.start);
    const end = toSrtTimestamp(seg.end);
    const text = (seg.text || '').trim();
    return `${index}\n${start} --> ${end}\n${text}\n`;
  }).join('\n');
}

function segmentsToVtt(segments) {
  const body = segments.map((seg) => {
    const start = toVttTimestamp(seg.start);
    const end = toVttTimestamp(seg.end);
    const text = (seg.text || '').trim();
    return `${start} --> ${end}\n${text}`;
  }).join('\n\n');
  return `WEBVTT\n\n${body}`;
}

describe('renderAiActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whisperService.transcribe.mockResolvedValue({
      text: 'Hello world. This is a test.',
      segments: [
        { start: 0, end: 2.5, text: 'Hello world.', words: [] },
        { start: 2.5, end: 5, text: 'This is a test.', words: [] },
      ],
      duration: 5,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
  });

  describe('generateSubtitles (imported module)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/wav' })),
        })
      );
    });

    it('calls whisperService.transcribe and returns SRT/VTT/segments', async () => {
      const result = await generateSubtitles('http://example.com/video.mp4', 'en');

      expect(result.segments).toHaveLength(2);
      expect(result.srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world.');
      expect(result.vtt).toContain('WEBVTT\n\n');
      expect(result.text).toBe('Hello world. This is a test.');
    });

    it('returns empty result on transcribe failure', async () => {
      whisperService.transcribe.mockRejectedValue(new Error('service down'));
      const result = await generateSubtitles('http://example.com/video.mp4');

      expect(result.srt).toBe('');
      expect(result.vtt).toBe('');
      expect(result.segments).toEqual([]);
      expect(result.error).toBe('service down');
    });
  });

  describe('toSrtTimestamp (inline, identical to source)', () => {
    it('formats zero seconds', () => {
      expect(toSrtTimestamp(0)).toBe('00:00:00,000');
    });
    it('formats fractional seconds with milliseconds', () => {
      expect(toSrtTimestamp(2.5)).toBe('00:00:02,500');
    });
    it('pads all fields to fixed widths', () => {
      expect(toSrtTimestamp(61.0)).toBe('00:01:01,000');
    });
  });

  describe('toVttTimestamp', () => {
    it('formats zero seconds', () => {
      expect(toVttTimestamp(0)).toBe('00:00:00.000');
    });
    it('formats fractional seconds with milliseconds', () => {
      expect(toVttTimestamp(5)).toBe('00:00:05.000');
    });
    it('pads all fields to fixed widths', () => {
      expect(toVttTimestamp(5.001)).toBe('00:00:05.001');
    });
  });

  describe('segmentsToSrt', () => {
    it('numbering starts at 1 with correct SRT timestamps', () => {
      const srt = segmentsToSrt([
        { start: 0, end: 2.5, text: 'Hello world.' },
        { start: 2.5, end: 5, text: 'This is a test.' },
      ]);
      expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHello world.');
      expect(srt).toContain('2\n00:00:02,500 --> 00:00:05,000\nThis is a test.');
    });
    it('trims whitespace from segment text', () => {
      expect(segmentsToSrt([{ start: 0, end: 2.5, text: '  spaces  ' }])).toBe('1\n00:00:00,000 --> 00:00:02,500\nspaces\n');
    });
    it('handles empty text fields', () => {
      expect(segmentsToSrt([{ start: 0, end: 1, text: '' }])).toContain('\n\n');
    });
  });

  describe('segmentsToVtt', () => {
    it('produces valid WebVTT with header and cues', () => {
      const vtt = segmentsToVtt([
        { start: 0, end: 2.5, text: 'Hello world.' },
        { start: 2.5, end: 5, text: 'This is a test.' },
      ]);
      expect(vtt).toContain('WEBVTT\n\n');
      expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
    });
    it('joins multiple cues with blank lines', () => {
      const vtt = segmentsToVtt([
        { start: 0, end: 1, text: 'A' },
        { start: 2, end: 3, text: 'B' },
      ]);
      expect(vtt).toContain('00:00:00.000 --> 00:00:01.000\nA');
      expect(vtt).toContain('00:00:02.000 --> 00:00:03.000\nB');
    });
  });
});
