// VideoRecorder Component - Cap-style screen and webcam recording
import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';

import { showError, showSuccess } from '../lib/services/alertService';

const VideoRecorder = ({
  onRecordingComplete,
  onRecordingError,
  maxDuration = 60,
  allowScreen = true,
  allowCamera = true
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [recordingMode, setRecordingMode] = useState('camera'); // 'camera', 'screen', 'both'
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasScreenPermission, setHasScreenPermission] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMediaTracks();
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Request camera permission on mount
  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      streamRef.current = stream;
      setHasCameraPermission(true);
    } catch (error) {
      console.error('Camera permission denied:', error);
      setHasCameraPermission(false);
      showError('Camera access denied. Please allow camera access to record.');
    }
  };

  const requestScreenPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });
      
      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (isRecording) {
          stopRecording();
        }
      };
      
      setHasScreenPermission(true);
      return stream;
    } catch (error) {
      console.error('Screen permission denied:', error);
      setHasScreenPermission(false);
      showError('Screen sharing denied. Please allow screen sharing to record.');
      return null;
    }
  };

  const startRecording = async () => {
    if (!hasCameraPermission && recordingMode !== 'screen') {
      await requestCameraPermission();
    }

    // Start countdown
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          beginRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const beginRecording = async () => {
    try {
      let combinedStream;

      if (recordingMode === 'camera') {
        // Camera only
        combinedStream = streamRef.current;
      } else if (recordingMode === 'screen') {
        // Screen only
        const screenStream = await requestScreenPermission();
        if (!screenStream) return;
        combinedStream = screenStream;
      } else if (recordingMode === 'both') {
        // Both camera and screen (picture-in-picture)
        const screenStream = await requestScreenPermission();
        if (!screenStream) return;
        
        // Create canvas to combine streams
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        const screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        screenVideo.play();
        
        const cameraVideo = document.createElement('video');
        cameraVideo.srcObject = streamRef.current;
        cameraVideo.play();
        
        // Capture canvas stream
        const canvasStream = canvas.captureStream(30);
        
        // Add audio tracks
        screenStream.getAudioTracks().forEach(track => {
          canvasStream.addTrack(track);
        });
        streamRef.current.getAudioTracks().forEach(track => {
          canvasStream.addTrack(track);
        });
        
        combinedStream = canvasStream;
        
        // Draw loop
        const draw = () => {
          if (!isRecording) return;
          
          // Draw screen full size
          ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
          
          // Draw camera in corner (picture-in-picture)
          const pipWidth = 320;
          const pipHeight = 240;
          const pipX = canvas.width - pipWidth - 20;
          const pipY = canvas.height - pipHeight - 20;
          
          // Draw rounded rectangle for PIP
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(pipX - 5, pipY - 5, pipWidth + 10, pipHeight + 10, 10);
          ctx.fillStyle = '#000';
          ctx.fill();
          ctx.restore();
          
          ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
          
          requestAnimationFrame(draw);
        };
        draw();
      }

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000 // 5 Mbps
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        if (onRecordingComplete) {
          onRecordingComplete({
            blob,
            url,
            duration: recordingTime,
            type: 'video/webm'
          });
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      showSuccess('Recording started!');

    } catch (error) {
      console.error('Failed to start recording:', error);
      showError('Failed to start recording: ' + error.message);
      if (onRecordingError) onRecordingError(error);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
      
      // Stop all tracks
      stopMediaTracks();
    }
  };

  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const discardRecording = () => {
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordingTime(0);
    requestCameraPermission(); // Restart camera preview
  };

  const saveRecording = () => {
    if (recordedBlob && onRecordingComplete) {
      onRecordingComplete({
        blob: recordedBlob,
        url: previewUrl,
        duration: recordingTime,
        type: 'video/webm'
      });
      showSuccess('Recording saved!');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-recorder">
      <div className="recorder-header">
        <h3 className="recorder-title">Record Your Video</h3>
        <p className="recorder-subtitle">
          Record yourself once, then personalize for each contact
        </p>
      </div>

      {/* Recording Mode Selector */}
      <div className="recording-modes">
        {allowCamera && (
          <button
            className={classnames('mode-btn', { active: recordingMode === 'camera' })}
            onClick={() => setRecordingMode('camera')}
            disabled={isRecording}
          >
            <span className="mode-icon">📹</span>
            <span className="mode-label">Camera Only</span>
          </button>
        )}
        
        {allowScreen && (
          <button
            className={classnames('mode-btn', { active: recordingMode === 'screen' })}
            onClick={() => setRecordingMode('screen')}
            disabled={isRecording}
          >
            <span className="mode-icon">🖥️</span>
            <span className="mode-label">Screen Only</span>
          </button>
        )}
        
        {allowCamera && allowScreen && (
          <button
            className={classnames('mode-btn', { active: recordingMode === 'both' })}
            onClick={() => setRecordingMode('both')}
            disabled={isRecording}
          >
            <span className="mode-icon">🎬</span>
            <span className="mode-label">Camera + Screen</span>
          </button>
        )}
      </div>

      {/* Video Preview */}
      <div className="preview-container">
        {previewUrl ? (
          <video
            ref={videoRef}
            src={previewUrl}
            controls
            className="video-preview"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="camera-preview"
          />
        )}

        {/* Recording Overlay */}
        {isRecording && (
          <div className="recording-overlay">
            <div className="recording-indicator">
              <span className={classnames('recording-dot', { paused: isPaused })}></span>
              <span className="recording-status">
                {isPaused ? 'PAUSED' : 'REC'}
              </span>
            </div>
            <div className="recording-timer">
              {formatTime(recordingTime)} / {formatTime(maxDuration)}
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {countdown > 0 && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
          </div>
        )}
      </div>

      {/* Recording Progress Bar */}
      {isRecording && (
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
          ></div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="recorder-controls">
        {!isRecording && !previewUrl && (
          <button
            className="record-btn"
            onClick={startRecording}
            disabled={!hasCameraPermission || countdown > 0}
          >
            <span className="btn-icon">🔴</span>
            Start Recording
          </button>
        )}

        {isRecording && !isPaused && (
          <>
            <button className="pause-btn" onClick={pauseRecording}>
              <span className="btn-icon">⏸️</span>
              Pause
            </button>
            <button className="stop-btn" onClick={stopRecording}>
              <span className="btn-icon">⏹️</span>
              Stop
            </button>
          </>
        )}

        {isRecording && isPaused && (
          <>
            <button className="resume-btn" onClick={resumeRecording}>
              <span className="btn-icon">▶️</span>
              Resume
            </button>
            <button className="stop-btn" onClick={stopRecording}>
              <span className="btn-icon">⏹️</span>
              Stop
            </button>
          </>
        )}

        {previewUrl && (
          <>
            <button className="discard-btn" onClick={discardRecording}>
              <span className="btn-icon">🗑️</span>
              Record Again
            </button>
            <button className="save-btn" onClick={saveRecording}>
              <span className="btn-icon">✅</span>
              Use This Recording
            </button>
          </>
        )}
      </div>

      {/* Recording Tips */}
      <div className="recording-tips">
        <h4>💡 Tips for a Great Recording</h4>
        <ul>
          <li>Speak clearly and at a moderate pace</li>
          <li>Use the contact's name naturally (e.g., "Hi there" or "Hey friend")</li>
          <li>Keep it under {maxDuration} seconds for best engagement</li>
          <li>Make sure you have good lighting</li>
          <li>Your voice will be cloned for personalization</li>
        </ul>
      </div>

      <style jsx>{`
        .video-recorder {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .recorder-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .recorder-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .recorder-subtitle {
          color: #666;
        }

        .recording-modes {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .mode-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn:hover:not(:disabled) {
          border-color: #007bff;
        }

        .mode-btn.active {
          border-color: #007bff;
          background: #f0f7ff;
        }

        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-icon {
          font-size: 24px;
        }

        .mode-label {
          font-size: 12px;
          font-weight: 500;
        }

        .preview-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #1a1a1a;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .camera-preview,
        .video-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .recording-overlay {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .recording-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.7);
          padding: 8px 16px;
          border-radius: 8px;
        }

        .recording-dot {
          width: 12px;
          height: 12px;
          background: #ff4444;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }

        .recording-dot.paused {
          animation: none;
          background: #ffaa00;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .recording-status {
          color: white;
          font-weight: 600;
          font-size: 14px;
        }

        .recording-timer {
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 18px;
        }

        .countdown-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
        }

        .countdown-number {
          font-size: 120px;
          font-weight: 700;
          color: white;
          animation: countdownPulse 1s ease-out;
        }

        @keyframes countdownPulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .progress-fill {
          height: 100%;
          background: #ff4444;
          transition: width 0.3s;
        }

        .recorder-controls {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .recorder-controls button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .record-btn {
          background: #ff4444;
          color: white;
        }

        .record-btn:hover:not(:disabled) {
          background: #cc0000;
        }

        .pause-btn {
          background: #ffaa00;
          color: white;
        }

        .resume-btn {
          background: #00aa44;
          color: white;
        }

        .stop-btn {
          background: #666;
          color: white;
        }

        .discard-btn {
          background: #f0f0f0;
          color: #666;
        }

        .save-btn {
          background: #007bff;
          color: white;
        }

        .save-btn:hover {
          background: #0056b3;
        }

        .btn-icon {
          font-size: 20px;
        }

        .recording-tips {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }

        .recording-tips h4 {
          margin-bottom: 12px;
          color: #333;
        }

        .recording-tips ul {
          margin: 0;
          padding-left: 20px;
          color: #666;
        }

        .recording-tips li {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};

export default VideoRecorder;