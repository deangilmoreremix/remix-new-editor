import Component from './base/Component.js';
import { createElementFromHTML } from '../utils/jsx.js';

export default class VideoUploader extends Component {
  constructor(options = {}) {
    super(options);
    this.onVideoSelected = options.onVideoSelected || (() => {});
    this.maxFileSize = options.maxFileSize || 500; // MB
    this.acceptedFormats = options.acceptedFormats || ['mp4', 'mov', 'avi', 'webm'];

    this.uploadedVideos = [];
    this.selectedVideo = null;
    this.isUploading = false;
    this.uploadProgress = 0;
    this.isDragging = false;
    this.fileInput = null;
  }

  handleFileSelect = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  };

  handleDragOver = (event) => {
    event.preventDefault();
    this.isDragging = true;
    this.update();
  };

  handleDragLeave = (event) => {
    event.preventDefault();
    this.isDragging = false;
    this.update();
  };

  handleDrop = (event) => {
    event.preventDefault();
    this.isDragging = false;

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
    this.update();
  };

  handleVideoSelect = (video) => {
    this.selectedVideo = video;
    this.onVideoSelected(video);
    this.update();
  };

  handleVideoDelete = (videoId) => {
    this.uploadedVideos = this.uploadedVideos.filter(v => v.id !== videoId);
    if (this.selectedVideo && this.selectedVideo.id === videoId) {
      this.selectedVideo = null;
    }
    this.update();
  };

  processFile(file) {
    const errors = this.validateVideoFile(file);
    if (errors.length > 0) {
      alert('Upload Error: ' + errors.join(', '));
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.update();

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      this.uploadProgress += 10;
      this.update();

      if (this.uploadProgress >= 100) {
        clearInterval(progressInterval);
        this.completeUpload(file);
      }
    }, 200);
  }

  validateVideoFile(file) {
    const errors = [];

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > this.maxFileSize) {
      errors.push(`File size must be less than ${this.maxFileSize}MB`);
    }

    // Check file format
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!this.acceptedFormats.includes(fileExtension)) {
      errors.push(`File format must be one of: ${this.acceptedFormats.join(', ')}`);
    }

    // Check if it's actually a video
    if (!file.type.startsWith('video/')) {
      errors.push('File must be a valid video');
    }

    return errors;
  }

  async completeUpload(file) {
    const videoUrl = URL.createObjectURL(file);
    const thumbnail = await this.generateThumbnail(file);

    const video = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      url: videoUrl,
      thumbnail: thumbnail,
      duration: 0, // Would need to calculate actual duration
      type: file.type
    };

    this.uploadedVideos.push(video);
    this.isUploading = false;
    this.uploadProgress = 0;

    // Auto-select the uploaded video
    this.handleVideoSelect(video);
  }

  async generateThumbnail(videoFile) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Seek to 1 second
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      video.src = URL.createObjectURL(videoFile);
    });
  }

  render() {
    const acceptedTypes = this.acceptedFormats.map(format => `video/${format}`).join(',');

    const uploadedVideosHtml = this.uploadedVideos.map(video => `
      <div class="uploaded-video ${this.selectedVideo && this.selectedVideo.id === video.id ? 'selected' : ''}">
        <div class="video-thumbnail" style="background-image: url(${video.thumbnail})">
          <div class="video-overlay">
            <button class="select-btn" onclick="this.handleVideoSelect(${JSON.stringify(video).replace(/"/g, '&quot;')})">
              ${this.selectedVideo && this.selectedVideo.id === video.id ? 'Selected' : 'Select'}
            </button>
            <button class="delete-btn" onclick="this.handleVideoDelete('${video.id}')">×</button>
          </div>
        </div>
        <div class="video-info">
          <div class="video-name">${video.name}</div>
          <div class="video-size">${(video.size / (1024 * 1024)).toFixed(1)} MB</div>
        </div>
      </div>
    `).join('');

    const html = `
      <div class="video-uploader">
        <div class="upload-section">
          <div class="upload-area ${this.isDragging ? 'dragging' : ''} ${this.isUploading ? 'uploading' : ''}"
               ondragover="this.handleDragOver(event)"
               ondragleave="this.handleDragLeave(event)"
               ondrop="this.handleDrop(event)">

            ${this.isUploading ? `
              <div class="upload-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${this.uploadProgress}%"></div>
                </div>
                <div class="progress-text">Uploading... ${this.uploadProgress}%</div>
              </div>
            ` : `
              <div class="upload-content">
                <div class="upload-icon">📹</div>
                <div class="upload-text">
                  <p>Drag & drop a video file here, or click to browse</p>
                  <p class="upload-hint">Supported formats: ${this.acceptedFormats.join(', ').toUpperCase()}</p>
                  <p class="upload-hint">Maximum size: ${this.maxFileSize}MB</p>
                </div>
                <button class="browse-btn" onclick="this.fileInput.click()">Browse Files</button>
              </div>
            `}

            <input
              type="file"
              ref="fileInput"
              accept="${acceptedTypes}"
              style="display: none"
              onchange="this.handleFileSelect(event)"
            />
          </div>
        </div>

        ${this.uploadedVideos.length > 0 ? `
          <div class="uploaded-videos-section">
            <h3>Uploaded Videos</h3>
            <div class="uploaded-videos-grid">
              ${uploadedVideosHtml}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    return createElementFromHTML(html);
  }

  update() {
    // Update drag state and progress
    if (this.element) {
      const uploadArea = this.element.querySelector('.upload-area');
      if (uploadArea) {
        uploadArea.classList.toggle('dragging', this.isDragging);
        uploadArea.classList.toggle('uploading', this.isUploading);
      }
    }
  }

  mount(element) {
    super.mount(element);
    this.fileInput = this.element.querySelector('input[type="file"]');

    this.element.handleFileSelect = this.handleFileSelect.bind(this);
    this.element.handleDragOver = this.handleDragOver.bind(this);
    this.element.handleDragLeave = this.handleDragLeave.bind(this);
    this.element.handleDrop = this.handleDrop.bind(this);
    this.element.handleVideoSelect = this.handleVideoSelect.bind(this);
    this.element.handleVideoDelete = this.handleVideoDelete.bind(this);
  }
}