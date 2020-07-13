import React, { useCallback, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import Cropper from 'react-cropper';

import { Box, Button } from '@material-ui/core';
import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import FieldBuilder from '../form/FieldBuilder';
import { CHECKBOX } from '../../lib/constants/forms';
import { setMinMax } from '../../lib/utils/cropHelper';

const ImageCropper = observer(({
  resolution,
  imageData,
  needSave,
  onImageCropped,
  handleClose,
  startUpload,
  endUpload,
  needClose = true,
}) => {
  const refEditor = useRef();
  const { uploadMedia } = useMediaStore();
  const [isAuto, setIsAuto] = useState(true);
  const [width, setWidth] = useState(resolution.width);
  const [height, setHeight] = useState(resolution.height);

  const { source, width: imageWidth, height: imageHeight } = useMemo(() => imageData,
    [imageData]);
  const { width: recommendedWidth, height: recommendedHeight } = useMemo(() => resolution,
    [resolution]);
  const widthProportion = useMemo(() => recommendedWidth / imageWidth,
    [recommendedWidth, imageWidth]);
  const heightProportion = useMemo(() => recommendedHeight / imageHeight,
    [recommendedHeight, imageHeight]);
  const proportion = useMemo(() => Math.min(1, Math.max(widthProportion, heightProportion)),
    [widthProportion, heightProportion]);
  const ratio = useMemo(() => recommendedWidth / recommendedHeight,
    [recommendedWidth, recommendedHeight]);

  const uploadFile = useCallback(async () => {
    let image = refEditor.current.cropper
      .getCroppedCanvas({ width: recommendedWidth, height: recommendedHeight }).toDataURL();
    let media;
    let hasError;
    if (needSave) {
      try {
        if (startUpload) {
          startUpload();
        }
        media = await uploadMedia({ data: image, isCrop: true });
      } catch (e) {
        hasError = true;
        showError(e.message);
      } finally {
        image = media && media.url;
        if (endUpload) {
          endUpload();
        }
        if (!hasError) {
          onImageCropped(image);
        }
        if (needClose) {
          handleClose();
        }
      }
    } else {
      onImageCropped(image);
      if (needClose) {
        handleClose();
      }
    }
  }, [refEditor]);

  React.useEffect(() => {
    if (!refEditor || !refEditor.current.cropper.cropBoxData) {
      return;
    }
    setMinMax(refEditor, isAuto);
    if (isAuto) {
      const { cropper } = refEditor.current;
      cropper.cropBoxData.width = cropper.initialCropBoxData.width;
      cropper.cropBoxData.height = cropper.initialCropBoxData.height;
      refEditor.current.setCropBoxData(cropper.cropBoxData);
    }
  }, [isAuto]);

  return (
    <div className="image-crop-content">
      <Box>
        <div className="canvas-container">
          <Cropper
            ref={refEditor}
            src={source}
            style={{ height: '70vh', width: '70vw' }}
            cropBoxResizable
            aspectRatio={ratio}
            guides={false}
            toggleDragModeOnDblclick={false}
            zoomable={false}
            zoomOnTouch={false}
            zoomOnWheel={false}
            viewMode={1}
            background={false}
            autoCropArea={proportion}
              // todo use consts
            dragMode={isAuto ? 'none' : 'crop'}
            disable
            ready={() => {
              if (isAuto) {
                setMinMax(refEditor, isAuto);
              }
            }}
          />
        </div>
        {/* todo add Grid */}
        <div className="img-size-settings">
          <FieldBuilder
            label="Width"
            value={width}
            readOnly={isAuto}
            disabled={isAuto}
            onChange={(e) => setWidth(e)}
            className="input-settings"
          />
          <FieldBuilder
            label="Height"
            value={height}
            readOnly={isAuto}
            disabled={isAuto}
            onChange={(e) => setHeight(e)}
            className="input-settings"
          />
          <FieldBuilder
            className="input-settings"
            type={CHECKBOX}
            label="Automatically"
            value={isAuto}
            onChange={() => setIsAuto(!isAuto)}
          />
        </div>
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
            onClick={uploadFile}
          >
              Ok
          </Button>
        </Box>
      </Box>
    </div>
  );
});

ImageCropper.propTypes = {
  className: PropTypes.string,
  imageData: PropTypes.shape({
    source: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  resolution: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  onImageCropped: PropTypes.func.isRequired,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  needSave: PropTypes.bool,
  needClose: PropTypes.bool,
};

export default ImageCropper;
