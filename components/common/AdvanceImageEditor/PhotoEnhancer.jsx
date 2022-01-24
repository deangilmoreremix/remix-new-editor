/* eslint-disable no-var */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import Pagination from '@material-ui/lab/Pagination';
// import Base64Downloader from 'react-base64-downloader';
import { triggerBase64Download } from 'react-base64-downloader';

import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import { LibrarySpinner } from '../../media/Loader';

const PhotoEnhancer = observer(({
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
  // const source = transparent;


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
      <div className="">

        <div className="flex advance-editor-modal-content">

          <div className="content-container">

            <div className="flex justify-content-center items-center  ">

              <div className="original-image-container ">
                <p className="text-center font-weight-bold"> Original Image</p>
                <div className=" flex justify-content-center ">
                  <img className="editor-image" src={source} />
                </div>
                <div className="flex justify-content-center ">
                  <div className="mt-5">
                    <button onClick={processImage} className="btn  btn-outline-danger  btn-sm">
                      Enhance Photo
                    </button>
                  </div>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image</p>

                <div className=" ">
                  {isLoading ? <LibrarySpinner /> : (
                    <div className=" flex justify-content-center">
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

          </div>


          <div className="download-container">
            {/* <div className="mt-5">
              <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
              <Pagination count={3} variant="outlined" shape="rounded" color="primary" />
            </div> */}
            <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
              Download Image
            </button>

            <button onClick={() => onLoadImage(newImage)} className="btn btn-danger btn-xl mt-5 w-full  w-100">
              Save to Canvas
            </button>
          </div>


        </div>

      </div>
    </>
  );
});

PhotoEnhancer.propTypes = {
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

PhotoEnhancer.defaultProps = {
  noCrop: false,
};

export default PhotoEnhancer;
