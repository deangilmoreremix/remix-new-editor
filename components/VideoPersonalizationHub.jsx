// Personalizer Hub - Main component for video personalization platform
// Supports both overlay-based and AI-generated video creation (Sendspark-style)
import React, { useState, useEffect } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import ContactImporterModal from '../components/modals/ContactImporterModal';
import VideoUploader from '../components/VideoUploader';
import VideoPersonalizer from '../components/VideoPersonalizer';
import TokenEditor from '../components/TokenEditor';
import AIVideoCreator from '../components/AIVideoCreator';
import SendsparkWorkflow from '../components/SendsparkWorkflow';
import EnhancedLandingPageBuilder from '../components/EnhancedLandingPageBuilder';
import Sidebar from '../components/Sidebar';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';
import { initAnalytics, trackEvent, trackPageView } from '../lib/analytics';
import { createPerformanceService } from '../lib/performance';

const VideoPersonalizationHub = () => {
  const [mode, setMode] = useState('sendspark'); // 'sendspark', 'overlay', 'ai-generated', or 'landing-pages'
  const [activeTab, setActiveTab] = useState('contacts'); // contacts, overlay-upload, overlay-tokens, overlay-personalize, ai-create, sendspark-workflow, landing-builder
  const [baseVideo, setBaseVideo] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [tokens, setTokens] = useState({});
  const [showContactImporter, setShowContactImporter] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [performanceService] = useState(() => createPerformanceService({
    cacheEnabled: true,
    compressionEnabled: true,
    cdnEnabled: process.env.NEXT_PUBLIC_CDN_ENABLED === 'true',
    cdnUrl: process.env.NEXT_PUBLIC_CDN_URL
  }));

  // Initialize analytics and performance services
  useEffect(() => {
    initAnalytics();
    trackPageView('/personalize', 'Video Personalization Hub');

    // Start performance monitoring
    performanceService.startPerformanceMonitoring();
    performanceService.monitorMemoryUsage();

    // Register service worker for caching
    performanceService.registerServiceWorker();
  }, [performanceService]);

  // Available tabs based on selected mode
  const getTabsForMode = () => {
    if (mode === 'sendspark') {
      return [
        { id: 'sendspark-workflow', label: 'Sendspark Workflow', icon: 'sparkles' }
      ];
    } else if (mode === 'landing-pages') {
      return [
        { id: 'landing-builder', label: 'Landing Page Builder', icon: 'globe' }
      ];
    } else if (mode === 'ai-generated') {
      return [
        { id: 'contacts', label: 'Import Contacts', icon: 'users' },
        { id: 'ai-create', label: 'Create AI Videos', icon: 'robot' }
      ];
    } else {
      return [
        { id: 'contacts', label: 'Import Contacts', icon: 'users' },
        { id: 'overlay-upload', label: 'Upload Video', icon: 'video' },
        { id: 'overlay-tokens', label: 'Manage Tokens', icon: 'tag' },
        { id: 'overlay-personalize', label: 'Generate Videos', icon: 'play' }
      ];
    }
  };

  const tabs = getTabsForMode();

  const handleVideoSelected = (video) => {
    setBaseVideo(video);
    showSuccess('Video uploaded successfully!');
    trackEvent('video_uploaded', { mode, videoSize: video.size });
  };

  const handleContactsImported = (importedContacts) => {
    // Cache the imported contacts for performance
    const cacheKey = `contacts_${importedContacts.length}_${Date.now()}`;
    performanceService.setCache(cacheKey, importedContacts, 3600000); // Cache for 1 hour

    setContacts(importedContacts);
    showSuccess(`Imported ${importedContacts.length} contacts`);
    setShowContactImporter(false);
    trackEvent('contacts_imported', { count: importedContacts.length, mode, cached: true });

    // Auto-advance to tokens tab if video is already uploaded
    if (baseVideo) {
      setActiveTab('tokens');
    }
  };

  const handleTokensChange = (updatedTokens) => {
    setTokens(updatedTokens);
  };

  const handleVideoGenerationComplete = async (videos) => {
    // Optimize videos for performance
    const optimizedVideos = await Promise.all(
      videos.map(async (video) => {
        if (video.blob) {
          const optimized = await performanceService.optimizeVideo(video.blob, {
            quality: 'medium',
            maxWidth: 1280,
            maxHeight: 720
          });
          return { ...video, optimized };
        }
        return video;
      })
    );

    setGeneratedVideos(optimizedVideos);
    showSuccess(`Generated and optimized ${optimizedVideos.length} personalized videos!`);
    trackEvent('videos_generated', { count: optimizedVideos.length, mode, totalContacts: contacts.length, optimized: true });
  };

  const canProceedToPersonalize = () => {
    return baseVideo && contacts.length > 0;
  };

  const handleModeChange = (newMode) => {
    trackEvent('mode_changed', { fromMode: mode, toMode: newMode });
    setMode(newMode);
    setActiveTab('contacts'); // Reset to contacts tab when changing modes
    setBaseVideo(null); // Clear base video when switching modes
    setTokens({}); // Reset tokens
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contacts':
        return (
          <div className="tab-content">
            <div className="contacts-section">
              <div className="section-header">
                <h2 className="section-title">Contact Management</h2>
                <p className="section-subtitle">
                  Import and manage contacts for personalized video generation
                </p>
              </div>

              {contacts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-content">
                    <h3>No contacts imported yet</h3>
                    <p>Upload a CSV file with your contact information to get started</p>
                    <button
                      className="primary-btn"
                      onClick={() => setShowContactImporter(true)}
                    >
                      Import Contacts
                    </button>
                  </div>
                </div>
              ) : (
                <div className="contacts-overview">
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-number">{contacts.length}</div>
                      <div className="stat-label">Total Contacts</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">
                        {contacts.filter(c => c.email).length}
                      </div>
                      <div className="stat-label">With Email</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">
                        {contacts.filter(c => c.company).length}
                      </div>
                      <div className="stat-label">With Company</div>
                    </div>
                  </div>

                  <div className="contacts-preview">
                    <h4>Recent Contacts</h4>
                    <div className="contacts-table">
                      <div className="table-header">
                        <div className="col">Name</div>
                        <div className="col">Email</div>
                        <div className="col">Company</div>
                      </div>
                      {contacts.slice(0, 5).map((contact, index) => (
                        <div key={index} className="table-row">
                          <div className="col">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="col">{contact.email}</div>
                          <div className="col">{contact.company || '-'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="contacts-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => setShowContactImporter(true)}
                    >
                      Import More Contacts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'tokens':
        return (
          <div className="tab-content">
            <TokenEditor
              onTokensChange={handleTokensChange}
              initialTokens={tokens}
            />
          </div>
        );

      case 'overlay-upload':
        return (
          <div className="tab-content">
            <VideoUploader
              onVideoSelected={handleVideoSelected}
              maxFileSize={500}
              acceptedFormats={['mp4', 'mov', 'avi', 'webm']}
            />
          </div>
        );

      case 'overlay-tokens':
        return (
          <div className="tab-content">
            <TokenEditor
              onTokensChange={handleTokensChange}
              initialTokens={tokens}
            />
          </div>
        );

      case 'overlay-personalize':
        return (
          <div className="tab-content">
            <VideoPersonalizer
              baseVideo={baseVideo}
              contacts={contacts}
              tokens={tokens}
              onVideoGenerated={handleVideoGenerationComplete}
              onProgressUpdate={(progress, videos) => setGeneratedVideos(videos)}
            />
          </div>
        );

      case 'ai-create':
        return (
          <div className="tab-content">
            <AIVideoCreator
              contacts={contacts}
              onVideoGenerated={handleVideoGenerationComplete}
              onProgressUpdate={(progress, videos) => setGeneratedVideos(videos)}
            />
          </div>
        );

      case 'sendspark-workflow':
        return (
          <div className="tab-content">
            <SendsparkWorkflow
              apiKey="" // API key should be passed from settings
              onWorkflowComplete={handleVideoGenerationComplete}
            />
          </div>
        );

      case 'landing-builder':
        return (
          <div className="tab-content">
            <EnhancedLandingPageBuilder
              video={baseVideo}
              contact={contacts.length > 0 ? contacts[0] : {}}
              onLandingPageCreated={(pageData) => {
                showSuccess('Landing page created successfully!');
                console.log('Landing page created:', pageData);
                // Here you could save the page data to a database
                // or show a preview modal
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="video-personalization-hub">
      <div className="hub-sidebar">
        <div className="sidebar-header">
          <h1 className="hub-title">Video Personalizer</h1>
          <p className="hub-subtitle">Sendspark-style video personalization platform</p>
        </div>

        {/* Mode Selector */}
        <div className="mode-selector">
          <h3 className="mode-title">Creation Mode</h3>
          <div className="mode-options">
            <button
              className={classnames('mode-btn', { 'active': mode === 'sendspark' })}
              onClick={() => handleModeChange('sendspark')}
            >
              <div className="mode-icon">✨</div>
              <div className="mode-info">
                <h4>Sendspark Workflow (Recommended)</h4>
                <p>Record once, personalize for each contact with voice cloning</p>
              </div>
            </button>
            <button
              className={classnames('mode-btn', { 'active': mode === 'overlay' })}
              onClick={() => handleModeChange('overlay')}
            >
              <div className="mode-icon">🎬</div>
              <div className="mode-info">
                <h4>Overlay Personalization</h4>
                <p>Replace text in existing videos</p>
              </div>
            </button>
            <button
              className={classnames('mode-btn', { 'active': mode === 'ai-generated' })}
              onClick={() => handleModeChange('ai-generated')}
            >
              <div className="mode-icon">🤖</div>
              <div className="mode-info">
                <h4>AI Video Generation</h4>
                <p>Create videos from scratch with AI avatars</p>
              </div>
            </button>
            <button
              className={classnames('mode-btn', { 'active': mode === 'landing-pages' })}
              onClick={() => handleModeChange('landing-pages')}
            >
              <div className="mode-icon">🌐</div>
              <div className="mode-info">
                <h4>Landing Page Builder</h4>
                <p>Create professional pages for your personalized videos</p>
              </div>
            </button>
          </div>
        </div>

        <div className="sidebar-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={classnames('nav-item', {
                'active': activeTab === tab.id,
                'disabled': (tab.id === 'overlay-personalize' && !canProceedToPersonalize()) ||
                           (tab.id === 'ai-create' && contacts.length === 0)
              })}
              onClick={() => setActiveTab(tab.id)}
              disabled={(tab.id === 'overlay-personalize' && !canProceedToPersonalize()) ||
                       (tab.id === 'ai-create' && contacts.length === 0)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
              {tab.id === 'contacts' && contacts.length > 0 && (
                <span className="nav-badge">{contacts.length}</span>
              )}
              {(tab.id === 'overlay-personalize' || tab.id === 'ai-create') && generatedVideos.length > 0 && (
                <span className="nav-badge">{generatedVideos.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-status">
          {mode === 'sendspark' && (
            <>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': baseVideo })}></span>
                <span>Recording</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': contacts.length > 0 })}></span>
                <span>Contacts</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': generatedVideos.length > 0 })}></span>
                <span>Generated</span>
              </div>
            </>
          )}
          {mode === 'overlay' && (
            <>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': contacts.length > 0 })}></span>
                <span>Contacts</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': baseVideo })}></span>
                <span>Base Video</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': Object.keys(tokens).length > 0 })}></span>
                <span>Tokens</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': generatedVideos.length > 0 })}></span>
                <span>Generated Videos</span>
              </div>
            </>
          )}
          {mode === 'ai-generated' && (
            <>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': contacts.length > 0 })}></span>
                <span>Contacts</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': true })}></span>
                <span>AI Services</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': true })}></span>
                <span>Avatar & Voice</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': generatedVideos.length > 0 })}></span>
                <span>Generated Videos</span>
              </div>
            </>
          )}
          {mode === 'landing-pages' && (
            <>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': baseVideo })}></span>
                <span>Video</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': contacts.length > 0 })}></span>
                <span>Contact</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': true })}></span>
                <span>GrapesJS Editor</span>
              </div>
              <div className="status-item">
                <span className={classnames('status-dot', { 'complete': false })}></span>
                <span>Landing Page</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="hub-content">
        {renderTabContent()}
      </div>

      {showContactImporter && (
        <ContactImporterModal
          handleClose={() => setShowContactImporter(false)}
          onContactsImported={handleContactsImported}
        />
      )}
    </div>
  );
};

export default observer(VideoPersonalizationHub);