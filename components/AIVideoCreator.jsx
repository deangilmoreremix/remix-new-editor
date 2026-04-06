// AI Video Creator Component - Uses Open-Higgsfield-AI for avatar generation
import React, { useState, useEffect } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { showError, showSuccess } from '../../lib/services/alertService';
import { createPersonalizedVideo } from '../../lib/videoPersonalizationEngine.js';
import { getMuapiClient } from '../../lib/muapi.js';
import { getTTSService } from '../../lib/ttsService.js';
import { AVATAR_TEMPLATES, SCRIPT_TEMPLATES } from '../../lib/templates.js';

import scriptIcon from '../../public/static/svgImages/script.svg';
import avatarIcon from '../../public/static/svgImages/avatar.svg';
import voiceIcon from '../../public/static/svgImages/voice.svg';
import videoIcon from '../../public/static/svgImages/video.svg';

const AIVideoCreator = ({
  contacts,
  onVideoGenerated,
  onProgressUpdate
}) => {
  const [activeStep, setActiveStep] = useState(1); // 1: Script, 2: Avatar, 3: Voice, 4: Generate
  const [script, setScript] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('professional-male');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [avatarPreviews, setAvatarPreviews] = useState({}); // Store generated avatar images
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  // Use Higgsfield avatar templates
  const avatars = AVATAR_TEMPLATES;

  // Available voices
  const voices = [
    { id: 'professional-male', name: 'Professional Male', provider: 'openai', voice: 'alloy' },
    { id: 'professional-female', name: 'Professional Female', provider: 'openai', voice: 'shimmer' },
    { id: 'friendly-male', name: 'Friendly Male', provider: 'openai', voice: 'echo' },
    { id: 'friendly-female', name: 'Friendly Female', provider: 'openai', voice: 'nova' }
  ];

  // Generate avatar preview using Higgsfield AI (Flux)
  const generateAvatarPreview = async (avatar) => {
    if (!apiKey) {
      showError('Please enter your API key first');
      return;
    }

    if (avatarPreviews[avatar.id]) {
      return; // Already generated
    }

    setIsGeneratingAvatar(true);
    
    try {
      const muapi = getMuapiClient(apiKey);
      
      // Use the avatar's prompt from Higgsfield templates
      const result = await muapi.generateImage({
        model: 'flux-dev',
        prompt: avatar.prompt,
        aspect_ratio: '1:1',
        resolution: '1024x1024'
      });

      setAvatarPreviews(prev => ({
        ...prev,
        [avatar.id]: result.url
      }));
      
    } catch (error) {
      console.error('Avatar generation failed:', error);
      showError('Failed to generate avatar preview');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // Handle avatar selection
  const handleAvatarSelect = async (avatar) => {
    setSelectedAvatar(avatar);
    
    // Generate preview if not already done
    if (!avatarPreviews[avatar.id] && apiKey) {
      await generateAvatarPreview(avatar);
    }
  };

  // Use Higgsfield script templates
  const scriptTemplates = SCRIPT_TEMPLATES.filter(t => t.category === 'sales').slice(0, 3) || [
    {
      name: 'Sales Introduction',
      template: `Hi {{firstName}},

I'm {{myName}} from {{myCompany}}. I wanted to personally reach out about our solution that helps companies like {{company}} increase productivity by 40%.

Would you be available for a quick 15-minute call next week to discuss how we can help {{company}} achieve similar results?

Best regards,
{{myName}}`
    },
    {
      name: 'Follow-up Email',
      template: `Hi {{firstName}},

I wanted to follow up on my previous message about our services. I noticed {{company}} is doing great work in {{industry}}.

Our clients typically see a 30% improvement in their key metrics within the first 3 months. I'd love to show you how this could work for {{company}}.

Are you available for a brief call?

Best,
{{myName}}`
    },
    {
      name: 'Personalized Outreach',
      template: `Hello {{firstName}},

I came across {{company}} and was impressed by your work in {{industry}}. As {{myTitle}} at {{myCompany}}, I understand the challenges you face.

We've helped similar companies overcome these challenges and achieve remarkable results. I'd be interested in learning more about {{company}}'s goals.

Would you have 10 minutes to chat?

Warm regards,
{{myName}}`
    }
  ];

  const handleNext = () => {
    if (activeStep < 4) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleGenerateVideos = async () => {
    if (!apiKey.trim()) {
      showError('Please enter your AI API key');
      return;
    }

    if (!script.trim()) {
      showError('Please enter a script');
      return;
    }

    if (!selectedAvatar) {
      showError('Please select an avatar');
      return;
    }

    if (contacts.length === 0) {
      showError('Please import contacts first');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      const videos = [];

      // Ensure avatar image is generated
      let avatarImageUrl = avatarPreviews[selectedAvatar.id];
      if (!avatarImageUrl) {
        showError('Please wait for avatar preview to generate');
        setIsGenerating(false);
        return;
      }

      // Create enhanced avatar object with generated image
      const enhancedAvatar = {
        ...selectedAvatar,
        imageUrl: avatarImageUrl
      };

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        try {
          console.log(`Generating AI video for ${contact.email} using Higgsfield...`);

          const result = await createPersonalizedVideo(null, contact, {
            '{{firstName}}': 'firstName',
            '{{lastName}}': 'lastName',
            '{{company}}': 'company',
            '{{email}}': 'email',
            '{{myName}}': 'John Smith',
            '{{myCompany}}': 'Tech Solutions Inc',
            '{{myTitle}}': 'Sales Director',
            '{{industry}}': 'industry'
          }, {
            mode: 'ai-generated',
            script: script,
            avatar: enhancedAvatar,
            apiKey: apiKey
          });

          videos.push(result);

          const currentProgress = ((i + 1) / contacts.length) * 100;
          setProgress(currentProgress);

          if (onProgressUpdate) {
            onProgressUpdate(currentProgress, videos);
          }

        } catch (error) {
          console.error(`Failed to generate video for ${contact.email}:`, error);
          videos.push({
            contact: contact,
            status: 'failed',
            error: error.message
          });
        }
      }

      setGeneratedVideos(videos);
      setIsGenerating(false);
      showSuccess(`Generated ${videos.filter(v => v.status === 'completed').length} AI videos!`);

      if (onVideoGenerated) {
        onVideoGenerated(videos);
      }

    } catch (error) {
      console.error('AI video generation failed:', error);
      showError('Video generation failed: ' + error.message);
      setIsGenerating(false);
    }
  };

  const applyTemplate = (template) => {
    setScript(template.template);
  };

  const steps = [
    { id: 1, name: 'Script', icon: scriptIcon, description: 'Write your personalized message' },
    { id: 2, name: 'Avatar', icon: avatarIcon, description: 'Choose your AI presenter' },
    { id: 3, name: 'Voice', icon: voiceIcon, description: 'Select voice style' },
    { id: 4, name: 'Generate', icon: videoIcon, description: 'Create AI videos' }
  ];

  return (
    <div className="ai-video-creator">
      {/* Header */}
      <div className="creator-header">
        <h2 className="creator-title">AI Video Creator</h2>
        <p className="creator-subtitle">
          Create personalized videos from scratch using AI avatars and voice synthesis
        </p>
      </div>

      {/* API Key Input */}
      <div className="api-key-section">
        <label className="api-key-label">
          AI API Key (Muapi.ai):
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Muapi.ai API key"
            className="api-key-input"
          />
        </label>
        <p className="api-key-help">
          Get your API key from <a href="https://muapi.ai" target="_blank" rel="noopener noreferrer">muapi.ai</a>
        </p>
      </div>

      {/* Progress Steps */}
      <div className="steps-container">
        {steps.map((step) => (
          <div
            key={step.id}
            className={classnames('step-item', {
              'active': activeStep === step.id,
              'completed': activeStep > step.id
            })}
          >
            <div className="step-icon">
              <SVGInline svg={step.icon} />
            </div>
            <div className="step-content">
              <h4 className="step-name">{step.name}</h4>
              <p className="step-description">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="step-content-container">
        {activeStep === 1 && (
          <div className="script-step">
            <h3>Write Your Script</h3>
            <p>Use tokens like {{firstName}}, {{company}} for personalization</p>

            {/* Template Buttons */}
            <div className="template-buttons">
              <h4>Choose a template:</h4>
              {scriptTemplates.map((template, index) => (
                <button
                  key={index}
                  className="template-btn"
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
                </button>
              ))}
            </div>

            {/* Script Editor */}
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Enter your personalized script here..."
              className="script-editor"
              rows={12}
            />

            {/* Token Help */}
            <div className="token-help">
              <h4>Available Tokens:</h4>
              <div className="token-grid">
                <span className="token">{{firstName}}</span>
                <span className="token">{{lastName}}</span>
                <span className="token">{{company}}</span>
                <span className="token">{{email}}</span>
                <span className="token">{{industry}}</span>
                <span className="token">{{myName}}</span>
                <span className="token">{{myCompany}}</span>
                <span className="token">{{myTitle}}</span>
              </div>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="avatar-step">
            <h3>Choose Your AI Avatar</h3>
            <p>Select the presenter that best fits your message. Powered by Higgsfield AI.</p>

            {!apiKey && (
              <div className="api-key-notice">
                <p>⚠️ Please enter your API key above to generate AI avatar previews</p>
              </div>
            )}

            {apiKey && Object.keys(avatarPreviews).length < avatars.length && (
              <button 
                className="generate-all-avatars-btn"
                onClick={async () => {
                  for (const avatar of avatars) {
                    if (!avatarPreviews[avatar.id]) {
                      await generateAvatarPreview(avatar);
                    }
                  }
                }}
                disabled={isGeneratingAvatar}
              >
                {isGeneratingAvatar ? 'Generating Avatars...' : '✨ Generate All Avatar Previews'}
              </button>
            )}

            <div className="avatar-grid">
              {avatars.map((avatar) => (
                <div
                  key={avatar.id}
                  className={classnames('avatar-card', {
                    'selected': selectedAvatar?.id === avatar.id
                  })}
                  onClick={() => handleAvatarSelect(avatar)}
                >
                  <div className="avatar-preview">
                    {avatarPreviews[avatar.id] ? (
                      <img 
                        src={avatarPreviews[avatar.id]} 
                        alt={avatar.name}
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {isGeneratingAvatar && selectedAvatar?.id === avatar.id ? (
                          <span className="generating-text">Generating...</span>
                        ) : (
                          <span className="avatar-emoji">
                            {avatar.gender === 'male' ? '👤' : '👩'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="avatar-info">
                    <h4 className="avatar-name">{avatar.name}</h4>
                    <p className="avatar-description">{avatar.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="voice-step">
            <h3>Select Voice Style</h3>
            <p>Choose how your AI presenter will sound</p>

            <div className="voice-options">
              {voices.map((voice) => (
                <div
                  key={voice.id}
                  className={classnames('voice-option', {
                    'selected': selectedVoice === voice.id
                  })}
                  onClick={() => setSelectedVoice(voice.id)}
                >
                  <div className="voice-info">
                    <h4 className="voice-name">{voice.name}</h4>
                    <p className="voice-provider">{voice.provider}</p>
                  </div>
                  <button className="preview-btn">Preview</button>
                </div>
              ))}
            </div>

            {/* Script Preview */}
            <div className="script-preview">
              <h4>Script Preview:</h4>
              <div className="preview-content">
                {script || 'Enter a script to see preview...'}
              </div>
            </div>
          </div>
        )}

        {activeStep === 4 && (
          <div className="generate-step">
            <h3>Generate AI Videos</h3>
            <p>Create personalized videos for {contacts.length} contacts</p>

            {/* Generation Settings Summary */}
            <div className="generation-summary">
              <div className="summary-item">
                <span className="summary-label">Contacts:</span>
                <span className="summary-value">{contacts.length}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Avatar:</span>
                <span className="summary-value">{selectedAvatar?.name || 'None'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Voice:</span>
                <span className="summary-value">{voices.find(v => v.id === selectedVoice)?.name || 'None'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Script Length:</span>
                <span className="summary-value">{script.length} characters</span>
              </div>
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {Math.round(progress)}% Complete
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              className={classnames('generate-btn', { 'loading': isGenerating })}
              onClick={handleGenerateVideos}
              disabled={isGenerating || contacts.length === 0}
            >
              {isGenerating ? 'Generating Videos...' : `Generate ${contacts.length} AI Videos`}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="step-navigation">
        <button
          className="nav-btn back-btn"
          onClick={handleBack}
          disabled={activeStep === 1}
        >
          Back
        </button>

        <div className="step-indicator">
          Step {activeStep} of 4
        </div>

        <button
          className="nav-btn next-btn"
          onClick={handleNext}
          disabled={activeStep === 4}
        >
          Next
        </button>
      </div>
    </div>
  );
};

AIVideoCreator.propTypes = {
  contacts: PropTypes.array.isRequired,
  onVideoGenerated: PropTypes.func,
  onProgressUpdate: PropTypes.func
};

export default AIVideoCreator;

// Additional styles for Higgsfield avatar integration
const additionalStyles = `
  .api-key-notice {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 20px;
  }

  .api-key-notice p {
    margin: 0;
    color: #856404;
  }

  .generate-all-avatars-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 20px;
    transition: all 0.2s;
  }

  .generate-all-avatars-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .generate-all-avatars-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
    border-radius: 8px;
  }

  .generating-text {
    font-size: 12px;
    color: #666;
  }

  .avatar-card {
    transition: all 0.2s;
  }

  .avatar-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
`;