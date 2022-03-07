/* eslint-disable no-var */
import React, { useCallback, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import { triggerBase64Download } from 'react-base64-downloader';
import Carousel from 'react-simply-carousel';
import PropTypes from '../../../lib/PropTypes';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import { LibrarySpinner } from '../../media/Loader';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';

const BackgroundRemoval = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  const { uploadMedia } = useMediaStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

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
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&mattingType=6`, {
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


  const changeBackgroundColor = (val) => {
    setIsLoading(true);
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&bgcolor=${val}&mattingType=6`, {
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
                <p className="text-center font-weight-bold"> Original</p>
                <div className=" flex justify-content-center ">
                  <img className="editor-image" src={source} />
                </div>
                <div className="flex justify-content-center ">
                  <div className="mt-5">
                    <button onClick={processImage} className="btn  btn-outline-danger  btn-sm">
                      Remove Background Image
                    </button>
                  </div>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result </p>
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
              <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
              <div className="">
                <Carousel
                  containerProps={{
                    style: {
                      width: '100%',
                      display: 'flex',
                      justifyContent: '',
                    },
                  }}
                  forwardBtnProps={{
                    children: '>',
                    style: {
                      border: 'none',
                      height: '20%',
                      justifyContent: 'center',
                      marginTop: '5px',
                      marginRight: '3px',
                      display: 'flex',
                      padding: '3px',
                      background: 'none',
                      color: '#fff',
                      outline: 'none',
                    },
                  }}
                  backwardBtnProps={{
                    children: '<',
                    style: {
                      border: 'none',
                      height: '20%',
                      justifyContent: 'center',
                      marginTop: '5px',
                      display: 'flex',
                      padding: '3px',
                      background: 'none',
                      color: '#fff',
                      outline: 'none',
                    },
                  }}
                  itemsToShow={12}
                  itemsToScroll={3}
                  activeSlideIndex={activeSlideIndex}
                  onRequestChange={setActiveSlideIndex}
                >
                  <button onClick={() => changeBackgroundColor('FFFFFF')} className="color-btn" style={{ backgroundColor: '#FFFFFF' }} />
                  <button onClick={() => changeBackgroundColor('FEACAD')} className="color-btn" style={{ backgroundColor: '#FEACAD' }} />
                  <button onClick={() => changeBackgroundColor('FFD6A5')} className="color-btn" style={{ backgroundColor: '#FFD6A5' }} />
                  <button onClick={() => changeBackgroundColor('A0C5FE')} className="color-btn" style={{ backgroundColor: '#A0C5FE' }} />
                  <button onClick={() => changeBackgroundColor('BCB1FF')} className="color-btn" style={{ backgroundColor: '#BCB1FF' }} />
                  <button onClick={() => changeBackgroundColor('C2C5AA')} className="color-btn" style={{ backgroundColor: '#C2C5AA' }} />
                  <button onClick={() => changeBackgroundColor('F1FBEF')} className="color-btn" style={{ backgroundColor: '#F1FBEF' }} />
                  <button onClick={() => changeBackgroundColor('D8D9D8')} className="color-btn" style={{ backgroundColor: '#D8D9D8' }} />
                  <button onClick={() => changeBackgroundColor('BEE1E6')} className="color-btn" style={{ backgroundColor: '#BEE1E6' }} />
                  <button onClick={() => changeBackgroundColor('97F5E1')} className="color-btn" style={{ backgroundColor: '#97F5E1' }} />
                  <button onClick={() => changeBackgroundColor('EB5054')} className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                  <button onClick={() => changeBackgroundColor('E9C1CA')} className="color-btn" style={{ backgroundColor: '#E9C1CA' }} />
                  <button onClick={() => changeBackgroundColor('CFDFC2')} className="color-btn" style={{ backgroundColor: '#CFDFC2' }} />
                  <button onClick={() => changeBackgroundColor('EA2055')} className="color-btn" style={{ backgroundColor: '#EA2055' }} />
                  <button onClick={() => changeBackgroundColor('23ef56')} className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                  <button onClick={() => changeBackgroundColor('ffed45')} className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                </Carousel>
              </div>
            </div>
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

BackgroundRemoval.propTypes = {
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

BackgroundRemoval.defaultProps = {
  noCrop: false,
};

export default BackgroundRemoval;
