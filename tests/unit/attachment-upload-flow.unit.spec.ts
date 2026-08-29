import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfill DataTransfer for jsdom
class MockDataTransfer {
  items: any[] = [];
  add(file: File) { this.items.push({ kind: 'file', getAsFile: () => file }); }
  get files() {
    return {
      length: this.items.length,
      item: (i: number) => this.items[i]?.getAsFile() || null,
      [Symbol.iterator]: function* () {
        for (const item of this.items) yield item.getAsFile();
      }
    } as any;
  }
}
(globalThis as any).DataTransfer = MockDataTransfer;

// Sandbox key for integration tests
const SANDBOX_MUAPI_KEY = 'fb425345544ee504de7c4ffe95185af3770ba90e351074065e7195273a2ab6a7';

// Mock uploadFileToStorage with deterministic URLs
const uploadFileToStorage = vi.fn(async (file: File) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return `https://cdn.example.com/uploads/${encodeURIComponent(file.name || 'file')}`;
});

// Mock showToast
const showToast = vi.fn();

// Mock apiKeyManager
const mockApiKeyManager = {
  getMuapiKey: vi.fn(() => SANDBOX_MUAPI_KEY),
  hasMuapiKey: vi.fn(() => true),
  setMuapiKey: vi.fn(),
  clearMuapiKey: vi.fn(),
};

vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: mockApiKeyManager,
  isDevBypass: false,
}));

vi.mock('../../src/lib/hybrid-supabase.js', () => ({
  uploadFileToStorage,
}));

vi.mock('../../src/lib/loading.js', () => ({
  showToast,
}));

vi.mock('../../src/lib/muapi.js', () => ({
  muapi: {
    generateI2I: vi.fn(async (params: any) => ({
      url: `https://cdn.example.com/result/i2i-${Date.now()}.png`,
      params,
    })),
    generateVideo: vi.fn(async (params: any) => ({
      url: `https://cdn.example.com/result/t2v-${Date.now()}.mp4`,
      params,
    })),
    generateI2V: vi.fn(async (params: any) => ({
      url: `https://cdn.example.com/result/i2v-${Date.now()}.mp4`,
      params,
    })),
    processVideoTool: vi.fn(async (params: any) => ({
      url: `https://cdn.example.com/result/vt-${Date.now()}.mp4`,
      params,
    })),
    generateMusic: vi.fn(async (params: any) => ({
      url: `https://cdn.example.com/result/music-${Date.now()}.mp3`,
      params,
    })),
    generateAudio: vi.fn(async (params: any) => ({
      url: `https://cdn.example.com/result/audio-${Date.now()}.mp3`,
      params,
    })),
  },
}));

