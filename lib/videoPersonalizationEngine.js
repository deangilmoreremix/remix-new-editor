// Advanced Video Personalization Engine - Single Video Processing Logic
class VideoPersonalizationEngine {

  constructor(options = {}) {
    this.baseVideoUrl = options.baseVideoUrl;
    this.contact = options.contact;
    this.tokens = options.tokens || {};
    this.outputPath = options.outputPath || this.generateOutputPath();
    this.processingSteps = [];
  }

  // Generate unique output path for the personalized video
  generateOutputPath() {
    const timestamp = Date.now();
    const contactId = this.contact.email.replace(/[^a-zA-Z0-9]/g, '_');
    return `/videos/personalized/${contactId}_${timestamp}.mp4`;
  }

  // Step 1: Validate all inputs
  validateInputs() {
    console.log('🔍 Step 1: Validating inputs...');

    this.processingSteps.push({
      step: 'validation',
      status: 'running',
      timestamp: Date.now()
    });

    // Validate base video
    if (!this.baseVideoUrl) {
      throw new Error('Base video URL is required');
    }

    // Validate contact data
    if (!this.contact || !this.contact.email) {
      throw new Error('Contact with email is required');
    }

    // Validate tokens
    if (!this.tokens || Object.keys(this.tokens).length === 0) {
      console.warn('⚠️ No tokens provided, using default mapping');
      this.tokens = this.getDefaultTokenMapping();
    }

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Input validation completed');
    return true;
  }

  // Default token mapping if none provided
  getDefaultTokenMapping() {
    return {
      '{{email}}': 'email',
      '{{firstName}}': 'firstName',
      '{{lastName}}': 'lastName',
      '{{company}}': 'company',
      '{{website}}': 'website',
      '{{linkedin}}': 'linkedin',
      '{{phone}}': 'phone',
      '{{title}}': 'title'
    };
  }

  // Step 2: Prepare token replacements
  prepareTokenReplacements() {
    console.log('🔄 Step 2: Preparing token replacements...');

    this.processingSteps.push({
      step: 'token_preparation',
      status: 'running',
      timestamp: Date.now()
    });

    this.replacements = {};
    this.missingData = [];

    // Map tokens to contact data
    Object.entries(this.tokens).forEach(([token, field]) => {
      const value = this.contact[field];

      if (value && value.trim()) {
        this.replacements[token] = value.trim();
      } else {
        // Handle missing data with fallbacks
        this.replacements[token] = this.getFallbackValue(token, field);
        this.missingData.push(field);
      }
    });

    // Log missing data for analytics
    if (this.missingData.length > 0) {
      console.warn(`⚠️ Missing data for fields: ${this.missingData.join(', ')}`);
    }

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Token replacements prepared:', this.replacements);
    return this.replacements;
  }

  // Get fallback values for missing data
  getFallbackValue(token, field) {
    const fallbacks = {
      '{{firstName}}': 'there',
      '{{lastName}}': '',
      '{{company}}': 'your organization',
      '{{website}}': 'your website',
      '{{linkedin}}': 'your LinkedIn profile',
      '{{phone}}': 'your phone number',
      '{{title}}': 'your role',
      '{{email}}': this.contact.email || 'your email'
    };

    return fallbacks[token] || '';
  }

  // Step 3: Analyze base video content
  async analyzeBaseVideo() {
    console.log('🎬 Step 3: Analyzing base video content...');

    this.processingSteps.push({
      step: 'video_analysis',
      status: 'running',
      timestamp: Date.now()
    });

    // Simulate video analysis
    this.videoMetadata = await this.simulateVideoAnalysis();

    // Detect text elements that need personalization
    this.textElements = await this.detectTextElements();

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Video analysis completed:', this.videoMetadata);
    return this.videoMetadata;
  }

