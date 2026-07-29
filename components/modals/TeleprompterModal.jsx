// TeleprompterModal - Professional teleprompter for video recording
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { showError, showSuccess } from '../../lib/services/alertService';

import playIcon from '../../public/static/svgImages/play.svg';
import pauseIcon from '../../public/static/svgImages/pause.svg';
import stopIcon from '../../public/static/svgImages/stop.svg';
import settingsIcon from '../../public/static/svgImages/settings.svg';

const TeleprompterModal = ({
  handleClose,
  onStartRecording,
  initialScript = '',
  tokens = {}
}) => {
  // Script state
  const [script, setScript] = useState(initialScript || `Hello {{firstName}},

Thank you for taking the time to meet with us today. I'm excited to share how {{company}} can help your organization achieve its goals.

At {{company}}, we specialize in helping businesses like yours streamline operations and increase productivity. Our solutions have helped companies across {{industry}} achieve remarkable results.

I'd love to schedule a quick call to discuss how we can specifically help {{company}}. What does your calendar look like next week?

Looking forward to connecting!

Best regards`);

  // Teleprompter settings
  const [settings, setSettings] = useState({
    fontSize: 32,
    scrollSpeed: 50, // pixels per second
    highlightColor: '#007bff',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    mirrorMode: false,
    countdownTimer: 3,
    showSettings: false
  });

  // Teleprompter state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(settings.countdownTimer);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);

  // Refs
  const scrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Calculate word count and estimated duration
  useEffect(() => {
    const words = script.trim().split(/\s+/).filter(w => w.length > 0);
    setWordCount(words.length);
    // Average speaking rate: 150 words per minute
    setEstimatedDuration(Math.ceil(words.length / 150 * 60));
  }, [script]);

  // Process script with tokens
  const processScript = useCallback((text, tokenData) => {
    let processed = text;
    Object.entries(tokenData).forEach(([token, value]) => {
      const regex = new RegExp(`{{${token}}}`, 'g');
      processed = processed.replace(regex, value || `[${token}]`);
    });
    return processed;
  }, []);

  // Get processed script for display
  const getDisplayScript = useCallback(() => {
    return processScript(script, tokens);
  }, [script, tokens, processScript]);

  // Start scrolling
  const startScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    const scrollSpeed = settings.scrollSpeed / 60; // Convert to per-frame (assuming 60fps)

    scrollIntervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const newPosition = currentPosition + scrollSpeed;
        const maxScroll = scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight;

        if (newPosition >= maxScroll) {
          // Reached the end
          stopScrolling();
          showSuccess('Teleprompter finished!');
          return;
        }

        scrollContainerRef.current.scrollTop = newPosition;
        setCurrentPosition(newPosition);
      }
    }, 1000 / 60); // 60fps

    // Start elapsed time timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    setIsPlaying(true);
    setIsPaused(false);
  }, [currentPosition, settings.scrollSpeed]);

  // Stop scrolling
  const stopScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  // Pause scrolling
  const pauseScrolling = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  // Reset teleprompter
  const resetTeleprompter = useCallback(() => {
    stopScrolling();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setCurrentPosition(0);
    setElapsedTime(0);
  }, [stopScrolling]);

  // Start countdown and then recording
  const startWithCountdown = useCallback(() => {
    if (settings.countdownTimer > 0) {
      setShowCountdown(true);
      setCountdownValue(settings.countdownTimer);

      countdownIntervalRef.current = setInterval(() => {
        setCountdownValue(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            setShowCountdown(false);
            startScrolling();
            if (onStartRecording) {
              onStartRecording({
                script: getDisplayScript(),
                settings,
                tokens
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      startScrolling();
      if (onStartRecording) {
        onStartRecording({
          script: getDisplayScript(),
          settings,
          tokens
        });
      }
    }
  }, [settings, startScrolling, onStartRecording, getDisplayScript, tokens]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseScrolling();
    } else if (isPaused) {
      startScrolling();
    } else {
      startWithCountdown();
    }
  }, [isPlaying, isPaused, pauseScrolling, startScrolling, startWithCountdown]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Update scroll position when settings change
  useEffect(() => {
    if (scrollContainerRef.current && !isPlaying) {
      scrollContainerRef.current.scrollTop = currentPosition;
    }
  }, [settings.fontSize, settings.mirrorMode, currentPosition, isPlaying]);

  return (
    <div className="teleprompter-modal">
      {/* Header */}
      <div className="modal-header">
        <h2>Teleprompter</h2>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>

      {/* Main Content */}
      <div className="modal-content">
        {/* Script Editor (shown when not playing) */}
        {!isPlaying && !isPaused && (
          <div className="script-editor">
            <div className="editor-header">
              <h3>Script Editor</h3>
              <div className="script-stats">
                <span>{wordCount} words</span>
                <span>~{formatTime(estimatedDuration)} duration</span>
              </div>
            </div>
            <textarea
              className="script-textarea"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Enter your script here... Use {{token}} for personalization"
              rows={15}
            />
            <div className="token-hints">
              <p>Available tokens: {Object.keys(tokens).map(t => `{{${t}}}`).join(', ') || 'None'}</p>
            </div>
          </div>
        )}

        {/* Teleprompter Display */}
        <div
          className={classnames('teleprompter-display', {
            'mirror-mode': settings.mirrorMode,
            'is-playing': isPlaying || isPaused
          })}
          style={{
            backgroundColor: settings.backgroundColor,
            color: settings.textColor
          }}
        >
          {/* Countdown Overlay */}
          {showCountdown && (
            <div className="countdown-overlay">
              <div className="countdown-number">{countdownValue}</div>
            </div>
          )}

          {/* Script Display */}
          <div
            ref={scrollContainerRef}
            className="script-display"
            style={{
              fontSize: `${settings.fontSize}px`,
              transform: settings.mirrorMode ? 'scaleX(-1)' : 'none'
            }}
          >
            <div className="script-text">
              {getDisplayScript().split('\n').map((line, index) => (
                <p key={index} className="script-line">{line}</p>
              ))}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: scrollContainerRef.current
                  ? `${(currentPosition / (scrollContainerRef.current.scrollHeight - scrollContainerRef.current.clientHeight)) * 100}%`
                  : '0%'
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="controls-section">
          {/* Playback Controls */}
          <div className="playback-controls">
            <button
              className={classnames('control-btn', { 'active': isPlaying })}
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Start'}
            >
              <SVGInline svg={isPlaying ? pauseIcon : playIcon} />
            </button>

            <button
              className="control-btn"
              onClick={stopScrolling}
              disabled={!isPlaying && !isPaused}
              title="Stop"
            >
              <SVGInline svg={stopIcon} />
            </button>

            <button
              className="control-btn"
              onClick={resetTeleprompter}
              title="Reset"
            >
              ↺
            </button>
          </div>

          {/* Timer Display */}
          <div className="timer-display">
            <div className="elapsed-time">
              <span className="label">Elapsed</span>
              <span className="time">{formatTime(elapsedTime)}</span>
            </div>
            <div className="estimated-time">
              <span className="label">Est. Total</span>
              <span className="time">{formatTime(estimatedDuration)}</span>
            </div>
          </div>

          {/* Settings Toggle */}
          <button
            className="settings-btn"
            onClick={() => setSettings(prev => ({ ...prev, showSettings: !prev.showSettings }))}
          >
            <SVGInline svg={settingsIcon} />
            Settings
          </button>
        </div>

        {/* Settings Panel */}
        {settings.showSettings && (
          <div className="settings-panel">
            <div className="setting-group">
              <label>Font Size</label>
              <input
                type="range"
                min="20"
                max="72"
                value={settings.fontSize}
                onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
              />
              <span>{settings.fontSize}px</span>
            </div>

            <div className="setting-group">
              <label>Scroll Speed</label>
              <input
                type="range"
                min="20"
                max="150"
                value={settings.scrollSpeed}
                onChange={(e) => setSettings(prev => ({ ...prev, scrollSpeed: parseInt(e.target.value) }))}
              />
              <span>{settings.scrollSpeed} px/s</span>
            </div>

            <div className="setting-group">
              <label>Countdown Timer</label>
              <input
                type="range"
                min="0"
                max="10"
                value={settings.countdownTimer}
                onChange={(e) => setSettings(prev => ({ ...prev, countdownTimer: parseInt(e.target.value) }))}
              />
              <span>{settings.countdownTimer}s</span>
            </div>

            <div className="setting-group">
              <label>Background Color</label>
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => setSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
              />
            </div>

            <div className="setting-group">
              <label>Text Color</label>
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) => setSettings(prev => ({ ...prev, textColor: e.target.value }))}
              />
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.mirrorMode}
                  onChange={(e) => setSettings(prev => ({ ...prev, mirrorMode: e.target.checked }))}
                />
                Mirror Mode (for teleprompter glass)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={handleClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={startWithCountdown}
          disabled={isPlaying || script.trim().length === 0}
        >
          {isPlaying ? 'Recording...' : 'Start Recording with Teleprompter'}
        </button>
      </div>
    </div>
  );
};

TeleprompterModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  onStartRecording: PropTypes.func,
  initialScript: PropTypes.string,
  tokens: PropTypes.object
};

export default observer(TeleprompterModal);