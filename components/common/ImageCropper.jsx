import React, { useCallback, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import ImageEditor from 'react-avatar-editor';

import { Box, Button } from '@material-ui/core';
import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import Loader from './Loader';
import useMediaStore from '../hooks/useMediaStore';
import {
  CROP_BRAND_LOGO_RESOLUTION,
  IMAGE_CANT_BE_UPLOADED_ERROR,
  IMAGE_NOT_FOUND_ERROR,
  IMAGE_NOT_SUPPORTED_ERROR,
} from '../../lib/constants/settings/image';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import FormSlider from '../form/FormSlider';

const ImageCropper = observer(({
  resolution,
  className,
  imageData,
  onImageCropped,
  handleClose,
}) => {
  const refEditor = useRef();
  const [isLoading, setLoading] = useState(false);
  const { uploadMedia } = useMediaStore();
  const { width, height } = useMemo(() => resolution, [resolution]);
  const { source } = useMemo(() => imageData, [imageData]);
  const [scale, setScale] = useState(1);
  const onLoadSuccess = useCallback(async () => {
    try {
      setLoading(true);
      await uploadFile(refEditor.current.getImageScaledToCanvas().toDataURL('image/png'));
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
    <div className="image-crop-content">
      { isLoading ? <Loader isLoading={isLoading} className="image-crop-content" /> : (
        <Box>
          <div className="canvas-container">
            <ImageEditor
              className={className}
              ref={refEditor}
              crossOrigin="anonymous"
              image={source}
              width={width}
              height={height}
              border={height === CROP_BRAND_LOGO_RESOLUTION.height ? 500 : 50}
              scale={scale}
            />
          </div>
          <FormSlider
            onChange={(value) => setScale(value)}
            value={scale}
            minValue={0.25}
            maxValue={10}
            step={0.05}
            sliderWidth={200}
            withoutInput
            sliderClassName="cropper-scale"
          />
          <Box className="cropper-buttons">
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
      ) }
    </div>
  );
});

ImageCropper.propTypes = {
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

export default ImageCropper;
