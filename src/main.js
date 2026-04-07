// Main entry point for the vanilla JS video personalization platform
import Router from './lib/router.js';
import App from './components/App.js';
import { initAnalytics } from './lib/analytics.js';
import { createPerformanceService } from './lib/performance.js';

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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const app = new App({
    performanceService,
    router: Router
  });

  app.init();
});