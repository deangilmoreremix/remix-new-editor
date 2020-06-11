import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../../lib/PropTypes';

import * as popcornConstants from '../../../../lib/constants/popcorn';

import useProjectStore from '../../../hooks/useProjectStore';

import FieldBuilder from '../../../form/FieldBuilder';
// import LineDuration from '../../../media/LineDuration';

import videoIcon from '../../../../public/static/images/media/icon-video.svg';
import audioIcon from '../../../../public/static/images/media/icon-audio-2.svg';

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
  } = values;

  const { isAudio } = useProjectStore();
  const [videoOut, setVideoOut] = useState(end - start + from);
  const [fadeInMax, setFadeInMax] = useState();
  const [fadeOutMax, setFadeOutMax] = useState();

  const itemVolume = useMemo(() => {
    if (mute) {
      onChange({ volume: 0 });
      return 0;
    }

    return volume !== undefined ? volume : fields[popcornConstants.VOLUME].default;
  }, [mute, volume]);

  useEffect(() => {
    setVideoOut(end - start + from);
  }, [end, from]);

  const changeHidden = useCallback((field) => {
    onChange({ hidden: !field.hidden });
  }, [hidden]);

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

  const changeFrom = useCallback((field) => {
    const value = field.from;
    if (value < (end - start + from)) {
      onChange(field);
      onChange({ end: +(end - value + from).toFixed(2) });
    } else {
      onChange({ from });
      onChange({ end });
    }
  }, [start, end, from]);

  const changeOut = useCallback((field) => {
    const value = field.out;
    if (value < duration && value > from) {
      onChange({ end: +(start + value - from).toFixed(2) });
    } else {
      onChange({ end });
    }
  }, [start, end, duration]);

  // ToDo implement in next PR
  // const changeFromOut = useCallback((field) => {
  //   onChange(field);
  //   onChange({ end });
  // }, [end, from]);

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

  return (
    <div className="video-settings-container">
      {/* ToDo implement in next PR */}
      {/* <LineDuration */}
      {/*  duration={duration} */}
      {/*  from={from} */}
      {/*  to={videoOut} */}
      {/*  changeFrom={changeFrom} */}
      {/*  changeOut={changeOut} */}
      {/*  changeFromOut={changeFromOut} */}
      {/* /> */}
      <div className="video-settings__inputs">
        <FieldBuilder
          label={fields[popcornConstants.FROM].label}
          type={fields[popcornConstants.FROM].type}
          value={from || fields[popcornConstants.FROM].default}
          name={popcornConstants.FROM}
          onChange={changeFrom}
          className="video-settings-input"
        />
        <FieldBuilder
          label="Out"
          type={fields[popcornConstants.END].type}
          value={videoOut}
          name="out"
          onChange={changeOut}
          className="video-settings-input"
        />
      </div>
      <div className="video-settings__block">
        <div className="video-settings__block-checkboxes">
          {!isAudio(element) && (
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
      </div>

      <FieldBuilder
        label={fields[popcornConstants.TITLE].label}
        type={fields[popcornConstants.TITLE].type}
        value={title || fields[popcornConstants.TITLE].default}
        name={popcornConstants.TITLE}
        onChange={onChange}
      />

      <div className="video-settings__timer">
        <FieldBuilder
          label={fields[popcornConstants.START].label}
          type={fields[popcornConstants.START].type}
          value={start || fields[popcornConstants.START].default}
          name={popcornConstants.START}
          onChange={onChange}
          className="video-settings__time"
        />
        <FieldBuilder
          label={fields[popcornConstants.END].label}
          type={fields[popcornConstants.END].type}
          value={end}
          name={popcornConstants.END}
          onChange={onChange}
          className="video-settings__time"
        />
      </div>

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
};

export default ClipEditor;
