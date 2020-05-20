import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import videojs from 'video.js';
import 'recordrtc';
import { ClipLoader } from 'react-spinners';
import WaveSurfer from 'wavesurfer.js';
import 'videojs-wavesurfer-dealiased/dist/videojs.wavesurfer';
import MicrophonePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.microphone';
import 'videojs-record-dealiased/dist/videojs.record';
import 'videojs-record-dealiased/dist/plugins/videojs.record.ts-ebml';

import useMediaStore from '../hooks/useMediaStore';
import useUiStore from '../hooks/useUIStore';

import { LIBRARY_TABS } from '../../lib/constants/library';
import { RECORDER_VIDEOJS_CONFIG } from '../../lib/constants/recorder';
import { showError } from '../../lib/services/alertService';

WaveSurfer.microphone = MicrophonePlugin;

export default observer(({ options: { type }, handleClose }) => {
  const {
    uploadMedia,
    storeAsset,
  } = useMediaStore();

  const {
    setLibraryType,
  } = useUiStore();

  const [saveOptionsVisible, setSaveOptionsVisible] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = () => {
    if (!recording) {
      return;
    }
    recording.saveAs({ video: `${type}.webm` });
  };

  const handleUpload = async (blob) => {
    if (!blob) {
      return;
    }
    setIsLoading(true);
    try {
      const asset = await uploadMedia({ data: blob });
      await storeAsset(asset, LIBRARY_TABS.VIDEO);
      setLibraryType(LIBRARY_TABS.VIDEO);
      handleClose();
    } catch (e) {
      showError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  RECORDER_VIDEOJS_CONFIG.plugins.record[type] = true;

  useEffect(() => {
    const player = videojs('recorder-modal__player', RECORDER_VIDEOJS_CONFIG);
    player.on('finishConvert', () => {
      setSaveOptionsVisible(true);
      setRecording(player.record());
      setRecordData(player.convertedData);
    });
    player.on('error', (element, error) => {
      showError(error.message);
    });
    player.on('deviceError', () => {
      showError(`Recording device error, code ${player.deviceErrorCode}`);
    });

    return () => (player ? player.dispose() : null);
  }, [type]);


  return (
    <React.Fragment>
      {
        isLoading
          ? (
            <ClipLoader
              size={300}
              loading
            />
          ) : (
            <div>
              <div data-vjs-player>
                <video id="recorder-modal__player" className="video-js vjs-default-skin" playsInline />
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
                  onClick={() => handleUpload(recordData)}
                >
                  Upload to Lib
                </button>
              </div>
            </div>
          )
      }
    </React.Fragment>
  );
});
