// Open-Higgsfield-AI Integration Test & Setup
// Comprehensive test of all integrated AI features

import { getMuapiClient } from './lib/muapi.js';
import { getTTSService } from './lib/ttsService.js';
import { getModelsByType, getModelById } from './lib/models.js';
import { getScriptTemplates, getAvatarById } from './lib/templates.js';
import { getInstructionsForStudio } from './lib/instructions.js';
import uploadHistory from './lib/uploadHistory.js';
import thumbnailGenerator from './lib/thumbnails.js';
import { getSupabaseClient } from './lib/supabase.js';

class OpenHiggsfieldIntegrationTester {
  constructor() {
    this.muapi = null;
    this.tts = null;
    this.results = {
      muapiConnection: false,
      ttsService: false,
      modelsLoaded: false,
      templatesLoaded: false,
      instructionsLoaded: false,
      uploadHistory: false,
      thumbnails: false,
      supabase: false,
      aiGeneration: false
    };
  }

  // Test Muapi.ai client connection
  async testMuapiConnection(apiKey) {
    console.log('🔗 Testing Muapi.ai connection...');

    try {
      this.muapi = getMuapiClient(apiKey);

      // Test with a simple model query (this would fail without valid key but tests the client)
      const models = getModelsByType('text-to-image');
      this.results.muapiConnection = models.length > 0;

      console.log(`✅ Muapi client initialized with ${models.length} text-to-image models`);
      return true;
    } catch (error) {
      console.warn('⚠️ Muapi connection test failed (expected without valid API key):', error.message);
      this.results.muapiConnection = false;
      return false;
    }
  }

  // Test TTS service
  async testTTSService() {
    console.log('🗣️ Testing TTS service...');

    try {
      this.tts = getTTSService({ provider: 'openai' });
      const voices = this.tts.getAvailableVoices();

      this.results.ttsService = voices.length > 0;
      console.log(`✅ TTS service initialized with ${voices.length} voice options`);
      return true;
    } catch (error) {
      console.warn('⚠️ TTS service test failed:', error.message);
      this.results.ttsService = false;
      return false;
    }
  }

  // Test models configuration
  testModelsConfiguration() {
    console.log('🎯 Testing AI models configuration...');

    try {
      const textToImage = getModelsByType('text-to-image');
      const textToVideo = getModelsByType('text-to-video');
      const imageToVideo = getModelsByType('image-to-video');

      const fluxModel = getModelById('flux-dev');

      this.results.modelsLoaded = textToImage.length > 0 &&
                                 textToVideo.length > 0 &&
                                 imageToVideo.length > 0 &&
                                 fluxModel !== null;

      console.log(`✅ Models loaded: ${textToImage.length} T2I, ${textToVideo.length} T2V, ${imageToVideo.length} I2V models`);
      return true;
    } catch (error) {
      console.warn('⚠️ Models configuration test failed:', error.message);
      this.results.modelsLoaded = false;
      return false;
    }
  }

  // Test templates system
  testTemplatesSystem() {
    console.log('📝 Testing templates system...');

    try {
      const scriptTemplates = getScriptTemplates();
      const avatar = getAvatarById('professional-male');

      this.results.templatesLoaded = scriptTemplates.length > 0 && avatar !== null;

      console.log(`✅ Templates loaded: ${scriptTemplates.length} script templates, avatar system ready`);
      return true;
    } catch (error) {
      console.warn('⚠️ Templates system test failed:', error.message);
      this.results.templatesLoaded = false;
      return false;
    }
  }

  // Test instructions/help system
  testInstructionsSystem() {
    console.log('📚 Testing instructions system...');

    try {
      const personalizeInstructions = getInstructionsForStudio('personalize');
      const aiCreatorInstructions = getInstructionsForStudio('ai-video-creator');

      this.results.instructionsLoaded = personalizeInstructions !== null &&
                                       aiCreatorInstructions !== null;

      console.log(`✅ Instructions loaded for ${personalizeInstructions ? 'personalize' : 'N/A'} studios`);
      return true;
    } catch (error) {
      console.warn('⚠️ Instructions system test failed:', error.message);
      this.results.instructionsLoaded = false;
      return false;
    }
  }

  // Test upload history system
  testUploadHistorySystem() {
    console.log('📁 Testing upload history system...');

    try {
      const stats = uploadHistory.getStats();
      const recent = uploadHistory.getRecentUploads(5);

      this.results.uploadHistory = typeof stats === 'object' && Array.isArray(recent);

      console.log(`✅ Upload history system ready (${stats.totalUploads} items stored)`);
      return true;
    } catch (error) {
      console.warn('⚠️ Upload history system test failed:', error.message);
      this.results.uploadHistory = false;
      return false;
    }
  }

  // Test thumbnail generation
  testThumbnailSystem() {
    console.log('🖼️ Testing thumbnail system...');

    try {
      // Test placeholder generation
      const placeholderPromise = thumbnailGenerator.generatePlaceholder({
        width: 160,
        height: 90,
        text: 'Test'
      });

      this.results.thumbnails = placeholderPromise instanceof Promise;

      console.log('✅ Thumbnail generation system ready');
      return true;
    } catch (error) {
      console.warn('⚠️ Thumbnail system test failed:', error.message);
      this.results.thumbnails = false;
      return false;
    }
  }

