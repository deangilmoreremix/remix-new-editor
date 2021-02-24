import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import SVGInline from 'react-svg-inline';

import playIcon from '../../../public/static/images/circle-play.svg';

const VideoTile = (props) => {
  const { onPreview, onSelect, url, preview, title, poster } = props;
  const previewContainer = useRef(null);

  const togglePreview = (state) => {
    if (previewContainer && previewContainer.current) {
      previewContainer.current[state ? 'play' : 'pause']();
    }
  };
  const isWebm = React.useMemo(() => {
    const link = preview || url;
    return link.includes('webm');
  }, [preview, url]);

  return (
    <div
      className="video-tile"
      style={{ backgroundImage: `url(${poster || 'https://cdn.vidcloud.io/revolution/resources/poster.png'})` }}
    >
      <video
        className="video"
        ref={previewContainer}
        muted
        preload="metadata"
      >
        <source src={preview || url} type={isWebm ? 'video/webm' : 'video/mp4'} />
      </video>
      {/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
      <div
        className="overlay"
        onMouseOver={() => togglePreview(true)}
        onMouseOut={() => togglePreview(false)}
      >
        <div
          className="buttons-container"
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
  poster: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
};

export default VideoTile;
