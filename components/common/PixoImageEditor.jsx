import React, { useCallback, useMemo, useRef } from 'react';
import _ from 'lodash';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';

import { BASE_MENU } from '../../lib/constants/imageEditor/tuiEditor';

const { Pixo } = window;

const BG_COLOR = '#272735';

const PixoImageEditor = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  const refEditor = useRef();
  const { uploadMedia, common: { pixoEditor: { apiKey } } } = useMediaStore();

  const { source } = useMemo(() => imageData, [imageData]);

  React.useEffect(() => {
    if (refEditor.current) {
      const pixoEditor = new Pixo.Bridge({
        parent: refEditor.current,
        texturesize: 512,
        type: 'child',
        apikey: apiKey,
        sessionrestore: false,
        features: noCrop ? _.initial(BASE_MENU) : BASE_MENU,
        styles: {
          propertiespanelbgcolor: BG_COLOR,
          actionsmenubgcolor: BG_COLOR,
          editmenubgcolor: BG_COLOR,
          canvasbgcolor: BG_COLOR,
          logosrc: 'none',
          css: `
            .pixo-editmenu button {
              padding: 2vh 0;
            }
            .pixo-propertypanel-handle {
              left: -2rem !important;
            }
            .pixo-logo:before {
              padding-bottom: 0;
            }
            .pixo-mainarea {
              padding-right: 1.5rem;
              background-color: ${BG_COLOR}
            }
          `,
        },
        onSave: (img) => onLoadImage(img.toDataURL()),
        onClose: () => handleClose(),
      });

      pixoEditor.edit(source);
    }
  }, [refEditor.current]);

  const onLoadImage = useCallback(async (image) => {
    if (!refEditor) {
      return;
    }

    let media;
    let hasError;

    try {
      startUpload();
      media = await uploadMedia({ data: image, isCrop: true });
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      image = media && media.url;
      if (!hasError) {
        onImageEdited(image);
      }
      handleClose();
      endUpload();
    }
  }, [refEditor]);

  return <div className="pixo-image-editor" ref={refEditor} />;
});

PixoImageEditor.propTypes = {
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

PixoImageEditor.defaultProps = {
  noCrop: false,
};

export default PixoImageEditor;
