import React, { useCallback, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react';

import ImageEditor from '@toast-ui/react-image-editor';
import { Box, Button } from '@material-ui/core';
import PropTypes from '../../lib/PropTypes';
import { showError, showInfo } from '../../lib/services/alertService';
import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import Loader from './Loader';
import useMediaStore from '../hooks/useMediaStore';
import {
  IMAGE_CANT_BE_UPLOADED_ERROR,
  IMAGE_NOT_FOUND_ERROR,
  IMAGE_NOT_SUPPORTED_ERROR,
  IMAGE_TO_PNG_FORMAT,
} from '../../lib/constants/settings/image';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import { DEFAULT_IMAGE_NAME, BAR_POSITION, MENU, SIZE } from '../../lib/constants/imageEditor/tuiEditor';
import { IMAGE_FORMATS } from '../../lib/constants/media';


import '../../styles/index.scss';
import { getFormatFromContentType } from '../../lib/utils/imageEditorHelper';

const TuiImageEditor = observer(({
  imageData,
  onImageCropped,
  handleClose,
}) => {
  const { CROP, FLIP, ROTATE, SHAPE, ICON, MASK, DRAW, FILTER } = MENU;
  const { SVG, SVG_XML, GIF } = IMAGE_FORMATS;
  const refEditor = useRef();
  const [isLoading, setLoading] = useState(false);
  const { uploadMedia } = useMediaStore();

  const { source, contentType } = useMemo(() => imageData, [imageData]);

  const onLoadImage = useCallback(async () => {
    const format = getFormatFromContentType(contentType);
    if (Object.values(IMAGE_FORMATS).includes(format)) {
      if (format === GIF) {
        return showError(`${IMAGE_NOT_SUPPORTED_ERROR}Current format: "${format}" . `);
      }
      if ([SVG_XML, SVG].includes(format)) {
        showInfo(`${IMAGE_TO_PNG_FORMAT}Current format: "${format}" . `);
      }
      try {
        setLoading(true);
        // eslint-disable-next-line no-underscore-dangle
        return uploadFile((refEditor).current.imageEditorInst._graphics
          .toDataURL({ format }));
      } catch (err) {
        return showError(err.message || IMAGE_CANT_BE_UPLOADED_ERROR);
      } finally {
        setLoading(false);
      }
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
              onClick={onLoadImage}
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
  }).isRequired,
  resolution: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
  onImageCropped: PropTypes.func.isRequired,
};

export default TuiImageEditor;
