// Video Personalizer Component - Handles token replacement and video generation
import React, { useState, useEffect, useCallback } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { showError, showSuccess } from '../../lib/services/alertService';
import { VIDEO_PERSONALIZER } from '../../lib/constants/components';

import playIcon from '../../public/static/svgImages/play.svg';
import pauseIcon from '../../public/static/svgImages/pause.svg';
import downloadIcon from '../../public/static/svgImages/download.svg';
import shareIcon from '../../public/static/svgImages/share.svg';

const VideoPersonalizer = ({
  baseVideo,
  contacts,
  onVideoGenerated,
  onProgressUpdate
}) => {
  const [currentContactIndex, setCurrentContactIndex] = useState(0);
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Token replacement patterns
  const tokenPatterns = {
    '{{email}}': 'email',
    '{{firstName}}': 'firstName',
    '{{lastName}}': 'lastName',
    '{{company}}': 'company',
    '{{website}}': 'website',
    '{{linkedin}}': 'linkedin',
    '{{phone}}': 'phone',
    '{{title}}': 'title',
    '{{industry}}': 'industry',
    '{{custom1}}': 'custom1',
    '{{custom2}}': 'custom2'
  };

  // Simulate video generation with token replacement
  const generatePersonalizedVideo = useCallback(async (contact, baseVideoUrl) => {
    // In a real implementation, this would call an API to process the video
    // with text-to-speech, image overlay, or other personalization techniques

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate processing time
        const personalizedVideo = {
          id: `video-${contact.email}-${Date.now()}`,
          contact: contact,
          url: baseVideoUrl, // In reality, this would be the processed video URL
          thumbnail: baseVideoUrl.replace('.mp4', '-thumb.jpg'),
          tokens: Object.entries(tokenPatterns).reduce((acc, [token, field]) => {
            acc[token] = contact[field] || '';
            return acc;
          }, {}),
          status: 'completed',
          createdAt: new Date().toISOString()
        };

        resolve(personalizedVideo);
      }, Math.random() * 3000 + 2000); // 2-5 second processing time
    });
  }, [tokenPatterns]);

  const startBulkGeneration = async () => {
    if (!baseVideo || !contacts || contacts.length === 0) {
      showError('Please select a base video and import contacts first');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setGeneratedVideos([]);

    const videos = [];
    const totalContacts = contacts.length;

    try {
      for (let i = 0; i < totalContacts; i++) {
        const contact = contacts[i];
        const video = await generatePersonalizedVideo(contact, baseVideo.url);

        videos.push(video);
        setGeneratedVideos([...videos]);

        const newProgress = ((i + 1) / totalContacts) * 100;
        setProgress(newProgress);

        if (onProgressUpdate) {
          onProgressUpdate(newProgress, videos);
        }

        // Small delay between generations to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      showSuccess(`Successfully generated ${videos.length} personalized videos`);
      if (onVideoGenerated) {
        onVideoGenerated(videos);
      }

    } catch (error) {
      showError('Failed to generate some videos. Please try again.');
      console.error('Video generation error:', error);
    } finally {
      setIsGenerating(false);
      setProgress(100);
    }
  };

  const playVideo = (video) => {
    setCurrentVideo(video);
    setIsPlaying(true);
  };

  const pauseVideo = () => {
    setIsPlaying(false);
  };

  const downloadVideo = async (video) => {
    try {
      // In a real implementation, this would trigger a download
      const link = document.createElement('a');
      link.href = video.url;
      link.download = `personalized-video-${video.contact.email}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('Video download started');
    } catch (error) {
      showError('Failed to download video');
    }
  };

  const shareVideo = (video) => {
    const shareUrl = `${window.location.origin}/videos/${video.id}`;

    if (navigator.share) {
      navigator.share({
        title: `Personalized video for ${video.contact.firstName}`,
        text: `Check out this personalized video I created for you!`,
        url: shareUrl
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      showSuccess('Video link copied to clipboard');
    }
  };

  const renderVideoPreview = (video) => (
    <div key={video.id} className="video-preview-card">
      <div className="video-thumbnail">
        <video
          src={video.url}
          poster={video.thumbnail}
          controls={false}
          onClick={() => playVideo(video)}
        />
        <div className="video-overlay">
          <button
            className="play-btn"
            onClick={() => playVideo(video)}
          >
            <SVGInline svg={playIcon} />
          </button>
        </div>
      </div>

      <div className="video-info">
        <h4 className="contact-name">
          {video.contact.firstName} {video.contact.lastName}
        </h4>
        <p className="contact-email">{video.contact.email}</p>
        {video.contact.company && (
          <p className="contact-company">{video.contact.company}</p>
        )}
      </div>

      <div className="video-actions">
        <button
          className="action-btn download-btn"
          onClick={() => downloadVideo(video)}
          title="Download video"
        >
          <SVGInline svg={downloadIcon} />
        </button>
        <button
          className="action-btn share-btn"
          onClick={() => shareVideo(video)}
          title="Share video"
        >
          <SVGInline svg={shareIcon} />
        </button>
      </div>

      <div className="video-tokens">
        <h5>Used Tokens:</h5>
        <div className="tokens-list">
          {Object.entries(video.tokens).map(([token, value]) => (
            value && (
              <span key={token} className="token-chip">
                {token}: {value.length > 20 ? `${value.substring(0, 20)}...` : value}
              </span>
            )
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="video-personalizer">
      <div className="personalizer-header">
        <h2 className="personalizer-title">Personalize Videos</h2>
        <p className="personalizer-subtitle">
          Generate personalized videos for {contacts?.length || 0} contacts
        </p>
      </div>

      <div className="personalizer-controls">
        <button
          className={classnames('generate-btn', {
            'generating': isGenerating,
            'disabled': !baseVideo || !contacts?.length
          })}
          onClick={startBulkGeneration}
          disabled={isGenerating || !baseVideo || !contacts?.length}
        >
          {isGenerating ? (
            <>
              <div className="spinner"></div>
              Generating Videos... ({Math.round(progress)}%)
            </>
          ) : (
            `Generate ${contacts?.length || 0} Videos`
          )}
        </button>

        {isGenerating && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
      </div>

      <div className="videos-grid">
        {generatedVideos.length > 0 ? (
          generatedVideos.map(renderVideoPreview)
        ) : (
          <div className="empty-state">
            <SVGInline svg={playIcon} className="empty-icon" />
            <h3 className="empty-title">No videos generated yet</h3>
            <p className="empty-subtitle">
              Upload a base video and contacts, then click "Generate Videos" to get started
            </p>
          </div>
        )}
      </div>

      {currentVideo && (
        <div className="video-modal" onClick={() => setCurrentVideo(null)}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-modal-btn"
              onClick={() => setCurrentVideo(null)}
            >
              ×
            </button>
            <video
              src={currentVideo.url}
              controls
              autoPlay={isPlaying}
              className="modal-video-player"
            />
            <div className="modal-video-info">
              <h3>{currentVideo.contact.firstName} {currentVideo.contact.lastName}</h3>
              <p>{currentVideo.contact.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

VideoPersonalizer.propTypes = {
  baseVideo: PropTypes.shape({
    url: PropTypes.string.isRequired,
    thumbnail: PropTypes.string
  }),
  contacts: PropTypes.arrayOf(PropTypes.object),
  onVideoGenerated: PropTypes.func,
  onProgressUpdate: PropTypes.func
};

export default VideoPersonalizer;