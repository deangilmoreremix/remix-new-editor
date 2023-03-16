import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import videojs from 'video.js';
import { Decoder, tools, Reader } from 'ts-ebml';
import { saveAs } from 'file-saver';
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
import useProjectStore from '../hooks/useProjectStore';
import useUserStore from '../hooks/useUserStore';

import { LIBRARY_TABS } from '../../lib/constants/library';
import { RECORDER_TYPES, RECORDER_VIDEOJS_CONFIG } from '../../lib/constants/recorder';
import { showError, showSuccess } from '../../lib/services/alertService';

WaveSurfer.microphone = MicrophonePlugin;

const EXTENSIONS_MAP = {
  [RECORDER_TYPES.AUDIO]: 'mp3',
  [RECORDER_TYPES.CAMERA]: 'webm',
  [RECORDER_TYPES.SCREEN]: 'webm',
};

const timeOut = 3000;

export default observer(({ options: { type, useAudio }, handleClose }) => {
  const mute = useRef(false);
  const playerRef = useRef(null);
  const videoRef = useRef(null);

  const {
    uploadMedia,
    storeAsset,
  } = useMediaStore();

  const {
    setLibraryType,
  } = useUiStore();

  const {
    isSuperAdmin,
  } = useUserStore();

  const { updateItem } = useProjectStore();

  const [saveOptionsVisible, setSaveOptionsVisible] = useState(false);
  const [showHiddenButton, setShowHiddenButton] = useState(false);
  const [time, setTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPipButton, setShowPipButton] = useState(false);

  let { current: player } = playerRef;

  const config = React.useMemo(
    () => RECORDER_VIDEOJS_CONFIG({ type, useAudio, WaveSurfer }),
    [type, useAudio]);

  const readAsArrayBuffer = (blob) => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(blob);
      reader.onloadend = () => { resolve(reader.result); };
      reader.onerror = (ev) => { reject(ev.error); };
    })
  );

  useEffect(() => {
    console.log(showPipButton,"showpipbutton")
  },[showPipButton])

  useEffect(() => {
    if (videoRef.current && useAudio !== undefined && type) {
      player = videojs(videoRef.current, config);

      player.on('deviceReady', () => {
        setShowHiddenButton(true);
        if (config.plugins.record.video !== false) {
          setShowPipButton(true);
        }
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
        if (player.recordedData.type.includes('audio')) {
          setSaveOptionsVisible(true);
        }
      });

      player.on('error', (element, error) => {
        player.record().stopStream();
        showError(error.message);
      });

      player.on('deviceError', () => {
        showError(`Recording device error, code ${player.deviceErrorCode}`);
      });
      player.on('finishConvert', () => {
        setSaveOptionsVisible(true);
      });
    }
  }, [videoRef, useAudio, type, config]);
console.log(saveOptionsVisible,"saveOptionsVisible")
  React.useEffect(() => () => () => {
    if (player) {
      player.dispose();
    }
  }, []);

  useEffect(() => () => player.record().stopStream(), []);

  const handleDownload = useCallback(() => {
    if (!player) {
      return;
    }

    const blob = player.recordedData;
    const decoder = new Decoder();
    const reader = new Reader();

    reader.logging = false;
    reader.drop_default_duration = false;

    // load webm blob and inject metadata
    readAsArrayBuffer(blob).then((buffer) => {
      const elms = decoder.decode(buffer);
      elms.forEach((elm) => { reader.read(elm); });
      reader.stop();

      const refinedMetadataBuf = tools.makeMetadataSeekable(
        reader.metadatas, reader.duration, reader.cues);
      const body = buffer.slice(reader.metadataSize);
      const result = new Blob([refinedMetadataBuf, body],
        { type: blob.type });

      saveAs(result, `${type}.${EXTENSIONS_MAP[type]}`);
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

  const getLink = React.useCallback(async () => {
    if (!player.recordedData) {
      return;
    }
    setIsLoading(true);
    const blob = player.recordedData;
    const decoder = new Decoder();
    const reader = new Reader();

    reader.logging = false;
    reader.drop_default_duration = false;
    try {
      const data = await readAsArrayBuffer(blob);
      const elms = decoder.decode(data);
      elms.forEach((elm) => { reader.read(elm); });
      reader.stop();
      const refinedMetadataBuf = tools.makeMetadataSeekable(
        reader.metadatas, reader.duration, reader.cues);
      const body = data.slice(reader.metadataSize);
      const result = new Blob([refinedMetadataBuf, body],
        { type: blob.type });
      const updatedData = await uploadMedia({ data: result });
      updateItem({ preview: updatedData.url });
      showSuccess(`Preview link was created:  ${updatedData.url}`, 'Success');
      handleClose();
    } catch (e) {
      showError(e.message || e.data || e.toString());
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
                <video
                  ref={videoRef}
                  className="video-js vjs-default-skin pic-to-pic-disable"
                  playsInline
                />
                {showHiddenButton && (
                  <button className="recorder-button-hidden" onClick={handleClick} />
                )}
                {showPipButton && (
                  <button
                    onClick={() => videoRef.current.requestPictureInPicture()}
                    className="pic-to-pic vjs-pip-button vjs-control vjs-button vjs-icon-picture-in-picture-start"
                  />
                )}
              </div>
              <div className={`recorder-modal-options ${saveOptionsVisible ? '' : 'recorder-modal-options_hidden'}`}>
                <button
                  className="recorder-modal-options__button recorder-modal-options__button_save"
                  onClick={handleDownload}
                >
                  Download
                </button>
                {isSuperAdmin
                  ? (
                    <button
                      className="recorder-modal-options__button recorder-modal-options__button_upload"
                      onClick={getLink}
                    >
                      Get preview link
                    </button>
                  ) : null}
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
