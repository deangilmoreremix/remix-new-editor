/* eslint-disable quotes */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UIEvent, PhotoEditorSDKUI } from 'photoeditorsdk';
import { observer } from 'mobx-react';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import useUIStore from '../hooks/useUIStore';
import PropTypes from '../../lib/PropTypes';
import { tabItems } from '../../lib/constants/library';


const license = { api_token: "Bmz_MBXK-7Rqsro1eLceKg", app_identifiers: ["revolution.videoremix.io", "dev-revolution.videoremix.io", "local-smart-video.videoremix.io"], available_actions: [], domains: ["https://api.photoeditorsdk.com"], enterprise_license: false, expires_at: null, features: ["camera", "library", "export", "customassets", "whitelabel", "adjustment", "brush", "filter", "focus", "frame", "overlay", "sticker", "text", "textdesign", "transform"], issued_at: 1648560818, minimum_sdk_version: "1.0", owner: "VideoRemix", platform: "HTML5", products: ["pesdk"], version: "2.4", signature: "aTxspPl/8xoZ7PgshpJWadw14FyTNqPONPd9aLv1tM0FxPbnZ9SLZ1dy/kkdUfu5E+jIt1DOio6CsBhF+tzmnG/OO06T57DT+p4OiHZfZWIy0StukcbZp/neAg7/bF9joXayKMBAi1r8Vcd5dMiGLYwyTe4znGrSZPxvTmaRrixBxDFCXPNMJFyziTeFa9+WlEG8duw0TSqYsaQkqZmw0/QIhiusBTRuy3W/HqUn074UpGtJ1CT7qbUhr2bFvwuE4HgbhlNn939VzF/wsMA79sML8GimpQKBhMuZOIR+wDbG8yT80/JHCcKIKqP3xujJzG7RPCZ0pmwr4nrfYu+r7HZ8y5LBRllLhQJZsXs3zxUn+FzQj61u0r1yeuCQOjyYrFqCV+5qAiS85UdYzsFiYLV3rYv0HxffM+LFhmJzCY5tivLTKuwYoIBtLmD5bne+Pke8anBZM8TCvu+2hVA0HHvVPkQTkjLd7nbFmLwQ885tUdotogJ6D7/Eg5Yi/GJ+Pi32NMGOVNhWPYF470wGd2e/CnyPvylTh4IS6FM2rrI1PvmJnOKTRhsuO5luw+E9Gc8ZxKWAOYDALWzUQjILtQLOS8XFadPuFjlGu248bmiozExfzTt2hupb0PZrCHm4GvcGgPSLiobYeXuBqXEycmsSFUjR4JPtypw9Jv0Qq2o=" };
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
      license: JSON.stringify(license),
      export: {
        image: {
          exportType: 'blob',
          enableDownload: false,
        },
      },
      custom: {
        mainCanvasActions: ['undo', 'redo', 'export', 'close'],
        themes: {
          dark: {
            /** Base Colors */
            /** Overall background color. This color is used if not overriden by a component */
            background: '#000000',
            /** Overall foreground color. This color is used if not overriden by a component */
            foreground: '#FFFFFF',
            primary: '#EB4F53',
            warning: '#FFBA5C',
            error: '#C2393A',
            success: '#39C26C',
            tooltip: {
              background: 'darkgray',
            },
            selectColor: {
              activeBorderColor: '#EB4F53',
              inactiveOpacity: '0.3',
            },
            colorPicker: {
              inputBorderColor: '#EB4F53',
              listBackground: '#333333',
              /**
              * According to material design
              * shadows are applied for dark theme
              * they don't really work well with light theme,
              * so they are customizable based on your design choices
              */
              listShadow: `0 12px 17px 2px rgba(0,0,0,0.14),
                0 5px 22px 4px rgba(0,0,0,0.12),
                0 7px 8px -4px rgba(0,0,0,0.20)`,
              controlsColor: '#FFFFFF',
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
              outlinedPrimaryBackground: '#EB4F53',
              outlinedPrimaryForeground: 'rgba(255, 255, 255, 0.90)',


              /** Medium Emphasis button - secondary variant e.g.: Remove Filter, Overlay, Shuffle Text Design */
              outlinedSecondaryBackground: 'transparent',
              outlinedSecondaryForeground: 'rgba(255, 255, 255, 0.90)',


              outlinedInactiveOverlayColor: 'rgba(0, 0, 0, 0.3)',
              outlinedBorderColor: '#EB4F53',


              /** Low Emphasis button - primary variant e.g.: primary button in modal */
              textPrimaryForeground: '#EB4F53',
              /** Low Emphasis button - secondary variant e.g.: secondary button in modal, undo, redo, Carousel navigators, alignment buttons */
              textSecondaryForeground: 'rgba(255, 255, 255, 0.90)',


              textInactiveOpacity: '0.5',
              activeForeground: '#EB4F53',


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

            checkbox: {
              background: '#333333',
              foreground: '#FFFFFF',
              activeForeground: '#EB4F53',
              activeBackground: '#EB4F53',
              inactiveOpacity: '0.3',
              hoverOpacity: '0.8',
            },

            card: {
              background: '#333333',
              foreground: 'rgba(255, 255, 255, 0.90)',
              activeBorderColor: '#EB4F53',
              // activeOverlayColor: '#f18487',
              activeOverlayColor: 'rgba(255,0,0,0.20)',
              /** card in PhotoEditor SDK almost always has a label */
              labelBackground: 'linear-gradient(transparent, rgba(0, 0, 0, 0.2))',
              labelForeground: 'rgba(255, 255, 255, 0.90)',
              inactiveOverlayColor: 'rgba(0, 0, 0, 0.3)',
              hoverOverlayColor: 'rgba(255, 255, 255, 0.08)',
            },

            tabTitle: {
              foreground: 'rgba(255, 255, 255, 0.60)',
              background: 'transparent',
              activeBackground: 'transparent',
              activeBorderColor: '#EB4F53',
              activeForeground: 'rgba(255, 255, 255, 0.90)',
            },

          },
        },
      },
    });
    editor.on(UIEvent.EXPORT, (imageSrc) => {
      onLoadImage(imageSrc);
    });
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
