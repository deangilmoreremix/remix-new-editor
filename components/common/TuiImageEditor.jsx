import React, { useCallback, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import ImageEditor from '@toast-ui/react-image-editor';

import { Box, Button } from '@material-ui/core';
import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import Loader from './Loader';
import useMediaStore from '../hooks/useMediaStore';
import {
  IMAGE_CANT_BE_UPLOADED_ERROR,
  IMAGE_NOT_FOUND_ERROR,
  IMAGE_NOT_SUPPORTED_ERROR,
} from '../../lib/constants/settings/image';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import { DEFAULT_IMAGE_NAME, BAR_POSITION, MENU, SIZE } from '../../lib/constants/imageEditor/tuiEditor';


import '../../styles/components/modals/TuiImageEditorModal.scss';
import { createBlob, getFormatFromContentType } from '../../lib/utils/imageEditorHelper';

const TuiImageEditor = observer(({
  imageData,
  onImageCropped,
  handleClose,
}) => {
  const { CROP, FLIP, ROTATE, SHAPE, ICON, MASK, DRAW, FILTER } = MENU;
  const refEditor = useRef();
  const [isLoading, setLoading] = useState(false);
  const { uploadMedia } = useMediaStore();

  const { source, contentType } = useMemo(() => imageData, [imageData]);

  const onLoadSuccess = useCallback(async () => {
    try {
      setLoading(true);

      const format = getFormatFromContentType(contentType);
      console.log(format);

      if (format === ('jpeg' || 'gif' || 'svg')) {
        // eslint-disable-next-line no-underscore-dangle
        await uploadFile(createBlob((refEditor).current.imageEditorInst._graphics
          .toDataURL({ format })));
      } else if (format === 'png') {
        // eslint-disable-next-line no-underscore-dangle
        await uploadFile((refEditor).current.imageEditorInst._graphics.toDataURL({ format }));
      }
    } catch (err) {
      return showError(err.message || IMAGE_CANT_BE_UPLOADED_ERROR);
    } finally {
      setLoading(false);
    }
  });

  const uploadFile = useCallback(async (imageMeta) => {
    try {
      if (imageMeta) {
        const newUrl = (await uploadMedia({ data: imageMeta, isCrop: true })).url;
        const metadata = await new MediaTypeDetector()
          .getMetadata(newUrl);
        if (!metadata.contentType.includes(MEDIA_TYPES.IMAGE)) {
          return showError(IMAGE_NOT_FOUND_ERROR);
        }
        onImageCropped(metadata);
      }
    } catch (err) {
      return showError(err.message || IMAGE_NOT_SUPPORTED_ERROR);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="image-editor-content">
      {isLoading ? <Loader isLoading={isLoading} className="image-editor-content" /> : (
        <Box>
          <div className="canvas-container">
            <ImageEditor
              ref={refEditor}
              includeUI={{
                loadImage: {
                  path: source,
                  name: DEFAULT_IMAGE_NAME,
                },
                menu: [CROP, FLIP, ROTATE, SHAPE, ICON, MASK, DRAW, FILTER],
                initMenu: MENU.FILTER,
                uiSize: SIZE,
                menuBarPosition: BAR_POSITION.BOTTOM,
              }}
              cssMaxHeight={500}
              cssMaxWidth={700}
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
              onClick={onLoadSuccess}
            >
              Ok
            </Button>
          </Box>
        </Box>
      )}
    </div>
  );
});

TuiImageEditor.propTypes = {
  className: PropTypes.string,
  imageData: PropTypes.shape({
    source: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  resolution: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  onImageCropped: PropTypes.func.isRequired,
};

export default TuiImageEditor;
