import {
  ASPECT_DIMS,
  extensionForMime,
  resolveExportMimeType,
  getVideoBitrate,
  computeFitSourceRect,
  computeTrailerDuration,
  buildFrameFilename,
} from '../renderHelpers.js';

// Mock MediaRecorder for format resolution tests.
const mockMediaRecorder = {
  isTypeSupported: () => false,
};

beforeAll(() => {
  global.MediaRecorder = mockMediaRecorder;
});

afterAll(() => {
  delete global.MediaRecorder;
});

describe('renderHelpers', () => {
  describe('extensionForMime', () => {
    it('returns webm for unknown/empty mime', () => {
      expect(extensionForMime('')).toBe('webm');
      expect(extensionForMime('video/webm')).toBe('webm');
      expect(extensionForMime('video/webm;codecs=vp9')).toBe('webm');
    });

    it('returns mp4 for H.264/AVC1/HEVC mimes', () => {
      expect(extensionForMime('video/mp4')).toBe('mp4');
      expect(extensionForMime('video/mp4;codecs=h264')).toBe('mp4');
      expect(extensionForMime('video/mp4;codecs=avc1')).toBe('mp4');
      expect(extensionForMime('video/mp4;codecs=hevc')).toBe('mp4');
      expect(extensionForMime('video/mp4;codecs=h265')).toBe('mp4');
    });
  });

  describe('resolveExportMimeType', () => {
    it('returns empty string when MediaRecorder is missing', () => {
      const original = global.MediaRecorder;
      delete global.MediaRecorder;
      expect(resolveExportMimeType('webm')).toBe('');
      global.MediaRecorder = original;
    });

    it('returns empty string when no candidate is supported', () => {
      mockMediaRecorder.isTypeSupported = () => false;
      expect(resolveExportMimeType('webm')).toBe('');
      expect(resolveExportMimeType('mp4')).toBe('');
    });

    it('returns the first supported candidate for each format', () => {
      const supported = new Set(['video/mp4;codecs=avc1', 'video/webm;codecs=vp9']);
      mockMediaRecorder.isTypeSupported = (c) => supported.has(c);
      expect(resolveExportMimeType('mp4')).toBe('video/mp4;codecs=avc1');
      expect(resolveExportMimeType('webm')).toBe('video/webm;codecs=vp9');
    });
  });

  describe('getVideoBitrate', () => {
    it('returns a value within expected bounds for standard settings', () => {
      const bitrate = getVideoBitrate({ width: 1920, height: 1080, fps: 30, quality: 82 });
      expect(bitrate).toBeGreaterThanOrEqual(500_000);
      expect(bitrate).toBeLessThan(10_000_000);
    });

    it('increases bitrate when quality increases', () => {
      const low = getVideoBitrate({ width: 1920, height: 1080, fps: 30, quality: 20 });
      const high = getVideoBitrate({ width: 1920, height: 1080, fps: 30, quality: 95 });
      expect(high).toBeGreaterThan(low);
    });

    it('increases bitrate when resolution increases', () => {
      const sd = getVideoBitrate({ width: 1280, height: 720, fps: 30, quality: 50 });
      const hd = getVideoBitrate({ width: 1920, height: 1080, fps: 30, quality: 50 });
      expect(hd).toBeGreaterThan(sd);
    });

    it('increases bitrate when fps increases', () => {
      const f24 = getVideoBitrate({ width: 1920, height: 1080, fps: 24, quality: 50 });
      const f60 = getVideoBitrate({ width: 1920, height: 1080, fps: 60, quality: 50 });
      expect(f60).toBeGreaterThan(f24);
    });

    it('clamps quality to 0-100', () => {
      const under = getVideoBitrate({ quality: -10 });
      const over = getVideoBitrate({ quality: 200 });
      expect(under).toBeGreaterThanOrEqual(500_000);
      expect(over).toBeGreaterThanOrEqual(500_000);
    });
  });

  describe('computeFitSourceRect', () => {
    it('centers-crops when source is wider than destination (contain)', () => {
      const rect = computeFitSourceRect(1920, 1080, 1080, 1920);
      expect(rect.sw).toBeLessThan(1920);
      expect(rect.sh).toBe(1080);
      expect(rect.sx).toBeGreaterThan(0);
    });

    it('centers-crops when source is taller than destination', () => {
      const rect = computeFitSourceRect(1080, 1920, 1920, 1080);
      expect(rect.sw).toBe(1080);
      expect(rect.sh).toBeLessThan(1920);
      expect(rect.sy).toBeGreaterThan(0);
    });

    it('does not stretch when source and destination match', () => {
      const rect = computeFitSourceRect(1920, 1080, 1920, 1080);
      expect(rect).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
    });
  });

  describe('computeTrailerDuration', () => {
    it('uses timeRange when provided', () => {
      expect(computeTrailerDuration({ start: 5, end: 35 }, null, 120)).toBe(30_000);
    });

    it('falls back to settings duration', () => {
      expect(computeTrailerDuration(null, 10, 120)).toBe(10_000);
    });

    it('falls back to source duration', () => {
      expect(computeTrailerDuration(null, null, 45)).toBe(45_000);
    });

    it('defaults to 5 seconds when nothing is provided', () => {
      expect(computeTrailerDuration(null, null, null)).toBe(5_000);
    });
  });

  describe('buildFrameFilename', () => {
    it('builds a filename with time tag', () => {
      const name = buildFrameFilename('my-frame', 'image/png', 12.345);
      expect(name).toBe('my-frame.png');
    });

    it('uses default base name when none provided', () => {
      const name = buildFrameFilename(undefined, 'image/png', 0);
      expect(name).toMatch(/^smartvideo-frame-00-00-000\.png$/);
    });

    it('converts jpeg format to jpg extension', () => {
      const name = buildFrameFilename('frame', 'image/jpeg', 5);
      expect(name).toBe('frame.jpg');
    });

    it('sanitizes base name', () => {
      const name = buildFrameFilename('my frame?/test', 'image/png', 1);
      expect(name).toBe('my_frame_test.png');
    });
  });

  describe('ASPECT_DIMS', () => {
    it('has expected social dimensions', () => {
      expect(ASPECT_DIMS['9:16']).toEqual({ width: 1080, height: 1920 });
      expect(ASPECT_DIMS['1:1']).toEqual({ width: 1080, height: 1080 });
      expect(ASPECT_DIMS['4:5']).toEqual({ width: 1080, height: 1350 });
      expect(ASPECT_DIMS['16:9']).toEqual({ width: 1920, height: 1080 });
    });
  });
});
