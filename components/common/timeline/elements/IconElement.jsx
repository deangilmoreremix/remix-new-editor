import React, { Fragment, useMemo } from 'react';
import classnames from 'classnames';
import Grid from '@material-ui/core/Grid/Grid';
import SVGInline from 'react-svg-inline';

import { ASSET_TYPES } from '../../../../lib/constants/media';
import {
  POPCORN_ELEMENT_LABELS,
  POPCORN_ELEMENT_TYPES,
  SEQUENCER,
} from '../../../../lib/constants/popcorn';
import { DEFAULT_SETTINGS } from '../../../../lib/constants/settings';
import PropTypes from '../../../../lib/PropTypes';
import {
  TIMELINE_ELEMENT_DEFAULT_FIELD as DEFAULT_FIELD,
  TIMELINE_ELEMENT_DEFAULT_ICONS,
  TIMELINE_ELEMENT_ICONS,
} from '../../../../lib/constants/timeline';

import svgAudioIcon from '../../../../public/static/images/media/icon-audio.svg';
import personalizedVoiceIcon from '../../../../public/static/images/media/personalized-voice.svg';
import voiceIcon from '../../../../public/static/images/media/voice.svg';
import useProjectStore from '../../../hooks/useProjectStore';

const IconElement = React.forwardRef(({ item, ...rest }, ref) => {
  const {
    isAudio,
  } = useProjectStore();

  const kind = React.useMemo(() => {
    if (!item.kind && item.type === SEQUENCER) {
      return isAudio({ popcornOptions: item }) ? ASSET_TYPES.AUDIO : ASSET_TYPES.VIDEO;
    }
  }, [item]);

  const icon = useMemo(() => {
    if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
      return personalizedVoiceIcon;
    }
    // ToDO add icons for voice and personalized voice
    if (item.kind === ASSET_TYPES.AUDIO || kind === ASSET_TYPES.AUDIO) {
      return svgAudioIcon;
    }
    if (item.kind === ASSET_TYPES.VOICE) {
      return voiceIcon;
    }
    return TIMELINE_ELEMENT_ICONS[item.type];
  }, [item]);

  const quantityIcon = useMemo(() => TIMELINE_ELEMENT_DEFAULT_ICONS[item.type], [item]);

  const itemTitle = useMemo(() => {
    if (!(item.kind === ASSET_TYPES.VOICE
      || item.kind === ASSET_TYPES.VIDEO
      || kind === ASSET_TYPES.VIDEO
      || kind === ASSET_TYPES.AUDIO
      || item.kind === ASSET_TYPES.AUDIO)) {
      if (item.type === POPCORN_ELEMENT_TYPES.SOCIAL) {
        return item.title;
      }
      return POPCORN_ELEMENT_LABELS[item.type];
    } else {
      return item.kind || kind;
    }
  }, [item.type, item.title]);

  return (
    <Grid
      container
      className={classnames(
        'popcorn-element',
        'icon-element',
        `popcorn-${item.type}-element`,
        { 'popcorn-element-personalized-voice': item.kind === ASSET_TYPES.PERSONALIZED_VOICE },
      )}
      ref={ref}
      title={item.title || item.htmlText || item.type}
      tabIndex={-1}
      {...rest}
    >
      {icon && (
        <div className={classnames('inner-wrapper', 'popcorn-timeline-icon')}>
          <SVGInline
            className="icon-btn"
            classSuffix="--inline"
            svg={icon}
            cleanup={['title']}
          />
        </div>
      )}
      {
        item.kind !== ASSET_TYPES.PERSONALIZED_VOICE
        && item.type !== POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION && (
          <Fragment>
            <div className="popcorn-element-title">
              {itemTitle}
            </div>
            <div className={classnames('inner-wrapper', 'popcorn-timeline-icon')}>
              {
                quantityIcon
                && item[DEFAULT_FIELD[item.type]]
                === DEFAULT_SETTINGS[item.type][DEFAULT_FIELD[item.type]]
                  ? (
                    <SVGInline
                      className="icon-btn"
                      classSuffix="--inline"
                      svg={quantityIcon}
                      cleanup={['title']}
                    />
                  ) : item[DEFAULT_FIELD[item.type]]
              }
            </div>
          </Fragment>
        )
      }
    </Grid>
  );
});

IconElement.propTypes = {
  item: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string,
    htmlText: PropTypes.string,
    kind: PropTypes.string,
  }).isRequired,
};

export default IconElement;
