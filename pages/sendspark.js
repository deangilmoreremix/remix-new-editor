// Sendspark Workflow Page - Dedicated page for Sendspark-style video personalization
import React, { useState } from 'react';
import Head from 'next/head';
import classnames from 'classnames';

import SendsparkWorkflow from '../components/SendsparkWorkflow';
import { showError, showSuccess } from '../lib/services/alertService';

const SendsparkWorkflowPage = () => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);
  const [generatedCampaigns, setGeneratedCampaigns] = useState([]);

  const handleWorkflowComplete = (videos) => {
    const campaign = {
      id: Date.now(),
      date: new Date().toISOString(),
      videoCount: videos.filter(v => v.status === 'completed').length,
      videos: videos
    };
    setGeneratedCampaigns([campaign, ...generatedCampaigns]);
    showSuccess(`Campaign completed! Generated ${campaign.videoCount} videos.`);
  };

  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    if (apiKey.trim()) {
      setShowApiKeyInput(false);
      showSuccess('API key saved!');
    } else {
      showError('Please enter a valid API key');
    }
  };

  return (
    <>
      <Head>
        <title>Sendspark Workflow - Personalized Video Campaigns</title>
        <meta
          name="description"
          content="Create personalized video campaigns like Sendspark. Record once, personalize for each contact with voice cloning and dynamic backgrounds."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="sendspark-page">
        {/* Header */}
        <header className="page-header">
          <div className="header-content">
            <div className="logo-section">
              <span className="logo-icon">✨</span>
              <div className="logo-text">
                <h1>Sendspark Workflow</h1>
                <p>Personalized video campaigns at scale</p>
              </div>
            </div>
            
            {!showApiKeyInput && (
              <div className="api-key-badge">
                <span className="key-icon">🔑</span>
                <span className="key-status">API Connected</span>
                <button 
                  className="change-key-btn"
                  onClick={() => setShowApiKeyInput(true)}
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </header>

        {/* API Key Input Modal */}
        {showApiKeyInput && (
          <div className="api-key-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Welcome to Sendspark Workflow</h2>
                <p>Enter your API key to get started with personalized video creation</p>
              </div>
              
              <form onSubmit={handleApiKeySubmit}>
                <div className="form-group">
                  <label htmlFor="apiKey">API Key (Muapi.ai)</label>
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Muapi.ai API key"
                    className="api-key-input"
                  />
                  <p className="help-text">
                    Your API key is used for voice cloning, video generation, and background creation.
                    <a href="https://muapi.ai" target="_blank" rel="noopener noreferrer">
                      Get your API key
                    </a>
                  </p>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="primary-btn">
                    Start Creating Videos
                  </button>
                </div>
              </form>

              <div className="feature-preview">
                <h3>What you can do:</h3>
                <div className="feature-grid">
                  <div className="feature-item">
                    <span className="feature-icon">🎥</span>
                    <h4>Record Once</h4>
                    <p>Record your video with screen, camera, or both</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">👥</span>
                    <h4>Import Contacts</h4>
                    <p>Upload your contact list via CSV</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🎙️</span>
                    <h4>Clone Your Voice</h4>
                    <p>AI clones your voice for personalization</p>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">✨</span>
                    <h4>Generate Videos</h4>
                    <p>Create personalized versions for each contact</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Workflow */}
        {!showApiKeyInput && (
          <main className="main-content">
            <SendsparkWorkflow
              apiKey={apiKey}
              onWorkflowComplete={handleWorkflowComplete}
            />
          </main>
        )}

        {/* Campaign History */}
        {generatedCampaigns.length > 0 && !showApiKeyInput && (
          <section className="campaign-history">
            <h2>Campaign History</h2>
            <div className="campaigns-list">
              {generatedCampaigns.map((campaign) => (
                <div key={campaign.id} className="campaign-card">
                  <div className="campaign-info">
                    <span className="campaign-date">
                      {new Date(campaign.date).toLocaleDateString()}
                    </span>
                    <span className="campaign-count">
                      {campaign.videoCount} videos generated
                    </span>
                  </div>
                  <div className="campaign-actions">
                    <button 
                      className="action-btn"
                      onClick={() => {
                        // View campaign details
                        console.log('Campaign details:', campaign);
                      }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .sendspark-page {
          min-height: 100vh;
          background: #f5f7fa;
        }

        .page-header {
          background: white;
          border-bottom: 1px solid #e0e0e0;
          padding: 16px 32px;
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          font-size: 32px;
        }

        .logo-text h1 {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
          color: #212529;
        }

        .logo-text p {
          font-size: 14px;
          color: #6c757d;
          margin: 0;
        }

        .api-key-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #e8f5e9;
          border-radius: 20px;
          font-size: 14px;
        }

        .key-icon {
          font-size: 16px;
        }

        .key-status {
          color: #2e7d32;
          font-weight: 500;
        }

        .change-key-btn {
          background: none;
          border: none;
          color: #007bff;
          cursor: pointer;
          font-size: 12px;
          text-decoration: underline;
        }

        .api-key-modal {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 80px);
          padding: 32px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 48px;
          max-width: 700px;
          width: 100%;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .modal-header h2 {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .modal-header p {
          color: #666;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .api-key-input {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .api-key-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .help-text {
          margin-top: 8px;
          font-size: 14px;
          color: #666;
        }

        .help-text a {
          color: #007bff;
          margin-left: 4px;
        }

        .form-actions {
          text-align: center;
        }

        .primary-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .primary-btn:hover {
          background: #0056b3;
        }

        .feature-preview {
          margin-top: 48px;
          padding-top: 32px;
          border-top: 1px solid #e0e0e0;
        }

        .feature-preview h3 {
          text-align: center;
          margin-bottom: 24px;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        .feature-item {
          text-align: center;
          padding: 24px;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .feature-icon {
          font-size: 32px;
          margin-bottom: 12px;
          display: block;
        }

        .feature-item h4 {
          margin-bottom: 8px;
          font-size: 16px;
        }

        .feature-item p {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .main-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px;
        }

        .campaign-history {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px 32px;
        }

        .campaign-history h2 {
          margin-bottom: 16px;
          font-size: 20px;
        }

        .campaigns-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .campaign-card {
          background: white;
          padding: 16px 24px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #e0e0e0;
        }

        .campaign-info {
          display: flex;
          gap: 24px;
        }

        .campaign-date {
          color: #666;
          font-size: 14px;
        }

        .campaign-count {
          font-weight: 600;
          color: #28a745;
        }

        .action-btn {
          background: #f0f0f0;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .action-btn:hover {
          background: #e0e0e0;
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 16px;
          }

          .modal-content {
            padding: 24px;
          }

          .feature-grid {
            grid-template-columns: 1fr;
          }

          .campaign-card {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }

          .campaign-info {
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>
    </>
  );
};

export default SendsparkWorkflowPage;