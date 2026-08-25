// Enhanced Recorder Modal with Cap Integration + Teleprompter
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { ClipLoader } from 'react-spinners';

import useMediaStore from '../hooks/useMediaStore';
import useUiStore from '../hooks/useUIStore';
import useProjectStore from '../hooks/useProjectStore';
import useUserStore from '../hooks/useUserStore';

import { LIBRARY_TABS } from '../../lib/constants/library';
import { showError, showSuccess } from '../../lib/services/alertService';
import { getCapRecorder } from '../../lib/utils/capRecorder';
import TeleprompterModal from './TeleprompterModal';

const RECORDER_MODES = {
  TRADITIONAL: 'traditional',
  CAP_ENHANCED: 'cap_enhanced'
};

export default observer(({ options: { type, useAudio }, handleClose }) => {
  const [recorderMode, setRecorderMode] = useState(RECORDER_MODES.CAP_ENHANCED);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingData, setRecordingData] = useState(null);
  const [displayOptions, setDisplayOptions] = useState([]);
  const [selectedDisplay, setSelectedDisplay] = useState('screen');
  const [recordingOptions, setRecordingOptions] = useState({
    audioSource: 'microphone',
    cursorMode: 'show',
    quality: 'high',
    frameRate: 30
  });

  // Teleprompter state
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleprompterScript, setTeleprompterScript] = useState('');
  const [teleprompterTokens, setTeleprompterTokens] = useState({});

  const capRecorder = useRef(null);
  const timerRef = useRef(null);

  const {
    uploadMedia,
    storeAsset,
  } = useMediaStore();

  const {
    setLibraryType,
  } = useUiStore();

  const {
    addElement,
  } = useProjectStore();

  useEffect(() => {
    // Initialize Cap recorder
    capRecorder.current = getCapRecorder();

    // Load display options
    loadDisplayOptions();

    return () => {
      if (capRecorder.current) {
        capRecorder.current.dispose();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const loadDisplayOptions = async () => {
    try {
      const options = await capRecorder.current.getDisplayOptions();
      setDisplayOptions(options);
    } catch (error) {
      console.warn('Could not load display options:', error);
    }
  };

  const startRecording = async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      if (recorderMode === RECORDER_MODES.CAP_ENHANCED) {
        // Use Cap enhanced recording
        const result = await capRecorder.current.startRecording({
          displayId: selectedDisplay,
          audioSource: recordingOptions.audioSource,
          cursorMode: recordingOptions.cursorMode,
          quality: recordingOptions.quality,
          frameRate: recordingOptions.frameRate,
          onDataAvailable: (data) => {
            // Handle real-time data if needed
          },
          onStop: (chunks) => {
            handleRecordingComplete(chunks);
          }
        });

        setRecordingData(result);
      } else {
        // Use traditional recording (existing implementation)
        // This would use the existing videojs/recordrtc setup
        showError('Traditional recording not implemented in this enhanced version');
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

    } catch (error) {
      console.error('Recording failed:', error);
      showError(`Recording failed: ${error.message}`);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      const result = await capRecorder.current.stopRecording();
      if (result) {
        await handleRecordingComplete([result.blob]);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      showError('Failed to save recording');
      setIsProcessing(false);
    }
  };

  const handleRecordingComplete = async (chunks) => {
    try {
      const mimeType = chunks[0]?.type || 'video/webm';
      const blob = chunks.length === 1 ? chunks[0] : new Blob(chunks, { type: mimeType });

      // Get duration if possible
      let duration = 0;
      try {
        if (window.getBlobDuration) {
          duration = await window.getBlobDuration(blob);
        }
      } catch (e) {
        // Duration estimation failed, use timer
        duration = recordingTime;
      }

      const fileName = `recording_${Date.now()}.${mimeType.split('/')[1].split(';')[0]}`;

      // Create file object for upload
      const file = new File([blob], fileName, { type: mimeType });

      // Upload to media library
      const uploadResult = await uploadMedia(file, {
        type: 'video',
        name: fileName,
        duration: Math.round(duration * 1000), // Convert to milliseconds
      });

      if (uploadResult) {
        // Add to project
        await addElement({
          src: uploadResult.url,
          type: 'video',
          name: uploadResult.name || fileName,
          duration: Math.round(duration * 1000),
          kind: 'video'
        });

        setLibraryType(LIBRARY_TABS.MEDIA);
        showSuccess('Recording saved to your media library!');
      }

    } catch (error) {
      console.error('Failed to process recording:', error);
      showError('Failed to save recording to library');
    } finally {
      setIsProcessing(false);
      setRecordingData(null);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Handle teleprompter start
  const handleTeleprompterStart = useCallback((teleprompterData) => {
    setTeleprompterScript(teleprompterData.script);
    setTeleprompterTokens(teleprompterData.tokens);
    setShowTeleprompter(false);

    // Start recording after teleprompter countdown
    setTimeout(() => {
      startRecording();
    }, (teleprompterData.settings?.countdownTimer || 3) * 1000);
  }, [startRecording]);

  return (
    <div className="enhanced-recorder-modal">
      {/* Teleprompter Modal */}
      {showTeleprompter && (
        <TeleprompterModal
          handleClose={() => setShowTeleprompter(false)}
          onStartRecording={handleTeleprompterStart}
          initialScript={teleprompterScript}
          tokens={teleprompterTokens}
        />
      )}

      <div className="recorder-modal__header">
        <div className="recorder-modal__title-section">
          <h2 className="recorder-modal__title">
            {recorderMode === RECORDER_MODES.CAP_ENHANCED ? 'Cap Enhanced Recorder' : 'Screen Recorder'}
          </h2>
          <p className="recorder-modal__subtitle">
            Professional screen recording with advanced features
          </p>
        </div>
        <button
          className="recorder-modal__close"
          onClick={handleClose}
          disabled={isRecording || isProcessing}
        >
          ✕
        </button>
      </div>

      <div className="recorder-modal__content">
        {/* Mode Selection */}
        <div className="recorder-modal__section">
          <label className="recorder-modal__section-label">Recording Engine</label>
          <div className="recorder-modal__mode-selector">
            <button
              className={`recorder-modal__mode-btn ${recorderMode === RECORDER_MODES.TRADITIONAL ? 'active' : ''}`}
              onClick={() => setRecorderMode(RECORDER_MODES.TRADITIONAL)}
              disabled={isRecording}
            >
              Traditional
            </button>
            <button
              className={`recorder-modal__mode-btn ${recorderMode === RECORDER_MODES.CAP_ENHANCED ? 'active' : ''}`}
              onClick={() => setRecorderMode(RECORDER_MODES.CAP_ENHANCED)}
              disabled={isRecording}
            >
              Cap Enhanced
            </button>
          </div>
        </div>

        {recorderMode === RECORDER_MODES.CAP_ENHANCED && (
          <>
            {/* Display Selection */}
            <div className="recorder-modal__section">
              <label className="recorder-modal__section-label">Display Source</label>
              <select
                className="recorder-modal__select"
                value={selectedDisplay}
                onChange={(e) => setSelectedDisplay(e.target.value)}
                disabled={isRecording}
              >
                {displayOptions.displays?.map(display => (
                  <option key={display.id} value={display.id}>
                    {display.name} ({display.width}x{display.height})
                  </option>
                ))}
                <option value="screen">Screen</option>
                <option value="window">Window</option>
              </select>
            </div>

            {/* Recording Options */}
            <div className="recorder-modal__section">
              <label className="recorder-modal__section-label">Recording Options</label>
              <div className="recorder-modal__options-grid">
                <div className="recorder-modal__option">
                  <label>Audio Source</label>
                  <select
                    value={recordingOptions.audioSource}
                    onChange={(e) => setRecordingOptions(prev => ({ ...prev, audioSource: e.target.value }))}
                    disabled={isRecording}
                  >
                    <option value="none">No Audio</option>
                    <option value="microphone">Microphone</option>
                    <option value="system">System Audio (Limited)</option>
                  </select>
                </div>

                <div className="recorder-modal__option">
                  <label>Cursor Mode</label>
                  <select
                    value={recordingOptions.cursorMode}
                    onChange={(e) => setRecordingOptions(prev => ({ ...prev, cursorMode: e.target.value }))}
                    disabled={isRecording}
                  >
                    <option value="show">Show Cursor</option>
                    <option value="hide">Hide Cursor</option>
                    <option value="highlight">Highlight Clicks</option>
                  </select>
                </div>

                <div className="recorder-modal__option">
                  <label>Quality</label>
                  <select
                    value={recordingOptions.quality}
                    onChange={(e) => setRecordingOptions(prev => ({ ...prev, quality: e.target.value }))}
                    disabled={isRecording}
                  >
                    <option value="low">Low (1 Mbps)</option>
                    <option value="medium">Medium (2.5 Mbps)</option>
                    <option value="high">High (5 Mbps)</option>
                    <option value="ultra">Ultra (10 Mbps)</option>
                  </select>
                </div>

                <div className="recorder-modal__option">
                  <label>Frame Rate</label>
                  <select
                    value={recordingOptions.frameRate}
                    onChange={(e) => setRecordingOptions(prev => ({ ...prev, frameRate: parseInt(e.target.value) }))}
                    disabled={isRecording}
                  >
                    <option value="24">24 fps</option>
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Teleprompter Button */}
        <div className="recorder-modal__section">
          <button
            className="recorder-modal__teleprompter-btn"
            onClick={() => setShowTeleprompter(true)}
            disabled={isRecording || isProcessing}
          >
            🎬 Use Teleprompter
          </button>
          {teleprompterScript && (
            <p className="recorder-modal__script-preview">
              Script ready: {teleprompterScript.substring(0, 50)}...
            </p>
          )}
        </div>

        {/* Recording Controls */}
        <div className="recorder-modal__controls">
          <button
            className={`recorder-modal__record-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <ClipLoader size={20} color="#fff" />
                Processing...
              </>
            ) : isRecording ? (
              <>
                <span className="record-indicator"></span>
                Stop Recording ({formatTime(recordingTime)})
              </>
            ) : (
              'Start Recording'
            )}
          </button>
        </div>

        {/* Recording Preview (when available) */}
        {recordingData?.stream && (
          <div className="recorder-modal__preview">
            <video
              ref={(el) => {
                if (el && recordingData.stream) {
                  el.srcObject = recordingData.stream;
                }
              }}
              autoPlay
              muted
              className="recorder-modal__preview-video"
            />
          </div>
        )}
      </div>
    </div>
  );
});