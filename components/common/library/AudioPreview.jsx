import React, { useMemo, Fragment } from 'react';
import AudioPlayer from 'react-audio-player';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import audioIcon from '../../../public/static/svgImages/common/audio.svg';
import PropTypes from '../../../lib/PropTypes';

const AudioPreview = observer((props) => {
  const { item, isActive, volume, isDisplayIcon, onEnded } = props;

  const icon = useMemo(() => {
    if (!isDisplayIcon) {
      return null;
    }
    if (item.preview) {
      return <img src={item.preview} alt="img" />;
    }
    return (
      <SVGInline
        className="library__item-audio-preview-icon"
        svg={audioIcon}
        cleanup={['title']}
      />
    );
  }, [isDisplayIcon, item.preview]);

  return (
    <div className="library__item-audio-preview">
      {isActive ? (
        <Fragment>
          <div className="playing-now-icon">
            <img src="/static/images/media/audio-playing.gif" alt="img" />
          </div>
          <AudioPlayer
            src={item.url}
            volume={volume / 100}
            onEnded={onEnded}
            autoPlay
          />
        </Fragment>
      ) : icon}
    </div>
  );
});

AudioPreview.propTypes = {
  isActive: PropTypes.bool,
  isDisplayIcon: PropTypes.bool,
  volume: PropTypes.number,
  onEnded: PropTypes.func,
  item: PropTypes.shape({
    url: PropTypes.string.isRequired,
    preview: PropTypes.string,
  }).isRequired,
};

AudioPreview.defaultProps = {
  volume: 100,
  isDisplayIcon: true,
  onEnded: () => {},
};

export default AudioPreview;