  // Simulate video metadata extraction
  async simulateVideoAnalysis() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          duration: 30.5, // seconds
          resolution: { width: 1920, height: 1080 },
          frameRate: 30,
          bitrate: '5000k',
          codec: 'h264',
          audioCodec: 'aac',
          fileSize: 15728640 // 15MB
        });
      }, 1000);
    });
  }

  // Detect text elements in the base video
  async detectTextElements() {
    // In a real implementation, this would use OCR/AI to detect text overlays
    // For demo purposes, we'll simulate common text elements

    const commonTextElements = [
      {
        id: 'greeting',
        text: 'Hello {{firstName}}!',
        position: { x: 100, y: 200 },
        startTime: 2.0,
        endTime: 8.0,
        font: 'Arial',
        size: 48,
        color: '#FFFFFF'
      },
      {
        id: 'company_intro',
        text: 'Welcome to {{company}}',
        position: { x: 100, y: 280 },
        startTime: 8.0,
        endTime: 15.0,
        font: 'Arial',
        size: 36,
        color: '#FFFFFF'
      },
      {
        id: 'contact_info',
        text: 'Contact: {{email}}',
        position: { x: 100, y: 900 },
        startTime: 20.0,
        endTime: 30.0,
        font: 'Arial',
        size: 24,
        color: '#CCCCCC'
      }
    ];

    return commonTextElements;
  }

  // Step 4: Apply token replacements to text elements
  applyTokenReplacements() {
    console.log('🎨 Step 4: Applying token replacements...');

    this.processingSteps.push({
      step: 'token_application',
      status: 'running',
      timestamp: Date.now()
    });

    this.personalizedElements = this.textElements.map(element => ({
      ...element,
      originalText: element.text,
      personalizedText: this.replaceTokens(element.text),
      replacements: this.getReplacementsForText(element.text)
    }));

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Token replacements applied:', this.personalizedElements);
    return this.personalizedElements;
  }

  // Replace tokens in text
  replaceTokens(text) {
    let processedText = text;

    Object.entries(this.replacements).forEach(([token, value]) => {
      const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processedText = processedText.replace(regex, value);
    });

    return processedText;
  }

  // Get which replacements were applied to a text
  getReplacementsForText(text) {
    const appliedReplacements = {};

    Object.entries(this.replacements).forEach(([token, value]) => {
      if (text.includes(token)) {
        appliedReplacements[token] = value;
      }
    });

    return appliedReplacements;
  }

  // Step 5: Render the personalized video
  async renderVideo() {
    console.log('🎥 Step 5: Rendering personalized video...');

    this.processingSteps.push({
      step: 'video_rendering',
      status: 'running',
      timestamp: Date.now()
    });

    // Simulate video rendering process
    this.outputUrl = await this.simulateVideoRendering();

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Video rendering completed:', this.outputUrl);
    return this.outputUrl;
  }

  // Simulate video rendering with detailed progress
  async simulateVideoRendering() {
    const steps = [
      'Loading base video...',
      'Applying text overlays...',
      'Processing audio...',
      'Encoding video...',
      'Finalizing output...'
    ];

    for (let i = 0; i < steps.length; i++) {
      console.log(`  📹 ${steps[i]}`);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    return this.outputPath;
  }

  // Step 6: Generate thumbnail
  async generateThumbnail() {
    console.log('🖼️ Step 6: Generating video thumbnail...');

    this.processingSteps.push({
      step: 'thumbnail_generation',
      status: 'running',
      timestamp: Date.now()
    });

    // Simulate thumbnail generation
    await new Promise(resolve => setTimeout(resolve, 500));

    this.thumbnailUrl = this.outputUrl.replace('.mp4', '-thumb.jpg');

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Thumbnail generated:', this.thumbnailUrl);
    return this.thumbnailUrl;
  }

  // Step 7: Final validation
  async validateOutput() {
    console.log('✅ Step 7: Validating final output...');

    this.processingSteps.push({
      step: 'validation',
      status: 'running',
      timestamp: Date.now()
    });

    // Simulate validation checks
    const validationResults = await this.simulateValidation();

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';

    if (!validationResults.isValid) {
      throw new Error(`Validation failed: ${validationResults.errors.join(', ')}`);
    }

    console.log('✅ Output validation passed');
    return validationResults;
  }

  // Simulate validation checks
  async simulateValidation() {
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      isValid: true,
      fileSize: 16252928, // ~16MB
      duration: 30.5,
      hasPersonalization: true,
      textElementsFound: this.personalizedElements.length,
      errors: []
    };
  }

  // Main processing method
  async processPersonalizedVideo() {
    const startTime = Date.now();

    try {
      console.log(`🚀 Starting video personalization for ${this.contact.email}`);

      // Execute processing pipeline
      this.validateInputs();
      this.prepareTokenReplacements();
      await this.analyzeBaseVideo();
      this.applyTokenReplacements();
      await this.renderVideo();
      await this.generateThumbnail();
      await this.validateOutput();

      const processingTime = Date.now() - startTime;

      // Return complete result
      const result = {
        id: `video-${this.contact.email}-${Date.now()}`,
        contact: this.contact,
        url: this.outputUrl,
        thumbnail: this.thumbnailUrl,
        tokens: this.replacements,
        metadata: this.videoMetadata,
        textElements: this.personalizedElements,
        processingSteps: this.processingSteps,
        processingTime: processingTime,
        status: 'completed',
        createdAt: new Date().toISOString(),
        analytics: {
          missingData: this.missingData,
          replacementsApplied: Object.keys(this.replacements).length,
          textElementsProcessed: this.personalizedElements.length
        }
      };

      console.log(`🎉 Video personalization completed successfully in ${processingTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ Video personalization failed:', error);

      // Update failed step
      if (this.processingSteps.length > 0) {
        this.processingSteps[this.processingSteps.length - 1].status = 'failed';
        this.processingSteps[this.processingSteps.length - 1].error = error.message;
      }

      throw error;
    }
  }
}

// Factory function to create and process a personalized video
export async function createPersonalizedVideo(baseVideo, contact, tokens = {}) {
  const engine = new VideoPersonalizationEngine({
    baseVideoUrl: baseVideo.url,
    contact: contact,
    tokens: tokens
  });

  return await engine.processPersonalizedVideo();
}

// Batch processing for multiple contacts
export async function createBulkPersonalizedVideos(baseVideo, contacts, tokens = {}, onProgress = null) {
  const results = [];
  const total = contacts.length;

  for (let i = 0; i < total; i++) {
    const contact = contacts[i];

    try {
      console.log(`\n📊 Processing ${i + 1}/${total}: ${contact.email}`);
      const result = await createPersonalizedVideo(baseVideo, contact, tokens);
      results.push(result);

      if (onProgress) {
        onProgress(((i + 1) / total) * 100, results);
      }
    } catch (error) {
      console.error(`❌ Failed to process ${contact.email}:`, error);
      results.push({
        contact: contact,
        status: 'failed',
        error: error.message
      });
    }
  }

  return results;
}