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
import { SANTISECOND } from '../../../lib/constants/project';

import { loadImage } from '../../../lib/requestCreator';
import { makeTransition, playTransition } from '../../../lib/utils/transition';
import Loader from '../../common/Loader';

const VideoTransitionSettings = observer(({ element, update, fields, find }) => {
  const {
    findAndUpdate,
    updateVideoDuration,
    elements,
    projectData,
    duration: clipDuration,
    updateElementFromTimeline,
  } = useProjectStore();
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
  const animationRef = React.useRef(null);

  const { popcornOptions: values } = element || {};

  const { current: from } = imageFrom;
  const { current: to } = imageTo;
  const { current: canvas } = canvasEl;

  const {
    kind,
    start,
    end,
    fromUrl,
    toUrl,
    width,
    height,
  } = values;

  const duration = React.useMemo(() => +((end - start).toFixed(2)), [start, end]);

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
    if (from && to && canvas && kind) {
      setTransition(makeTransition({ canvas, kind, from: from.dataUri, to: to.dataUri }));
    }
  }, [from, to, canvas, kind]);

  React.useEffect(() => {
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
    if (fromPlayer && fromPlayer.current && !isCaptured) {
      fromPlayer.current.video.seek(fromVideo.popcornOptions.end - fromVideo.popcornOptions.start
        + fromVideo.popcornOptions.from);
    }
  }, [fromVideo, isCaptured]);

  React.useEffect(() => {
    if (toPlayer && toPlayer.current && !isCaptured) {
      toPlayer.current.video.seek(toVideo.popcornOptions.from);
    }
  }, [toVideo, isCaptured]);

  const handleCaptureClick = React.useCallback(async () => {
    setIsPlaying(false);
    if (isCaptured) {
      animationRef.current = null;
      return setIsCaptured(false);
    }
    setIsLoading(true);
    let fromFrame;
    let toFrame;

    if (fromVideo) {
      const { player } = fromPlayer.current.getState();
      let currentTime = (+(player.currentTime.toFixed(2)))
        - (+(fromVideo.popcornOptions.from.toFixed(2)));
      if (fromVideo.popcornOptions.from + 1 > currentTime) {
        currentTime = 1.01;
        await fromPlayer.current.video.seek(fromVideo.popcornOptions.from + 1.01);
      }

      fromFrame = captureVideoFrame(fromVideo.id, 'png');

      newFromEnd.current = currentTime;
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
      const newEnd = newFromEnd.current
        ? (+((fromVideoStart + newFromEnd.current - TRANSITION_TIMELINE_OFFSET).toFixed(2)))
        : fromVideoEnd;

      const fromVideoNewOptions = {
        end: newEnd,
      };
      const transitionStart = +((fromVideoNewOptions.end + TRANSITION_TIMELINE_OFFSET).toFixed(2));
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
      const newFrom = newToStart.current
        ? +((newToStart.current + TRANSITION_TIMELINE_OFFSET).toFixed(2)) : toVideoFrom;

      let toVideoNewEnd = transitionOptions.end + TRANSITION_TIMELINE_OFFSET
        + (toVideo.popcornOptions.end - toVideo.popcornOptions.start)
        - newFrom + toVideo.popcornOptions.from;

      if (newFrom
        > (toVideo.popcornOptions.end - toVideo.popcornOptions.start)) {
        toVideoNewEnd = +((toVideo.popcornOptions.duration - newFrom).toFixed(2))
          + transitionOptions.end + TRANSITION_TIMELINE_OFFSET;
      }

      const toVideoNewOptions = {
        from: newFrom,
        start: transitionOptions.end + 0.001,
        end: toVideoNewEnd,
      };

      // 5. Update clip duration and
      // Update start and end in elements after second video with animation
      const elementsForUpdate = [];
      const elementsEnds = [];
      let animationOut = 0;
      elementsEnds.push(fromVideoNewOptions.end);
      elementsEnds.push(toVideoNewOptions.end);
      let itemStartAfterToVideo = null;

      const difference = +((toVideoNewOptions.end - toVideo.popcornOptions.end)
        .toFixed(2));

      const currentLayer = elements.filter(item => item.id === element.id);

      projectData.media.forEach((media) => {
        media.tracks.map((track) => {
          track.trackEvents.forEach(trackEvent => {
            if (trackEvent.track === currentLayer[0].track) {
              if (toVideo.popcornOptions.end < trackEvent.popcornOptions.start) {
                elementsForUpdate.push(trackEvent);
                elementsEnds.push(trackEvent.popcornOptions.end + difference);
                if (trackEvent.popcornOptions.animation
                  && trackEvent.popcornOptions.animation.out) {
                  animationOut += trackEvent.popcornOptions.animation.out.duration;
                }
              }
            }
          });
          return null;
        });
      });

      if (elementsForUpdate && elementsForUpdate.length) {
        elementsForUpdate.forEach(item => {
          if (item.popcornOptions.start < itemStartAfterToVideo || !itemStartAfterToVideo) {
            itemStartAfterToVideo = item.popcornOptions.start;
          }
        });
      }

      if (toVideoNewOptions.end > itemStartAfterToVideo) {
        if (clipDuration < ((Math.max(...elementsEnds) + animationOut) * SANTISECOND)) {
          updateVideoDuration(Math.max(...elementsEnds) + animationOut);
        }

        if (elementsForUpdate && elementsForUpdate.length && difference > 0) {
          elementsForUpdate.forEach(item => {
            updateElementFromTimeline({
              needUpdateStartEnd: true,
              elementId: item.id,
              start: item.popcornOptions.start + difference,
              end: item.popcornOptions.end + difference,
            });
          });
        }
      }

      // 6. update From video end
      findAndUpdate(fromVideo.id, fromVideoNewOptions);

      // 7. update transition element
      update(transitionOptions);

      // 8. update To video start
      findAndUpdate(toVideo.id, toVideoNewOptions);

      // 9. Set popcorn
      // setPopcorn();

      // 10. Clear time refs
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
    if (from && to && canvas && kind) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      if (selectRef && selectRef.current && selectRef.current.select) {
        selectRef.current.select.focus();
      }
    }
  };

  const updateAnimation = (value) => {
    animationRef.current = value.kind;
    update(value);
  };

  return (
    <div className="video-transition-settings">
      <Loader isLoading={isLoading} />
      {values && isCaptured && (
        <div className="video-transition-form">
          <FieldBuilder
            ref={selectRef}
            name={KIND}
            value={values.kind}
            onChange={updateAnimation}
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
            {
              fromVideo.popcornOptions && fromVideo.popcornOptions.from > 0 && (
                <div className="video-transition-warning">
                  Warning: Since the video has a
                  {' '}
                  <span className="video-transition-var">IN</span>
                  {' '}
                  value of
                  {' '}
                  <span>
                    {`${fromVideo.popcornOptions.from} seconds, the minimum frame will be set is ${fromVideo.popcornOptions.from + 1} seconds.`}
                  </span>
                </div>
              )
            }
            {fromVideo && (
              <Player
                ref={fromPlayer}
                src={fromVideo && fromVideo.popcornOptions ? (fromVideo.popcornOptions.src || fromVideo.popcornOptions.source[0]) : ''}
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
                src={toVideo && toVideo.popcornOptions ? (toVideo.popcornOptions.src || toVideo.popcornOptions.source[0]) : ''}
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
            disabled={!(from && to) || !animationRef.current}
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
