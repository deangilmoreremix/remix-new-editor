// Enhanced Video Player with analytics tracking
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';

import PropTypes from '../lib/PropTypes';
import { showError } from '../lib/services/alertService';

const VideoPlayer = ({
  src,
  poster,
  className,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  videoId,
  contactId,
  campaignId,
  analyticsService,
  onPlay,
  onPause,
  onComplete,
  onTimeUpdate,
  ...props
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Analytics tracking state
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [watchStartTime, setWatchStartTime] = useState(null);
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const [hasTrackedPlay, setHasTrackedPlay] = useState(false);

  // Initialize analytics session
  useEffect(() => {
    if (analyticsService && analyticsService.isEnabled()) {
      analyticsService.startSession({
        video_id: videoId,
        contact_id: contactId,
        campaign_id: campaignId,
        session_id: sessionId
      });
    }

    return () => {
      // Track session end on unmount
      if (analyticsService && analyticsService.isEnabled() && watchStartTime) {
        const sessionDuration = Date.now() - watchStartTime;
        analyticsService.endSession(sessionId, sessionDuration, {
          video_id: videoId,
          contact_id: contactId,
          total_watch_time: totalWatchTime
        });
      }
    };
  }, [analyticsService, videoId, contactId, campaignId, sessionId, watchStartTime, totalWatchTime]);

  // Video event handlers
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setWatchStartTime(Date.now());

    // Track play event
    if (analyticsService && analyticsService.isEnabled() && !hasTrackedPlay) {
      analyticsService.trackVideoPlay(videoId, contactId, {
        campaign_id: campaignId,
        session_id: sessionId,
        video_duration: duration
      });
      setHasTrackedPlay(true);
    }

    if (onPlay) {
      onPlay();
    }
  }, [analyticsService, videoId, contactId, campaignId, sessionId, duration, hasTrackedPlay, onPlay]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);

    // Track pause event and accumulate watch time
    if (analyticsService && analyticsService.isEnabled() && watchStartTime) {
      const watchDuration = Date.now() - watchStartTime;
      setTotalWatchTime(prev => prev + watchDuration);

      analyticsService.trackVideoPause(videoId, contactId, currentTime, {
        campaign_id: campaignId,
        session_id: sessionId,
        watch_duration: watchDuration,
        total_watch_time: totalWatchTime + watchDuration
      });
    }

    if (onPause) {
      onPause(currentTime);
    }
  }, [analyticsService, videoId, contactId, campaignId, sessionId, currentTime, watchStartTime, totalWatchTime, onPause]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);

    // Track completion event
    if (analyticsService && analyticsService.isEnabled()) {
      const finalWatchTime = totalWatchTime + (watchStartTime ? Date.now() - watchStartTime : 0);
      const completionRate = duration > 0 ? (finalWatchTime / (duration * 1000)) * 100 : 0;

      analyticsService.trackVideoComplete(videoId, contactId, finalWatchTime, {
        campaign_id: campaignId,
        session_id: sessionId,
        completion_rate: completionRate,
        total_watch_time: finalWatchTime
      });
    }

    if (onComplete) {
      onComplete();
    }
  }, [analyticsService, videoId, contactId, campaignId, sessionId, duration, totalWatchTime, watchStartTime, onComplete]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime;
      setCurrentTime(newTime);

      if (onTimeUpdate) {
        onTimeUpdate(newTime);
      }
    }
  }, [onTimeUpdate]);

  const handleSeeked = useCallback(() => {
    if (videoRef.current && analyticsService && analyticsService.isEnabled()) {
      const seekFrom = currentTime;
      const seekTo = videoRef.current.currentTime;

      analyticsService.trackVideoSeek(videoId, contactId, seekFrom, seekTo, {
        campaign_id: campaignId,
        session_id: sessionId
      });
    }
  }, [analyticsService, videoId, contactId, campaignId, sessionId, currentTime]);

  const handleError = useCallback((error) => {
    setHasError(true);
    setIsLoading(false);

    if (analyticsService && analyticsService.isEnabled()) {
      analyticsService.trackError(new Error('Video playback failed'), {
        video_id: videoId,
        contact_id: contactId,
        error_code: error?.target?.error?.code,
        error_message: error?.target?.error?.message
      });
    }

    showError('Failed to load video. Please try again.');
  }, [analyticsService, videoId, contactId]);

  // Format time display
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={classnames('video-player', className)}>
      <div className="video-container">
        {isLoading && (
          <div className="video-loading">
            <div className="loading-spinner"></div>
            <span>Loading video...</span>
          </div>
        )}

        {hasError && (
          <div className="video-error">
            <span className="error-icon">⚠️</span>
            <span>Failed to load video</span>
            <button
              className="retry-btn"
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
            >
              Retry
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          src={src}
          poster={poster}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          onLoadStart={handleLoadStart}
          onLoadedData={handleLoadedData}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onSeeked={handleSeeked}
          onError={handleError}
          className="video-element"
          {...props}
        />

        {/* Custom controls overlay (if needed) */}
        {controls && (
          <div className="video-overlay">
            <div className="video-info">
              {isPlaying && (
                <span className="play-indicator">▶️ Playing</span>
              )}
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .video-player {
          position: relative;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .video-container {
          position: relative;
          width: 100%;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .video-element {
          width: 100%;
          height: auto;
          display: block;
        }

        .video-loading,
        .video-error {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          z-index: 10;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .retry-btn {
          margin-top: 16px;
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .retry-btn:hover {
          background: #0056b3;
        }

        .video-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
          padding: 16px;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .video-container:hover .video-overlay {
          opacity: 1;
        }

        .video-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          font-size: 14px;
        }

        .play-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .time-display {
          font-family: monospace;
          font-weight: 500;
        }

        /* Responsive */
        @media (max-width: 600px) {
          .video-overlay {
            opacity: 1;
            background: rgba(0, 0, 0, 0.7);
          }

          .video-info {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

VideoPlayer.propTypes = {
  src: PropTypes.string.isRequired,
  poster: PropTypes.string,
  className: PropTypes.string,
  controls: PropTypes.bool,
  autoPlay: PropTypes.bool,
  loop: PropTypes.bool,
  muted: PropTypes.bool,
  videoId: PropTypes.string,
  contactId: PropTypes.string,
  campaignId: PropTypes.string,
  analyticsService: PropTypes.object,
  onPlay: PropTypes.func,
  onPause: PropTypes.func,
  onComplete: PropTypes.func,
  onTimeUpdate: PropTypes.func
};

export default observer(VideoPlayer);