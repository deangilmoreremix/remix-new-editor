import React, { useEffect } from 'react';
import PropTypes from '../../lib/PropTypes';

import VideoPlayer from '../media/VideoGallery/VideoPlayer';
import { ASSET_TYPES } from '../../lib/constants/media';

const PreviewMediaModal = ({ handleClose, options, setMaxWidth }) => {
  const { item, volume, mute, activeTab } = options;

  const handleUseVideo = () => {
    options.onSelect({ ...item, volume, mute });
    handleClose();
  };

  useEffect(() => {
    setMaxWidth(activeTab.toLowerCase() === ASSET_TYPES.IMAGE ? 'xl' : 'sm');
  }, []);

  const getTitle = () => {
    if (item.tags) {
      const [tag] = Array.isArray(item.tags) ? item.tags : item.tags.split(',');
      const newTag = tag || 'Video';

      return `${newTag[0].toUpperCase() + newTag.slice(1)} by ${item.user}`;
    } else {
      return item.title;
    }
  };

  return (
    <div className="preview-media-modal">
      {activeTab.toLowerCase() === ASSET_TYPES.IMAGE ? (
        <div className="preview-image-container">
          <img className="preview-image" src={item.url} alt={`preview-${activeTab.toLowerCase()}`} />
        </div>
      ) : (
        <>
          <div className="preview-video-player-title-container">
            <span>{item.name || getTitle()}</span>
          </div>
          <VideoPlayer
            url={item.url}
            containerClassName="preview-video-player-container"
            videoClassName="preview-video-player"
          />
        </>
      )}
      <div className="preview-video-buttons-container">
        <button className="preview-video-button-hidden" />
        <button className="preview-video-button" onClick={handleUseVideo}>Use</button>
        <button className="preview-video-button-cancel" onClick={handleClose}>Cancel</button>
      </div>
    </div>
  );
};

PreviewMediaModal.propTypes = {
  options: PropTypes.shape({
    item: PropTypes.object.isRequired,
    onSelect: PropTypes.func.isRequired,
    activeTab: PropTypes.string.isRequired,
    volume: PropTypes.number,
    mute: PropTypes.bool,
  }),
  handleClose: PropTypes.func.isRequired,
  setMaxWidth: PropTypes.func,
};

export default PreviewMediaModal;
