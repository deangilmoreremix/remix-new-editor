import * as React from 'react';
import { observer } from 'mobx-react';
import captureVideoFrame from 'capture-video-frame';
import { Player, ControlBar } from 'video-react';

import PropTypes from '../../../lib/PropTypes';
import FieldBuilder from '../../form/FieldBuilder';
import { FROM, KIND, TO } from '../../../lib/constants/popcorn';
import useMediaStore from '../../hooks/useMediaStore';
import useProjectStore from '../../hooks/useProjectStore';
import { TRANSITION_TIMELINE_OFFSET } from '../../../lib/constants/settings/video-transition';
import { loadImage } from '../../../lib/requestCreator';
import { makeTransition, playTransition } from '../../../lib/utils/transition';

const VideoTransitionSettings = observer(({ element, update, fields, find }) => {
  const { findAndUpdate } = useProjectStore();
  const { uploadMedia } = useMediaStore();

  const [isCaptured, setIsCaptured] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [transition, setTransition] = React.useState(null);

  const newFromEnd = React.useRef(null);
  const newToStart = React.useRef(null);

  const imageFrom = React.useRef(null);
  const imageTo = React.useRef(null);
  const fromPlayer = React.useRef(null);
  const toPlayer = React.useRef(null);
  const canvasEl = React.useRef(null);

  const { popcornOptions: values } = element || {};

  const { current: from } = imageFrom;
  const { current: to } = imageTo;

  const { kind, start, end, fromUrl, toUrl } = values;

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
        await Promise.all([
          imageFrom.current = { dataUri: await loadImage(fromUrl) },
          imageTo.current = { dataUri: await loadImage(toUrl) },
        ]);
        setIsCaptured(true);
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

    return setIsCaptured(true);
  }, [fromVideo, isCaptured, toVideo]);

  const handleSave = React.useCallback(
    async () => {
      // 1. upload images
      if (from && to) {
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
          end: newFromEnd.current ? (fromVideoStart + newFromEnd.current) : fromVideoEnd,
        };

        const transitionStart = fromVideoNewOptions.end + TRANSITION_TIMELINE_OFFSET;
        const transitionEnd = transitionStart + duration;

        // 3. Prepare to update transition
        const transitionOptions = {
          fromUrl: newFromUrl || fromUrl,
          toUrl: newToUrl || toUrl,
          start: transitionStart,
          end: transitionEnd,
        };

        // 4. Prepare to update the second video
        const toVideoNewOptions = {
          from: newToStart.current || toVideoFrom,
          start: transitionOptions.end + TRANSITION_TIMELINE_OFFSET,
        };

        // 5. update From video end
        findAndUpdate(fromVideo.id, fromVideoNewOptions);

        // 6. update transition element
        update(transitionOptions);

        // 7. update To video start
        findAndUpdate(toVideo.id, toVideoNewOptions);

        // 8. Clear time refs
        newFromEnd.current = null;
        newToStart.current = null;
      }
    },
    [
      duration,
      from,
      fromVideo,
      to,
      toVideo,
    ],
  );

  return (
    <div className="video-transition-form">
      {values && (
        <React.Fragment>
          <FieldBuilder name={KIND} value={values.kind} onChange={update} {...fields[KIND]} />
          <FieldBuilder name={FROM} value={values.from} onChange={update} {...fields[FROM]} />
          <FieldBuilder name={TO} value={values.to} onChange={update} {...fields[TO]} />
        </React.Fragment>
      )}
      {isCaptured ? (
        <React.Fragment>
          <canvas ref={canvasEl} width={300} height={300 * 0.5625} />
          <button
            disabled={!(from && to)}
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? 'stop' : 'play'}
          </button>
          <button type="button" onClick={handleSave} disabled={!(from && to)}>
            save
          </button>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Player
            ref={fromPlayer}
            src={fromVideo && fromVideo.popcornOptions ? fromVideo.popcornOptions.src : ''}
            videoId={fromVideo.id}
            crossOrigin="anonymous"
          >
            <ControlBar autoHide={false} />
          </Player>
          <Player
            ref={toPlayer}
            src={toVideo && toVideo.popcornOptions ? toVideo.popcornOptions.src : ''}
            videoId={toVideo.id}
            crossOrigin="anonymous"
          >
            <ControlBar autoHide={false} />
          </Player>
        </React.Fragment>
      )}
      <button type="button" onClick={handleCaptureClick}>{isCaptured ? 'Reselect' : 'Capture'}</button>
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
