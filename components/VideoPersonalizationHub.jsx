// Personalizer Hub - Main component for video personalization platform
import React, { useState, useEffect } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import ContactImporterModal from '../components/modals/ContactImporterModal';
import VideoUploader from '../components/VideoUploader';
import VideoPersonalizer from '../components/VideoPersonalizer';
import TokenEditor from '../components/TokenEditor';
import Sidebar from '../components/Sidebar';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';

const VideoPersonalizationHub = () => {
  const [activeTab, setActiveTab] = useState('upload'); // upload, contacts, tokens, personalize
  const [baseVideo, setBaseVideo] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [tokens, setTokens] = useState({});
  const [showContactImporter, setShowContactImporter] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState([]);

  // Available tabs for the personalization workflow
  const tabs = [
    { id: 'upload', label: 'Upload Video', icon: 'video' },
    { id: 'contacts', label: 'Import Contacts', icon: 'users' },
    { id: 'tokens', label: 'Manage Tokens', icon: 'tag' },
    { id: 'personalize', label: 'Generate Videos', icon: 'play' }
  ];

  const handleVideoSelected = (video) => {
    setBaseVideo(video);
    showSuccess('Video uploaded successfully!');
  };

  const handleContactsImported = (importedContacts) => {
    setContacts(importedContacts);
    showSuccess(`Imported ${importedContacts.length} contacts`);
    setShowContactImporter(false);

    // Auto-advance to tokens tab if video is already uploaded
    if (baseVideo) {
      setActiveTab('tokens');
    }
  };

  const handleTokensChange = (updatedTokens) => {
    setTokens(updatedTokens);
  };

  const handleVideoGenerationComplete = (videos) => {
    setGeneratedVideos(videos);
    showSuccess(`Generated ${videos.length} personalized videos!`);
  };

  const canProceedToPersonalize = () => {
    return baseVideo && contacts.length > 0;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'upload':
        return (
          <div className="tab-content">
            <VideoUploader
              onVideoSelected={handleVideoSelected}
              maxFileSize={500}
              acceptedFormats={['mp4', 'mov', 'avi', 'webm']}
            />
          </div>
        );

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

      case 'personalize':
        return (
          <div className="tab-content">
            {!canProceedToPersonalize() ? (
              <div className="requirements-notice">
                <h3>Requirements Not Met</h3>
                <p>Please complete the following before generating videos:</p>
                <ul>
                  {!baseVideo && <li>Upload a base video</li>}
                  {contacts.length === 0 && <li>Import contacts</li>}
                </ul>
                <div className="requirements-actions">
                  {!baseVideo && (
                    <button
                      className="primary-btn"
                      onClick={() => setActiveTab('upload')}
                    >
                      Upload Video
                    </button>
                  )}
                  {contacts.length === 0 && (
                    <button
                      className="primary-btn"
                      onClick={() => setActiveTab('contacts')}
                    >
                      Import Contacts
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <VideoPersonalizer
                baseVideo={baseVideo}
                contacts={contacts}
                onVideoGenerated={handleVideoGenerationComplete}
              />
            )}
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
          <h1 className="hub-title">Personalizer</h1>
          <p className="hub-subtitle">Create personalized videos at scale like Sendspark</p>
        </div>

        <div className="sidebar-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={classnames('nav-item', {
                'active': activeTab === tab.id,
                'disabled': tab.id === 'personalize' && !canProceedToPersonalize()
              })}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.id === 'personalize' && !canProceedToPersonalize()}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
              {tab.id === 'contacts' && contacts.length > 0 && (
                <span className="nav-badge">{contacts.length}</span>
              )}
              {tab.id === 'personalize' && generatedVideos.length > 0 && (
                <span className="nav-badge">{generatedVideos.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sidebar-status">
          <div className="status-item">
            <span className={classnames('status-dot', { 'complete': baseVideo })}></span>
            <span>Base Video</span>
          </div>
          <div className="status-item">
            <span className={classnames('status-dot', { 'complete': contacts.length > 0 })}></span>
            <span>Contacts</span>
          </div>
          <div className="status-item">
            <span className={classnames('status-dot', { 'complete': Object.keys(tokens).length > 0 })}></span>
            <span>Tokens</span>
          </div>
          <div className="status-item">
            <span className={classnames('status-dot', { 'complete': generatedVideos.length > 0 })}></span>
            <span>Generated Videos</span>
          </div>
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