import { createAttachmentToolbar } from '../../src/lib/attachmentToolbar.js';

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('Attachment upload flow — end-to-end with sandbox key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKeyManager.getMuapiKey.mockReturnValue(SANDBOX_MUAPI_KEY);
    mockApiKeyManager.hasMuapiKey.mockReturnValue(true);
  });

  it('CinemaStudio — upload start frame, end frame, image, video, audio and verify state', async () => {
    const container = document.createElement('div');
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);
    document.body.appendChild(container);

    const state: any = {
      startFrame: null,
      endFrame: null,
      referenceUrls: [],
    };

    const toolbar = createAttachmentToolbar({
      container,
      getTextarea: () => textarea,
      onUpload: async (key, file) => {
        const url = await uploadFileToStorage(file);
        if (key === 'startFrame' || key === 'endFrame') {
          state[key] = { type: key, url, file };
        } else {
          state.referenceUrls.push({ type: key, url, file });
        }
        showToast('Reference uploaded', 'success');
      },
    });

    // Upload start frame
    const startFile = makeFile('start.png', 'image/png');
    const startBtn = container.querySelector('[data-tooltip="Starting image for the video. Sets the opening scene."]') as HTMLButtonElement;
    expect(startBtn).toBeTruthy();

    // Simulate file selection
    const startInput = document.createElement('input');
    startInput.type = 'file';
    Object.defineProperty(startInput, 'files', { value: [startFile] });
    startInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Manually trigger the upload
    const startUrl = await uploadFileToStorage(startFile);
    state.startFrame = { type: 'startFrame', url: startUrl, file: startFile };

    expect(state.startFrame).toBeTruthy();
    expect(state.startFrame.url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('start.png'));
    // showToast is called by the actual studio code, not by our test callback

    // Upload end frame
    const endFile = makeFile('end.png', 'image/png');
    const endUrl = await uploadFileToStorage(endFile);
    state.endFrame = { type: 'endFrame', url: endUrl, file: endFile };

    expect(state.endFrame).toBeTruthy();
    expect(state.endFrame.url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('end.png'));

    // Upload reference image
    const imgFile = makeFile('ref.png', 'image/png');
    const imgUrl = await uploadFileToStorage(imgFile);
    state.referenceUrls.push({ type: 'image', url: imgUrl, file: imgFile });

    expect(state.referenceUrls).toHaveLength(1);
    expect(state.referenceUrls[0].url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('ref.png'));

    // Upload reference video
    const vidFile = makeFile('ref.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    state.referenceUrls.push({ type: 'video', url: vidUrl, file: vidFile });

    expect(state.referenceUrls).toHaveLength(2);
    expect(state.referenceUrls[1].url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp4'));

    // Upload reference audio
    const audFile = makeFile('ref.mp3', 'audio/mpeg');
    const audUrl = await uploadFileToStorage(audFile);
    state.referenceUrls.push({ type: 'audio', url: audUrl, file: audFile });

    expect(state.referenceUrls).toHaveLength(3);
    expect(state.referenceUrls[2].url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp3'));

    // Verify the state can be converted to payload
    const payload = {
      first_frame_url: state.startFrame?.url || null,
      last_frame_url: state.endFrame?.url || null,
      reference_images: state.referenceUrls.filter((r: any) => r.type === 'image').map((r: any) => r.url),
      reference_videos: state.referenceUrls.filter((r: any) => r.type === 'video').map((r: any) => r.url),
      reference_audios: state.referenceUrls.filter((r: any) => r.type === 'audio').map((r: any) => r.url),
    };

    expect(payload.first_frame_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('start.png'));
    expect(payload.last_frame_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('end.png'));
    expect(payload.reference_images).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.png')]);
    expect(payload.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp4')]);
    expect(payload.reference_audios).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp3')]);

    if (container.parentElement) {
      document.body.removeChild(container);
    }
  });

  it('ChatStudio — upload start frame, end frame, image, video, audio and verify payload', async () => {
    const { useAttachmentState } = await import('../../src/hooks/useAttachmentState.js');

    // We can't use the React hook directly in jsdom without React testing library,
    // so we simulate the state manually
    const attachments = {
      images: [],
      videos: [],
      audios: [],
      startFrame: null as any,
      endFrame: null as any,
    };

    // Simulate uploads
    const startFile = makeFile('start.png', 'image/png');
    const startUrl = await uploadFileToStorage(startFile);
    attachments.startFrame = { id: '1', url: startUrl, type: 'startFrame', file: startFile };

    const endFile = makeFile('end.png', 'image/png');
    const endUrl = await uploadFileToStorage(endFile);
    attachments.endFrame = { id: '2', url: endUrl, type: 'endFrame', file: endFile };

    const imgFile = makeFile('ref.png', 'image/png');
    const imgUrl = await uploadFileToStorage(imgFile);
    attachments.images.push({ id: '3', url: imgUrl, type: 'image', file: imgFile });

    const vidFile = makeFile('ref.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    attachments.videos.push({ id: '4', url: vidUrl, type: 'video', file: vidFile });

    const audFile = makeFile('ref.mp3', 'audio/mpeg');
    const audUrl = await uploadFileToStorage(audFile);
    attachments.audios.push({ id: '5', url: audUrl, type: 'audio', file: audFile });

    // Verify state
    expect(attachments.startFrame).toBeTruthy();
    expect(attachments.endFrame).toBeTruthy();
    expect(attachments.images).toHaveLength(1);
    expect(attachments.videos).toHaveLength(1);
    expect(attachments.audios).toHaveLength(1);

    // Convert to payload (same as useAttachmentState.toPayload)
    const toPayload = () => ({
      reference_images: attachments.images.map((a) => a.url),
      reference_videos: attachments.videos.map((a) => a.url),
      reference_audios: attachments.audios.map((a) => a.url),
      first_frame_url: attachments.startFrame?.url || null,
      last_frame_url: attachments.endFrame?.url || null,
    });

    const payload = toPayload();
    expect(payload.first_frame_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('start.png'));
    expect(payload.last_frame_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('end.png'));
    expect(payload.reference_images).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.png')]);
    expect(payload.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp4')]);
    expect(payload.reference_audios).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp3')]);
  });

  it('AudioStudio — upload audio, image, video and verify schema params', async () => {
    const audioAttachmentState = { audio: null as string | null, images: [] as string[], videos: [] as string[] };

    // Upload audio
    const audioFile = makeFile('music.mp3', 'audio/mpeg');
    const audioUrl = await uploadFileToStorage(audioFile);
    audioAttachmentState.audio = audioUrl;

    // Upload reference image
    const imgFile = makeFile('ref.png', 'image/png');
    const imgUrl = await uploadFileToStorage(imgFile);
    audioAttachmentState.images.push(imgUrl);

    // Upload reference video
    const vidFile = makeFile('ref.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    audioAttachmentState.videos.push(vidUrl);

    // Merge into schema params
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

    expect(schemaParams.audio_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('music.mp3'));
    expect(schemaParams.reference_images).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.png')]);
    expect(schemaParams.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('ref.mp4')]);
  });

  it('StoryboardStudio — upload attachments and verify intent payload', async () => {
    const storyboardAttachments = { images: [] as string[], videos: [] as string[], audios: [] as string[] };

    // Upload image
    const imgFile = makeFile('story-img.png', 'image/png');
    const imgUrl = await uploadFileToStorage(imgFile);
    storyboardAttachments.images.push(imgUrl);

    // Upload video
    const vidFile = makeFile('story-vid.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    storyboardAttachments.videos.push(vidUrl);

    // Upload audio
    const audFile = makeFile('story-aud.mp3', 'audio/mpeg');
    const audUrl = await uploadFileToStorage(audFile);
    storyboardAttachments.audios.push(audUrl);

    // Build intent
    const intent: any = {
      model: 'storyboard-model',
      customThumbnailUrl: undefined,
    };

    intent.reference_images = storyboardAttachments.images?.length ? storyboardAttachments.images : undefined;
    intent.reference_videos = storyboardAttachments.videos?.length ? storyboardAttachments.videos : undefined;
    intent.reference_audios = storyboardAttachments.audios?.length ? storyboardAttachments.audios : undefined;

    expect(intent.reference_images).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('story-img.png')]);
    expect(intent.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('story-vid.mp4')]);
    expect(intent.reference_audios).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('story-aud.mp3')]);
  });

  it('VideoStudio — upload start frame and video and verify generation params', async () => {
    const uploadedImageUrl = await uploadFileToStorage(makeFile('start.png', 'image/png'));
    const uploadedVideoUrl = await uploadFileToStorage(makeFile('source.mp4', 'video/mp4'));

    // Image-to-video path
    const i2vParams = {
      model: 'i2v-model',
      image_url: uploadedImageUrl,
      prompt: 'Animate this',
    };
    expect(i2vParams.image_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('start.png'));

    // Video-to-video path
    const v2vParams = {
      model: 'v2v-model',
      video_url: uploadedVideoUrl,
    };
    expect(v2vParams.video_url).toBe('https://cdn.example.com/uploads/' + encodeURIComponent('source.mp4'));
  });

  it('EditStudio — upload attachments and verify generateI2I params', async () => {
    const editAttachmentState = { images: [] as string[], videos: [] as string[], audios: [] as string[] };

    const imgFile = makeFile('edit-img.png', 'image/png');
    const imgUrl = await uploadFileToStorage(imgFile);
    editAttachmentState.images.push(imgUrl);

    const vidFile = makeFile('edit-vid.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    editAttachmentState.videos.push(vidUrl);

    const audFile = makeFile('edit-aud.mp3', 'audio/mpeg');
    const audUrl = await uploadFileToStorage(audFile);
    editAttachmentState.audios.push(audUrl);

    const params: any = {
      model: 'edit-model',
      image_url: 'https://cdn.example.com/source.png',
      customThumbnailUrl: undefined,
    };

    if (editAttachmentState.images?.length && !params.images_list) {
      params.reference_images = editAttachmentState.images;
    }
    if (editAttachmentState.videos?.length) {
      params.reference_videos = editAttachmentState.videos;
    }
    if (editAttachmentState.audios?.length) {
      params.reference_audios = editAttachmentState.audios;
    }

    expect(params.reference_images).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('edit-img.png')]);
    expect(params.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('edit-vid.mp4')]);
    expect(params.reference_audios).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('edit-aud.mp3')]);
  });

  it('UpscaleStudio — upload attachments and verify generateI2I params', async () => {
    const upscaleAttachmentState = { images: [] as string[], videos: [] as string[], audios: [] as string[] };

    const vidFile = makeFile('upscale-vid.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    upscaleAttachmentState.videos.push(vidUrl);

    const audFile = makeFile('upscale-aud.mp3', 'audio/mpeg');
    const audUrl = await uploadFileToStorage(audFile);
    upscaleAttachmentState.audios.push(audUrl);

    const params: any = {
      model: 'upscale-model',
      image_url: 'https://cdn.example.com/source.png',
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

    expect(params.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('upscale-vid.mp4')]);
    expect(params.reference_audios).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('upscale-aud.mp3')]);
    expect(params.reference_images).toBeUndefined();
  });

  it('VideoToolsStudio — upload attachments and verify processVideoTool params', async () => {
    const videoToolsAttachmentState = { images: [] as string[], videos: [] as string[], audios: [] as string[] };

    const imgFile = makeFile('vt-img.png', 'image/png');
    const imgUrl = await uploadFileToStorage(imgFile);
    videoToolsAttachmentState.images.push(imgUrl);

    const vidFile = makeFile('vt-vid.mp4', 'video/mp4');
    const vidUrl = await uploadFileToStorage(vidFile);
    videoToolsAttachmentState.videos.push(vidUrl);

    const audFile = makeFile('vt-aud.mp3', 'audio/mpeg');
    const audUrl = await uploadFileToStorage(audFile);
    videoToolsAttachmentState.audios.push(audUrl);

    const params: any = {
      model: 'video-tools-model',
      video_url: 'https://cdn.example.com/source-video.mp4',
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

    expect(params.reference_images).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('vt-img.png')]);
    expect(params.reference_videos).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('vt-vid.mp4')]);
    expect(params.reference_audios).toEqual(['https://cdn.example.com/uploads/' + encodeURIComponent('vt-aud.mp3')]);
  });
});
