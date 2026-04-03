// Video Uploader Component - Upload and manage base videos for personalization
import React, { useState, useRef, useCallback } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { showError, showSuccess } from '../../lib/services/alertService';
import { VIDEO_UPLOADER } from '../../lib/constants/components';

import uploadIcon from '../../public/static/svgImages/upload.svg';
import videoIcon from '../../public/static/svgImages/video.svg';
import deleteIcon from '../../public/static/svgImages/delete.svg';
import playIcon from '../../public/static/svgImages/play.svg';

const VideoUploader = ({
  onVideoSelected,
  maxFileSize = 500, // MB
  acceptedFormats = ['mp4', 'mov', 'avi', 'webm']
}) => {
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const validateVideoFile = (file) => {
    const errors = [];

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      errors.push(`File size must be less than ${maxFileSize}MB`);
    }

    // Check file format
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!acceptedFormats.includes(fileExtension)) {
      errors.push(`File format must be one of: ${acceptedFormats.join(', ')}`);
    }

    // Check if it's actually a video
    if (!file.type.startsWith('video/')) {
      errors.push('File must be a valid video');
    }

    return errors;
  };

  const generateThumbnail = (videoFile) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        // Seek to 1 second or 10% of video duration, whichever is smaller
        const seekTime = Math.min(1, video.duration * 0.1);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        canvas.width = 320;
        canvas.height = (video.videoHeight / video.videoWidth) * 320;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);

        URL.revokeObjectURL(video.src);
        resolve(thumbnailUrl);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null); // Return null if thumbnail generation fails
      };
    });
  };

  const uploadVideo = useCallback(async (file) => {
    const errors = validateVideoFile(file);
    if (errors.length > 0) {
      showError(errors.join('\n'));
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Generate thumbnail
      const thumbnail = await generateThumbnail(file);

      // Simulate upload completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Create video object
      const videoObject = {
        id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file), // In reality, this would be the uploaded URL
        thumbnail: thumbnail,
        duration: 0, // Would be populated from video metadata
        uploadedAt: new Date().toISOString()
      };

      setUploadedVideos(prev => [...prev, videoObject]);
      setSelectedVideo(videoObject);

      if (onVideoSelected) {
        onVideoSelected(videoObject);
      }

      showSuccess('Video uploaded successfully');

    } catch (error) {
      showError('Failed to upload video');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [maxFileSize, acceptedFormats, onVideoSelected]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadVideo(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      uploadVideo(files[0]);
    }
  };

  const selectVideo = (video) => {
    setSelectedVideo(video);
    if (onVideoSelected) {
      onVideoSelected(video);
    }
  };

  const deleteVideo = (videoId) => {
    setUploadedVideos(prev => prev.filter(v => v.id !== videoId));
    if (selectedVideo?.id === videoId) {
      setSelectedVideo(null);
      if (onVideoSelected) {
        onVideoSelected(null);
      }
    }
    showSuccess('Video deleted');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderVideoCard = (video) => (
    <div
      key={video.id}
      className={classnames('video-card', {
        'selected': selectedVideo?.id === video.id
      })}
      onClick={() => selectVideo(video)}
    >
      <div className="video-thumbnail">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.name} />
        ) : (
          <div className="no-thumbnail">
            <SVGInline svg={videoIcon} />
          </div>
        )}
        <div className="video-overlay">
          <SVGInline svg={playIcon} className="play-overlay-icon" />
        </div>
      </div>

      <div className="video-info">
        <h4 className="video-name">{video.name}</h4>
        <p className="video-size">{formatFileSize(video.size)}</p>
        <p className="video-date">
          {new Date(video.uploadedAt).toLocaleDateString()}
        </p>
      </div>

      <button
        className="delete-video-btn"
        onClick={(e) => {
          e.stopPropagation();
          deleteVideo(video.id);
        }}
        title="Delete video"
      >
        <SVGInline svg={deleteIcon} />
      </button>
    </div>
  );

  return (
    <div className="video-uploader">
      <div className="uploader-header">
        <h2 className="uploader-title">Upload Base Video</h2>
        <p className="uploader-subtitle">
          Upload the video you want to personalize for your contacts
        </p>
      </div>

      <div className="upload-section">
        <div
          className={classnames('upload-zone', {
            'dragging': isDragging,
            'uploading': isUploading
          })}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className="upload-progress">
              <div className="spinner"></div>
              <p>Uploading video... {uploadProgress}%</p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              <SVGInline svg={uploadIcon} className="upload-icon" />
              <h3 className="upload-title">Upload Video</h3>
              <p className="upload-subtitle">
                Drag and drop your video here, or click to browse
              </p>
              <div className="upload-requirements">
                <p>Supported formats: {acceptedFormats.join(', ')}</p>
                <p>Maximum size: {maxFileSize}MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={`video/*,.${acceptedFormats.join(',.')}`}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isUploading}
              />
            </>
          )}
        </div>
      </div>

      {uploadedVideos.length > 0 && (
        <div className="videos-section">
          <h3 className="section-title">Uploaded Videos</h3>
          <div className="videos-grid">
            {uploadedVideos.map(renderVideoCard)}
          </div>
        </div>
      )}

      {selectedVideo && (
        <div className="selected-video-preview">
          <h3 className="preview-title">Selected Video</h3>
          <div className="video-preview">
            <video
              src={selectedVideo.url}
              controls
              className="preview-video-player"
            />
            <div className="preview-info">
              <h4>{selectedVideo.name}</h4>
              <p>{formatFileSize(selectedVideo.size)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

VideoUploader.propTypes = {
  onVideoSelected: PropTypes.func,
  maxFileSize: PropTypes.number,
  acceptedFormats: PropTypes.arrayOf(PropTypes.string)
};

export default VideoUploader;