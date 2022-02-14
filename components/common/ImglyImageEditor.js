import { useCallback, useEffect, useMemo } from 'react';
import { UIEvent, PhotoEditorSDKUI } from 'photoeditorsdk';
import { observer } from 'mobx-react';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import PropTypes from '../../lib/PropTypes';

const PhotoEditorSDK = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
}) => {
  const { source } = useMemo(() => imageData, [imageData]);
  const { uploadMedia } = useMediaStore();

  const onLoadImage = useCallback(async (image) => {
    console.log(image, 'Pixi image to be update');

    let media;
    let hasError;

    try {
      // setIsLoading(true);
      startUpload();
      media = await uploadMedia({ data: image, isCrop: true });
      console.log(media, 'Media section');
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
    console.log('PhotoEditorSDK for Web is ready!');
    editor.on(UIEvent.EXPORT, (imageSrc) => {
      onLoadImage(imageSrc);
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
