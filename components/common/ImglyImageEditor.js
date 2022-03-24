/* eslint-disable quotes */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UIEvent, PhotoEditorSDKUI } from 'photoeditorsdk';
import { observer } from 'mobx-react';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import useUIStore from '../hooks/useUIStore';
import PropTypes from '../../lib/PropTypes';
import { tabItems } from '../../lib/constants/library';



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
      license: `{"api_token":"Bmz_MBXK-7Rqsro1eLceKg","app_identifiers":["https://videoremix.io/","https://revolution.videoremix.io/","https://revolution.videoremix.io/edit","https://lead-buster.videoremix.io/","https://dev-revolution.videoremix.io/","https://dev-revolution.videoremix.io/edit","http://local-smart-video.videoremix.io/","http://local-smart-video.videoremix.io/edit"],"available_actions":[],"domains":["https://api.photoeditorsdk.com"],"enterprise_license":false,"expires_at":null,"features":["camera","library","export","customassets","whitelabel","adjustment","brush","filter","focus","frame","overlay","sticker","text","textdesign","transform"],"issued_at":1648111355,"minimum_sdk_version":"1.0","owner":"VideoRemix","platform":"HTML5","products":["pesdk"],"version":"2.4","signature":"OvKhhfYiRHcDZ/GggObgMKd4r+p8Jh4JxP3Ee5OWKpFlMReksa7BCrBpbM8D+6wB8e9BYqNcjutNqyzjLHWAI8z2Z5fqDoTCkF/rnG/HBZ5eTU6DXS+hn6mOs2Aecx3LpOtrGh96vXEwsPExbqauODTxUE2IWneiZywek1e54Pvqw6cEmaGoGCY2cFNkkKx/HjgGdAdmP2BUNhlYXhUzZmsN0L64G4i32yO2caCWpSSLsvRXOML6cpf9qLCX8+ccuFPPi45n5KcrU/m50/fln8cIgBWNeiuFLgyiqZSe2hs4SluNAhvdhS9xZSxpvd4KciPxXfl83ILliAC8FwqpzgeSdpK59QcxE3QfJbuM37guK4s/DZGQtwV4tUjOHZdqWbYv4sIKvpkhcjcYwwt2JUzLmaH0GSjyz92Te6LZlbFAqoSr+4xxuEvtTwQ9iliVBhq4v/zIYFu8roCEAAFrRTeCPf7kq0mw7Yf7PrJhkEHEjN2SQn5QdvvTzcVDNFJspWYNWnf47nl6I6DnHtQf/Vz4lWFblI1oAQpVMubM66rhWms4LEKEQvELWNk58/8cc4xG1ywhYMke5xJ4TP9kw9bM1aD/TcWtqEkdaz0OHl/wgkm0n1njuzbGWEO/ClYBcQVgNl4zfBLz4ry+bZX/7TkBv63l9b+EnkzRA3+BlCk="}
      `,
      // mainCanvasActions: ['export', 'download'],
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
