/* eslint-disable no-var */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import Pagination from '@material-ui/lab/Pagination';
// import Base64Downloader from 'react-base64-downloader';
import { triggerBase64Download } from 'react-base64-downloader';

import undoIcon from '../../public/static/svgImages/header/undo.svg';
import saveIcon from '../../public/static/svgImages/header/save.svg';

import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import useMediaStore from '../hooks/useMediaStore';
import { LibrarySpinner } from '../media/Loader';

// import { BASE_MENU, ADVANCE_IMAGE_EDITOR_MENU } from '../../lib/constants/imageEditor/tuiEditor';


const AdvancedImageEditor = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  // const refEditor = useRef();
  const { uploadMedia } = useMediaStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');


  const transparent = 'https://user-images.githubusercontent.com/20482760/56193735-a33f2800-6031-11e9-80c7-878dad341315.png';
  const { source } = useMemo(() => imageData, [imageData]);

  const onClose = () => {
    if (!isLoading) {
      handleClose();
    }
  };

  const convertToBlob = (dataURI) => {
    // eslint-disable-next-line no-var
    var byteString = atob(dataURI.split(',')[1]);
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    // eslint-disable-next-line vars-on-top
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/jpeg' });
  };

  const onLoadImage = useCallback(async (image) => {
    const base64Response = await fetch(`data:image/jpeg;base64,${image}`);
    const blob = await base64Response.blob();
    console.log(blob, 'This is the blob');
    const media = await uploadMedia({ data: blob, isCrop: true });
    console.log(media);
    // if (!newImage) {
    //   return;
    // }

    // let media;
    // let hasError;

    // try {
    //   setIsLoading(true);
    //   startUpload();
    //   media = await uploadMedia({ data: blob, isCrop: true });
    // } catch (e) {
    //   hasError = true;
    //   showError(e.message);
    // } finally {
    //   setIsLoading(false);
    //   image = media && media.url;
    //   if (!hasError) {
    //     onImageEdited(image);
    //   }
    //   handleClose();
    //   endUpload();
    // }
  }, [newImage]);


  const processImage = () => {
    setIsLoading(true);
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&mattingType=18`, {
      method: 'get',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        APIKEY: 'f8215a0e6b3b40b78a2ce62ce89c5d9e',
      },
    })
      .then((data) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        data.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        console.log('Request succeeded with JSON response', resp);
        setNewImage(resp.data.imageBase64);
      })
      .catch((error) => {
        setIsLoading(false);
        console.log('Request failed', error);
      });
  };

  const base64 = `data:image/png;base64,${newImage}`;

  return (
    <>
      {/* { isLoading ? <div className="pixo-image-loading">Uploading image... </div>
        : <div className="pixo-image-editor" ref={refEditor} /> } */}
      <div className="advance-editor-modal">

        <div className="flex justify-content-between align-items-center align-content-center ">
          <div>
            <p className="text-header">Advance Image Features</p>
          </div>

          <div className="w-6 flex">

            <div className="mr-4 flex">
              <SVGInline
                className="svg-icon mr-1 "
                classSuffix=""
                svg={undoIcon}
                cleanup={['title']}
                component="button"
              />

              <button className="icon-button container-menu__button-text text-white">Undo</button>
            </div>


            <div className="flex">
              <SVGInline
                className="svg-icon mr-1"
                classSuffix=""
                svg={saveIcon}
                cleanup={['title']}
                component="button"
              />
              <button onClick={() => onLoadImage(newImage)} className="icon-button container-menu__button-text text-white">Save</button>
            </div>

          </div>

          <div>
            <button onClick={onClose} className="icon-button container-menu__button-text text-white">X</button>
          </div>

        </div>

        <div className="flex advance-editor-modal-content">

          <div className="edit-menu bg">

            <button className="btn btn btn-white mb-3 text-white"> Remove Background </button>
            <button className="btn btn btn-white mb-3 text-white btn-outline-primary"> Photo Enhancer </button>
            <button className="btn btn btn-white mb-3 text-white"> Photo Colorizer  </button>
            <button className="btn btn btn-white mb-3 text-white"> Photo Animer </button>
            <button className="btn btn btn-white mb-3 text-white"> Photo Color Correction </button>

          </div>


          <div className="content-container">
            <div className="flex justify-content-center items-center  ">

              <div className="original-image-container ">
                <p className="text-center font-weight-bold"> Original Image</p>
                <img className="editor-image" src={source} />
                <div className="mt-5">
                  <button onClick={processImage} className="btn btn-primary btn-sm">
                    Enhance Image
                  </button>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image</p>

                {isLoading ? <LibrarySpinner /> : (
                  <div>
                    {isProcessImage
                      ? (
                        <img
                          className="editor-image"
                          src={`data:image/png;base64,${newImage}`}
                        />
                      )
                      : <img className="editor-image" src={transparent} />}
                  </div>
                )}


              </div>
            </div>
          </div>


          <div className="download-container">
            <div className="mßt-5">
              <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
              <Pagination count={3} variant="outlined" shape="rounded" color="primary" />
            </div>
            <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
              Download
            </button>
          </div>


        </div>

      </div>
    </>
  );
});

AdvancedImageEditor.propTypes = {
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

AdvancedImageEditor.defaultProps = {
  noCrop: false,
};

export default AdvancedImageEditor;
