// SendsparkWorkflow Component - Correct Sendspark-style video personalization workflow
// 5 Steps: Record → Import Contacts → Clone Voice → Generate → Share
import React, { useState, useEffect } from 'react';
import classnames from 'classnames';

import VideoRecorder from './VideoRecorder';
import ContactImporterModal from './modals/ContactImporterModal';
import { SendsparkPersonalizationEngine } from '../lib/sendsparkEngine';
import { showError, showSuccess } from '../lib/services/alertService';

const SendsparkWorkflow = ({
  onWorkflowComplete,
  apiKey
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Step 1: Recording
  const [recordedVideo, setRecordedVideo] = useState(null);
  
  // Step 2: Contacts
  const [contacts, setContacts] = useState([]);
  const [showContactImporter, setShowContactImporter] = useState(false);
  
  // Step 3: Voice Cloning
  const [voiceCloneStatus, setVoiceCloneStatus] = useState('idle'); // idle, cloning, completed, failed
  const [clonedVoiceId, setClonedVoiceId] = useState(null);
  const [script, setScript] = useState('');
  
  // Step 4: Generation
  const [generationStatus, setGenerationStatus] = useState('idle'); // idle, generating, completed, failed
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [currentContactIndex, setCurrentContactIndex] = useState(0);
  
  // Step 5: Share
  const [selectedVideos, setSelectedVideos] = useState([]);
  
  // Engine instance
  const [engine, setEngine] = useState(null);

  // Initialize engine when API key is available
  useEffect(() => {
    if (apiKey) {
      const newEngine = new SendsparkPersonalizationEngine({
        apiKey: apiKey,
        userVideo: recordedVideo,
        script: script,
        contacts: contacts
      });
      setEngine(newEngine);
    }
  }, [apiKey, recordedVideo, script, contacts]);

  const steps = [
    { id: 1, name: 'Record', description: 'Record your base video once', icon: '🎥' },
    { id: 2, name: 'Contacts', description: 'Import your contact list', icon: '👥' },
    { id: 3, name: 'Voice', description: 'Clone your voice from the recording', icon: '🎙️' },
    { id: 4, name: 'Generate', description: 'Create personalized videos', icon: '✨' },
    { id: 5, name: 'Share', description: 'Share your videos', icon: '📤' }
  ];

  const handleStepClick = (stepId) => {
    // Only allow clicking completed steps or the current step
    if (stepId <= Math.max(...completedSteps, currentStep)) {
      setCurrentStep(stepId);
    }
  };

  const handleRecordingComplete = (recording) => {
    setRecordedVideo(recording);
    setCompletedSteps([...completedSteps, 1]);
    setCurrentStep(2);
    showSuccess('Video recorded successfully!');
  };

  const handleContactsImported = (importedContacts) => {
    setContacts(importedContacts);
    setShowContactImporter(false);
    setCompletedSteps([...completedSteps.filter(s => s !== 2), 2]);
    setCurrentStep(3);
    showSuccess(`Imported ${importedContacts.length} contacts!`);
  };

  const handleCloneVoice = async () => {
    if (!recordedVideo) {
      showError('Please record a video first');
      return;
    }

    if (!apiKey) {
      showError('Please provide an API key for voice cloning');
      return;
    }

    setVoiceCloneStatus('cloning');
    
    try {
      const engine = new SendsparkPersonalizationEngine({
        apiKey: apiKey,
        userVideo: recordedVideo
      });

      const clonedVoice = await engine.cloneUserVoice();
      setClonedVoiceId(clonedVoice.voiceId);
      setVoiceCloneStatus('completed');
      setCompletedSteps([...completedSteps.filter(s => s !== 3), 3]);
      showSuccess('Voice cloned successfully!');
    } catch (error) {
      console.error('Voice cloning failed:', error);
      setVoiceCloneStatus('failed');
      showError('Voice cloning failed: ' + error.message);
    }
  };

  const handleGenerateVideos = async () => {
    if (!script.trim()) {
      showError('Please enter a script for personalization');
      return;
    }

    if (contacts.length === 0) {
      showError('Please import contacts first');
      return;
    }

    setGenerationStatus('generating');
    setIsProcessing(true);
    setProgress(0);

    try {
      const engine = new SendsparkPersonalizationEngine({
        apiKey: apiKey,
        userVideo: recordedVideo,
        userVoiceSample: recordedVideo, // Use video audio for voice
        script: script,
        contacts: contacts,
        tokens: {
          '{{firstName}}': 'firstName',
          '{{lastName}}': 'lastName',
          '{{company}}': 'company',
          '{{email}}': 'email',
          '{{website}}': 'website',
          '{{industry}}': 'industry',
          '{{title}}': 'title'
        }
      });

      // Process script for all contacts
      engine.processScript();

      // Generate videos with progress tracking
      const results = await engine.generatePersonalizedVideos((progress, videos) => {
        setProgress(progress);
        setGeneratedVideos(videos);
        setCurrentContactIndex(videos.length);
      });

      setGeneratedVideos(results);
      setGenerationStatus('completed');
      setCompletedSteps([...completedSteps.filter(s => s !== 4), 4]);
      setCurrentStep(5);
      setIsProcessing(false);
      
      showSuccess(`Generated ${results.filter(r => r.status === 'completed').length} personalized videos!`);

      if (onWorkflowComplete) {
        onWorkflowComplete(results);
      }

    } catch (error) {
      console.error('Video generation failed:', error);
      setGenerationStatus('failed');
      setIsProcessing(false);
      showError('Video generation failed: ' + error.message);
    }
  };

  const handleVideoSelect = (video) => {
    if (selectedVideos.find(v => v.contact.email === video.contact.email)) {
      setSelectedVideos(selectedVideos.filter(v => v.contact.email !== video.contact.email));
    } else {
      setSelectedVideos([...selectedVideos, video]);
    }
  };

  const handleSelectAll = () => {
    if (selectedVideos.length === generatedVideos.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(generatedVideos.filter(v => v.status === 'completed'));
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <VideoRecorder
              onRecordingComplete={handleRecordingComplete}
              maxDuration={60}
              allowScreen={true}
              allowCamera={true}
            />
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <div className="contacts-step">
              <h3>Import Your Contacts</h3>
              <p className="step-description">
                Upload a CSV file with your contacts. Each contact will receive a personalized version of your video.
              </p>

              {contacts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h4>No contacts yet</h4>
                  <p>Import your contacts from a CSV file</p>
                  <button
                    className="primary-btn"
                    onClick={() => setShowContactImporter(true)}
                  >
                    Import Contacts
                  </button>
                </div>
              ) : (
                <div className="contacts-preview">
                  <div className="contacts-stats">
                    <div className="stat-item">
                      <span className="stat-value">{contacts.length}</span>
                      <span className="stat-label">Total Contacts</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">
                        {contacts.filter(c => c.firstName && c.company).length}
                      </span>
                      <span className="stat-label">Complete Records</span>
                    </div>
                  </div>

                  <div className="contacts-table">
                    <div className="table-header">
                      <div className="col">Name</div>
                      <div className="col">Email</div>
                      <div className="col">Company</div>
                    </div>
                    {contacts.slice(0, 10).map((contact, index) => (
                      <div key={index} className="table-row">
                        <div className="col">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="col">{contact.email}</div>
                        <div className="col">{contact.company || '-'}</div>
                      </div>
                    ))}
                  </div>

                  {contacts.length > 10 && (
                    <p className="more-contacts">+{contacts.length - 10} more contacts</p>
                  )}

                  <div className="step-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => setShowContactImporter(true)}
                    >
                      Import More Contacts
                    </button>
                    <button
                      className="primary-btn"
                      onClick={() => setCurrentStep(3)}
                    >
                      Continue to Voice Cloning
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <div className="voice-step">
              <h3>Clone Your Voice</h3>
              <p className="step-description">
                We'll clone your voice from your recorded video. This allows us to personalize the audio for each contact while keeping it sounding like you.
              </p>

              <div className="voice-clone-container">
                <div className="recording-preview">
                  <h4>Your Recording</h4>
                  {recordedVideo && (
                    <video
                      src={recordedVideo.url}
                      controls
                      className="preview-video"
                    />
                  )}
                </div>

                <div className="script-editor">
                  <h4>Enter Your Script</h4>
                  <p className="script-help">
                    Use tokens like {'{{firstName}}'}, {'{{company}}'} for personalization.
                    Powered by Muapi voice cloning.
                  </p>
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Enter your script here...&#10;&#10;Example:&#10;Hi {{firstName}},&#10;&#10;I wanted to personally reach out to you at {{company}}..."
                    className="script-input"
                    rows={8}
                  />
                  
                  <div className="token-help">
                    <h5>Available Tokens:</h5>
                    <div className="token-tags">
                      <span className="token-tag">{'{{firstName}}'}</span>
                      <span className="token-tag">{'{{lastName}}'}</span>
                      <span className="token-tag">{'{{company}}'}</span>
                      <span className="token-tag">{'{{email}}'}</span>
                      <span className="token-tag">{'{{website}}'}</span>
                      <span className="token-tag">{'{{industry}}'}</span>
                      <span className="token-tag">{'{{title}}'}</span>
                    </div>
                  </div>
                </div>

                <div className="clone-action">
                  <button
                    className={classnames('clone-btn', {
                      'cloning': voiceCloneStatus === 'cloning',
                      'completed': voiceCloneStatus === 'completed'
                    })}
                    onClick={handleCloneVoice}
                    disabled={voiceCloneStatus === 'cloning' || !script.trim()}
                  >
                    {voiceCloneStatus === 'idle' && 'Clone My Voice'}
                    {voiceCloneStatus === 'cloning' && 'Cloning Voice...'}
                    {voiceCloneStatus === 'completed' && '✓ Voice Cloned'}
                    {voiceCloneStatus === 'failed' && 'Retry Voice Cloning'}
                  </button>

                  {voiceCloneStatus === 'completed' && (
                    <button
                      className="primary-btn"
                      onClick={() => setCurrentStep(4)}
                    >
                      Continue to Generate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <div className="generate-step">
              <h3>Generate Personalized Videos</h3>
              <p className="step-description">
                We'll create a personalized version of your video for each contact with their information and dynamic backgrounds.
              </p>

              <div className="generation-summary">
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Contacts</span>
                    <span className="summary-value">{contacts.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Video Duration</span>
                    <span className="summary-value">
                      {recordedVideo ? `${recordedVideo.duration}s` : '-'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Voice Clone</span>
                    <span className={classnames('summary-value', 'status', voiceCloneStatus)}>
                      {voiceCloneStatus === 'completed' ? '✓ Ready' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {generationStatus === 'generating' && (
                <div className="generation-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-info">
                    <span>Generating video {currentContactIndex + 1} of {contacts.length}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>
              )}

              {generatedVideos.length > 0 && (
                <div className="generated-preview">
                  <h4>Generated Videos</h4>
                  <div className="videos-grid">
                    {generatedVideos.slice(0, 6).map((video, index) => (
                      <div
                        key={index}
                        className={classnames('video-card', {
                          'completed': video.status === 'completed',
                          'failed': video.status === 'failed'
                        })}
                      >
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="Video thumbnail" />
                        ) : (
                          <div className="video-placeholder">
                            {video.status === 'completed' ? '🎬' : '❌'}
                          </div>
                        )}
                        <div className="video-info">
                          <span className="contact-name">
                            {video.contact.firstName} {video.contact.lastName}
                          </span>
                          <span className="video-status">{video.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {generatedVideos.length > 6 && (
                    <p className="more-videos">+{generatedVideos.length - 6} more videos</p>
                  )}
                </div>
              )}

              <div className="step-actions">
                <button
                  className={classnames('generate-btn', {
                    'generating': generationStatus === 'generating'
                  })}
                  onClick={handleGenerateVideos}
                  disabled={generationStatus === 'generating' || voiceCloneStatus !== 'completed'}
                >
                  {generationStatus === 'idle' && `Generate ${contacts.length} Videos`}
                  {generationStatus === 'generating' && 'Generating Videos...'}
                  {generationStatus === 'completed' && '✓ All Videos Generated'}
                  {generationStatus === 'failed' && 'Retry Generation'}
                </button>

                {generationStatus === 'completed' && (
                  <button
                    className="primary-btn"
                    onClick={() => setCurrentStep(5)}
                  >
                    Continue to Share
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        const completedVideos = generatedVideos.filter(v => v.status === 'completed');
        return (
          <div className="step-content">
            <div className="share-step">
              <h3>Share Your Videos</h3>
              <p className="step-description">
                Select which videos to share and choose your sharing method.
              </p>

              <div className="share-stats">
                <div className="stat-box">
                  <span className="stat-number">{completedVideos.length}</span>
                  <span className="stat-label">Videos Ready</span>
                </div>
                <div className="stat-box">
                  <span className="stat-number">{selectedVideos.length}</span>
                  <span className="stat-label">Selected</span>
                </div>
              </div>

              <div className="videos-selection">
                <div className="selection-header">
                  <label className="select-all">
                    <input
                      type="checkbox"
                      checked={selectedVideos.length === completedVideos.length && completedVideos.length > 0}
                      onChange={handleSelectAll}
                    />
                    Select All
                  </label>
                </div>

                <div className="videos-list">
                  {completedVideos.map((video, index) => (
                    <div
                      key={index}
                      className={classnames('video-item', {
                        'selected': selectedVideos.find(v => v.contact.email === video.contact.email)
                      })}
                      onClick={() => handleVideoSelect(video)}
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedVideos.find(v => v.contact.email === video.contact.email)}
                        onChange={() => {}}
                      />
                      <div className="video-thumbnail">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="" />
                        ) : (
                          <div className="thumbnail-placeholder">🎬</div>
                        )}
                      </div>
                      <div className="video-details">
                        <span className="contact-name">
                          {video.contact.firstName} {video.contact.lastName}
                        </span>
                        <span className="contact-email">{video.contact.email}</span>
                        <span className="contact-company">{video.contact.company}</span>
                      </div>
                      <div className="video-actions">
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(video.videoUrl, '_blank');
                          }}
                        >
                          👁️ View
                        </button>
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(video.videoUrl);
                            showSuccess('Link copied!');
                          }}
                        >
                          📋 Copy Link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="share-actions">
                <button
                  className="share-btn email-btn"
                  disabled={selectedVideos.length === 0}
                  onClick={() => {
                    // Generate email template
                    const emails = selectedVideos.map(v => ({
                      to: v.contact.email,
                      subject: `Personalized video for ${v.contact.firstName}`,
                      body: `Hi ${v.contact.firstName},\n\nI recorded a personalized video just for you. Watch it here: ${v.videoUrl}\n\nBest regards`
                    }));
                    console.log('Email templates:', emails);
                    showSuccess(`Prepared ${emails.length} emails`);
                  }}
                >
                  ✉️ Send via Email
                </button>
                <button
                  className="share-btn download-btn"
                  disabled={selectedVideos.length === 0}
                  onClick={() => {
                    showSuccess(`Prepared ${selectedVideos.length} videos for download`);
                  }}
                >
                  ⬇️ Download All
                </button>
                <button
                  className="share-btn embed-btn"
                  disabled={selectedVideos.length === 0}
                  onClick={() => {
                    const embedCodes = selectedVideos.map(v => 
                      `<iframe src="${v.videoUrl}" width="640" height="360"></iframe>`
                    );
                    navigator.clipboard.writeText(embedCodes.join('\n'));
                    showSuccess('Embed codes copied!');
                  }}
                >
                  📎 Get Embed Codes
                </button>
              </div>

              <button
                className="secondary-btn start-over"
                onClick={() => {
                  setCurrentStep(1);
                  setCompletedSteps([]);
                  setRecordedVideo(null);
                  setContacts([]);
                  setVoiceCloneStatus('idle');
                  setGenerationStatus('idle');
                  setGeneratedVideos([]);
                  setSelectedVideos([]);
                }}
              >
                🔄 Start New Campaign
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="sendspark-workflow">
      {/* Progress Steps */}
      <div className="workflow-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={classnames('workflow-step', {
              'active': currentStep === step.id,
              'completed': completedSteps.includes(step.id),
              'clickable': step.id <= Math.max(...completedSteps, currentStep)
            })}
            onClick={() => handleStepClick(step.id)}
          >
            <div className="step-number">
              {completedSteps.includes(step.id) ? '✓' : step.icon}
            </div>
            <div className="step-info">
              <span className="step-name">{step.name}</span>
              <span className="step-desc">{step.description}</span>
            </div>
            {step.id < steps.length && <div className="step-connector"></div>}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="workflow-content">
        {renderStepContent()}
      </div>

      {/* Contact Importer Modal */}
      {showContactImporter && (
        <ContactImporterModal
          handleClose={() => setShowContactImporter(false)}
          onContactsImported={handleContactsImported}
        />
      )}

      <style jsx>{`
        .sendspark-workflow {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .workflow-steps {
          display: flex;
          padding: 24px;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
          overflow-x: auto;
        }

        .workflow-step {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: default;
          transition: all 0.2s;
          flex: 1;
          min-width: 180px;
        }

        .workflow-step.clickable {
          cursor: pointer;
        }

        .workflow-step.clickable:hover {
          background: white;
        }

        .workflow-step.active {
          background: #007bff;
          color: white;
        }

        .workflow-step.completed {
          background: #28a745;
          color: white;
        }

        .step-number {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
        }

        .step-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .step-name {
          font-weight: 600;
          font-size: 14px;
        }

        .step-desc {
          font-size: 12px;
          opacity: 0.8;
        }

        .step-connector {
          width: 20px;
          height: 2px;
          background: currentColor;
          opacity: 0.3;
          margin-left: auto;
        }

        .workflow-content {
          padding: 32px;
          min-height: 500px;
        }

        .step-content h3 {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .step-description {
          color: #666;
          margin-bottom: 24px;
        }

        /* Contacts Step */
        .empty-state {
          text-align: center;
          padding: 48px;
          background: #f8f9fa;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .primary-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .primary-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .primary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .secondary-btn {
          background: #f0f0f0;
          color: #333;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .secondary-btn:hover {
          background: #e0e0e0;
        }

        .contacts-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 24px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #007bff;
        }

        .stat-label {
          color: #666;
          font-size: 14px;
        }

        .contacts-table {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 12px 16px;
          background: #f8f9fa;
          font-weight: 600;
          border-bottom: 1px solid #e0e0e0;
        }

        .table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .step-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        /* Voice Step */
        .voice-clone-container {
          display: grid;
          gap: 24px;
        }

        .recording-preview h4,
        .script-editor h4 {
          margin-bottom: 12px;
        }

        .preview-video {
          width: 100%;
          max-width: 400px;
          border-radius: 8px;
        }

        .script-input {
          width: 100%;
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
          min-height: 150px;
        }

        .script-help {
          color: #666;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .token-help {
          margin-top: 16px;
        }

        .token-help h5 {
          margin-bottom: 8px;
          color: #333;
        }

        .token-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .token-tag {
          background: #e3f2fd;
          color: #007bff;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-family: monospace;
        }

        .clone-action {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .clone-btn {
          padding: 14px 32px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #007bff;
          color: white;
        }

        .clone-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .clone-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .clone-btn.cloning {
          background: #ff9800;
        }

        .clone-btn.completed {
          background: #28a745;
        }

        /* Generate Step */
        .generation-summary {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .summary-label {
          color: #666;
          font-size: 14px;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 700;
        }

        .summary-value.status.completed {
          color: #28a745;
        }

        .generation-progress {
          margin-bottom: 24px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          color: #666;
          font-size: 14px;
        }

        .videos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .video-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid #e0e0e0;
        }

        .video-card.completed {
          border-color: #28a745;
        }

        .video-card.failed {
          border-color: #dc3545;
        }

        .video-card img {
          width: 100%;
          aspect-ratio: 16/9;
          object-fit: cover;
        }

        .video-placeholder {
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          background: #f0f0f0;
        }

        .video-info {
          padding: 12px;
        }

        .contact-name {
          display: block;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .video-status {
          font-size: 12px;
          color: #666;
          text-transform: capitalize;
        }

        .generate-btn {
          padding: 16px 48px;
          border: none;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #007bff;
          color: white;
        }

        .generate-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .generate-btn.generating {
          background: #ff9800;
        }

        /* Share Step */
        .share-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
        }

        .stat-box {
          flex: 1;
          background: #f8f9fa;
          padding: 24px;
          border-radius: 8px;
          text-align: center;
        }

        .stat-number {
          font-size: 36px;
          font-weight: 700;
          color: #007bff;
        }

        .videos-selection {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .selection-header {
          padding: 16px;
          border-bottom: 1px solid #e0e0e0;
        }

        .select-all {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .videos-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .video-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          transition: background 0.2s;
        }

        .video-item:hover {
          background: #f8f9fa;
        }

        .video-item.selected {
          background: #e3f2fd;
        }

        .video-thumbnail {
          width: 80px;
          height: 45px;
          border-radius: 4px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .video-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumbnail-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f0f0;
          font-size: 20px;
        }

        .video-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .contact-email,
        .contact-company {
          font-size: 12px;
          color: #666;
        }

        .video-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px 12px;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: #f0f0f0;
        }

        .share-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .share-btn {
          flex: 1;
          padding: 16px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .share-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .email-btn {
          background: #28a745;
          color: white;
        }

        .email-btn:hover:not(:disabled) {
          background: #218838;
        }

        .download-btn {
          background: #007bff;
          color: white;
        }

        .download-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .embed-btn {
          background: #6c757d;
          color: white;
        }

        .embed-btn:hover:not(:disabled) {
          background: #5a6268;
        }

        .start-over {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default SendsparkWorkflow;