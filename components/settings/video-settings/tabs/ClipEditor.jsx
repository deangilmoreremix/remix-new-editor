import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';
import { ASSET_TYPES } from '../../../../lib/constants/media';

import * as popcornConstants from '../../../../lib/constants/popcorn';
import { regexpVideo360, video360prefix, REGEX_MAP } from '../../../../lib/constants/settings/video';

import useProjectStore from '../../../hooks/useProjectStore';
import useUserStore from '../../../hooks/useUserStore';

import FieldBuilder from '../../../form/FieldBuilder';
import LineDuration from '../../../media/LineDuration';

import videoIcon from '../../../../public/static/images/media/icon-video.svg';
import audioIcon from '../../../../public/static/images/media/icon-audio-2.svg';
import fillIcon from '../../../../public/static/images/fill.svg';
import Is360 from '../components/Is360';
import { SANTISECOND } from '../../../../lib/constants/project';

const ClipEditor = observer(({ values, fields, element, onChange }) => {
  const {
    from,
    mute,
    hidden,
    volume,
    title,
    start,
    end,
    duration,
    audioFadeIn,
    audioFadeOut,
    source,
    contentType,
    kind,
  } = values;

  const {
    isAudio,
    isVideo,
    duration: timelineDuration,
    updateVideoDuration,
    projectData,
    updateElementFromTimeline,
  } = useProjectStore();
  const { video360Enabled, downloaderEnabled } = useUserStore();
  const [videoOut, setVideoOut] = useState(end - start + from);
  const [fadeInMax, setFadeInMax] = useState();
  const [fadeOutMax, setFadeOutMax] = useState();

  const src = React.useMemo(() => (source && typeof source === 'string' ? source : source[0]),
    [source]);

  const is360 = React.useMemo(() => regexpVideo360.test(src), [src]);

  const is360allowed = React.useMemo(() => isVideo({ popcornOptions: { contentType } })
    && video360Enabled && (is360 || REGEX_MAP.Adaptive.test(src)),
  [contentType, video360Enabled, is360, src]);

  const itemVolume = useMemo(() => {
    if (mute) {
      onChange({ volume: 0 });
      return 0;
    }

    return volume !== undefined ? volume : fields[popcornConstants.VOLUME].default;
  }, [mute, volume]);

  useEffect(() => {
    let newOut = +(end - start + from).toFixed(2);
    if (newOut > +duration) {
      newOut = +duration;
    }
    setVideoOut(newOut);
  }, [end, from]);

  const changeHidden = useCallback((field) => {
    onChange({ hidden: !field.hidden });
  }, [hidden]);

  const changeIs360 = useCallback(() => {
    let newSource = source[0];
    const newIs360 = !is360;
    if (newIs360) {
      newSource = `${video360prefix}${newSource}`;
    } else {
      [, newSource] = newSource.split(video360prefix);
    }
    onChange({ source: [newSource] });
  }, [is360]);

  const changeMute = useCallback((field) => {
    if (volume === 0 && field.mute) {
      return;
    }

    onChange({ mute: !field.mute });
    if (!field.mute) {
      onChange({ volume: 0 });
    }
  }, [mute, volume]);

  const changeVolume = useCallback((field) => {
    if (field.volume > 100) {
      onChange({ volume: 100 });
    } else {
      onChange(field);
    }

    if (field.volume > 0 && mute) {
      onChange({ mute: false });
    }

    if (field.volume === 0 && !mute) {
      onChange({ mute: true });
    }
  }, [volume, mute, element.id]);

  const updateLayerElements = async (newEnd) => {
    if (newEnd < element.popcornOptions.end) {
      return null;
    }

    const differenceLength = newEnd - element.popcornOptions.end;
    const elementsForUpdate = [];
    const elementsEnds = [];
    let animationOut = 0;
    let itemStartAfterToVideo = null;

    projectData.media.forEach((media) => {
      media.tracks.forEach((track) => {
        track.trackEvents.forEach(trackEvent => {
          if (trackEvent.track === element.track) {
            elementsEnds.push(trackEvent.popcornOptions.end);
            if (element.popcornOptions.end <= trackEvent.popcornOptions.start) {
              elementsForUpdate.push(trackEvent);
              if (trackEvent.popcornOptions.animation
                && trackEvent.popcornOptions.animation.out) {
                // eslint-disable-next-line max-len
                animationOut += trackEvent.popcornOptions.animation.out.duration;
              }
            }
          }
        });
      });
    });

    if (elementsForUpdate && elementsForUpdate.length) {
      elementsForUpdate.forEach(item => {
        if (item.popcornOptions.start
          <= itemStartAfterToVideo || !itemStartAfterToVideo) {
          itemStartAfterToVideo = item.popcornOptions.start;
        }
      });
    }

    if (newEnd > itemStartAfterToVideo) {
      if (timelineDuration < (Math.max(...elementsEnds)
        + differenceLength + animationOut) * SANTISECOND) {
        await updateVideoDuration((timelineDuration / SANTISECOND) + differenceLength);
      }

      if (elementsForUpdate && elementsForUpdate.length) {
        elementsForUpdate.forEach(item => (
          updateElementFromTimeline({
            needUpdateStartEnd: true,
            elementId: item.id,
            start: item.popcornOptions.start + differenceLength,
            end: item.popcornOptions.end + differenceLength,
          })));
      }
    }
  };

  const changeFrom = useCallback((field) => {
    let value;
    if (typeof field === 'number') {
      value = field;
    } else {
      value = field.from;
    }
    if (value < (end - start + from)) {
      const newEnd = +(end - value + from).toFixed(2);
      updateLayerElements(newEnd);
      onChange({ from: value });
      onChange({ end: newEnd });
    } else {
      onChange({ from: videoOut - 1 });
      onChange({ end: start + 1 });
    }
  }, [start, end, from]);

  const changeOut = useCallback(async (field) => {
    let value;
    if (typeof field === 'number') {
      value = field;
    } else {
      value = field.out;
    }

    if (value <= duration && value > from) {
      const newEnd = +(start + value - from).toFixed(2);
      if (newEnd * 100 > timelineDuration) {
        await updateVideoDuration(newEnd);
      }
      updateLayerElements(newEnd);
      onChange({ end: newEnd });
    } else {
      onChange({ end: start + 1 });
    }
  }, [start, end, from, duration]);

  const updateFrom = (field) => {
    onChange(field);
  };

  useEffect(() => {
    const defaultMax = fields[popcornConstants.AUDIO_FADE_IN].max;
    const videoLength = Math.floor(end - start);

    if ((videoLength - (audioFadeOut || 0)) >= defaultMax) {
      setFadeInMax(defaultMax);
    } else {
      setFadeInMax(videoLength - (audioFadeOut || 0));
    }

    if ((videoLength - (audioFadeIn || 0)) >= defaultMax) {
      setFadeOutMax(defaultMax);
    } else {
      setFadeOutMax(videoLength - (audioFadeIn || 0));
    }

    if (((audioFadeIn || 0) + (audioFadeOut || 0)) > videoLength) {
      onChange({ audioFadeIn: Math.floor(videoLength / 2) });
      onChange({ audioFadeOut: Math.floor(videoLength / 2) });
    }
  }, [audioFadeIn, audioFadeOut, end]);

  const isVoice = useMemo(() => (
    kind && (kind === ASSET_TYPES.VOICE || kind === ASSET_TYPES.PERSONALIZED_VOICE)
  ), [kind]);

  return (
    <div className="video-settings-container">
      <LineDuration
        duration={duration}
        from={from}
        to={videoOut}
        changeFrom={changeFrom}
        changeOut={changeOut}
        updateFrom={updateFrom}
      />
      {
        element.popcornOptions.kind !== ASSET_TYPES.PERSONALIZED_VOICE && (
          <div className="video-settings__inputs">
            <FieldBuilder
              label={fields[popcornConstants.FROM].label}
              type={fields[popcornConstants.FROM].type}
              value={from || fields[popcornConstants.FROM].default}
              name={popcornConstants.FROM}
              onChange={changeFrom}
              className="video-settings-input"
            />
            {kind !== ASSET_TYPES.PERSONALIZED_VOICE && (
              <FieldBuilder
                label="Out"
                type={fields[popcornConstants.DURATION].type}
                value={videoOut}
                name="out"
                onChange={changeOut}
                className="video-settings-input"
              />
            )}
          </div>
        )
      }
      <div className="video-settings__block">
        <div className="video-settings__block-checkboxes">
          {!isAudio(element) && (
            <Fragment>
              <div className="video-settings__block-element">
                <SVGInline
                  className="video-settings__icon"
                  svg={videoIcon}
                  cleanup={['title']}
                />
                <FieldBuilder
                  label={fields[popcornConstants.HIDDEN].label}
                  type={fields[popcornConstants.HIDDEN].type}
                  value={hidden !== undefined
                    ? !hidden : !fields[popcornConstants.HIDDEN].default}
                  name={popcornConstants.HIDDEN}
                  onChange={changeHidden}
                />
              </div>
              {!is360 && (
                <div className="video-settings__block-element">
                  <SVGInline
                    className="video-settings__icon"
                    svg={fillIcon}
                    cleanup={['title']}
                  />
                  <FieldBuilder
                    label={fields[popcornConstants.FILL].label}
                    type={fields[popcornConstants.FILL].type}
                    value={values[popcornConstants.FILL]}
                    name={popcornConstants.FILL}
                    onChange={onChange}
                  />
                </div>
              )}
            </Fragment>
          )}
          <div className="video-settings__block-element">
            <SVGInline
              className="video-settings__icon"
              svg={audioIcon}
              cleanup={['title']}
            />
            <FieldBuilder
              label={fields[popcornConstants.MUTE].label}
              type={fields[popcornConstants.MUTE].type}
              value={mute !== undefined
                ? !mute : !fields[popcornConstants.MUTE].default}
              name={popcornConstants.MUTE}
              onChange={changeMute}
            />
          </div>
        </div>

        <FieldBuilder
          label={fields[popcornConstants.VOLUME].label}
          type={fields[popcornConstants.VOLUME].type}
          value={itemVolume}
          name={popcornConstants.VOLUME}
          onChange={changeVolume}
          containerClassName="video-settings-slider-block"
          sliderClassName="video-settings-slider"
          inputClassName="video-settings-slider-input"
        />
        {is360allowed
        && (
        <Is360
          value={is360}
          className="is-360"
          onChange={changeIs360}
          downloaderEnabled={downloaderEnabled}
        />
        )}
      </div>

      <FieldBuilder
        label={fields[popcornConstants.TITLE].label}
        type={fields[popcornConstants.TITLE].type}
        value={title || fields[popcornConstants.TITLE].default}
        name={popcornConstants.TITLE}
        onChange={onChange}
        readOnly={isVoice}
      />

      <div className="video-settings__timer">
        <FieldBuilder
          label={fields[popcornConstants.START].label}
          type={fields[popcornConstants.START].type}
          value={start || fields[popcornConstants.START].default}
          name={popcornConstants.START}
          onChange={onChange}
          onEnter={onChange}
          className="video-settings__time"
          element={element}
        />
        {
          element.popcornOptions.kind !== ASSET_TYPES.PERSONALIZED_VOICE && (
            <FieldBuilder
              label={fields[popcornConstants.END].label}
              type={fields[popcornConstants.END].type}
              value={end}
              name={popcornConstants.END}
              onChange={onChange}
              onEnter={onChange}
              className="video-settings__time"
              element={element}
            />
          )
        }
      </div>

      {kind !== ASSET_TYPES.PERSONALIZED_VOICE && (
        <div className="video-settings__fade">
          <div className="video-settings__fade-block">
            <div className="video-settings__fade-header">
              <label>Fade In</label>
              <p>
                {audioFadeIn !== undefined
                  ? `${audioFadeIn}s` : `${fields[popcornConstants.AUDIO_FADE_IN].default}s`}
              </p>
            </div>
            <FieldBuilder
              type={fields[popcornConstants.AUDIO_FADE_IN].type}
              value={audioFadeIn !== undefined
                ? audioFadeIn : fields[popcornConstants.AUDIO_FADE_IN].default}
              name={popcornConstants.AUDIO_FADE_IN}
              onChange={onChange}
              containerClassName="video-settings-slider-block"
              sliderClassName="video-settings-slider"
              inputClassName="video-settings-slider-input"
              maxValue={fadeInMax}
              withoutInput
            />
          </div>
          <div className="video-settings__fade-block">
            <div className="video-settings__fade-header">
              <label>Fade Out</label>
              <p>
                {audioFadeOut !== undefined
                  ? `${audioFadeOut}s` : `${fields[popcornConstants.AUDIO_FADE_OUT].default}s`}
              </p>
            </div>
            <FieldBuilder
              type={fields[popcornConstants.AUDIO_FADE_OUT].type}
              value={audioFadeOut !== undefined
                ? audioFadeOut : fields[popcornConstants.AUDIO_FADE_OUT].default}
              name={popcornConstants.AUDIO_FADE_OUT}
              onChange={onChange}
              containerClassName="video-settings-slider-block"
              sliderClassName="video-settings-slider"
              maxValue={fadeOutMax}
              withoutInput
            />
          </div>
        </div>
      )}
    </div>
  );
});

ClipEditor.propTypes = {
  values: PropTypes.shape({
    start: PropTypes.number,
    end: PropTypes.number,
  }),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.shape({
    start: PropTypes.shape({}),
    end: PropTypes.shape({}),
  }),
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
};

export default ClipEditor;
