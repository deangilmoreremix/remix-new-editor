// Main entry point for the vanilla JS video personalization platform
import Router from './lib/router.js';
import App from './components/App.js';
import { initAnalytics } from './lib/analytics.js';
import { createPerformanceService } from './lib/performance.js';
import VideoCreationEngine from './lib/VideoCreationEngine.js';

// Initialize services
const performanceService = createPerformanceService({
  cacheEnabled: true,
  compressionEnabled: true,
  cdnEnabled: false, // Can be enabled via environment
});

// Initialize analytics
initAnalytics();

// Initialize performance monitoring
performanceService.startPerformanceMonitoring();
performanceService.monitorMemoryUsage();

// Global video creation engine instance
let videoEngine = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const app = new App({
    performanceService,
    router: Router,
    onComponentsReady: (components) => {
      // Initialize video creation engine when components are ready
      videoEngine = new VideoCreationEngine({
        canvas: components.canvas,
        timeline: components.timeline,
        sidebar: components.sidebar,
        analytics: window.analyticsService,
        performance: performanceService,
        onProgress: (progress) => {
          console.log(`Video render progress: ${progress.toFixed(1)}%`);
          // Update UI progress indicators
          updateRenderProgress(progress);
        },
        onComplete: (videoBlob, contactData) => {
          console.log('Video render completed!', videoBlob);
          handleVideoComplete(videoBlob, contactData);
        },
        onError: (error) => {
          console.error('Video render failed:', error);
          handleVideoError(error);
        }
      });

      // Make engine globally available
      window.videoEngine = videoEngine;
    }
  });

  app.init();
});

// Progress update handler
function updateRenderProgress(progress) {
  // Update progress bars in UI
  const progressBars = document.querySelectorAll('.render-progress');
  progressBars.forEach(bar => {
    bar.style.width = `${progress}%`;
    bar.textContent = `${progress.toFixed(1)}%`;
  });

  const progressTexts = document.querySelectorAll('.render-progress-text');
  progressTexts.forEach(text => {
    text.textContent = `Rendering video... ${progress.toFixed(1)}%`;
  });
}

// Video completion handler
function handleVideoComplete(videoBlob, contactData) {
  // Create download link
  const url = URL.createObjectURL(videoBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personalized-video-${contactData.firstName || 'video'}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show success message
  alert(`Video generated successfully for ${contactData.firstName || 'contact'}!`);

  // Track analytics
  if (window.analyticsService) {
    window.analyticsService.trackEvent('video_downloaded', {
      contactId: contactData.id,
      fileSize: videoBlob.size
    });
  }
}

// Error handler
function handleVideoError(error) {
  alert(`Video generation failed: ${error.message}`);
  console.error('Video generation error:', error);
}