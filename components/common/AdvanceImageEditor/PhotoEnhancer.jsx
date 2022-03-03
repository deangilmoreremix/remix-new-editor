/* eslint-disable no-var */
import React, { useCallback, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import Pagination from '@material-ui/lab/Pagination';
import { triggerBase64Download } from 'react-base64-downloader';
import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import { LibrarySpinner } from '../../media/Loader';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';


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
  
  const { source } = useMemo(() => imageData, [imageData]);

  const onLoadImage = useCallback(async (image) => {
    const base64Response = await fetch(`data:image/jpeg;base64,${image}`);
    const blob = await base64Response.blob();
    if (!newImage) {
      return;
    }

    let media;
    let hasError;

    try {
      setIsLoading(true);
      startUpload();
      media = await uploadMedia({ data: blob, isCrop: true });
    } catch (e) {
      hasError = true;
      showError(e.message);
    } finally {
      setIsLoading(false);
      image = media && media.url;
      if (!hasError) {
        onImageEdited(image);
      }
      handleClose();
      endUpload();
    }
  }, [newImage]);


  const processImage = () => {
    setIsLoading(true);
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&mattingType=18`, {
      method: 'get',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        APIKEY: config.cutoutPro.apiKey,
      },
    })
      .then((data) =>
        // eslint-disable-next-line implicit-arrow-linebreak
        data.json(),
      ).then(resp => {
        setIsLoading(false);
        setIsProcessImage(true);
        setNewImage(resp.data.imageBase64);
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
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
            <div className="mt-5">
              <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                Download Image
              </button>
            </div>
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
