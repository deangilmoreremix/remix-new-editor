import React, { useMemo, Fragment } from 'react';
import AudioPlayer from 'react-audio-player';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import audioIcon from '../../../public/static/svgImages/common/audio.svg';

const AudioPreview = observer((props) => {
  const { item, isActive, volume, isDisplayIcon, onEnded } = props;

  const icon = useMemo(() => {
    if (isDisplayIcon) {
      return (
        <SVGInline
          className="library__item-audio-preview-icon"
          svg={audioIcon}
          cleanup={['title']}
        />
      );
    }
    return null;
  }, [isDisplayIcon]);

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

AudioPreview.propTypes = {};

AudioPreview.defaultProps = {
  volume: 100,
  isDisplayTitle: true,
  isDisplayIcon: true,
  onEnded: () => {},
};

export default AudioPreview;
