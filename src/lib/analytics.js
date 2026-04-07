// Analytics service for tracking video engagement and user behavior
// Uses PostHog for event tracking and analytics - vanilla JS version

import posthog from 'posthog-js';

class AnalyticsService {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = {
      host: options.host || 'https://app.posthog.com',
      loaded: false,
      ...options
    };

    this.init();
  }

  // Initialize PostHog
  init() {
    if (typeof window !== 'undefined') {
      // Load PostHog script
      this.loadPostHog();
    }
  }

  // Load PostHog script dynamically
  loadPostHog() {
    if (this.options.loaded) return;

    try {
      // PostHog is imported at the top, so initialize directly
      posthog.init(this.apiKey, {
        api_host: this.options.host,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage',
        loaded: () => {
          this.options.loaded = true;
          console.log('PostHog analytics initialized');
        }
      });

      // Store reference for later use
      this.posthog = posthog;
    } catch (error) {
      console.warn('Failed to load PostHog:', error);
    }
  }

  // Track video events
  trackVideoEvent(eventType, properties = {}) {
    if (!this.posthog) return;

    const eventData = {
      video_id: properties.videoId,
      contact_id: properties.contactId,
      campaign_id: properties.campaignId,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      ...properties
    };

    this.posthog.capture(`video_${eventType}`, eventData);
  }

  // Video-specific tracking methods
  trackVideoPlay(videoId, contactId, metadata = {}) {
    this.trackVideoEvent('play', {
      videoId,
      contactId,
      ...metadata
    });
  }

  trackVideoPause(videoId, contactId, currentTime, metadata = {}) {
    this.trackVideoEvent('pause', {
      videoId,
      contactId,
      current_time: currentTime,
      ...metadata
    });
  }

  trackVideoComplete(videoId, contactId, watchTime, metadata = {}) {
    this.trackVideoEvent('complete', {
      videoId,
      contactId,
      watch_time: watchTime,
      completion_rate: metadata.duration ? (watchTime / metadata.duration) * 100 : null,
      ...metadata
    });
  }

  trackVideoSeek(videoId, contactId, fromTime, toTime, metadata = {}) {
    this.trackVideoEvent('seek', {
      videoId,
      contactId,
      from_time: fromTime,
      to_time: toTime,
      seek_distance: Math.abs(toTime - fromTime),
      ...metadata
    });
  }

  // Landing page tracking
  trackLandingPageView(pageId, contactId, campaignId, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('landing_page_view', {
      page_id: pageId,
      contact_id: contactId,
      campaign_id: campaignId,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      ...metadata
    });
  }

  trackLandingPageCTA(pageId, contactId, ctaType, ctaText, destination, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('landing_page_cta_click', {
      page_id: pageId,
      contact_id: contactId,
      cta_type: ctaType,
      cta_text: ctaText,
      destination,
      ...metadata
    });
  }

  // Campaign tracking
  trackCampaignView(campaignId, contactId, source, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('campaign_view', {
      campaign_id: campaignId,
      contact_id: contactId,
      source, // 'email', 'direct', 'social'
      ...metadata
    });
  }

  // User identification
  identifyUser(userId, traits = {}) {
    if (!this.posthog) return;

    this.posthog.identify(userId, traits);
  }

  // Custom event tracking
  trackEvent(eventName, properties = {}) {
    if (!this.posthog) return;

    this.posthog.capture(eventName, properties);
  }

  // Performance tracking
  trackPerformance(metric, value, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('performance_metric', {
      metric,
      value,
      timestamp: Date.now(),
      ...metadata
    });
  }

  // Error tracking
  trackError(error, context = {}) {
    if (!this.posthog) return;

    this.posthog.capture('error', {
      error_message: error.message,
      error_stack: error.stack,
      context,
      timestamp: Date.now()
    });
  }

  // Funnel analysis
  trackFunnelStep(stepName, stepNumber, funnelName, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('funnel_step', {
      step_name: stepName,
      step_number: stepNumber,
      funnel_name: funnelName,
      ...metadata
    });
  }

  // A/B testing
  trackABTest(testName, variant, userId, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('ab_test', {
      test_name: testName,
      variant,
      user_id: userId,
      ...metadata
    });
  }

  // Session tracking
  startSession(metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('session_start', {
      session_id: this.generateSessionId(),
      start_time: Date.now(),
      ...metadata
    });
  }

  endSession(sessionId, duration, metadata = {}) {
    if (!this.posthog) return;

    this.posthog.capture('session_end', {
      session_id: sessionId,
      duration,
      end_time: Date.now(),
      ...metadata
    });
  }

  // Utility methods
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if analytics is enabled
  isEnabled() {
    return this.options.loaded && this.posthog;
  }

  // Disable tracking (GDPR compliance)
  disable() {
    if (this.posthog) {
      this.posthog.opt_out_capturing();
    }
  }

  // Re-enable tracking
  enable() {
    if (this.posthog) {
      this.posthog.opt_in_capturing();
    }
  }
}

// Factory function to create analytics service
export function createAnalyticsService(apiKey, options = {}) {
  return new AnalyticsService(apiKey, options);
}

// Initialize function for easy setup
export function initAnalytics() {
  // Create default analytics service
  window.analyticsService = new AnalyticsService('phc_test_key', {
    host: 'https://app.posthog.com'
  });
}

// Export default
export default AnalyticsService;