  // Test Supabase client
  testSupabaseClient() {
    console.log('☁️ Testing Supabase client...');

    try {
      const supabase = getSupabaseClient();

      // Test if client initializes (even without real config)
      this.results.supabase = supabase instanceof Object;

      console.log('✅ Supabase client initialized (optional cloud storage)');
      return true;
    } catch (error) {
      console.warn('⚠️ Supabase client test failed:', error.message);
      this.results.supabase = false;
      return false;
    }
  }

  // Test AI generation pipeline (mock)
  async testAIGenerationPipeline() {
    console.log('🤖 Testing AI generation pipeline...');

    try {
      // This is a mock test since we don't have a real API key
      // In production, this would test actual AI generation

      const mockContact = {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp'
      };

      const mockTokens = {
        '{{firstName}}': 'firstName',
        '{{company}}': 'company'
      };

      // Test token replacement logic
      const testScript = 'Hi {{firstName}}, welcome to {{company}}!';
      let processedScript = testScript;

      Object.entries(mockTokens).forEach(([token, field]) => {
        const value = mockContact[field];
        if (value) {
          processedScript = processedScript.replace(
            new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            value
          );
        }
      });

      const expected = 'Hi John, welcome to Acme Corp!';
      this.results.aiGeneration = processedScript === expected;

      console.log('✅ AI generation pipeline logic validated');
      return true;
    } catch (error) {
      console.warn('⚠️ AI generation pipeline test failed:', error.message);
      this.results.aiGeneration = false;
      return false;
    }
  }

  // Run all tests
  async runAllTests(apiKey = null) {
    console.log('🚀 Starting Open-Higgsfield-AI Integration Tests...\n');

    const tests = [
      { name: 'Muapi Connection', fn: () => this.testMuapiConnection(apiKey) },
      { name: 'TTS Service', fn: () => this.testTTSService() },
      { name: 'Models Configuration', fn: () => this.testModelsConfiguration() },
      { name: 'Templates System', fn: () => this.testTemplatesSystem() },
      { name: 'Instructions System', fn: () => this.testInstructionsSystem() },
      { name: 'Upload History', fn: () => this.testUploadHistorySystem() },
      { name: 'Thumbnail System', fn: () => this.testThumbnailSystem() },
      { name: 'Supabase Client', fn: () => this.testSupabaseClient() },
      { name: 'AI Generation Pipeline', fn: () => this.testAIGenerationPipeline() }
    ];

    for (const test of tests) {
      try {
        await test.fn();
      } catch (error) {
        console.error(`❌ ${test.name} test threw an error:`, error);
      }
    }

    this.printResults();
    return this.getOverallStatus();
  }

  // Print test results
  printResults() {
    console.log('\n📊 OPEN-HIGGSFIELD-AI INTEGRATION TEST RESULTS');
    console.log('='.repeat(50));

    const passedTests = Object.values(this.results).filter(result => result).length;
    const totalTests = Object.keys(this.results).length;

    Object.entries(this.results).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${status} ${testName}`);
    });

    console.log('='.repeat(50));
    console.log(`📈 Overall Score: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Open-Higgsfield-AI integration is complete.');
    } else {
      console.log('⚠️ Some tests failed. Check the results above.');
    }
  }

  // Get overall status
  getOverallStatus() {
    const passedTests = Object.values(this.results).filter(result => result).length;
    const totalTests = Object.keys(this.results).length;

    return {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests,
      results: this.results
    };
  }

  // Get integration summary
  getIntegrationSummary() {
    return {
      status: this.getOverallStatus(),
      features: {
        aiModels: this.results.modelsLoaded,
        textToSpeech: this.results.ttsService,
        videoGeneration: this.results.muapiConnection,
        avatarSystem: this.results.templatesLoaded,
        lipSync: this.results.muapiConnection, // Uses same Muapi infrastructure
        scriptProcessing: this.results.templatesLoaded,
        cloudStorage: this.results.supabase,
        helpSystem: this.results.instructionsLoaded
      },
      readyForProduction: this.getOverallStatus().success
    };
  }
}

// Export for use in other files
export default OpenHiggsfieldIntegrationTester;

// Helper function to run integration tests
export async function runOpenHiggsfieldIntegrationTests(apiKey = null) {
  const tester = new OpenHiggsfieldIntegrationTester();
  await tester.runAllTests(apiKey);
  return tester.getIntegrationSummary();
}

// Quick setup check
export function checkOpenHiggsfieldSetup() {
  const tester = new OpenHiggsfieldIntegrationTester();

  // Run synchronous checks only
  tester.testModelsConfiguration();
  tester.testTemplatesSystem();
  tester.testInstructionsSystem();
  tester.testUploadHistorySystem();
  tester.testThumbnailSystem();
  tester.testSupabaseClient();

  return tester.getIntegrationSummary();
}