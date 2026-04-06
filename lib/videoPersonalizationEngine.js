// Advanced Video Personalization Engine - Single Video Processing Logic
// Supports both overlay-based and AI-generated video creation (Sendspark-style)
class VideoPersonalizationEngine {

  constructor(options = {}) {
    this.mode = options.mode || 'overlay'; // 'overlay' or 'ai-generated'
    this.baseVideoUrl = options.baseVideoUrl;
    this.contact = options.contact;
    this.tokens = options.tokens || {};
    this.script = options.script; // For AI-generated mode
    this.avatar = options.avatar; // For AI-generated mode
    this.apiKey = options.apiKey; // For AI services
    this.outputPath = options.outputPath || this.generateOutputPath();
    this.processingSteps = [];

    // Initialize AI services for AI-generated mode
    if (this.mode === 'ai-generated' && this.apiKey) {
      const { getMuapiClient } = require('./muapi.js');
      const { getTTSService } = require('./ttsService.js');
      this.muapi = getMuapiClient(this.apiKey);
      this.tts = getTTSService({ provider: 'openai', apiKey: this.apiKey });
    }
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

  // Main processing method - supports both overlay and AI-generated modes
  async processPersonalizedVideo() {
    const startTime = Date.now();

    try {
      console.log(`🚀 Starting ${this.mode} video personalization for ${this.contact.email}`);

      if (this.mode === 'ai-generated') {
        return await this.processAIGeneratedVideo(startTime);
      } else {
        return await this.processOverlayVideo(startTime);
      }

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

  // Overlay-based video processing (existing functionality)
  async processOverlayVideo(startTime) {
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
      mode: 'overlay',
      createdAt: new Date().toISOString(),
      analytics: {
        missingData: this.missingData,
        replacementsApplied: Object.keys(this.replacements).length,
        textElementsProcessed: this.personalizedElements.length
      }
    };

    console.log(`🎉 Overlay video personalization completed successfully in ${processingTime}ms`);
    return result;
  }

  // AI-generated video processing (Sendspark-style)
  async processAIGeneratedVideo(startTime) {
    // Validate AI requirements
    this.validateAIInputs();

    // Process script with tokens
    this.processScript();

    // Generate AI avatar
    await this.generateAvatar();

    // Generate voice audio
    await this.generateVoice();

    // Create AI video with lip-sync
    await this.createAIVideo();

    // Generate thumbnail
    await this.generateThumbnail();

    // Final validation
    await this.validateOutput();

    const processingTime = Date.now() - startTime;

    // Return complete result
    const result = {
      id: `ai-video-${this.contact.email}-${Date.now()}`,
      contact: this.contact,
      url: this.outputUrl,
      thumbnail: this.thumbnailUrl,
      script: this.personalizedScript,
      avatar: this.selectedAvatar,
      audio: this.audioData,
      tokens: this.replacements,
      processingSteps: this.processingSteps,
      processingTime: processingTime,
      status: 'completed',
      mode: 'ai-generated',
      createdAt: new Date().toISOString(),
      analytics: {
        scriptLength: this.personalizedScript.length,
        voiceDuration: this.audioData?.duration || 0,
        avatarType: this.selectedAvatar?.type || 'unknown'
      }
    };

    console.log(`🎉 AI-generated video personalization completed successfully in ${processingTime}ms`);
    return result;
  }
}

  // Validate AI generation inputs
  validateAIInputs() {
    console.log('🔍 Step 1: Validating AI inputs...');

    this.processingSteps.push({
      step: 'ai_validation',
      status: 'running',
      timestamp: Date.now()
    });

    // Validate script
    if (!this.script) {
      throw new Error('Script is required for AI-generated videos');
    }

    // Validate contact data
    if (!this.contact || !this.contact.email) {
      throw new Error('Contact with email is required');
    }

    // Validate API key
    if (!this.apiKey) {
      throw new Error('API key is required for AI services');
    }

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ AI input validation completed');
    return true;
  }

  // Process script with token replacements
  processScript() {
    console.log('📝 Step 2: Processing script...');

    this.processingSteps.push({
      step: 'script_processing',
      status: 'running',
      timestamp: Date.now()
    });

    // Apply token replacements to script
    this.personalizedScript = this.script;
    this.replacements = {};

    Object.entries(this.tokens).forEach(([token, field]) => {
      const value = this.contact[field];

      if (value && value.trim()) {
        this.personalizedScript = this.personalizedScript.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value.trim());
        this.replacements[token] = value.trim();
      } else {
        // Use fallback values
        const fallback = this.getFallbackValue(token, field);
        this.personalizedScript = this.personalizedScript.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fallback);
        this.replacements[token] = fallback;
      }
    });

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Script processing completed:', this.personalizedScript.substring(0, 100) + '...');
    return this.personalizedScript;
  }

  // Generate AI avatar
  async generateAvatar() {
    console.log('🎭 Step 3: Generating AI avatar...');

    this.processingSteps.push({
      step: 'avatar_generation',
      status: 'running',
      timestamp: Date.now()
    });

    // Select avatar based on contact data and preferences
    this.selectedAvatar = this.selectAvatarForContact();

    // Generate avatar image using AI
    const avatarPrompt = this.createAvatarPrompt();
    const avatarResult = await this.muapi.generateImage({
      model: 'flux-dev',
      prompt: avatarPrompt,
      aspect_ratio: '1:1',
      resolution: '1024x1024'
    });

    this.selectedAvatar.imageUrl = avatarResult.url;

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Avatar generated:', avatarResult.url);
    return this.selectedAvatar;
  }

  // Select appropriate avatar for contact
  selectAvatarForContact() {
    // Default avatar selection logic
    const industry = this.contact.industry || 'general';
    const role = this.contact.title || 'professional';

    let avatarType = 'professional-male';
    let description = 'Professional business person';

    if (industry.toLowerCase().includes('healthcare') || industry.toLowerCase().includes('medical')) {
      avatarType = 'healthcare-professional';
      description = 'Healthcare professional';
    } else if (industry.toLowerCase().includes('education') || industry.toLowerCase().includes('teaching')) {
      avatarType = 'educator';
      description = 'Educator or teacher';
    } else if (role.toLowerCase().includes('engineer') || role.toLowerCase().includes('developer')) {
      avatarType = 'tech-professional';
      description = 'Technology professional';
    }

    return {
      type: avatarType,
      description: description,
      industry: industry,
      role: role
    };
  }

  // Create avatar generation prompt
  createAvatarPrompt() {
    const { firstName, lastName, company, industry, title } = this.contact;

    return `Professional headshot portrait of ${firstName || 'a person'} ${lastName || ''}, ${title || 'professional'} at ${company || 'a company'} in the ${industry || 'business'} industry. Clean background, professional attire, confident expression, photorealistic, high quality, corporate headshot style.`;
  }

  // Generate voice audio
  async generateVoice() {
    console.log('🗣️ Step 4: Generating voice audio...');

    this.processingSteps.push({
      step: 'voice_generation',
      status: 'running',
      timestamp: Date.now()
    });

    // Generate TTS audio
    this.audioData = await this.tts.generateSpeech(this.personalizedScript, {
      voice: this.selectVoiceForContact(),
      language: 'en',
      speed: 1.0,
      emotion: 'professional'
    });

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Voice generated:', this.audioData.url);
    return this.audioData;
  }

  // Select appropriate voice for contact
  selectVoiceForContact() {
    // Voice selection logic based on contact data
    const title = (this.contact.title || '').toLowerCase();

    if (title.includes('ceo') || title.includes('founder') || title.includes('president')) {
      return 'professional-male';
    } else if (title.includes('sales') || title.includes('marketing')) {
      return 'friendly-male';
    } else {
      return 'professional-female'; // Default
    }
  }

  // Create AI video with lip-sync
  async createAIVideo() {
    console.log('🎬 Step 5: Creating AI video with lip-sync...');

    this.processingSteps.push({
      step: 'ai_video_creation',
      status: 'running',
      timestamp: Date.now()
    });

    // Generate lip-synced video using avatar and audio
    const videoResult = await this.muapi.generateLipSync({
      video_url: this.selectedAvatar.imageUrl,
      audio_url: this.audioData.url,
      resolution: '1920x1080'
    });

    this.outputUrl = videoResult.url;

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ AI video created:', this.outputUrl);
    return this.outputUrl;
  }

  // Factory function to create and process a personalized video (supports both modes)
  export async function createPersonalizedVideo(baseVideo, contact, tokens = {}, options = {}) {
    const engine = new VideoPersonalizationEngine({
      mode: options.mode || 'overlay',
      baseVideoUrl: baseVideo?.url,
      contact: contact,
      tokens: tokens,
      script: options.script,
      avatar: options.avatar,
      apiKey: options.apiKey
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