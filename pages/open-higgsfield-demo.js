// Demo Page - SmartVideo Integration Showcase
// Complete demonstration of all AI video personalization features

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import classnames from 'classnames';

import { getMuapiClient } from '../lib/muapi.js';
import { getTTSService } from '../lib/ttsService.js';
import { getVideoEnhancementService } from '../lib/videoEnhancementService.js';
import { getModelsByType } from '../lib/models.js';
import { SCRIPT_TEMPLATES, AVATAR_TEMPLATES } from '../lib/templates.js';

const SmartVideoDemo = () => {
  const [activeDemo, setActiveDemo] = useState('overview');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [demoResults, setDemoResults] = useState({});

  // Demo sections
  const demos = [
    { id: 'overview', name: 'Overview', icon: '🎯' },
    { id: 'models', name: 'AI Models', icon: '🤖' },
    { id: 'tts', name: 'Text-to-Speech', icon: '🗣️' },
    { id: 'avatars', name: 'AI Avatars', icon: '👤' },
    { id: 'enhancement', name: 'Video Enhancement', icon: '✨' },
    { id: 'integration', name: 'Integration Status', icon: '🔗' }
  ];

  // Render overview section
  const renderOverview = () => (
    <div className="demo-section">
      <h2>🎯 SmartVideo Integration Overview</h2>
      <p className="section-description">
        Complete Sendspark-style video personalization platform with AI-powered video generation,
        neural text-to-speech, and professional avatar creation.
      </p>

      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">🎬</div>
          <h3>AI Video Generation</h3>
          <p>Create professional videos from text scripts using 200+ AI models</p>
          <ul>
            <li>Text-to-Video (40+ models)</li>
            <li>Image-to-Video (60+ models)</li>
            <li>Lip-sync technology</li>
            <li>Professional cinematography</li>
          </ul>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🗣️</div>
          <h3>Neural Text-to-Speech</h3>
          <p>Natural voice synthesis with multiple providers and languages</p>
          <ul>
            <li>OpenAI TTS (6 voices)</li>
            <li>ElevenLabs (premium + cloning)</li>
            <li>Azure TTS (enterprise)</li>
            <li>40+ languages supported</li>
          </ul>
        </div>

        <div className="feature-card">
          <div className="feature-icon">👤</div>
          <h3>AI Avatar System</h3>
          <p>Professional avatar generation with emotional expressions</p>
          <ul>
            <li>8 avatar styles</li>
            <li>Emotional context analysis</li>
            <li>Industry-specific selection</li>
            <li>Dynamic scene backgrounds</li>
          </ul>
        </div>

        <div className="feature-card">
          <div className="feature-icon">✨</div>
          <h3>Video Enhancement</h3>
          <p>AI-powered video quality improvements</p>
          <ul>
            <li>AI upscaling (2x-4x)</li>
            <li>Color grading</li>
            <li>Noise reduction</li>
            <li>Sharpness enhancement</li>
          </ul>
        </div>
      </div>

      <div className="api-key-section">
        <h3>🔑 API Configuration</h3>
        <p>Enter your Muapi.ai API key to enable AI features:</p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Muapi.ai API key"
          className="api-key-input"
        />
        <p className="api-help">
          Get your API key from <a href="https://muapi.ai" target="_blank" rel="noopener noreferrer">muapi.ai</a>
        </p>
      </div>
    </div>
  );

  // Render AI Models section
  const renderModels = () => {
    const textToImage = getModelsByType('text-to-image');
    const textToVideo = getModelsByType('text-to-video');
    const imageToVideo = getModelsByType('image-to-video');

    return (
      <div className="demo-section">
        <h2>🤖 Available AI Models</h2>
        <p className="section-description">
          200+ state-of-the-art AI models for video and image generation
        </p>

        <div className="models-container">
          <div className="model-category">
            <h3>Text-to-Image ({textToImage.length} models)</h3>
            <div className="model-list">
              {textToImage.slice(0, 6).map(model => (
                <div key={model.id} className="model-item">
                  <span className="model-name">{model.name}</span>
                  <span className="model-provider">{model.provider}</span>
                  <span className="model-res">{model.maxResolution}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="model-category">
            <h3>Text-to-Video ({textToVideo.length} models)</h3>
            <div className="model-list">
              {textToVideo.slice(0, 6).map(model => (
                <div key={model.id} className="model-item">
                  <span className="model-name">{model.name}</span>
                  <span className="model-provider">{model.provider}</span>
                  <span className="model-duration">{model.maxDuration}s</span>
                </div>
              ))}
            </div>
          </div>

          <div className="model-category">
            <h3>Image-to-Video ({imageToVideo.length} models)</h3>
            <div className="model-list">
              {imageToVideo.slice(0, 6).map(model => (
                <div key={model.id} className="model-item">
                  <span className="model-name">{model.name}</span>
                  <span className="model-provider">{model.provider}</span>
                  <span className="model-duration">{model.maxDuration}s</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render TTS section
  const renderTTS = () => {
    const tts = getTTSService({ provider: 'openai' });
    const voices = tts.getAvailableVoices();

    return (
      <div className="demo-section">
        <h2>🗣️ Text-to-Speech Providers</h2>
        <p className="section-description">
          Multiple TTS providers with natural voice synthesis and voice cloning
        </p>

        <div className="tts-providers">
          <div className="provider-card">
            <h3>OpenAI TTS</h3>
            <p>High-quality neural voices</p>
            <div className="voice-list">
              {voices.filter(v => !v.quality || v.quality === 'high').map(voice => (
                <span key={voice.id} className="voice-tag">{voice.name}</span>
              ))}
            </div>
          </div>

          <div className="provider-card">
            <h3>ElevenLabs</h3>
            <p>Premium voices with cloning</p>
            <div className="voice-list">
              <span className="voice-tag premium">Adam (Professional)</span>
              <span className="voice-tag premium">Bella (Friendly)</span>
              <span className="voice-tag premium">Antoni (Enthusiastic)</span>
              <span className="voice-tag premium">Custom Voice Cloning</span>
            </div>
          </div>

          <div className="provider-card">
            <h3>Azure TTS</h3>
            <p>Enterprise-grade speech</p>
            <div className="voice-list">
              <span className="voice-tag">Brian (Professional)</span>
              <span className="voice-tag">Zira (Professional)</span>
              <span className="voice-tag">40+ Languages</span>
            </div>
          </div>
        </div>

        <div className="language-support">
          <h3>Language Support</h3>
          <div className="language-grid">
            {['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic'].map(lang => (
              <span key={lang} className="language-tag">{lang}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render Avatars section
  const renderAvatars = () => (
    <div className="demo-section">
      <h2>👤 AI Avatar Templates</h2>
      <p className="section-description">
        Professional avatar styles with emotional context awareness
      </p>

      <div className="avatar-grid">
        {AVATAR_TEMPLATES.map(avatar => (
          <div key={avatar.id} className="avatar-card-demo">
            <div className="avatar-preview-large">{avatar.preview}</div>
            <h4>{avatar.name}</h4>
            <p>{avatar.description}</p>
            <span className={`style-tag ${avatar.style}`}>{avatar.style}</span>
          </div>
        ))}
      </div>

      <div className="emotional-analysis-demo">
        <h3>Emotional Context Analysis</h3>
        <div className="analysis-example">
          <p><strong>Input Script:</strong> "I'm so excited to welcome you to our amazing company!"</p>
          <p><strong>Detected Tone:</strong> <span className="tone-excited">Excited</span></p>
          <p><strong>Energy Level:</strong> <span className="energy-high">High</span></p>
          <p><strong>Recommended Avatar:</strong> Enthusiastic style with bright expression</p>
        </div>
      </div>
    </div>
  );

  // Render Enhancement section
  const renderEnhancement = () => {
    const enhancer = getVideoEnhancementService();
    const enhancements = enhancer.getAvailableEnhancements();

    return (
      <div className="demo-section">
        <h2>✨ Video Enhancement Options</h2>
        <p className="section-description">
          AI-powered video quality improvements and professional finishing
        </p>

        <div className="enhancement-list">
          {enhancements.map(enhancement => (
            <div key={enhancement.id} className="enhancement-item">
              <div className="enhancement-icon">
                {enhancement.id === 'ai_upscaling' && '🔍'}
                {enhancement.id === 'color_grading' && '🎨'}
                {enhancement.id === 'noise_reduction' && '🔇'}
                {enhancement.id === 'sharpness_enhancement' && '✨'}
                {enhancement.id === 'stabilization' && '🎥'}
              </div>
              <div className="enhancement-details">
                <h4>{enhancement.name}</h4>
                <p>{enhancement.description}</p>
                <span className={`category-tag ${enhancement.category}`}>{enhancement.category}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="processing-pipeline">
          <h3>AI Processing Pipeline</h3>
          <div className="pipeline-steps">
            <div className="pipeline-step">
              <span className="step-num">1</span>
              <span>Emotional Analysis</span>
            </div>
            <div className="pipeline-arrow">→</div>
            <div className="pipeline-step">
              <span className="step-num">2</span>
              <span>Avatar Generation</span>
            </div>
            <div className="pipeline-arrow">→</div>
            <div className="pipeline-step">
              <span className="step-num">3</span>
              <span>Voice Synthesis</span>
            </div>
            <div className="pipeline-arrow">→</div>
            <div className="pipeline-step">
              <span className="step-num">4</span>
              <span>Lip-Sync</span>
            </div>
            <div className="pipeline-arrow">→</div>
            <div className="pipeline-step">
              <span className="step-num">5</span>
              <span>Enhancement</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Integration Status
  const renderIntegration = () => (
    <div className="demo-section">
      <h2>🔗 Integration Status</h2>
      <p className="section-description">
        Complete feature checklist for Sendspark parity
      </p>

      <div className="integration-checklist">
        <div className="checklist-category">
          <h3>✅ Core AI Features</h3>
          <ul>
            <li className="check-complete">AI Avatar Generation</li>
            <li className="check-complete">Text-to-Speech (Multiple Providers)</li>
            <li className="check-complete">Lip-Sync Technology</li>
            <li className="check-complete">Script-to-Video Creation</li>
            <li className="check-complete">Dynamic Scene Generation</li>
            <li className="check-complete">Emotional Context Analysis</li>
          </ul>
        </div>

        <div className="checklist-category">
          <h3>✅ Advanced Features</h3>
          <ul>
            <li className="check-complete">Voice Cloning (ElevenLabs)</li>
            <li className="check-complete">Multi-language Support (40+)</li>
            <li className="check-complete">AI Video Upscaling</li>
            <li className="check-complete">Professional Color Grading</li>
            <li className="check-complete">Noise Reduction</li>
            <li className="check-complete">Video Stabilization</li>
          </ul>
        </div>

        <div className="checklist-category">
          <h3>✅ Infrastructure</h3>
          <ul>
            <li className="check-complete">200+ AI Models</li>
            <li className="check-complete">Muapi.ai Integration</li>
            <li className="check-complete">Template System</li>
            <li className="check-complete">Upload History</li>
            <li className="check-complete">Cloud Storage (Supabase)</li>
            <li className="check-complete">Help System</li>
          </ul>
        </div>
      </div>

      <div className="sendspark-comparison">
        <h3>🎯 Sendspark Parity: 100%</h3>
        <p>All Sendspark features are now implemented and available.</p>
        <div className="parity-bar">
          <div className="parity-fill" style={{ width: '100%' }}></div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>SmartVideo Integration Demo</title>
        <meta name="description" content="Complete AI video personalization platform demo" />
      </Head>

      <div className="smartvideo-demo">
        <div className="demo-sidebar">
          <h1>SmartVideo</h1>
          <p className="demo-subtitle">Complete Integration Demo</p>

          <nav className="demo-nav">
            {demos.map(demo => (
              <button
                key={demo.id}
                className={classnames('demo-nav-item', { active: activeDemo === demo.id })}
                onClick={() => setActiveDemo(demo.id)}
              >
                <span className="demo-icon">{demo.icon}</span>
                <span>{demo.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="demo-content">
          {activeDemo === 'overview' && renderOverview()}
          {activeDemo === 'models' && renderModels()}
          {activeDemo === 'tts' && renderTTS()}
          {activeDemo === 'avatars' && renderAvatars()}
          {activeDemo === 'enhancement' && renderEnhancement()}
          {activeDemo === 'integration' && renderIntegration()}
        </div>
      </div>

      <style jsx>{`
        .smartvideo-demo {
          display: flex;
          min-height: 100vh;
          background: #0f172a;
          color: white;
        }

        .demo-sidebar {
          width: 280px;
          background: #1e293b;
          padding: 24px;
          border-right: 1px solid #334155;
        }

        .demo-sidebar h1 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .demo-subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin: 0 0 32px 0;
        }

        .demo-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .demo-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .demo-nav-item:hover {
          background: #334155;
        }

        .demo-nav-item.active {
          background: #3b82f6;
          color: white;
        }

        .demo-icon {
          font-size: 18px;
        }

        .demo-content {
          flex: 1;
          padding: 40px;
          overflow-y: auto;
        }

        .demo-section h2 {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 16px 0;
        }

        .section-description {
          font-size: 16px;
          color: #94a3b8;
          margin-bottom: 32px;
          max-width: 600px;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }

        .feature-card {
          background: #1e293b;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #334155;
        }

        .feature-icon {
          font-size: 32px;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 12px 0;
        }

        .feature-card p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0 0 16px 0;
        }

        .feature-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-card li {
          font-size: 13px;
          color: #cbd5e1;
          padding: 4px 0;
          padding-left: 16px;
          position: relative;
        }

        .feature-card li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #22c55e;
        }

        .api-key-section {
          background: #1e293b;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #334155;
        }

        .api-key-section h3 {
          margin: 0 0 12px 0;
        }

        .api-key-input {
          width: 100%;
          padding: 12px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 6px;
          color: white;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .api-help {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }

        .api-help a {
          color: #3b82f6;
          text-decoration: none;
        }

        .models-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .model-category {
          background: #1e293b;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #334155;
        }

        .model-category h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
        }

        .model-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .model-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #0f172a;
          border-radius: 6px;
          font-size: 13px;
        }

        .model-name {
          font-weight: 500;
        }

        .model-provider {
          color: #94a3b8;
        }

        .tts-providers {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .provider-card {
          background: #1e293b;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #334155;
        }

        .provider-card h3 {
          margin: 0 0 8px 0;
        }

        .voice-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .voice-tag {
          padding: 4px 10px;
          background: #0f172a;
          border-radius: 20px;
          font-size: 12px;
        }

        .voice-tag.premium {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .avatar-card-demo {
          background: #1e293b;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          border: 1px solid #334155;
        }

        .avatar-preview-large {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .style-tag {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          text-transform: uppercase;
        }

        .enhancement-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .enhancement-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #1e293b;
          border-radius: 8px;
        }

        .enhancement-icon {
          font-size: 24px;
        }

        .integration-checklist {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .checklist-category {
          background: #1e293b;
          padding: 20px;
          border-radius: 12px;
        }

        .checklist-category ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .checklist-category li {
          padding: 8px 0;
          font-size: 14px;
        }

        .check-complete:before {
          content: "✓ ";
          color: #22c55e;
          font-weight: bold;
        }

        .parity-bar {
          width: 100%;
          height: 8px;
          background: #334155;
          border-radius: 4px;
          overflow: hidden;
        }

        .parity-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
          transition: width 0.5s ease;
        }

        .pipeline-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          padding: 24px;
          background: #1e293b;
          border-radius: 12px;
        }

        .pipeline-step {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #0f172a;
          border-radius: 8px;
        }

        .step-num {
          width: 24px;
          height: 24px;
          background: #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }
      `}</style>
    </>
  );
};

export default SmartVideoDemo;