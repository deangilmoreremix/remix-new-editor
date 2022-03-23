import { useCallback, useEffect, useMemo, useState } from 'react';
import { UIEvent, PhotoEditorSDKUI } from 'photoeditorsdk';
import { observer } from 'mobx-react';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import useUIStore from '../hooks/useUIStore';
import PropTypes from '../../lib/PropTypes';
import { tabItems } from '../../lib/constants/library';


const licence = {
  api_token: 'Bmz_MBXK-7Rqsro1eLceKg',
  app_identifiers: ['https://videoremix.io/', 'https://revolution.videoremix.io/', 'https://lead-buster.videoremix.io/', 'https://dev-revolution.videoremix.io/', 'http://local-smart-video.videoremix.io/'],
  available_actions: [],
  domains: ['https://api.photoeditorsdk.com'],
  enterprise_license: false,
  expires_at: null,
  features: ['camera', 'library', 'export', 'customassets', 'whitelabel', 'adjustment', 'brush', 'filter', 'focus', 'frame', 'overlay', 'sticker', 'text', 'textdesign', 'transform'],
  issued_at: 1648042514,
  minimum_sdk_version: '1.0',
  owner: 'VideoRemix',
  platform: 'HTML5',
  products: ['pesdk'],
  version: '2.4',
  signature: 'jko8WvCA0SU008lVIsEWQ6xA6ymjM8n3f+CDHjwGKSlWzHFLTEKS+oeZ0Ji+4bHmXP5uLylh2J9UQHctZR8NqUHcHvgUgtrUh5yNgiEYNbV8A9KUryTqdwEIFjucZkPOiaEvQcuaoIn+r+mK2f6CIJnEnwc6+AhTm8eeN6F6ZUK/0aP9QRY37E+1I33Ti80kNEHPDKhXyAWs7qQHNHtvGZyJPo7f3lJTUFiqjoEh8u474Ym7+xgi+h3SNyvRaGwnbutRqMLR2FG8W9fQNWR+V7YAQkzbORehinkQd/1PEF/iWyA1wrjUwgvGK8EmFQRbrjx7zjzO4n0GzD5rJOakS2l8LNVaLyUDF4h8SSwBLwliSgivWbw8RmgqgcoVq/ayObxHIGSF11PPO0XpUNeA/O4A5Y16VyA4yS2OEtRpeMdZNo2oQ+i9+uAUXcc8T6no2OEeH0fSobMngBqHF0MvVfvpolKOBE38NLvi8esySID4H0K2JPlKJ5ieLnMt/eZ4CE0ikarh2Mgtg6e1ebpwsGyQB+2vM5W7cQzLWKn+gSOBlAVkm+Rc4SKgdqhBUOSGXQ/tvSgtpNljIQfcE3SdCXiNknTqpa7f6Lc9xxKK1Dnesmof+u1bOlpPcaj7D1+C2uJs0tYzdeRZ2OX0Jzs5ppb+gjVtu0oc5lFmIcAo6SQ=',
};
const PhotoEditorSDK = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
}) => {
  const { source } = useMemo(() => imageData, [imageData]);
  const { uploadMedia, storeAsset } = useMediaStore();

  const {
    secondaryWindowType: activeTab,
  } = useUIStore();

  const onLoadImage = useCallback(async (image) => {
    let media;
    let hasError;

    try {
      // setIsLoading(true);
      startUpload();
      media = await uploadMedia({ data: image, isCrop: true });
      const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
      let fileType = activeTab;
      Object.keys(tabItems).forEach((item) => {
        tabItems[item].formats.forEach((format) => {
          if (format === fileExtension) {
            fileType = item;
          }
        });
      });

      await storeAsset(media, fileType);
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      // setIsLoading(false);
      image = media && media.url;
      if (!hasError) {
        // console.log(onImageEdited);
        onImageEdited(image);
      }
      handleClose();
      endUpload();
    }
  }, []);

  async function initEditor() {
    const editor = await PhotoEditorSDKUI.init({
      container: '#editor',
      image: source, // Image url or Image path relative to assets folder
      license: licence.api_token,
      mainCanvasActions: ['export', 'download'],
      export: {

        image: {
          exportType: 'blob',
          enableDownload: true,
        },
      },
      custom: {
        mainCanvasActions: ['undo', 'redo', 'export', 'close'],
        themes: {
          dark: {
            tooltip: {
              background: 'darkgray',
            },
            toolbar: {
              foreground: 'rgba(255, 255, 255, 0.90)',
              background: '#242424',
              activeBackground: 'transparent',
              activeForeground: '#EB4F53',
              /** border between the toolbar and the toolControlBar * */
              borderColor: 'transparent',
              /** this will overwrite borderColor and apply a border of your choosing * */
              border: 'none',
            },
            button: {
              /** High Emphasis button - primary variant e.g.: Export button */
              containedPrimaryBackground: '#EB4F53',
              containedPrimaryForeground: 'rgba(255, 255, 255, 0.90)',


              /** Medium Emphasis button - primary variant e.g.: New Text, Text Design, Upload on toolControlBar */
              outlinedPrimaryBackground: '#242424',
              outlinedPrimaryForeground: 'rgba(255, 255, 255, 0.90)',


              /** Medium Emphasis button - secondary variant e.g.: Remove Filter, Overlay, Shuffle Text Design */
              outlinedSecondaryBackground: 'transparent',
              outlinedSecondaryForeground: 'rgba(255, 255, 255, 0.90)',


              outlinedInactiveOverlayColor: 'rgba(0, 0, 0, 0.3)',
              outlinedBorderColor: '#333333',


              /** Low Emphasis button - primary variant e.g.: primary button in modal */
              textPrimaryForeground: '#365AFC',
              /** Low Emphasis button - secondary variant e.g.: secondary button in modal, undo, redo, Carousel navigators, alignment buttons */
              textSecondaryForeground: 'rgba(255, 255, 255, 0.90)',


              textInactiveOpacity: '0.5',


              activeForeground: '#365AFC',


              hoverOverlayColor: 'rgba(255, 255, 255, 0.08)',
            },
            slider: {
              trackColor: 'rgba(255, 255, 255, 0.4)',
              activeTrackColor: '#EB4F53',
              thumbBackground: '#171717',
              thumbBorderColor: '#EB4F53',
              inactiveOpacity: '0.3',
              hoverOpacity: '0.7',
            },
          },
        },
      },
    });
    //   // editor.on(UIEvent.EXPORT, (imageSrc) => {
    //   //   onLoadImage(imageSrc);
    //   // });
    editor.on(UIEvent.DOWNLOAD, (imageSrc) => {
      onLoadImage(imageSrc);
    });
    editor.on(UIEvent.CLOSE, () => {
      handleClose();
    });
  }

  useEffect(() => {
    initEditor();
  });


  return (
    <div
      id="editor"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
});

PhotoEditorSDK.propTypes = {
  className: PropTypes.string,
  imageData: PropTypes.shape({
    source: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  onImageEdited: PropTypes.func.isRequired,
  startUpload: PropTypes.func.isRequired,
  endUpload: PropTypes.func.isRequired,
  noCrop: PropTypes.bool.isRequired,
};

PhotoEditorSDK.defaultProps = {
  noCrop: false,
};

export default PhotoEditorSDK;
