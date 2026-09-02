// Video Creation Engine - Core logic for generating videos from editor components
// Handles composition, rendering, and export of personalized videos

export default class VideoCreationEngine {
  constructor(options = {}) {
    this.canvas = options.canvas; // Canvas component instance
    this.timeline = options.timeline; // Timeline component instance
    this.sidebar = options.sidebar; // Sidebar component instance
    this.analytics = options.analytics; // Analytics service
    this.performance = options.performance; // Performance service

    // Video creation state
    this.isRendering = false;
    this.renderProgress = 0;
    this.currentFrame = 0;
    this.totalFrames = 0;

    // Video specifications
    this.videoSpec = {
      width: 1920,
      height: 1080,
      frameRate: 30,
      duration: 0,
      format: 'mp4',
      quality: 'high'
    };

    // Rendering context
    this.renderCanvas = null;
    this.renderContext = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];

    // Video layers and assets
    this.layers = [];
    this.assets = new Map();
    this.templates = new Map();

    // Event callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});

    this.initialize();
  }

  initialize() {
    // Create offscreen canvas for rendering
    this.renderCanvas = document.createElement('canvas');
    this.renderCanvas.width = this.videoSpec.width;
    this.renderCanvas.height = this.videoSpec.height;
    this.renderContext = this.renderCanvas.getContext('2d');

    // Initialize video layers
    this.layers = [];

    // Load templates and assets
    this.loadTemplates();
    this.loadAssets();

    console.log('Video Creation Engine initialized');
  }

  // ========== TEMPLATE MANAGEMENT ==========

  async loadTemplates() {
    // Load predefined video templates
    const templates = [
      {
        id: 'business-intro',
        name: 'Business Introduction',
        category: 'business',
        duration: 30,
        scenes: [
          { duration: 10, text: 'Welcome to {{company}}', voice: 'professional' },
          { duration: 10, text: 'We help {{industry}} businesses succeed', voice: 'professional' },
          { duration: 10, text: 'Contact us at {{email}}', voice: 'professional' }
        ]
      },
      {
        id: 'product-demo',
        name: 'Product Demonstration',
        category: 'marketing',
        duration: 45,
        scenes: [
          { duration: 15, text: 'Introducing our amazing product', voice: 'enthusiastic' },
          { duration: 15, text: 'See it in action', voice: 'enthusiastic' },
          { duration: 15, text: 'Perfect for {{useCase}}', voice: 'enthusiastic' }
        ]
      },
      {
        id: 'thank-you',
        name: 'Thank You Message',
        category: 'personal',
        duration: 20,
        scenes: [
          { duration: 10, text: 'Thank you for your interest, {{firstName}}', voice: 'warm' },
          { duration: 10, text: 'We look forward to working with you', voice: 'warm' }
        ]
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });

    console.log(`Loaded ${templates.length} video templates`);
  }

  async loadAssets() {
    // Load common video assets (backgrounds, transitions, etc.)
    const assets = [
      { id: 'bg-gradient', type: 'image', url: '/assets/backgrounds/gradient.jpg' },
      { id: 'bg-corporate', type: 'image', url: '/assets/backgrounds/corporate.jpg' },
      { id: 'transition-fade', type: 'transition', effect: 'fade' },
      { id: 'transition-slide', type: 'transition', effect: 'slide' },
      { id: 'music-corporate', type: 'audio', url: '/assets/music/corporate.mp3' },
      { id: 'music-upbeat', type: 'audio', url: '/assets/music/upbeat.mp3' }
    ];

    // Preload assets
    for (const asset of assets) {
      try {
        if (asset.type === 'image') {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = () => {
              this.assets.set(asset.id, { ...asset, element: img });
              resolve();
            };
            img.onerror = reject;
            img.src = asset.url;
          });
        } else {
          this.assets.set(asset.id, asset);
        }
      } catch (error) {
        console.warn(`Failed to load asset ${asset.id}:`, error);
      }
    }

    console.log(`Loaded ${this.assets.size} video assets`);
  }

  applyTemplate(templateId, contactData = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Clear existing layers
    this.layers = [];

    // Calculate total duration
    this.videoSpec.duration = template.duration;

    // Create layers from template scenes
    let currentTime = 0;
    template.scenes.forEach((scene, index) => {
      // Background layer
      this.addLayer({
        id: `bg-${index}`,
        type: 'background',
        startTime: currentTime,
        duration: scene.duration,
        assetId: 'bg-corporate'
      });

      // Text layer with personalization
      const personalizedText = this.personalizeText(scene.text, contactData);
      this.addLayer({
        id: `text-${index}`,
        type: 'text',
        startTime: currentTime,
        duration: scene.duration,
        text: personalizedText,
        style: {
          fontSize: 48,
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          position: { x: this.videoSpec.width / 2, y: this.videoSpec.height / 2 }
        }
      });

      // Voice layer
      this.addLayer({
        id: `voice-${index}`,
        type: 'voice',
        startTime: currentTime,
        duration: scene.duration,
        text: personalizedText,
        voice: scene.voice
      });

      // Transition (except for last scene)
      if (index < template.scenes.length - 1) {
        this.addLayer({
          id: `transition-${index}`,
          type: 'transition',
          startTime: currentTime + scene.duration - 1,
          duration: 1,
          effect: 'fade'
        });
      }

      currentTime += scene.duration;
    });

    // Add background music
    this.addLayer({
      id: 'bg-music',
      type: 'audio',
      startTime: 0,
      duration: this.videoSpec.duration,
      assetId: 'music-corporate',
      volume: 0.3
    });

    console.log(`Applied template ${templateId} with ${contactData.firstName || 'default'} personalization`);
  }

  personalizeText(text, contactData) {
    let personalizedText = text;

    // Replace template variables with contact data
    Object.entries(contactData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      personalizedText = personalizedText.replace(new RegExp(placeholder, 'g'), value || '');
    });

    return personalizedText;
  }

  // ========== LAYER MANAGEMENT ==========

  addLayer(layerData) {
    const layer = {
      id: layerData.id || `layer-${Date.now()}`,
      type: layerData.type,
      name: layerData.name || `${layerData.type} layer`,
      startTime: layerData.startTime || 0,
      duration: layerData.duration || 5,
      visible: layerData.visible !== false,
      locked: layerData.locked || false,
      zIndex: layerData.zIndex || this.layers.length,
      ...layerData
    };

    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);

    console.log(`Added layer: ${layer.name} (${layer.type})`);
    return layer;
  }

  removeLayer(layerId) {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index > -1) {
      const removed = this.layers.splice(index, 1)[0];
      console.log(`Removed layer: ${removed.name}`);
      return removed;
    }
    return null;
  }

  updateLayer(layerId, updates) {
    const layer = this.layers.find(l => l.id === layerId);
    if (layer) {
      Object.assign(layer, updates);
      console.log(`Updated layer: ${layer.name}`);
      return layer;
    }
    return null;
  }

  getLayersAtTime(time) {
    return this.layers.filter(layer =>
      layer.visible &&
      time >= layer.startTime &&
      time <= layer.startTime + layer.duration
    );
  }

  // ========== VIDEO RENDERING ==========

  async renderVideo(contactData = {}, options = {}) {
    if (this.isRendering) {
      throw new Error('Video rendering already in progress');
    }

    this.isRendering = true;
    this.renderProgress = 0;
    this.recordedChunks = [];

    try {
      // Apply personalization if contact data provided
      if (contactData.templateId) {
        this.applyTemplate(contactData.templateId, contactData);
      }

      // Update video specifications
      this.videoSpec = { ...this.videoSpec, ...options };

      // Calculate total frames
      this.totalFrames = Math.ceil(this.videoSpec.duration * this.videoSpec.frameRate);
      this.currentFrame = 0;

      console.log(`Starting video render: ${this.totalFrames} frames at ${this.videoSpec.frameRate}fps`);

      // Track analytics
      if (this.analytics) {
        this.analytics.trackEvent('video_render_start', {
          templateId: contactData.templateId,
          duration: this.videoSpec.duration,
          contactId: contactData.id
        });
      }

      // Start recording
      await this.startRecording();

      // Render each frame
      for (let frame = 0; frame < this.totalFrames; frame++) {
        const time = frame / this.videoSpec.frameRate;
        await this.renderFrame(time);

        this.currentFrame = frame;
        this.renderProgress = (frame / this.totalFrames) * 100;

        // Update progress (throttled)
        if (frame % 10 === 0) {
          this.onProgress(this.renderProgress);
        }
      }

      // Stop recording and get final video
      const videoBlob = await this.stopRecording();

      // Track completion
      if (this.analytics) {
        this.analytics.trackEvent('video_render_complete', {
          templateId: contactData.templateId,
          duration: this.videoSpec.duration,
          contactId: contactData.id,
          fileSize: videoBlob.size
        });
      }

      this.onComplete(videoBlob, contactData);
      return videoBlob;

    } catch (error) {
      console.error('Video rendering failed:', error);
      this.onError(error);
      throw error;
    } finally {
      this.isRendering = false;
    }
  }

  async renderFrame(time) {
    // Clear canvas
    this.renderContext.clearRect(0, 0, this.videoSpec.width, this.videoSpec.height);

    // Get active layers for this time
    const activeLayers = this.getLayersAtTime(time);

    // Render layers in order (background to foreground)
    for (const layer of activeLayers) {
      await this.renderLayer(layer, time);
    }

    // Capture frame for recording
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Convert canvas to video frame
      const frameData = this.renderCanvas.toDataURL('image/png');
      // In a real implementation, you'd convert this to video frames
      // For now, we'll simulate the recording process
    }
  }

  async renderLayer(layer, time) {
    const relativeTime = time - layer.startTime;
    const progress = Math.max(0, Math.min(1, relativeTime / layer.duration));

    switch (layer.type) {
      case 'background':
        await this.renderBackgroundLayer(layer, progress);
        break;
      case 'text':
        this.renderTextLayer(layer, progress);
        break;
      case 'image':
        await this.renderImageLayer(layer, progress);
        break;
      case 'video':
        await this.renderVideoLayer(layer, progress);
        break;
      case 'transition':
        this.renderTransitionLayer(layer, progress);
        break;
      case 'shape':
        this.renderShapeLayer(layer, progress);
        break;
      case 'voice':
        // Voice layers are handled during audio generation
        break;
      case 'audio':
        // Audio layers are handled during audio mixing
        break;
    }
  }

  async renderBackgroundLayer(layer, progress) {
    const asset = this.assets.get(layer.assetId);
    if (!asset) return;

    if (asset.type === 'image' && asset.element) {
      // Draw background image
      this.renderContext.drawImage(
        asset.element,
        0, 0, this.videoSpec.width, this.videoSpec.height
      );
    } else {
      // Draw solid color background
      this.renderContext.fillStyle = layer.color || '#000000';
      this.renderContext.fillRect(0, 0, this.videoSpec.width, this.videoSpec.height);
    }
  }

  renderTextLayer(layer, progress) {
    const style = layer.style || {};
    const position = style.position || { x: this.videoSpec.width / 2, y: this.videoSpec.height / 2 };

    this.renderContext.save();

    // Set text properties
    this.renderContext.font = `${style.fontSize || 24}px ${style.fontFamily || 'Arial'}`;
    this.renderContext.fillStyle = style.color || '#ffffff';
    this.renderContext.textAlign = style.textAlign || 'center';
    this.renderContext.textBaseline = 'middle';

    // Apply animations/effects based on progress
    if (layer.animation) {
      this.applyTextAnimation(layer.animation, progress);
    }

    // Draw text
    const lines = layer.text.split('\n');
    const lineHeight = style.fontSize * 1.2;
    let y = position.y - (lines.length - 1) * lineHeight / 2;

    lines.forEach(line => {
      this.renderContext.fillText(line, position.x, y);
      y += lineHeight;
    });

    this.renderContext.restore();
  }

  applyTextAnimation(animation, progress) {
    switch (animation.type) {
      case 'fade-in':
        this.renderContext.globalAlpha = progress;
        break;
      case 'slide-up':
        const slideDistance = 50;
        this.renderContext.translate(0, slideDistance * (1 - progress));
        break;
      case 'scale':
        const scale = 0.5 + 0.5 * progress;
        this.renderContext.scale(scale, scale);
        break;
    }
  }

  async renderImageLayer(layer, progress) {
    const asset = this.assets.get(layer.assetId);
    if (!asset || !asset.element) return;

    const img = asset.element;
    const position = layer.position || { x: 0, y: 0 };
    const size = layer.size || { width: img.width, height: img.height };

    // Apply animations
    if (layer.animation) {
      this.applyImageAnimation(layer.animation, progress);
    }

    this.renderContext.drawImage(
      img,
      position.x, position.y, size.width, size.height
    );
  }

  applyImageAnimation(animation, progress) {
    switch (animation.type) {
      case 'fade-in':
        this.renderContext.globalAlpha = progress;
        break;
      case 'zoom':
        const scale = 1 + 0.2 * (1 - progress);
        this.renderContext.scale(scale, scale);
        break;
      case 'pan':
        const panDistance = 100;
        this.renderContext.translate(panDistance * (1 - progress), 0);
        break;
    }
  }

  async renderVideoLayer(layer, progress) {
    // Video layer rendering would require video decoding
    // This is a simplified placeholder
    console.log(`Rendering video layer: ${layer.name} at ${progress * 100}%`);
  }

  renderTransitionLayer(layer, progress) {
    switch (layer.effect) {
      case 'fade':
        this.renderContext.globalAlpha = 1 - progress;
        break;
      case 'wipe':
        const wipeWidth = this.videoSpec.width * progress;
        this.renderContext.clearRect(wipeWidth, 0, this.videoSpec.width - wipeWidth, this.videoSpec.height);
        break;
    }
  }

  renderShapeLayer(layer, progress) {
    const position = layer.position || { x: 100, y: 100 };
    const size = layer.size || { width: 200, height: 200 };

    this.renderContext.save();

    if (layer.fillColor) {
      this.renderContext.fillStyle = layer.fillColor;
      this.renderContext.fillRect(position.x, position.y, size.width, size.height);
    }

    if (layer.strokeColor) {
      this.renderContext.strokeStyle = layer.strokeColor;
      this.renderContext.lineWidth = layer.strokeWidth || 2;
      this.renderContext.strokeRect(position.x, position.y, size.width, size.height);
    }

    this.renderContext.restore();
  }

  // ========== RECORDING AND EXPORT ==========

  async startRecording() {
    return new Promise((resolve, reject) => {
      try {
        // Create a stream from the canvas
        const stream = this.renderCanvas.captureStream(this.videoSpec.frameRate);

        // Create MediaRecorder
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
        });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, {
            type: 'video/webm'
          });
          resolve(blob);
        };

        this.mediaRecorder.onerror = (error) => {
          reject(error);
        };

        // Start recording
        this.mediaRecorder.start();
        resolve();

      } catch (error) {
        reject(error);
      }
    });
  }

  async stopRecording() {
    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, {
            type: 'video/webm'
          });
          resolve(blob);
        };
        this.mediaRecorder.stop();
      } else {
        // Fallback: create a placeholder video
        const canvas = document.createElement('canvas');
        canvas.width = this.videoSpec.width;
        canvas.height = this.videoSpec.height;
        const ctx = canvas.getContext('2d');

        // Draw a simple placeholder
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Video Generated', canvas.width / 2, canvas.height / 2);

        canvas.toBlob((blob) => resolve(blob), 'video/webm');
      }
    });
  }

  // ========== AUDIO GENERATION ==========

  async generateAudio(contactData = {}) {
    const audioLayers = this.layers.filter(layer => layer.type === 'voice' || layer.type === 'audio');

    if (audioLayers.length === 0) {
      return null;
    }

    // Collect all voice layers
    const voiceLayers = audioLayers.filter(layer => layer.type === 'voice');

    // Generate TTS for each voice layer
    const audioBuffers = [];
    for (const layer of voiceLayers) {
      try {
        const audioBuffer = await this.generateTTS(layer.text, layer.voice, contactData);
        audioBuffers.push({
          buffer: audioBuffer,
          startTime: layer.startTime,
          duration: layer.duration
        });
      } catch (error) {
        console.warn(`Failed to generate TTS for layer ${layer.id}:`, error);
      }
    }

    // Mix audio layers
    return this.mixAudioBuffers(audioBuffers);
  }

  async generateTTS(text, voice, contactData) {
    // This would integrate with a TTS service like ElevenLabs, AWS Polly, etc.
    // For now, return a placeholder audio buffer

    // Personalize the text
    const personalizedText = this.personalizeText(text, contactData);

    console.log(`Generating TTS for: "${personalizedText}" with voice: ${voice}`);

    // Simulate TTS generation delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return placeholder audio data
    // In production, this would make an API call to a TTS service
    return {
      duration: personalizedText.length * 0.1, // Rough estimate
      sampleRate: 44100,
      channels: 2,
      data: new Float32Array(44100 * personalizedText.length * 0.1) // Placeholder
    };
  }

  mixAudioBuffers(audioBuffers) {
    if (audioBuffers.length === 0) return null;

    // Find total duration
    const maxEndTime = Math.max(...audioBuffers.map(buf =>
      buf.startTime + (buf.buffer.duration || buf.duration)
    ));

    const sampleRate = 44100;
    const totalSamples = Math.ceil(maxEndTime * sampleRate);
    const mixedBuffer = new Float32Array(totalSamples);

    // Mix audio buffers
    audioBuffers.forEach(({ buffer, startTime }) => {
      const startSample = Math.floor(startTime * sampleRate);
      const bufferData = buffer.data || new Float32Array(buffer.duration * sampleRate);

      for (let i = 0; i < bufferData.length && startSample + i < totalSamples; i++) {
        mixedBuffer[startSample + i] += bufferData[i];
      }
    });

    return {
      duration: maxEndTime,
      sampleRate,
      channels: 2,
      data: mixedBuffer
    };
  }

  // ========== UTILITY METHODS ==========

  setVideoSpec(spec) {
    this.videoSpec = { ...this.videoSpec, ...spec };

    // Recreate render canvas with new dimensions
    if (spec.width || spec.height) {
      this.renderCanvas.width = this.videoSpec.width;
      this.renderCanvas.height = this.videoSpec.height;
    }
  }

  getVideoSpec() {
    return { ...this.videoSpec };
  }

  getLayers() {
    return [...this.layers];
  }

  getLayer(layerId) {
    return this.layers.find(l => l.id === layerId);
  }

  exportProject() {
    const projectData = {
      version: '1.0',
      videoSpec: this.videoSpec,
      layers: this.layers,
      templates: Array.from(this.templates.entries()),
      assets: Array.from(this.assets.entries()),
      createdAt: new Date().toISOString()
    };

    return JSON.stringify(projectData, null, 2);
  }

  importProject(projectJson) {
    try {
      const projectData = JSON.parse(projectJson);

      this.videoSpec = projectData.videoSpec;
      this.layers = projectData.layers;

      // Recreate render canvas
      this.renderCanvas.width = this.videoSpec.width;
      this.renderCanvas.height = this.videoSpec.height;

      console.log('Project imported successfully');
    } catch (error) {
      throw new Error(`Failed to import project: ${error.message}`);
    }
  }

  // ========== CLEANUP ==========

  destroy() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    this.layers = [];
    this.assets.clear();
    this.templates.clear();
    this.recordedChunks = [];

    if (this.renderCanvas) {
      const ctx = this.renderCanvas.getContext('2d');
      ctx.clearRect(0, 0, this.renderCanvas.width, this.renderCanvas.height);
    }

    console.log('Video Creation Engine destroyed');
  }
}