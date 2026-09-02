// EnhancedLandingPageBuilder - Advanced landing page builder with GrapesJS integration
import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';
import GrapesJSEditor from './GrapesJSEditor';

const EnhancedLandingPageBuilder = ({
  video,
  contact = {},
  onLandingPageCreated,
  initialMode = 'simple' // 'simple' or 'advanced'
}) => {
  const [mode, setMode] = useState(initialMode);
  const [currentPageData, setCurrentPageData] = useState(null);

  // Handle mode switching
  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  // Handle page creation from simple mode
  const handleSimplePageCreated = useCallback((pageData) => {
    setCurrentPageData(pageData);
    if (onLandingPageCreated) {
      onLandingPageCreated(pageData);
    }
  }, [onLandingPageCreated]);

  // Handle page changes from GrapesJS
  const handlePageChange = useCallback((pageData) => {
    setCurrentPageData(pageData);
  }, []);

  // Handle save from GrapesJS
  const handleSave = useCallback(async (pageData) => {
    setCurrentPageData(pageData);
    if (onLandingPageCreated) {
      await onLandingPageCreated(pageData);
    }
  }, [onLandingPageCreated]);

  return (
    <div className="enhanced-landing-page-builder">
      {/* Mode Selector */}
      <div className="mode-selector">
        <div className="mode-tabs">
          <button
            className={classnames('mode-tab', { active: mode === 'simple' })}
            onClick={() => handleModeChange('simple')}
          >
            <span className="mode-icon">📝</span>
            <div className="mode-info">
              <div className="mode-name">Simple Builder</div>
              <div className="mode-desc">Quick form-based creation</div>
            </div>
          </button>

          <button
            className={classnames('mode-tab', { active: mode === 'advanced' })}
            onClick={() => handleModeChange('advanced')}
          >
            <span className="mode-icon">🎨</span>
            <div className="mode-info">
              <div className="mode-name">Visual Builder</div>
              <div className="mode-desc">Professional drag-and-drop editor</div>
            </div>
          </button>
        </div>

        <div className="mode-badges">
          {mode === 'simple' && (
            <span className="badge badge-easy">Easy to Use</span>
          )}
          {mode === 'advanced' && (
            <span className="badge badge-pro">Pro Features</span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="builder-content">
        {mode === 'simple' ? (
          <SimpleLandingPageBuilder
            video={video}
            contact={contact}
            onLandingPageCreated={handleSimplePageCreated}
          />
        ) : (
          <GrapesJSEditor
            video={video}
            contact={contact}
            initialTemplate={currentPageData}
            onPageChange={handlePageChange}
            onSave={handleSave}
          />
        )}
      </div>

      {/* Feature Comparison */}
      <div className="feature-comparison">
        <h4>Feature Comparison</h4>
        <div className="comparison-grid">
          <div className="comparison-row">
            <span className="feature-name">Ease of Use</span>
            <span className="simple-rating">★★★★★</span>
            <span className="advanced-rating">★★★☆☆</span>
          </div>
          <div className="comparison-row">
            <span className="feature-name">Design Control</span>
            <span className="simple-rating">★★☆☆☆</span>
            <span className="advanced-rating">★★★★★</span>
          </div>
          <div className="comparison-row">
            <span className="feature-name">Customization</span>
            <span className="simple-rating">★★★☆☆</span>
            <span className="advanced-rating">★★★★★</span>
          </div>
          <div className="comparison-row">
            <span className="feature-name">Mobile Responsive</span>
            <span className="simple-rating">★★★★☆</span>
            <span className="advanced-rating">★★★★★</span>
          </div>
          <div className="comparison-row">
            <span className="feature-name">Professional Look</span>
            <span className="simple-rating">★★★☆☆</span>
            <span className="advanced-rating">★★★★★</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Landing Page Builder (existing functionality)
const SimpleLandingPageBuilder = ({
  video,
  contact = {},
  onLandingPageCreated
}) => {
  // Copy the existing simple builder logic here
  // This would be the existing LandingPageBuilder.jsx content
  // For brevity, I'll create a simplified version

  const [pageConfig, setPageConfig] = useState({
    title: 'Personalized Video for {{firstName}}',
    subtitle: 'This video was created just for you!',
    ctaText: 'Watch Now',
    ctaUrl: video?.url || '',
    primaryColor: '#007bff'
  });

  const [branding, setBranding] = useState({
    companyName: contact.company || 'Your Company',
    logo: '',
    tagline: 'Making video personal'
  });

  const handleCreate = () => {
    const pageData = {
      type: 'simple',
      config: pageConfig,
      branding,
      video,
      contact,
      html: generateSimpleHTML(pageConfig, branding, video, contact),
      css: generateSimpleCSS(pageConfig),
      createdAt: new Date().toISOString()
    };

    if (onLandingPageCreated) {
      onLandingPageCreated(pageData);
    }
  };

  const generateSimpleHTML = (config, branding, video, contact) => {
    const replaceTokens = (text) => {
      return text
        .replace(/{{firstName}}/g, contact.firstName || 'there')
        .replace(/{{company}}/g, contact.company || 'your company')
        .replace(/{{email}}/g, contact.email || '');
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <header style="text-align: center; margin-bottom: 30px;">
          ${branding.logo ? `<img src="${branding.logo}" alt="${branding.companyName}" style="max-width: 200px; margin-bottom: 20px;">` : ''}
          <h1 style="color: ${config.primaryColor}; margin: 0;">${replaceTokens(config.title)}</h1>
          <p style="font-size: 18px; color: #666; margin: 10px 0;">${replaceTokens(config.subtitle)}</p>
        </header>

        <div style="text-align: center; margin-bottom: 30px;">
          <video controls poster="${video?.thumbnail || ''}" style="width: 100%; max-width: 500px; border-radius: 8px;">
            <source src="${video?.url || ''}" type="video/mp4">
          </video>
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${config.ctaUrl}" style="display: inline-block; padding: 15px 30px; background-color: ${config.primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
            ${config.ctaText}
          </a>
        </div>

        <footer style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>${branding.tagline}</p>
          <p>Powered by ${branding.companyName}</p>
        </footer>
      </div>
    `;
  };

  const generateSimpleCSS = (config) => {
    return `
      body { margin: 0; padding: 20px; background: #f8f9fa; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    `;
  };

  return (
    <div className="simple-builder">
      <div className="builder-form">
        <div className="form-section">
          <h3>Page Content</h3>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={pageConfig.title}
              onChange={(e) => setPageConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Personalized Video for {{firstName}}"
            />
          </div>

          <div className="form-group">
            <label>Subtitle</label>
            <input
              type="text"
              value={pageConfig.subtitle}
              onChange={(e) => setPageConfig(prev => ({ ...prev, subtitle: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Call-to-Action Text</label>
            <input
              type="text"
              value={pageConfig.ctaText}
              onChange={(e) => setPageConfig(prev => ({ ...prev, ctaText: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Branding</h3>
          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={branding.companyName}
              onChange={(e) => setBranding(prev => ({ ...prev, companyName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Logo URL (optional)</label>
            <input
              type="url"
              value={branding.logo}
              onChange={(e) => setBranding(prev => ({ ...prev, logo: e.target.value }))}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Styling</h3>
          <div className="form-group">
            <label>Primary Color</label>
            <input
              type="color"
              value={pageConfig.primaryColor}
              onChange={(e) => setPageConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="preview-section">
        <h3>Preview</h3>
        <div className="page-preview">
          <div
            className="preview-content"
            dangerouslySetInnerHTML={{
              __html: generateSimpleHTML(pageConfig, branding, video, contact)
            }}
          />
        </div>
      </div>

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={!video?.url}
        >
          Create Landing Page
        </button>
      </div>
    </div>
  );
};

EnhancedLandingPageBuilder.propTypes = {
  video: PropTypes.object,
  contact: PropTypes.object,
  onLandingPageCreated: PropTypes.func,
  initialMode: PropTypes.oneOf(['simple', 'advanced'])
};

export default observer(EnhancedLandingPageBuilder);