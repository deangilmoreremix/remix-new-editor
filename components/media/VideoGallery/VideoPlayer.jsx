import React from 'react';
import PropTypes from 'prop-types';

const VideoPlayer = (props) => {
  const { url, autoPlay, controls, loop, muted, containerClassName, videoClassName } = props;

  return (
    <div className={containerClassName}>
      <video
        className={videoClassName}
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
  containerClassName: PropTypes.string,
  videoClassName: PropTypes.string,
  controls: PropTypes.bool,
  autoPlay: PropTypes.bool,
  muted: PropTypes.bool,
  loop: PropTypes.bool,
};

VideoPlayer.defaultProps = {
  videoClassName: 'video-player',
  containerClassName: 'video-player-container',
  controls: true,
  autoPlay: true,
  muted: false,
  loop: false,
};

export default VideoPlayer;
