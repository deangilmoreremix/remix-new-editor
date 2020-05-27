import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import SVGInline from 'react-svg-inline';

import playIcon from '../../../public/static/images/circle-play.svg';

const VideoTile = (props) => {
  const { onPreview, onSelect, url, preview, title } = props;
  const previewContainer = useRef(null);

  const togglePreview = (state) => {
    if (previewContainer && previewContainer.current) {
      previewContainer.current[state ? 'play' : 'pause']();
    }
  };

  return (
    <div
      className="video-tile"
      style={{ backgroundImage: `url(${preview})` }}
    >
      { preview && (
        <video
          className="video"
          preload="true"
          ref={previewContainer}
          loop
          muted
        >
          <source src={preview} type="video/webm" />
        </video>
      )}
      <div
        className="overlay"
        onMouseOver={() => togglePreview(true)}
        onFocus={() => togglePreview(true)}
        onBlur={() => togglePreview(false)}
      >
        <div
          className="buttons-container"
          onMouseOver={() => togglePreview(true)}
          onFocus={() => togglePreview(true)}
        >
          <button className="btn-preview" onClick={() => { onPreview(title, url); }}>
            <SVGInline
              className="btn-preview__icon"
              svg={playIcon}
              cleanup={['title']}
            />
          </button>
          <p className="title">{title}</p>
          <button className="button generator-use" onClick={() => onSelect(url)}>use</button>
        </div>
      </div>
    </div>
  );
};

VideoTile.propTypes = {
  url: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  preview: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
};

export default VideoTile;
