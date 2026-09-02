// LandingPageBuilder - Create professional landing pages for personalized videos
import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';

const LandingPageBuilder = ({
  video,
  contact = {},
  onLandingPageCreated,
  availableTemplates = []
}) => {
  // Page state
  const [selectedTemplate, setSelectedTemplate] = useState('professional');
  const [pageConfig, setPageConfig] = useState({
    title: 'Personalized Video for {{firstName}}',
    subtitle: 'This video was created just for you!',
    ctaText: 'Schedule a Call',
    ctaUrl: 'https://calendly.com',
    showBranding: true,
    customColors: {
      primary: '#007bff',
      secondary: '#6c757d',
      background: '#ffffff',
      text: '#212529'
    }
  });

  // Branding state
  const [branding, setBranding] = useState({
    logo: '',
    companyName: 'Your Company',
    tagline: 'Making video personal',
    website: 'https://example.com'
  });

  // Preview state
  const [previewUrl, setPreviewUrl] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Templates
  const templates = [
    {
      id: 'professional',
      name: 'Professional',
      description: 'Clean, corporate design',
      preview: '🏢'
    },
    {
      id: 'modern',
      name: 'Modern',
      description: 'Contemporary, stylish layout',
      preview: '🎨'
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Simple, focused design',
      preview: '✨'
    },
    {
      id: 'bold',
      name: 'Bold',
      description: 'High-impact, attention-grabbing',
      preview: '🔥'
    }
  ];

  // Replace tokens in text
  const replaceTokens = useCallback((text) => {
    if (!text) return '';
    let result = text;
    Object.entries(contact).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || `[${key}]`);
    });
    return result;
  }, [contact]);

  // Update page config
  const updateConfig = useCallback((key, value) => {
    setPageConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // Update branding
  const updateBranding = useCallback((key, value) => {
    setBranding(prev => ({ ...prev, [key]: value }));
  }, []);

  // Update colors
  const updateColor = useCallback((colorKey, value) => {
    setPageConfig(prev => ({
      ...prev,
      customColors: { ...prev.customColors, [colorKey]: value }
    }));
  }, []);

  // Create landing page
  const createLandingPage = useCallback(async () => {
    setIsCreating(true);

    try {
      // Generate unique page ID
      const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create page configuration
      const pageData = {
        id: pageId,
        template: selectedTemplate,
        config: {
          ...pageConfig,
          title: replaceTokens(pageConfig.title),
          subtitle: replaceTokens(pageConfig.subtitle)
        },
        branding,
        video: {
          url: video?.url,
          thumbnail: video?.thumbnail
        },
        contact,
        createdAt: new Date().toISOString()
      };

      // Simulate page creation (in real implementation, this would save to backend)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate URLs
      const baseUrl = window.location.origin;
      const generatedShareUrl = `${baseUrl}/v/${pageId}`;
      const generatedPreviewUrl = `${baseUrl}/preview/${pageId}`;

      setShareUrl(generatedShareUrl);
      setPreviewUrl(generatedPreviewUrl);

      showSuccess('Landing page created successfully!');

      if (onLandingPageCreated) {
        onLandingPageCreated({
          ...pageData,
          shareUrl: generatedShareUrl,
          previewUrl: generatedPreviewUrl
        });
      }

    } catch (error) {
      console.error('Failed to create landing page:', error);
      showError('Failed to create landing page');
    } finally {
      setIsCreating(false);
    }
  }, [selectedTemplate, pageConfig, branding, video, contact, replaceTokens, onLandingPageCreated]);

  // Copy share URL to clipboard
  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    showSuccess('Share URL copied to clipboard!');
  }, [shareUrl]);

  // Generate embed code
  const generateEmbedCode = useCallback(() => {
    return `<iframe
  src="${shareUrl}"
  width="100%"
  height="600"
  frameborder="0"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>`;
  }, [shareUrl]);

  // Copy embed code
  const copyEmbedCode = useCallback(() => {
    navigator.clipboard.writeText(generateEmbedCode());
    showSuccess('Embed code copied to clipboard!');
  }, [generateEmbedCode]);

  return (
    <div className="landing-page-builder">
      <div className="builder-header">
        <h2>Landing Page Builder</h2>
        <p>Create a professional landing page for your personalized video</p>
      </div>

      <div className="builder-content">
        {/* Template Selection */}
        <div className="template-section">
          <h3>Select Template</h3>
          <div className="templates-grid">
            {templates.map(template => (
              <div
                key={template.id}
                className={classnames('template-card', { 'selected': selectedTemplate === template.id })}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="template-preview">{template.preview}</div>
                <div className="template-info">
                  <div className="template-name">{template.name}</div>
                  <div className="template-description">{template.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page Content */}
        <div className="content-section">
          <h3>Page Content</h3>
          <div className="form-group">
            <label>Page Title</label>
            <input
              type="text"
              value={pageConfig.title}
              onChange={(e) => updateConfig('title', e.target.value)}
              placeholder="Personalized Video for {{firstName}}"
            />
            <div className="token-hint">Use {'{{firstName}}'} for personalization</div>
          </div>

          <div className="form-group">
            <label>Subtitle</label>
            <input
              type="text"
              value={pageConfig.subtitle}
              onChange={(e) => updateConfig('subtitle', e.target.value)}
              placeholder="This video was created just for you!"
            />
          </div>

          <div className="form-group">
            <label>Call-to-Action Text</label>
            <input
              type="text"
              value={pageConfig.ctaText}
              onChange={(e) => updateConfig('ctaText', e.target.value)}
              placeholder="Schedule a Call"
            />
          </div>

          <div className="form-group">
            <label>Call-to-Action URL</label>
            <input
              type="url"
              value={pageConfig.ctaUrl}
              onChange={(e) => updateConfig('ctaUrl', e.target.value)}
              placeholder="https://calendly.com/your-link"
            />
          </div>
        </div>

        {/* Branding */}
        <div className="branding-section">
          <h3>Branding</h3>
          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={branding.companyName}
              onChange={(e) => updateBranding('companyName', e.target.value)}
              placeholder="Your Company"
            />
          </div>

          <div className="form-group">
            <label>Logo URL (optional)</label>
            <input
              type="url"
              value={branding.logo}
              onChange={(e) => updateBranding('logo', e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="form-group">
            <label>Tagline</label>
            <input
              type="text"
              value={branding.tagline}
              onChange={(e) => updateBranding('tagline', e.target.value)}
              placeholder="Making video personal"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="colors-section">
          <h3>Colors</h3>
          <div className="colors-grid">
            <div className="color-item">
              <label>Primary Color</label>
              <input
                type="color"
                value={pageConfig.customColors.primary}
                onChange={(e) => updateColor('primary', e.target.value)}
              />
            </div>
            <div className="color-item">
              <label>Background</label>
              <input
                type="color"
                value={pageConfig.customColors.background}
                onChange={(e) => updateColor('background', e.target.value)}
              />
            </div>
            <div className="color-item">
              <label>Text Color</label>
              <input
                type="color"
                value={pageConfig.customColors.text}
                onChange={(e) => updateColor('text', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Video Preview */}
        <div className="video-preview-section">
          <h3>Video Preview</h3>
          <div className="video-preview">
            {video?.url ? (
              <video
                src={video.url}
                controls
                className="preview-video"
              />
            ) : (
              <div className="no-video">
                <p>No video available</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="preview-section">
          <h3>Page Preview</h3>
          <div
            className="page-preview"
            style={{
              backgroundColor: pageConfig.customColors.background,
              color: pageConfig.customColors.text
            }}
          >
            <div className="preview-header">
              {branding.logo && (
                <img src={branding.logo} alt="Logo" className="preview-logo" />
              )}
              <div className="preview-company">{branding.companyName}</div>
            </div>

            <div className="preview-content">
              <h1 className="preview-title" style={{ color: pageConfig.customColors.primary }}>
                {replaceTokens(pageConfig.title)}
              </h1>
              <p className="preview-subtitle">{replaceTokens(pageConfig.subtitle)}</p>

              <div className="preview-video-container">
                {video?.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt="Video thumbnail"
                    className="preview-thumbnail"
                  />
                )}
              </div>

              <a
                href={pageConfig.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="preview-cta"
                style={{ backgroundColor: pageConfig.customColors.primary }}
              >
                {pageConfig.ctaText}
              </a>
            </div>

            <div className="preview-footer">
              <span>{branding.tagline}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="builder-actions">
        {!shareUrl ? (
          <button
            className="btn btn-primary create-btn"
            onClick={createLandingPage}
            disabled={isCreating || !video?.url}
          >
            {isCreating ? 'Creating...' : 'Create Landing Page'}
          </button>
        ) : (
          <div className="share-section">
            <div className="share-url">
              <label>Share URL</label>
              <div className="url-display">
                <input type="text" value={shareUrl} readOnly />
                <button onClick={copyShareUrl}>Copy</button>
              </div>
            </div>

            <div className="embed-section">
              <label>Embed Code</label>
              <textarea
                value={generateEmbedCode()}
                readOnly
                rows={3}
              />
              <button onClick={copyEmbedCode}>Copy Embed Code</button>
            </div>

            <div className="preview-actions">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                Preview Page
              </a>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShareUrl('');
                  setPreviewUrl('');
                }}
              >
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

LandingPageBuilder.propTypes = {
  video: PropTypes.object,
  contact: PropTypes.object,
  onLandingPageCreated: PropTypes.func,
  availableTemplates: PropTypes.array
};

export default observer(LandingPageBuilder);