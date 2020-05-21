import * as React from 'react';
import { observer } from 'mobx-react';
import captureVideoFrame from 'capture-video-frame';
import { Player, ControlBar } from 'video-react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import FieldBuilder from '../../form/FieldBuilder';
import svgPlayIcon from '../../../public/static/svgImages/common/play.svg';

import useMediaStore from '../../hooks/useMediaStore';
import useProjectStore from '../../hooks/useProjectStore';

import { KIND } from '../../../lib/constants/popcorn';
import { TRANSITION_TIMELINE_OFFSET } from '../../../lib/constants/settings/video-transition';

import { loadImage } from '../../../lib/requestCreator';
import { makeTransition, playTransition } from '../../../lib/utils/transition';
import Loader from '../../common/Loader';

const VideoTransitionSettings = observer(({ element, update, fields, find }) => {
  const { findAndUpdate, setPopcorn } = useProjectStore();
  const { uploadMedia } = useMediaStore();

  const [isLoading, setIsLoading] = React.useState(false);
  const [isCaptured, setIsCaptured] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [transition, setTransition] = React.useState(null);

  const newFromEnd = React.useRef(null);
  const newToStart = React.useRef(null);
  const selectRef = React.useRef(null);

  const imageFrom = React.useRef(null);
  const imageTo = React.useRef(null);
  const fromPlayer = React.useRef(null);
  const toPlayer = React.useRef(null);
  const canvasEl = React.useRef(null);
  const canvasContainerRef = React.useRef(null);

  const { popcornOptions: values } = element || {};

  const { current: from } = imageFrom;
  const { current: to } = imageTo;

  const {
    kind,
    start,
    end,
    fromUrl,
    toUrl,
    width,
    height,
  } = values;

  const duration = React.useMemo(() => end - start, [start, end]);

  const fromVideo = React.useMemo(() => {
    if (values) {
      return find(values.from);
    }
    return null;
  }, [values]);

  const toVideo = React.useMemo(() => {
    if (values) {
      return find(values.to);
    }
    return null;
  }, [values]);

  React.useEffect(() => {
    const { current: canvas } = canvasEl;
    if (from && to && canvas && kind) {
      setTransition(makeTransition({ canvas, kind, from: from.dataUri, to: to.dataUri }));
    }
  }, [from, to, canvasEl, kind]);

  React.useEffect(() => {
    const { current: canvas } = canvasEl;
    if (isPlaying && transition && canvas && duration) {
      playTransition({ canvas, duration, ...transition, callback: () => setIsPlaying(false) });
    } else {
      setIsPlaying(false);
    }
  }, [duration, isPlaying, transition]);

  React.useEffect(() => {
    (async () => {
      if (fromUrl && toUrl) {
        setIsLoading(true);
        await Promise.all([
          imageFrom.current = { dataUri: await loadImage(fromUrl) },
          imageTo.current = { dataUri: await loadImage(toUrl) },
        ]);
        setIsCaptured(true);
        setIsLoading(false);
      }
    })();
  }, [fromUrl, toUrl]);

  React.useEffect(() => {
    if (fromPlayer && fromPlayer.current) {
      fromPlayer.current.video.seek(duration - 0.5);
    }
  }, [duration, fromVideo]);

  React.useEffect(() => {
    if (toPlayer && toPlayer.current) {
      toPlayer.current.video.seek(0.5);
    }
  }, [toVideo]);

  const handleCaptureClick = React.useCallback(async () => {
    setIsPlaying(false);
    if (isCaptured) {
      return setIsCaptured(false);
    }
    setIsLoading(true);
    let fromFrame;
    let toFrame;

    if (fromVideo) {
      fromFrame = captureVideoFrame(fromVideo.id, 'png');
      const { player } = fromPlayer.current.getState();
      newFromEnd.current = player.currentTime;
      imageFrom.current = {
        ...fromFrame,
        dataUri: await loadImage(fromFrame.dataUri),
      };
    }
    if (toVideo) {
      toFrame = captureVideoFrame(toVideo.id, 'png');
      const { player } = toPlayer.current.getState();
      newToStart.current = player.currentTime;
      imageTo.current = {
        ...toFrame,
        dataUri: await loadImage(toFrame.dataUri),
      };
    }

    setIsLoading(false);
    return setIsCaptured(true);
  }, [fromVideo, isCaptured, toVideo]);

  const handleSave = React.useCallback(async () => {
    // 1. upload images
    if (from && to) {
      setIsLoading(true);
      const [fromImageResponse, toImageResponse] = await Promise.all([
        ...(from.blob ? [uploadMedia({ data: from.blob })] : []),
        ...(to.blob ? [uploadMedia({ data: to.blob })] : []),
      ]);

      const newFromUrl = fromImageResponse ? fromImageResponse.url : fromUrl;
      const newToUrl = toImageResponse ? toImageResponse.url : toUrl;

      const {
        start: fromVideoStart,
        end: fromVideoEnd,
      } = fromVideo.popcornOptions;
      const { from: toVideoFrom } = toVideo.popcornOptions;

      // 2. Prepare to update the first video
      const fromVideoNewOptions = {
        end: newFromEnd.current
          ? (fromVideoStart + newFromEnd.current - TRANSITION_TIMELINE_OFFSET)
          : fromVideoEnd,
      };

      const transitionStart = fromVideoNewOptions.end + TRANSITION_TIMELINE_OFFSET;
      const transitionEnd = transitionStart + duration;

      // 3. Prepare to update transition
      const transitionOptions = {
        fromUrl: newFromUrl || fromUrl,
        toUrl: newToUrl || toUrl,
        start: transitionStart,
        end: transitionEnd,
        width,
        height,
      };

      // 4. Prepare to update the second video
      const toVideoNewOptions = {
        from: newToStart.current ? newToStart.current + TRANSITION_TIMELINE_OFFSET : toVideoFrom,
        start: transitionOptions.end + TRANSITION_TIMELINE_OFFSET,
      };

      // 5. update From video end
      findAndUpdate(fromVideo.id, fromVideoNewOptions);

      // 6. update transition element
      update(transitionOptions);

      // 7. update To video start
      findAndUpdate(toVideo.id, toVideoNewOptions);

      // 8. Set popcorn
      setPopcorn();

      // 9. Clear time refs
      newFromEnd.current = null;
      newToStart.current = null;
      setIsLoading(false);
    }
  }, [
    duration,
    from,
    fromVideo,
    to,
    toVideo,
    width,
    height,
  ]);

  const handlePlay = () => {
    const { current: canvas } = canvasEl;
    if (from && to && canvas && kind) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      if (selectRef && selectRef.current && selectRef.current.select) {
        selectRef.current.select.focus();
      }
    }
  };

  return (
    <div className="video-transition-settings">
      <Loader isLoading={isLoading} />
      {values && (
        <div className="video-transition-form">
          <FieldBuilder
            ref={selectRef}
            name={KIND}
            value={values.kind}
            onChange={update}
            {...fields[KIND]}
          />
        </div>
      )}
      {isCaptured ? (
        <div className="video-transition-selected">
          <div className="title">Choose and Preview the Effect</div>
          <div className="canvas-player" ref={canvasContainerRef}>
            <canvas
              className="canvas"
              ref={canvasEl}
              width={width}
              height={height}
            />
            {!isPlaying && (
              <button
                className="video-transition-btn play"
                disabled={!(from && to)}
                type="button"
                onClick={handlePlay}
              >
                <SVGInline
                  className="play-icon"
                  classSuffix="--inline"
                  svg={svgPlayIcon}
                  cleanup={['title']}
                />
              </button>
            )}
          </div>
        </div>
      ) : (
        <React.Fragment>
          <div className="video-transition-preview">
            <div className="title">Select the Start Frame</div>
            {fromVideo && (
              <Player
                ref={fromPlayer}
                src={fromVideo && fromVideo.popcornOptions ? fromVideo.popcornOptions.src : ''}
                videoId={fromVideo.id}
                crossOrigin="anonymous"
                width={width}
                height={height}
              >
                <ControlBar autoHide={false} />
              </Player>
            )}
          </div>
          <div className="video-transition-preview">
            <div className="title">Select the End Frame</div>
            {toVideo && (
              <Player
                ref={toPlayer}
                src={toVideo && toVideo.popcornOptions ? toVideo.popcornOptions.src : ''}
                videoId={toVideo.id}
                crossOrigin="anonymous"
                width={width}
                height={height}
              >
                <ControlBar autoHide={false} />
              </Player>
            )}
          </div>
        </React.Fragment>
      )}
      <div className="video-transition-controls">
        <button
          className="video-transition-btn merge"
          type="button"
          onClick={handleCaptureClick}
        >
          {isCaptured ? 'Change' : 'Merge'}
        </button>
        {isCaptured && (
          <button
            className="video-transition-btn apply"
            type="button"
            onClick={handleSave}
            disabled={!(from && to)}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
});

VideoTransitionSettings.propTypes = {
  element: PropTypes.shape({
    id: PropTypes.string,
    popcornOptions: PropTypes.shape({
      url: PropTypes.string,
    }),
  }),
  update: PropTypes.func.isRequired,
  find: PropTypes.func.isRequired,
  fields: PropTypes.shape({}),
};

export default VideoTransitionSettings;
