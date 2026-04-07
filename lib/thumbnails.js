// Thumbnail Generation Utilities - Open-Higgsfield-AI Integration
// Generate and manage video thumbnails for the personalization platform

export class ThumbnailGenerator {
  constructor() {
    this.canvas = null;
    this.video = null;
  }

  // Initialize canvas for thumbnail generation
  initCanvas() {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 180;
    }
    return this.canvas;
  }

  // Generate thumbnail from video file
  async generateFromVideoFile(videoFile, options = {}) {
    const {
      time = 1, // seconds into video
      quality = 0.8,
      format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = this.initCanvas();
      const ctx = canvas.getContext('2d');

      video.preload = 'metadata';
      video.currentTime = time;

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(time, video.duration * 0.25); // 25% into video
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, format, quality);
      };

      video.onerror = reject;
      video.src = URL.createObjectURL(videoFile);
    });
  }

  // Generate thumbnail from video URL
  async generateFromVideoUrl(videoUrl, options = {}) {
    const {
      time = 1,
      quality = 0.8,
      format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = this.initCanvas();
      const ctx = canvas.getContext('2d');

      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      video.currentTime = time;

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(time, video.duration * 0.25);
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, format, quality);
      };

      video.onerror = reject;
      video.src = videoUrl;
    });
  }

  // Generate thumbnail from image file
  async generateFromImageFile(imageFile, options = {}) {
    const {
      quality = 0.8,
      format = 'image/jpeg',
      maxWidth = 320,
      maxHeight = 180
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = this.initCanvas();
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate dimensions to fit within maxWidth/maxHeight
        const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolve, format, quality);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(imageFile);
    });
  }

  // Generate placeholder thumbnail
  generatePlaceholder(options = {}) {
    const {
      width = 320,
      height = 180,
      backgroundColor = '#f0f0f0',
      text = 'Video',
      textColor = '#666'
    } = options;

    const canvas = this.initCanvas();
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    return new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });
  }

  // Convert blob to data URL
  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert blob to object URL
  blobToObjectUrl(blob) {
    return URL.createObjectURL(blob);
  }

  // Clean up resources
  cleanup() {
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
    }
  }
}

// Create singleton instance
const thumbnailGenerator = new ThumbnailGenerator();

// Helper functions for easy access
export async function generateVideoThumbnail(videoFile, options = {}) {
  const blob = await thumbnailGenerator.generateFromVideoFile(videoFile, options);
  return thumbnailGenerator.blobToDataUrl(blob);
}

export async function generateImageThumbnail(imageFile, options = {}) {
  const blob = await thumbnailGenerator.generateFromImageFile(imageFile, options);
  return thumbnailGenerator.blobToDataUrl(blob);
}

export async function generatePlaceholderThumbnail(options = {}) {
  const blob = await thumbnailGenerator.generatePlaceholder(options);
  return thumbnailGenerator.blobToDataUrl(blob);
}

export async function generateVideoThumbnailBlob(videoUrl, options = {}) {
  return await thumbnailGenerator.generateFromVideoUrl(videoUrl, options);
}

export function cleanupThumbnails() {
  thumbnailGenerator.cleanup();
}

export { ThumbnailGenerator };
export default thumbnailGenerator;