// BatchGenerator - Generate personalized videos at scale
import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';
import { createPersonalizedVideo, createBulkPersonalizedVideos } from '../lib/videoPersonalizationEngine';

const BatchGenerator = ({
  baseVideo,
  contacts = [],
  personalizationConfig,
  onGenerationComplete,
  onProgressUpdate
}) => {
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [failedVideos, setFailedVideos] = useState([]);

  // Settings
  const [settings, setSettings] = useState({
    concurrentJobs: 3,
    retryFailed: true,
    maxRetries: 2,
    quality: '1080p',
    generateThumbnails: true,
    generateLandingPages: true
  });

  // Stats
  const [stats, setStats] = useState({
    total: contacts.length,
    completed: 0,
    failed: 0,
    pending: contacts.length,
    averageTime: 0,
    estimatedTimeRemaining: 0
  });

  // Update stats when contacts change
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      total: contacts.length,
      pending: contacts.length - prev.completed - prev.failed
    }));
  }, [contacts]);

  // Generate single video
  const generateSingleVideo = useCallback(async (contact, index) => {
    const startTime = Date.now();

    try {
      const result = await createPersonalizedVideo(baseVideo, contact, {
        ...personalizationConfig?.tokens,
        ...contact
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        contact,
        video: result,
        index,
        processingTime
      };

    } catch (error) {
      console.error(`Failed to generate video for ${contact.email}:`, error);

      return {
        success: false,
        contact,
        error: error.message,
        index,
        processingTime: Date.now() - startTime
      };
    }
  }, [baseVideo, personalizationConfig]);

  // Start batch generation
  const startGeneration = useCallback(async () => {
    if (contacts.length === 0) {
      showError('No contacts to generate videos for');
      return;
    }

    if (!baseVideo) {
      showError('No base video selected');
      return;
    }

    setIsGenerating(true);
    setIsPaused(false);
    setProgress(0);
    setCurrentIndex(0);
    setGeneratedVideos([]);
    setFailedVideos([]);

    const total = contacts.length;
    const completedVideos = [];
    const failedList = [];
    let totalTime = 0;

    try {
      // Process in batches
      for (let i = 0; i < total; i += settings.concurrentJobs) {
        if (isPaused) {
          // Wait for resume
          await new Promise(resolve => {
            const checkPause = setInterval(() => {
              if (!isPaused) {
                clearInterval(checkPause);
                resolve();
              }
            }, 100);
          });
        }

        const batch = contacts.slice(i, i + settings.concurrentJobs);
        const batchPromises = batch.map((contact, batchIndex) =>
          generateSingleVideo(contact, i + batchIndex)
        );

        const batchResults = await Promise.all(batchPromises);

        // Process results
        batchResults.forEach(result => {
          if (result.success) {
            completedVideos.push(result);
            setGeneratedVideos(prev => [...prev, result]);
          } else {
            failedList.push(result);
            setFailedVideos(prev => [...prev, result]);
          }

          totalTime += result.processingTime;
        });

        // Update progress
        const completed = Math.min(i + settings.concurrentJobs, total);
        const progressPercent = (completed / total) * 100;
        setProgress(progressPercent);
        setCurrentIndex(completed);

        // Update stats
        const avgTime = totalTime / completed;
        const remaining = total - completed;
        const estimatedRemaining = (avgTime * remaining) / 1000; // in seconds

        setStats(prev => ({
          ...prev,
          completed: completedVideos.length,
          failed: failedList.length,
          pending: remaining,
          averageTime: avgTime,
          estimatedTimeRemaining: estimatedRemaining
        }));

        // Call progress callback
        if (onProgressUpdate) {
          onProgressUpdate({
            progress: progressPercent,
            completed: completedVideos.length,
            failed: failedList.length,
            total
          });
        }
      }

      // Retry failed if enabled
      if (settings.retryFailed && failedList.length > 0) {
        showSuccess(`Retrying ${failedList.length} failed videos...`);

        for (const failed of failedList) {
          for (let retry = 0; retry < settings.maxRetries; retry++) {
            const retryResult = await generateSingleVideo(failed.contact, failed.index);

            if (retryResult.success) {
              completedVideos.push(retryResult);
              setGeneratedVideos(prev => [...prev, retryResult]);

              // Remove from failed list
              setFailedVideos(prev => prev.filter(v => v.index !== failed.index));
              break;
            }
          }
        }
      }

      // Generation complete
      setIsGenerating(false);
      showSuccess(`Generated ${completedVideos.length} personalized videos!`);

      if (onGenerationComplete) {
        onGenerationComplete({
          generated: completedVideos,
          failed: failedList.filter(f =>
            !completedVideos.find(c => c.index === f.index)
          ),
          total,
          stats
        });
      }

    } catch (error) {
      console.error('Batch generation error:', error);
      showError('Batch generation failed');
      setIsGenerating(false);
    }
  }, [contacts, baseVideo, settings, generateSingleVideo, onGenerationComplete, onProgressUpdate, stats, isPaused]);

  // Pause generation
  const pauseGeneration = useCallback(() => {
    setIsPaused(true);
  }, []);

  // Resume generation
  const resumeGeneration = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Stop generation
  const stopGeneration = useCallback(() => {
    setIsGenerating(false);
    setIsPaused(false);
    showSuccess('Generation stopped');
  }, []);

  // Format time
  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Export results as CSV
  const exportResults = useCallback(() => {
    const csvContent = [
      ['Email', 'Name', 'Company', 'Status', 'Video URL', 'Processing Time'].join(','),
      ...generatedVideos.map(result => [
        result.contact.email,
        `${result.contact.firstName} ${result.contact.lastName}`,
        result.contact.company,
        'Success',
        result.video?.url || '',
        `${(result.processingTime / 1000).toFixed(2)}s`
      ].join(',')),
      ...failedVideos.map(result => [
        result.contact.email,
        `${result.contact.firstName} ${result.contact.lastName}`,
        result.contact.company,
        `Failed: ${result.error}`,
        '',
        ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-generation-results-${Date.now()}.csv`;
    link.click();

    showSuccess('Results exported to CSV');
  }, [generatedVideos, failedVideos]);

  return (
    <div className="batch-generator">
      <div className="generator-header">
        <h2>Batch Video Generator</h2>
        <p>Generate personalized videos for {contacts.length} contacts</p>
      </div>

      <div className="generator-content">
        {/* Settings */}
        <div className="settings-section">
          <h3>Generation Settings</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Concurrent Jobs</label>
              <select
                value={settings.concurrentJobs}
                onChange={(e) => setSettings(prev => ({ ...prev, concurrentJobs: parseInt(e.target.value) }))}
                disabled={isGenerating}
              >
                <option value="1">1 (Slower, less resource usage)</option>
                <option value="3">3 (Balanced)</option>
                <option value="5">5 (Faster, more resource usage)</option>
              </select>
            </div>

            <div className="setting-item">
              <label>Video Quality</label>
              <select
                value={settings.quality}
                onChange={(e) => setSettings(prev => ({ ...prev, quality: e.target.value }))}
                disabled={isGenerating}
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.retryFailed}
                  onChange={(e) => setSettings(prev => ({ ...prev, retryFailed: e.target.checked }))}
                  disabled={isGenerating}
                />
                Retry Failed Videos
              </label>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.generateThumbnails}
                  onChange={(e) => setSettings(prev => ({ ...prev, generateThumbnails: e.target.checked }))}
                  disabled={isGenerating}
                />
                Generate Thumbnails
              </label>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-section">
          <div className="progress-header">
            <h3>Generation Progress</h3>
            <div className="progress-stats">
              <span className="stat">
                <strong>{stats.completed}</strong> completed
              </span>
              <span className="stat">
                <strong>{stats.failed}</strong> failed
              </span>
              <span className="stat">
                <strong>{stats.pending}</strong> pending
              </span>
            </div>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
            <div className="progress-text">
              {isGenerating ? (
                <>
                  {isPaused ? 'Paused' : 'Generating'}...
                  {stats.estimatedTimeRemaining > 0 && (
                    <span> ~{formatTime(stats.estimatedTimeRemaining)} remaining</span>
                  )}
                </>
              ) : (
                'Ready to generate'
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="generation-controls">
            {!isGenerating ? (
              <button
                className="btn btn-primary start-btn"
                onClick={startGeneration}
                disabled={contacts.length === 0 || !baseVideo}
              >
                Start Generation ({contacts.length} videos)
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    className="btn btn-primary"
                    onClick={resumeGeneration}
                  >
                    Resume Generation
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={pauseGeneration}
                  >
                    Pause Generation
                  </button>
                )}
                <button
                  className="btn btn-danger"
                  onClick={stopGeneration}
                >
                  Stop Generation
                </button>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="results-section">
          <div className="results-header">
            <h3>Generated Videos ({generatedVideos.length})</h3>
            {generatedVideos.length > 0 && (
              <button
                className="btn btn-secondary export-btn"
                onClick={exportResults}
              >
                Export Results CSV
              </button>
            )}
          </div>

          <div className="results-list">
            {generatedVideos.length === 0 && failedVideos.length === 0 ? (
              <div className="empty-state">
                <p>No videos generated yet. Start generation to see results.</p>
              </div>
            ) : (
              <>
                {/* Successful Videos */}
                {generatedVideos.map((result, index) => (
                  <div key={index} className="result-item success">
                    <div className="result-status">✓</div>
                    <div className="result-info">
                      <div className="result-name">
                        {result.contact.firstName} {result.contact.lastName}
                      </div>
                      <div className="result-email">{result.contact.email}</div>
                      <div className="result-company">{result.contact.company}</div>
                    </div>
                    <div className="result-meta">
                      <span className="result-time">
                        {(result.processingTime / 1000).toFixed(1)}s
                      </span>
                      <a
                        href={result.video?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="result-link"
                      >
                        View Video
                      </a>
                    </div>
                  </div>
                ))}

                {/* Failed Videos */}
                {failedVideos.map((result, index) => (
                  <div key={`failed-${index}`} className="result-item failed">
                    <div className="result-status">✗</div>
                    <div className="result-info">
                      <div className="result-name">
                        {result.contact.firstName} {result.contact.lastName}
                      </div>
                      <div className="result-email">{result.contact.email}</div>
                      <div className="result-error">{result.error}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Summary */}
        {!isGenerating && (generatedVideos.length > 0 || failedVideos.length > 0) && (
          <div className="summary-section">
            <h3>Generation Summary</h3>
            <div className="summary-stats">
              <div className="summary-item">
                <span className="summary-label">Total Contacts</span>
                <span className="summary-value">{stats.total}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Successfully Generated</span>
                <span className="summary-value success">{stats.completed}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Failed</span>
                <span className="summary-value failed">{stats.failed}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Success Rate</span>
                <span className="summary-value">
                  {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Average Processing Time</span>
                <span className="summary-value">
                  {stats.averageTime > 0 ? (stats.averageTime / 1000).toFixed(1) + 's' : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

BatchGenerator.propTypes = {
  baseVideo: PropTypes.object,
  contacts: PropTypes.array,
  personalizationConfig: PropTypes.object,
  onGenerationComplete: PropTypes.func,
  onProgressUpdate: PropTypes.func
};

export default observer(BatchGenerator);