import React, { useCallback, useMemo, useRef } from 'react';
import { observer } from 'mobx-react';

import ImageEditor from '@toast-ui/react-image-editor';
import { Box, Button } from '@material-ui/core';
import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import { DEFAULT_IMAGE_NAME, BAR_POSITION, BASE_MENU, SIZE } from '../../lib/constants/imageEditor/tuiEditor';


import '../../styles/index.scss';

const TuiImageEditor = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  menu,
}) => {
  const refEditor = useRef();
  const { uploadMedia } = useMediaStore();

  const { source } = useMemo(() => imageData, [imageData]);

  const onLoadImage = useCallback(async () => {
    if (!refEditor) {
      return;
    }
    const { _graphics: graphics } = refEditor.current.imageEditorInst;
    let media;
    let hasError;
    let image = graphics.toDataURL();
    try {
      startUpload();
      handleClose();
      media = await uploadMedia({ data: image, isCrop: true });
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      image = media && media.url;
      if (!hasError) {
        onImageEdited(image);
      }
      endUpload();
    }
  }, [refEditor]);

  return (
    <div className="image-editor-content">
      <Box>
        <div className="canvas-container">
          <ImageEditor
            ref={refEditor}
            includeUI={{
              loadImage: {
                path: source,
                name: DEFAULT_IMAGE_NAME,
              },
              menu,
              initMenu: menu[0],
              uiSize: SIZE,
              menuBarPosition: BAR_POSITION,
            }}
            cssMaxHeight={500}
            cssMaxWidth={700}
            usageStatistics={false}
            selectionStyle={{
              cornerSize: 20,
              rotatingPointOffset: 70,
            }}
          />
        </div>
        <Box className="editor-buttons">
          <Button
            variant="outlined"
            color="default"
            className="done-button"
            onClick={handleClose}
          >
              Cancel
          </Button>
          <Button
            variant="outlined"
            color="default"
            className="done-button"
            onClick={onLoadImage}
          >
              Ok
          </Button>
        </Box>
      </Box>
    </div>
  );
});

TuiImageEditor.defaultProps = {
  menu: BASE_MENU,
};

TuiImageEditor.propTypes = {
  className: PropTypes.string,
  imageData: PropTypes.shape({
    source: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  resolution: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  onImageEdited: PropTypes.func.isRequired,
  startUpload: PropTypes.func.isRequired,
  endUpload: PropTypes.func.isRequired,
};

export default TuiImageEditor;
