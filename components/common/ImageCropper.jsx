import React, { useCallback, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import Cropper from 'react-cropper';
import { Box, Icon, IconButton } from '@material-ui/core';

import ImageButtons from '../imageEditor/ImageButtons';

import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import FieldBuilder from '../form/FieldBuilder';
import { CHECKBOX } from '../../lib/constants/forms';
import { setMinMax } from '../../lib/utils/cropHelper';
import { DRAG_MODES } from '../../lib/constants/imageEditor/tuiEditor';

const ImageCropper = observer((props) => {
  const {
    resolution,
    imageData,
    needSave,
    onImageCropped,
    handleClose,
    startUpload,
    endUpload,
    zoomable,
    needClose = true,
    openImageEditor,
  } = props;
  const refEditor = useRef();
  const { uploadMedia } = useMediaStore();
  const [isAuto, setIsAuto] = useState(true);

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
  const editStep = useMemo(() => (openImageEditor && 'Open Image Editor'),
    [openImageEditor]);

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

  const handleExtraStep = useCallback(() => {
    const image = refEditor.current.cropper
      .getCroppedCanvas({ width: recommendedWidth, height: recommendedHeight }).toDataURL();
    openImageEditor(image);
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
            zoomable={zoomable || false}
            zoomOnTouch={zoomable || false}
            zoomOnWheel={zoomable || false}
            viewMode={zoomable ? 0 : 1}
            background={false}
            autoCropArea={proportion}
            dragMode={isAuto ? DRAG_MODES.NONE : DRAG_MODES.CROP}
            disable
            ready={() => {
              if (isAuto) {
                setMinMax(refEditor, isAuto);
              }
              if (zoomable) {
                refEditor.current.cropper.zoom(-proportion);
              }
            }}
          />
        </div>
        <div className="img-size-settings black">
          { zoomable && (
            <>
              <IconButton
                aria-label="zoom"
                onClick={() => refEditor.current.cropper.zoom(-0.1)}
                className="zoom-icon"
              >
                <Icon className="fa fa-search-minus" />
              </IconButton>
              <IconButton
                aria-label="reduce"
                onClick={() => refEditor.current.cropper.zoom(0.1)}
                className="zoom-icon"
              >
                <Icon className="fa fa-search-plus" />
              </IconButton>
            </>
          )}
          <FieldBuilder
            className="input-settings"
            type={CHECKBOX}
            label="Automatically"
            value={isAuto}
            onChange={() => setIsAuto(!isAuto)}
          />
        </div>
        <ImageButtons
          uploadFile={uploadFile}
          handleClose={handleClose}
          extraStep={editStep}
          handleExtraStep={handleExtraStep}
        />
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
  openImageEditor: PropTypes.func,
  startUpload: PropTypes.func,
  endUpload: PropTypes.func,
  needSave: PropTypes.bool,
  needClose: PropTypes.bool,
  zoomable: PropTypes.bool,
};

export default ImageCropper;
