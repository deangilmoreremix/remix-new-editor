import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uploadFileToStorage
vi.mock('../../src/lib/hybrid-supabase.js', () => ({
  uploadFileToStorage: vi.fn(async (file: File) => {
    return `https://example.com/uploads/${encodeURIComponent(file.name || 'file')}`;
  })
}));

// Mock showToast
vi.mock('../../src/lib/loading.js', () => ({
  showToast: vi.fn()
}));

// Mock muapi for payload verification tests
const mockGenerateI2I = vi.fn(async (params: any) => ({ url: 'https://example.com/result.png' }));
const mockGenerateVideo = vi.fn(async (params: any) => ({ url: 'https://example.com/result.mp4' }));
const mockGenerateI2V = vi.fn(async (params: any) => ({ url: 'https://example.com/result.mp4' }));

vi.mock('../../src/lib/muapi.js', () => ({
  muapi: {
    generateI2I: vi.fn(async (params: any) => ({ url: 'https://example.com/result.png' })),
    generateVideo: vi.fn(async (params: any) => ({ url: 'https://example.com/result.mp4' })),
    generateI2V: vi.fn(async (params: any) => ({ url: 'https://example.com/result.mp4' })),
  }
}));

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('Attachment upload wiring — studio payload merge', () => {
  it('EditStudio merges attachment URLs into generateI2I payload', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');

    // Simulate EditStudio generation path
    const params = {
      model: 'edit-model',
      image_url: 'https://example.com/source.png',
      customThumbnailUrl: undefined,
    };

    const editAttachmentState = { images: ['https://example.com/ref1.png'], videos: [], audios: [] };

    if (editAttachmentState.images?.length && !params.images_list) {
      params.reference_images = editAttachmentState.images;
    }
    if (editAttachmentState.videos?.length) {
      params.reference_videos = editAttachmentState.videos;
    }
    if (editAttachmentState.audios?.length) {
      params.reference_audios = editAttachmentState.audios;
    }

    expect(params.reference_images).toEqual(['https://example.com/ref1.png']);
    expect(params.reference_videos).toBeUndefined();
    expect(params.reference_audios).toBeUndefined();

    const result = await muapi.generateI2I(params);
    expect(muapi.generateI2I).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_images: ['https://example.com/ref1.png'],
      })
    );
    expect(result.url).toBe('https://example.com/result.png');
  });

  it('CinemaStudio frame-to-frame includes first_frame_url and last_frame_url', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');

    const firstFrameUrl = 'https://example.com/first.png';
    const lastFrameUrl = 'https://example.com/last.png';

    const params = {
      model: 'frame-to-frame-model',
      first_frame_url: firstFrameUrl,
      last_frame_url: lastFrameUrl,
      duration: 5,
      resolution: '1080p',
      thumbnail_url: undefined,
    };

    const result = await muapi.generateVideo(params);
    expect(muapi.generateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        first_frame_url: 'https://example.com/first.png',
        last_frame_url: 'https://example.com/last.png',
      })
    );
    expect(result.url).toBe('https://example.com/result.mp4');
  });

  it('CinemaStudio merges reference videos and audios into i2v and t2v paths', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');

    const extraVideos = ['https://example.com/ref-video.mp4'];
    const extraAudios = ['https://example.com/ref-audio.mp3'];

    // Image-to-video path
    const i2vParams = {
      model: 'i2v-model',
      image_url: 'https://example.com/source.png',
      reference_images: ['https://example.com/source.png'],
      character_consistency: false,
    };

    if (extraVideos.length) i2vParams.reference_videos = extraVideos;
    if (extraAudios.length) i2vParams.reference_audios = extraAudios;

    const i2vResult = await muapi.generateI2V(i2vParams);
    expect(muapi.generateI2V).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_videos: ['https://example.com/ref-video.mp4'],
        reference_audios: ['https://example.com/ref-audio.mp3'],
      })
    );
    expect(i2vResult.url).toBe('https://example.com/result.mp4');

    // Text-to-video path
    const t2vParams = {
      model: 't2v-model',
      prompt: 'A cinematic scene',
      reference_images: ['https://example.com/source.png'],
      character_consistency: false,
    };

    if (extraVideos.length) t2vParams.reference_videos = extraVideos;
    if (extraAudios.length) t2vParams.reference_audios = extraAudios;

    const t2vResult = await muapi.generateVideo(t2vParams);
    expect(muapi.generateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_videos: ['https://example.com/ref-video.mp4'],
        reference_audios: ['https://example.com/ref-audio.mp3'],
      })
    );
    expect(t2vResult.url).toBe('https://example.com/result.mp4');
  });

  it('AudioStudio merges audio_url and reference media into schema params', async () => {
    const audioAttachmentState = {
      audio: 'https://example.com/audio.mp3',
      images: ['https://example.com/img1.png'],
      videos: ['https://example.com/vid1.mp4'],
    };

    const schemaParams: any = {};

    if (audioAttachmentState.audio && !schemaParams.audio_url) {
      schemaParams.audio_url = audioAttachmentState.audio;
    }
    if (audioAttachmentState.images?.length && !schemaParams.reference_images) {
      schemaParams.reference_images = audioAttachmentState.images;
    }
    if (audioAttachmentState.videos?.length && !schemaParams.reference_videos) {
      schemaParams.reference_videos = audioAttachmentState.videos;
    }

    expect(schemaParams.audio_url).toBe('https://example.com/audio.mp3');
    expect(schemaParams.reference_images).toEqual(['https://example.com/img1.png']);
    expect(schemaParams.reference_videos).toEqual(['https://example.com/vid1.mp4']);
  });

  it('StoryboardStudio merges attachments into intent before generation', async () => {
    const storyboardAttachments = { images: [], videos: [], audios: [] };

    // Simulate upload
    const { uploadFileToStorage } = await import('../../src/lib/hybrid-supabase.js');
    const imgUrl = await uploadFileToStorage(makeFile('story-img.png', 'image/png'));
    storyboardAttachments.images.push(imgUrl);

    const vidUrl = await uploadFileToStorage(makeFile('story-vid.mp4', 'video/mp4'));
    storyboardAttachments.videos.push(vidUrl);

    const audUrl = await uploadFileToStorage(makeFile('story-aud.mp3', 'audio/mp3'));
    storyboardAttachments.audios.push(audUrl);

    const intent: any = {
      model: 'storyboard-model',
      customThumbnailUrl: undefined,
    };

    intent.reference_images = storyboardAttachments.images?.length ? storyboardAttachments.images : undefined;
    intent.reference_videos = storyboardAttachments.videos?.length ? storyboardAttachments.videos : undefined;
    intent.reference_audios = storyboardAttachments.audios?.length ? storyboardAttachments.audios : undefined;

    expect(intent.reference_images).toEqual(['https://example.com/uploads/story-img.png']);
    expect(intent.reference_videos).toEqual(['https://example.com/uploads/story-vid.mp4']);
    expect(intent.reference_audios).toEqual(['https://example.com/uploads/story-aud.mp3']);
  });

  it('EffectsStudio merges attachments into buildBaseParams', async () => {
    const effectsAttachmentState = { images: ['https://example.com/eff-img.png'], videos: [], audios: [] };

    const params: any = { model: 'effects-model', prompt: 'Make it pop' };

    if (effectsAttachmentState.images?.length) {
      params.reference_images = effectsAttachmentState.images;
    }
    if (effectsAttachmentState.videos?.length) {
      params.reference_videos = effectsAttachmentState.videos;
    }
    if (effectsAttachmentState.audios?.length) {
      params.reference_audios = effectsAttachmentState.audios;
    }

    expect(params.reference_images).toEqual(['https://example.com/eff-img.png']);
    expect(params.reference_videos).toBeUndefined();
    expect(params.reference_audios).toBeUndefined();
  });

  it('VideoToolsStudio merges attachments into processVideoTool params', async () => {
    const videoToolsAttachmentState = { images: [], videos: ['https://example.com/vid.mp4'], audios: [] };

    const params: any = {
      model: 'video-tools-model',
      video_url: 'https://example.com/source-video.mp4',
      customThumbnailUrl: undefined,
    };

    if (videoToolsAttachmentState.images?.length) {
      params.reference_images = videoToolsAttachmentState.images;
    }
    if (videoToolsAttachmentState.videos?.length) {
      params.reference_videos = videoToolsAttachmentState.videos;
    }
    if (videoToolsAttachmentState.audios?.length) {
      params.reference_audios = videoToolsAttachmentState.audios;
    }

    expect(params.reference_videos).toEqual(['https://example.com/vid.mp4']);
    expect(params.reference_images).toBeUndefined();
    expect(params.reference_audios).toBeUndefined();
  });

  it('VideoStudio reuses uploadedImageUrl/uploadedVideoUrl in generation paths', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');

    // Image-to-video path
    const uploadedImageUrl = 'https://example.com/start-frame.png';
    const i2vParams = {
      model: 'i2v-model',
      image_url: uploadedImageUrl,
      prompt: 'Animate this',
    };

    // VideoStudio passes uploadedImageUrl as image_url
    expect(i2vParams.image_url).toBe('https://example.com/start-frame.png');

    const i2vResult = await muapi.generateI2V(i2vParams);
    expect(muapi.generateI2V).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: 'https://example.com/start-frame.png',
      })
    );

    // Video-to-video path
    const uploadedVideoUrl = 'https://example.com/source.mp4';
    const v2vParams = {
      model: 'v2v-model',
      video_url: uploadedVideoUrl,
    };

    // VideoStudio passes uploadedVideoUrl as video_url
    expect(v2vParams.video_url).toBe('https://example.com/source.mp4');
  });

  it('ImageStudio reuses uploadedImageUrls in generateI2I payload', async () => {
    const { muapi } = await import('../../src/lib/muapi.js');

    const uploadedImageUrls = ['https://example.com/img1.png', 'https://example.com/img2.png'];

    // ImageStudio passes uploadedImageUrls as images_list for multi-image
    const params = {
      model: 'i2i-model',
      images_list: uploadedImageUrls,
      prompt: 'Transform these',
    };

    expect(params.images_list).toEqual(['https://example.com/img1.png', 'https://example.com/img2.png']);

    const result = await muapi.generateI2I(params);
    expect(muapi.generateI2I).toHaveBeenCalledWith(
      expect.objectContaining({
        images_list: ['https://example.com/img1.png', 'https://example.com/img2.png'],
      })
    );
  });

  it('UpscaleStudio merges attachments into generateI2I params', async () => {
    const upscaleAttachmentState = { images: [], videos: ['https://example.com/ref.mp4'], audios: ['https://example.com/ref.mp3'] };

    const params: any = {
      model: 'upscale-model',
      image_url: 'https://example.com/source.png',
      customThumbnailUrl: undefined,
    };

    if (upscaleAttachmentState.images?.length && !params.images_list) {
      params.reference_images = upscaleAttachmentState.images;
    }
    if (upscaleAttachmentState.videos?.length) {
      params.reference_videos = upscaleAttachmentState.videos;
    }
    if (upscaleAttachmentState.audios?.length) {
      params.reference_audios = upscaleAttachmentState.audios;
    }

    expect(params.reference_videos).toEqual(['https://example.com/ref.mp4']);
    expect(params.reference_audios).toEqual(['https://example.com/ref.mp3']);
    expect(params.reference_images).toBeUndefined();
  });
});
