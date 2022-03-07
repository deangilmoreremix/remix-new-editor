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
      license: '',
      export: {
        image: {
          exportType: 'blob',
          enableDownload: false,
        },
      },
    });
    editor.on(UIEvent.EXPORT, (imageSrc) => {
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
