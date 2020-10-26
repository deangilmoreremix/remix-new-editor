import * as React from 'react';
import AudioPlayer from 'react-audio-player';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import audioIcon from '../../../public/static/svgImages/common/audio.svg';

const AudioPreview = observer(({ item, isActive, volume }) => (
  <div className="library__item-audio-preview">
    {isActive ? (
      <React.Fragment>
        <div className="playing-now-icon">
          <img src="/static/images/media/audio-playing.gif" alt="" />
        </div>
        <AudioPlayer
          src={item.url}
          volume={volume / 100}
          autoPlay
        />
      </React.Fragment>
    ) : (
      <SVGInline
        className="library__item-audio-preview-icon"
        svg={audioIcon}
        cleanup={['title']}
      />
    )}
  </div>
));

AudioPreview.propTypes = {};

export default AudioPreview;
