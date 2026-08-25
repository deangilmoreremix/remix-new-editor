// PersonalizationEditor - Edit recorded video with personalization markers
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError, showSuccess } from '../lib/services/alertService';
import { tokens as defaultTokens } from '../lib/constants/tokens';

const PersonalizationEditor = ({
  videoUrl,
  videoDuration = 0,
  onPersonalizationComplete,
  availableTokens = defaultTokens
}) => {
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(videoDuration);

  // Personalization markers
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Token management
  const [customTokens, setCustomTokens] = useState([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenValue, setNewTokenValue] = useState('');

  // Preview state
  const [previewContact, setPreviewContact] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    company: 'Acme Corp',
    website: 'https://acme.com'
  });

  // Refs
  const videoRef = useRef(null);
  const timelineRef = useRef(null);

  // Initialize video
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }
  }, [videoUrl]);

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Handle video loaded
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Play/pause video
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Seek to time
  const seekTo = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Add marker at current time
  const addMarker = useCallback((token, defaultValue = '') => {
    const newMarker = {
      id: `marker-${Date.now()}`,
      time: currentTime,
      token: token,
      defaultValue: defaultValue,
      duration: 3, // Default 3 second display
      position: { x: 100, y: 200 }, // Default position
      style: {
        fontSize: 48,
        color: '#FFFFFF',
        fontFamily: 'Arial'
      }
    };

    setMarkers(prev => [...prev, newMarker].sort((a, b) => a.time - b.time));
    setSelectedMarker(newMarker.id);
    showSuccess(`Marker added at ${formatTime(currentTime)}`);
  }, [currentTime]);

  // Update marker
  const updateMarker = useCallback((markerId, updates) => {
    setMarkers(prev => prev.map(marker =>
      marker.id === markerId ? { ...marker, ...updates } : marker
    ));
  }, []);

  // Delete marker
  const deleteMarker = useCallback((markerId) => {
    setMarkers(prev => prev.filter(marker => marker.id !== markerId));
    if (selectedMarker === markerId) {
      setSelectedMarker(null);
    }
    showSuccess('Marker deleted');
  }, [selectedMarker]);

  // Add custom token
  const addCustomToken = useCallback(() => {
    if (!newTokenName.trim()) {
      showError('Please enter a token name');
      return;
    }

    const tokenKey = newTokenName.toUpperCase().replace(/\s+/g, '_');

    if (customTokens.find(t => t.key === tokenKey)) {
      showError('Token already exists');
      return;
    }

    setCustomTokens(prev => [...prev, {
      key: tokenKey,
      label: newTokenName,
      defaultValue: newTokenValue
    }]);

    setNewTokenName('');
    setNewTokenValue('');
    showSuccess(`Custom token {{${tokenKey}}} added`);
  }, [newTokenName, newTokenValue, customTokens]);

  // Replace tokens in text for preview
  const replaceTokensForPreview = useCallback((text) => {
    let result = text;

    // Replace standard tokens
    Object.entries(previewContact).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key.toUpperCase()}}}`, 'g');
      result = result.replace(regex, value);
    });

    // Replace custom tokens
    customTokens.forEach(token => {
      const regex = new RegExp(`{{${token.key}}}`, 'g');
      result = result.replace(regex, token.defaultValue || `[${token.key}]`);
    });

    return result;
  }, [previewContact, customTokens]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save personalization configuration
  const savePersonalization = useCallback(() => {
    const config = {
      videoUrl,
      markers,
      customTokens,
      previewContact,
      createdAt: new Date().toISOString()
    };

    if (onPersonalizationComplete) {
      onPersonalizationComplete(config);
    }

    showSuccess('Personalization configuration saved!');
  }, [videoUrl, markers, customTokens, previewContact, onPersonalizationComplete]);

  // Get all available tokens (standard + custom)
  const allTokens = [...availableTokens.map(t => ({ key: t, label: t })), ...customTokens];

  return (
    <div className="personalization-editor">
      <div className="editor-header">
        <h2>Personalization Editor</h2>
        <p>Add and manage personalization markers for your video</p>
      </div>

      <div className="editor-content">
        {/* Video Preview Section */}
        <div className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controls={false}
              className="video-player"
            />

            {/* Marker Overlays */}
            {markers.map(marker => {
              const isVisible = currentTime >= marker.time && currentTime <= marker.time + marker.duration;
              if (!isVisible) return null;

              return (
                <div
                  key={marker.id}
                  className={classnames('marker-overlay', { 'selected': selectedMarker === marker.id })}
                  style={{
                    left: `${marker.position.x}px`,
                    top: `${marker.position.y}px`,
                    fontSize: `${marker.style.fontSize}px`,
                    color: marker.style.color,
                    fontFamily: marker.style.fontFamily
                  }}
                >
                  {replaceTokensForPreview(`{{${marker.token}}}`)}
                </div>
              );
            })}
          </div>

          {/* Video Controls */}
          <div className="video-controls">
            <button
              className="play-btn"
              onClick={togglePlayPause}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>

            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <button
              className="add-marker-btn"
              onClick={() => addMarker('FIRSTNAME', 'John')}
            >
              + Add Marker
            </button>
          </div>

          {/* Timeline */}
          <div
            ref={timelineRef}
            className="timeline"
            onClick={(e) => {
              const rect = timelineRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percentage = clickX / rect.width;
              seekTo(percentage * duration);
            }}
          >
            <div
              className="playhead"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />

            {markers.map(marker => (
              <div
                key={marker.id}
                className={classnames('timeline-marker', { 'selected': selectedMarker === marker.id })}
                style={{ left: `${(marker.time / duration) * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMarker(marker.id);
                  seekTo(marker.time);
                }}
              >
                <div className="marker-label">{marker.token}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Marker Editor Section */}
        <div className="marker-section">
          <div className="section-header">
            <h3>Personalization Markers</h3>
            <p>Click on timeline to add markers at specific times</p>
          </div>

          {/* Add Marker Form */}
          <div className="add-marker-form">
            <label>Token</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addMarker(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">Select token to add...</option>
              {allTokens.map(token => (
                <option key={token.key} value={token.key}>
                  {`{{${token.key}}}`} - {token.label}
                </option>
              ))}
            </select>
          </div>

          {/* Markers List */}
          <div className="markers-list">
            {markers.length === 0 ? (
              <div className="empty-state">
                <p>No markers yet. Click on the timeline to add personalization points.</p>
              </div>
            ) : (
              markers.map(marker => (
                <div
                  key={marker.id}
                  className={classnames('marker-item', { 'selected': selectedMarker === marker.id })}
                  onClick={() => {
                    setSelectedMarker(marker.id);
                    seekTo(marker.time);
                  }}
                >
                  <div className="marker-info">
                    <span className="marker-token">{`{{${marker.token}}}`}</span>
                    <span className="marker-time">{formatTime(marker.time)}</span>
                  </div>

                  {selectedMarker === marker.id && (
                    <div className="marker-details">
                      <div className="detail-row">
                        <label>Duration (seconds)</label>
                        <input
                          type="number"
                          min="0.5"
                          max="10"
                          step="0.5"
                          value={marker.duration}
                          onChange={(e) => updateMarker(marker.id, { duration: parseFloat(e.target.value) })}
                        />
                      </div>

                      <div className="detail-row">
                        <label>Default Value</label>
                        <input
                          type="text"
                          placeholder="Value if contact data missing"
                          value={marker.defaultValue}
                          onChange={(e) => updateMarker(marker.id, { defaultValue: e.target.value })}
                        />
                      </div>

                      <div className="detail-row">
                        <label>Font Size</label>
                        <input
                          type="range"
                          min="12"
                          max="96"
                          value={marker.style.fontSize}
                          onChange={(e) => updateMarker(marker.id, {
                            style: { ...marker.style, fontSize: parseInt(e.target.value) }
                          })}
                        />
                        <span>{marker.style.fontSize}px</span>
                      </div>

                      <div className="detail-row">
                        <label>Color</label>
                        <input
                          type="color"
                          value={marker.style.color}
                          onChange={(e) => updateMarker(marker.id, {
                            style: { ...marker.style, color: e.target.value }
                          })}
                        />
                      </div>

                      <button
                        className="delete-marker-btn"
                        onClick={() => deleteMarker(marker.id)}
                      >
                        Delete Marker
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Custom Tokens Section */}
          <div className="custom-tokens-section">
            <h4>Custom Tokens</h4>
            <div className="add-token-form">
              <input
                type="text"
                placeholder="Token Name (e.g., CUSTOM_FIELD)"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Default Value"
                value={newTokenValue}
                onChange={(e) => setNewTokenValue(e.target.value)}
              />
              <button onClick={addCustomToken}>Add Token</button>
            </div>

            {customTokens.length > 0 && (
              <div className="custom-tokens-list">
                {customTokens.map(token => (
                  <div key={token.key} className="custom-token-item">
                    <span className="token-key">{`{{${token.key}}}`}</span>
                    <span className="token-value">{token.defaultValue || '(empty)'}</span>
                    <button
                      className="remove-token-btn"
                      onClick={() => setCustomTokens(prev => prev.filter(t => t.key !== token.key))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className="preview-section">
          <h3>Preview with Sample Contact</h3>
          <div className="preview-contact-form">
            <div className="form-row">
              <label>First Name</label>
              <input
                type="text"
                value={previewContact.firstName}
                onChange={(e) => setPreviewContact(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label>Last Name</label>
              <input
                type="text"
                value={previewContact.lastName}
                onChange={(e) => setPreviewContact(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                value={previewContact.email}
                onChange={(e) => setPreviewContact(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label>Company</label>
              <input
                type="text"
                value={previewContact.company}
                onChange={(e) => setPreviewContact(prev => ({ ...prev, company: e.target.value }))}
              />
            </div>
          </div>

          <div className="preview-results">
            {markers.map(marker => (
              <div key={marker.id} className="preview-item">
                <span className="preview-time">{formatTime(marker.time)}</span>
                <span className="preview-token">{`{{${marker.token}}}`}</span>
                <span className="preview-arrow">→</span>
                <span className="preview-value">
                  {replaceTokensForPreview(`{{${marker.token}}}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="editor-footer">
        <div className="markers-count">
          {markers.length} personalization marker{markers.length !== 1 ? 's' : ''} added
        </div>
        <button
          className="save-btn"
          onClick={savePersonalization}
          disabled={markers.length === 0}
        >
          Save Personalization Configuration
        </button>
      </div>
    </div>
  );
};

PersonalizationEditor.propTypes = {
  videoUrl: PropTypes.string.isRequired,
  videoDuration: PropTypes.number,
  onPersonalizationComplete: PropTypes.func,
  availableTokens: PropTypes.array
};

export default observer(PersonalizationEditor);