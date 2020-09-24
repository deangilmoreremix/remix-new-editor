import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import videojs from 'video.js';
import { ClipLoader } from 'react-spinners';
import WaveSurfer from 'wavesurfer.js';
import MicrophonePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.microphone';
import getBlobDuration from 'get-blob-duration';

import 'recordrtc';
import 'videojs-wavesurfer-dealiased/dist/videojs.wavesurfer.min';
import 'videojs-record-dealiased/dist/videojs.record.min';
import 'videojs-record-dealiased/dist/plugins/videojs.record.ts-ebml.min';
import 'videojs-record-dealiased/dist/plugins/videojs.record.lamejs';

import useMediaStore from '../hooks/useMediaStore';
import useUiStore from '../hooks/useUIStore';

import { LIBRARY_TABS } from '../../lib/constants/library';
import { RECORDER_TYPES, RECORDER_VIDEOJS_CONFIG } from '../../lib/constants/recorder';
import { showError } from '../../lib/services/alertService';

WaveSurfer.microphone = MicrophonePlugin;

const EXTENSIONS_MAP = {
  [RECORDER_TYPES.AUDIO]: 'mp3',
  [RECORDER_TYPES.CAMERA]: 'webm',
  [RECORDER_TYPES.SCREEN]: 'webm',
};

const timeOut = 3000;

export default observer(({ options: { type, useAudio }, handleClose }) => {
  const mute = useRef(false);

  const {
    uploadMedia,
    storeAsset,
  } = useMediaStore();

  const {
    setLibraryType,
  } = useUiStore();

  const [saveOptionsVisible, setSaveOptionsVisible] = useState(false);
  const [showHiddenButton, setShowHiddenButton] = useState(false);
  const [time, setTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const playerRef = React.useRef(null);
  const videoRef = React.useRef(null);

  let { current: player } = playerRef;

  const config = React.useMemo(
    () => RECORDER_VIDEOJS_CONFIG({ type, useAudio, WaveSurfer }),
    [type, useAudio]);

  useEffect(() => {
    if (videoRef.current && useAudio !== undefined && type) {
      player = videojs(videoRef.current, config);

      player.on('deviceReady', () => {
        setShowHiddenButton(true);
      });

      player.recordToggle.on('click', () => {
        const recorder = player.record();
        if (!recorder.isRecording() && !showHiddenButton) {
          setShowHiddenButton(true);
        }
      });

      player.on('volumechange', () => {
        if (player.volume() === 0 || player.muted()) {
          mute.current = true;
          player.muted(true);
        } else {
          mute.current = false;
          player.muted(false);
        }
      });

      player.on('finishRecord', () => {
        if (mute.current) {
          player.volume(0);
        }
        setSaveOptionsVisible(true);
      });

      player.on('error', (element, error) => {
        player.record().stopStream();
        showError(error.message);
      });

      player.on('deviceError', () => {
        showError(`Recording device error, code ${player.deviceErrorCode}`);
      });
    }
  }, [videoRef, useAudio, type, config]);

  React.useEffect(() => () => () => {
    if (player) {
      player.dispose();
    }
  }, []);

  useEffect(() => () => player.record().stopStream(), []);

  const handleDownload = React.useCallback(() => {
    if (!player) {
      return;
    }
    player.record().saveAs({
      [type === RECORDER_TYPES.AUDIO
        ? RECORDER_TYPES.AUDIO : RECORDER_TYPES.CAMERA]: `${type}.${EXTENSIONS_MAP[type]}`,
    });
  }, [player]);

  const handleUpload = React.useCallback(async () => {
    if (!player.recordedData) {
      return;
    }
    setIsLoading(true);
    try {
      const duration = await getBlobDuration(player.recordedData);
      const videoFile = player.recordedData.type.indexOf('video') === 0;
      const libraryType = videoFile ? LIBRARY_TABS.VIDEO : LIBRARY_TABS.AUDIO;

      const asset = await uploadMedia({ data: player.recordedData });
      if (videoFile) {
        asset.duration = duration;
      }
      await storeAsset(asset, libraryType);
      setLibraryType(libraryType);
      handleClose();
    } catch (e) {
      showError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [player]);

  const handleClick = useCallback(() => {
    const recorder = player.record();
    const { title } = document;
    setTime(timeOut / 1000);
    document.title = `${title} (record ${timeOut / 1000})`;

    const interval = setInterval(() => {
      setTime(value => {
        if (value < 2) {
          document.title = title;
          recorder.start();
          setShowHiddenButton(false);
          return clearInterval(interval);
        }
        document.title = `${title} (record ${value - 1})`;
        return value - 1;
      });
    }, [1000]);
  }, [player]);

  return (
    <div className={isLoading ? 'recorder-await' : ''}>
      {
        isLoading
          ? (
            <ClipLoader
              size={150}
              loading
            />
          ) : (
            <div>
              <div data-vjs-player>
                <video ref={videoRef} className="video-js vjs-default-skin" playsInline />
                {showHiddenButton && <button className="recorder-button-hidden" onClick={handleClick} />}
              </div>
              <div className={`recorder-modal-options ${saveOptionsVisible ? '' : 'recorder-modal-options_hidden'}`}>
                <button
                  className="recorder-modal-options__button recorder-modal-options__button_save"
                  onClick={handleDownload}
                >
                  Download
                </button>
                <button
                  className="recorder-modal-options__button recorder-modal-options__button_upload"
                  onClick={handleUpload}
                >
                  Add in media
                </button>
              </div>
              {time ? <div className="recorder-hidden-block">{time}</div> : null}
            </div>
          )
      }
    </div>
  );
});
