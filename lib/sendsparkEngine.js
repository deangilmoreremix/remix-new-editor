// Sendspark-Style Video Personalization Engine
// Correct workflow: Record video → Clone voice → Personalize for each contact

import { getMuapiClient } from './muapi.js';
import { getTTSService } from './ttsService.js';
import { getVideoEnhancementService } from './videoEnhancementService.js';

class SendsparkPersonalizationEngine {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.userVideo = options.userVideo; // User's recorded video
    this.userVoiceSample = options.userVoiceSample; // For voice cloning
    this.contacts = options.contacts || [];
    this.script = options.script; // Script with placeholders like "Hi {{firstName}}"
    this.tokens = options.tokens || {};
    
    // Initialize AI services
    if (this.apiKey) {
      this.muapi = getMuapiClient(this.apiKey);
      this.tts = getTTSService({ provider: 'elevenlabs', apiKey: this.apiKey });
      this.enhancer = getVideoEnhancementService({ apiKey: this.apiKey });
    }
    
    this.processingSteps = [];
    this.clonedVoiceId = null;
  }

  // ============================================================================
  // STEP 1: Record Base Video (Using Cap-style recorder)
  // ============================================================================
  
  async recordBaseVideo(recordingOptions = {}) {
    console.log('🎥 Step 1: Recording base video...');
    
    this.processingSteps.push({
      step: 'recording',
      status: 'running',
      timestamp: Date.now()
    });

    // In the actual implementation, this would use Cap's recording functionality
    // For now, we accept the recorded video blob
    const recording = await this.captureRecording(recordingOptions);
    
    this.userVideo = {
      url: recording.url,
      duration: recording.duration,
      resolution: recording.resolution,
      thumbnail: recording.thumbnail,
      blob: recording.blob
    };

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Base video recorded:', this.userVideo.duration + 's');
    return this.userVideo;
  }

  // Simulate video capture (would integrate with Cap in production)
  async captureRecording(options) {
    // This would integrate with the Cap recorder component
    // For now, return a placeholder
    return new Promise((resolve) => {
      // In production, this would use Cap's recording API
      resolve({
        url: 'placeholder-video-url',
        duration: 30,
        resolution: { width: 1920, height: 1080 },
        thumbnail: 'placeholder-thumbnail',
        blob: null
      });
    });
  }

  // ============================================================================
  // STEP 2: Clone User's Voice
  // ============================================================================
  
  async cloneUserVoice() {
    console.log('🎙️ Step 2: Cloning user voice...');
    
    this.processingSteps.push({
      step: 'voice_cloning',
      status: 'running',
      timestamp: Date.now()
    });

    if (!this.tts.supportsVoiceCloning()) {
      throw new Error('Voice cloning requires ElevenLabs provider');
    }

    // Extract audio from user's video or use provided voice sample
    const voiceSample = this.userVoiceSample || await this.extractAudioFromVideo(this.userVideo);
    
    // Clone the voice using ElevenLabs
    const clonedVoice = await this.tts.cloneVoice(
      [voiceSample],
      'User Voice Clone'
    );

    this.clonedVoiceId = clonedVoice.voiceId;

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Voice cloned:', this.clonedVoiceId);
    return clonedVoice;
  }

  // Extract audio track from video
  async extractAudioFromVideo(video) {
    console.log('🔊 Extracting audio from video...');
    
    // In production, this would use Web Audio API or server-side processing
    // to extract the audio track from the video file
    return new Promise((resolve) => {
      // Placeholder - would extract actual audio in production
      resolve(new Blob(['audio-data'], { type: 'audio/wav' }));
    });
  }

  // ============================================================================
  // STEP 3: Import Contacts
  // ============================================================================
  
  async importContacts(contactsData) {
    console.log('👥 Step 3: Importing contacts...');
    
    this.processingSteps.push({
      step: 'contact_import',
      status: 'running',
      timestamp: Date.now()
    });

    // Validate and process contacts
    this.contacts = contactsData.map((contact, index) => ({
      id: `contact-${index}`,
      email: contact.email,
      firstName: contact.firstName || contact.first_name || '',
      lastName: contact.lastName || contact.last_name || '',
      company: contact.company || '',
      website: contact.website || '',
      industry: contact.industry || '',
      title: contact.title || '',
      customFields: contact.customFields || {}
    }));

    // Validate required fields
    const invalidContacts = this.contacts.filter(c => !c.email);
    if (invalidContacts.length > 0) {
      throw new Error(`${invalidContacts.length} contacts missing email addresses`);
    }

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Contacts imported:', this.contacts.length);
    return this.contacts;
  }

  // ============================================================================
  // STEP 4: Process Script with Tokens
  // ============================================================================
  
  processScript() {
    console.log('📝 Step 4: Processing script with tokens...');
    
    this.processingSteps.push({
      step: 'script_processing',
      status: 'running',
      timestamp: Date.now()
    });

    if (!this.script) {
      throw new Error('Script is required');
    }

    // Default token mapping
    this.tokenMapping = {
      '{{firstName}}': 'firstName',
      '{{lastName}}': 'lastName',
      '{{company}}': 'company',
      '{{website}}': 'website',
      '{{industry}}': 'industry',
      '{{title}}': 'title',
      ...this.tokens
    };

    // Process script for each contact
    this.processedScripts = this.contacts.map(contact => {
      let personalizedScript = this.script;
      const tokensUsed = [];

      Object.entries(this.tokenMapping).forEach(([token, field]) => {
        const value = contact[field] || contact.customFields[field] || '';
        if (value) {
          personalizedScript = personalizedScript.replace(
            new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            value
          );
          tokensUsed.push({ token, value });
        } else {
          // Use fallback for missing data
          const fallback = this.getTokenFallback(token, field);
          personalizedScript = personalizedScript.replace(
            new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            fallback
          );
        }
      });

      return {
        contact,
        originalScript: this.script,
        personalizedScript,
        tokensUsed
      };
    });

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log('✅ Scripts processed for', this.processedScripts.length, 'contacts');
    return this.processedScripts;
  }

  getTokenFallback(token, field) {
    const fallbacks = {
      '{{firstName}}': 'there',
      '{{lastName}}': '',
      '{{company}}': 'your company',
      '{{website}}': 'your website',
      '{{industry}}': 'your industry',
      '{{title}}': 'your role'
    };
    return fallbacks[token] || '';
  }

  // ============================================================================
  // STEP 5: Generate Personalized Videos
  // ============================================================================
  
  async generatePersonalizedVideos(onProgress = null) {
    console.log('🎬 Step 5: Generating personalized videos...');
    
    this.processingSteps.push({
      step: 'video_generation',
      status: 'running',
      timestamp: Date.now()
    });

    const results = [];
    const total = this.processedScripts.length;

    for (let i = 0; i < total; i++) {
      const { contact, personalizedScript } = this.processedScripts[i];
      
      try {
        console.log(`\n📊 Processing ${i + 1}/${total}: ${contact.email}`);

        // Generate audio with cloned voice
        const audioResult = await this.generatePersonalizedAudio(personalizedScript);

        // Generate dynamic background
        const backgroundResult = await this.generateDynamicBackground(contact);

        // Synthesize personalized video
        const videoResult = await this.synthesizePersonalizedVideo({
          baseVideo: this.userVideo,
          audio: audioResult,
          background: backgroundResult,
          contact
        });

        results.push({
          contact,
          videoUrl: videoResult.url,
          thumbnail: videoResult.thumbnail,
          duration: audioResult.duration,
          status: 'completed'
        });

        // Update progress
        const progress = ((i + 1) / total) * 100;
        if (onProgress) {
          onProgress(progress, results);
        }

      } catch (error) {
        console.error(`❌ Failed to process ${contact.email}:`, error);
        results.push({
          contact,
          status: 'failed',
          error: error.message
        });
      }
    }

    this.processingSteps[this.processingSteps.length - 1].status = 'completed';
    console.log(`\n✅ Generated ${results.filter(r => r.status === 'completed').length}/${total} videos`);
    return results;
  }

  // Generate audio using cloned voice
  async generatePersonalizedAudio(script) {
    console.log('  🗣️ Generating audio with cloned voice...');
    
    const audioResult = await this.tts.generateSpeech(script, {
      voice: 'custom',
      language: 'en',
      speed: 1.0
    });

    return audioResult;
  }

  // Generate dynamic background for contact
  async generateDynamicBackground(contact) {
    console.log('  🎨 Generating dynamic background...');
    
    // Option 1: Use contact's website screenshot
    if (contact.website) {
      try {
        const screenshot = await this.captureWebsiteScreenshot(contact.website);
        return {
          type: 'website',
          url: screenshot.url,
          source: contact.website
        };
      } catch (error) {
        console.warn('  ⚠️ Failed to capture website, using fallback');
      }
    }

    // Option 2: Generate AI background based on industry
    const industry = contact.industry || 'business';
    const backgroundPrompt = this.getIndustryBackgroundPrompt(industry);
    
    const backgroundResult = await this.muapi.generateImage({
      model: 'flux-dev',
      prompt: backgroundPrompt,
      aspect_ratio: '16:9',
      resolution: '1920x1080'
    });

    return {
      type: 'ai-generated',
      url: backgroundResult.url,
      industry: industry
    };
  }

  // Capture website screenshot
  async captureWebsiteScreenshot(url) {
    console.log('  📸 Capturing website screenshot...');
    
    // In production, this would use a service like PageShot or similar
    // For now, return a placeholder
    return {
      url: `https://api.pageshot.io/screenshot?url=${encodeURIComponent(url)}`,
      source: url
    };
  }

  getIndustryBackgroundPrompt(industry) {
    const prompts = {
      'technology': 'Modern tech office with glass walls, computers, blue lighting, professional corporate environment',
      'healthcare': 'Clean medical office with medical equipment, white walls, professional healthcare environment',
      'finance': 'Professional corporate office with wood paneling, executive desk, banking environment',
      'education': 'Modern classroom or university setting, educational materials, learning environment',
      'real estate': 'Modern property interior or exterior, luxury real estate, professional setting',
      'marketing': 'Creative agency office, colorful modern design, marketing environment',
      'default': 'Professional office space, neutral colors, corporate business environment'
    };

    return prompts[industry.toLowerCase()] || prompts['default'];
  }

  // Synthesize final personalized video
  async synthesizePersonalizedVideo({ baseVideo, audio, background, contact }) {
    console.log('  🎥 Synthesizing personalized video...');
    
    // Use AI to composite the video:
    // 1. Extract user from base video (background removal)
    // 2. Place user on dynamic background
    // 3. Sync with personalized audio
    // 4. Add name overlay if needed

    const compositionResult = await this.muapi.generateVideo({
      model: 'kling-v3.0-pro',
      prompt: `Professional video composition: Presenter from source video, dynamic background from ${background.type}, synchronized with personalized audio, professional lighting, seamless integration`,
      duration: Math.ceil(audio.duration),
      resolution: '1920x1080',
      quality: 'high'
    });

    // Apply enhancements
    const enhancedResult = await this.enhancer.enhanceVideo(compositionResult.url, [
      'color_grading',
      'sharpness_enhancement'
    ]);

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(enhancedResult.url);

    return {
      url: enhancedResult.url,
      thumbnail: thumbnail,
      duration: audio.duration
    };
  }

  // Generate video thumbnail
  async generateThumbnail(videoUrl) {
    // In production, this would extract a frame from the video
    return `${videoUrl}-thumb.jpg`;
  }

  // ============================================================================
  // STEP 6: Share/Distribute Videos
  // ============================================================================
  
  async generateShareOptions(videoResult) {
    console.log('📤 Generating share options...');
    
    return {
      email: {
        subject: `Personalized video from ${videoResult.contact.company || 'me'}`,
        body: `Hi ${videoResult.contact.firstName},\n\nI recorded a personalized video just for you. Click here to watch:\n${videoResult.videoUrl}`,
        thumbnail: videoResult.thumbnail
      },
      embed: {
        html: `<iframe src="${videoResult.videoUrl}" width="640" height="360" frameborder="0"></iframe>`,
        thumbnail: videoResult.thumbnail
      },
      link: {
        url: videoResult.videoUrl,
        thumbnail: videoResult.thumbnail
      }
    };
  }

  // ============================================================================
  // Main Workflow Orchestrator
  // ============================================================================
  
  async executeFullWorkflow(options = {}) {
    const startTime = Date.now();
    const { onProgress } = options;

    try {
      console.log('🚀 Starting Sendspark-style personalization workflow...\n');

      // Step 1: Record base video (if not provided)
      if (!this.userVideo) {
        await this.recordBaseVideo(options.recordingOptions);
      }

      // Step 2: Clone user voice
      await this.cloneUserVoice();

      // Step 3: Import contacts (if not already done)
      if (this.contacts.length === 0 && options.contacts) {
        await this.importContacts(options.contacts);
      }

      // Step 4: Process scripts
      this.processScript();

      // Step 5: Generate personalized videos
      const results = await this.generatePersonalizedVideos(onProgress);

      const processingTime = Date.now() - startTime;

      console.log(`\n🎉 Workflow completed in ${processingTime}ms`);
      console.log(`✅ Successfully generated ${results.filter(r => r.status === 'completed').length} personalized videos`);

      return {
        success: true,
        results,
        processingTime,
        steps: this.processingSteps
      };

    } catch (error) {
      console.error('❌ Workflow failed:', error);
      throw error;
    }
  }
}

// Factory function for easy usage
export async function createSendsparkPersonalization(options) {
  const engine = new SendsparkPersonalizationEngine(options);
  return engine;
}

export { SendsparkPersonalizationEngine };
export default SendsparkPersonalizationEngine;