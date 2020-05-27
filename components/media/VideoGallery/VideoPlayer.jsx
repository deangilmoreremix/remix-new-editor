import React from 'react';
import PropTypes from 'prop-types';

const VideoPlayer = (props) => {
  const { url, autoPlay, controls, loop, muted } = props;

  return (
    <div className="video-player-container">
      <video
        className="video-player"
        preload="true"
        autoPlay={autoPlay}
        muted={muted}
        controls={controls}
        loop={loop}
      >
        <source src={url} type="video/mp4" />
      </video>
    </div>
  );
};

VideoPlayer.propTypes = {
  url: PropTypes.string.isRequired,
  controls: PropTypes.bool,
  autoPlay: PropTypes.bool,
  muted: PropTypes.bool,
  loop: PropTypes.bool,
};

VideoPlayer.defaultProps = {
  controls: true,
  autoPlay: true,
  muted: false,
  loop: false,
};

export default VideoPlayer;
