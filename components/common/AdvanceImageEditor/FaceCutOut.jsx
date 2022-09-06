/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import Carousel from 'react-simply-carousel';
import { triggerBase64Download } from 'react-base64-downloader';
import PropTypes from '../../../lib/PropTypes';
import useUserStore from '../../hooks/useUserStore';

import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import { LibrarySpinner } from '../../media/Loader';
import { Progress } from 'reactstrap';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';
import { tabItems } from '../../../lib/constants/library';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';


const FaceCutOut = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  const { uploadMedia, storeAsset } = useMediaStore();
  const {
    secondaryWindowType: activeTab,
  } = useUIStore();
  const userStore = useUserStore();

  const {
    updateUserCreditUseAndGetUserCreditBalance,
    userCutOutProBalance,
    cutoutProCreditUserUsed,
    cutoutProCreditAvailableBalance,
  } = userStore;

  const [isLoading, setIsLoading] = useState(false);
  const [progressState, setProgressState] = useState(0);
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isError, setError] = useState(null);


  const { source } = useMemo(() => imageData, [imageData]);

  const quantify = () => {
    userCutOutProBalance()
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };
  useEffect(() => quantify(), []);

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
      const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
      let fileType = activeTab;
      Object.keys(tabItems).forEach((item) => {
        tabItems[item].formats.forEach((format) => {
          if (format === fileExtension) {
            fileType = item;
          }
        });
      });
      await storeAsset(media, fileType);
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


  const processImage = async () => {
    setIsLoading(true);
    let counter = 0;
    const interval = setInterval(() => {
      if(counter < 100) {
        counter = counter + 10;
        }
        setProgressState(counter);
        if(counter == 100) {
            clearInterval(interval);
           
        }
    }, 100);
    setProgressState(0);
    const total = cutoutProCreditUserUsed + 2;
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&mattingType=3`, {
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
        if (resp.msg === 'Processing failed') {
          setError(resp.msg);
        } else {
          setNewImage(resp.data.imageBase64);
          setError(null);
          // talk to backend to reduce the use cutoutpro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
      });
  };

  const changeBackgroundColor = (val) => {
    setIsLoading(true);
    let counter = 0;
    const interval = setInterval(() => {
      if(counter < 100) {
        counter = counter + 10;
        }
        setProgressState(counter);
        if(counter == 100) {
            clearInterval(interval);
           
        }
    }, 100);
    setProgressState(0);
    const total = cutoutProCreditUserUsed + 2;
    fetch(`https://www.cutout.pro/api/v1/mattingByUrl?url=${source}&bgcolor=${val}&mattingType=3`, {
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
        if (resp.msg === 'Processing failed') {
          setError(resp.msg);
        } else {
          setNewImage(resp.data.imageBase64);
          setError(null);
          // talk to backend to reduce the use cutoutpro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
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

        <div className="">
          {
            isError === 'Processing failed' ? (
              <div>
                <p className="errorText mb-0"> This picture is not supported and no foreground is not recognized </p>
                <p className="errorText">
                  {' '}
                  Please select a picture with a clear distinction between foreground and background.
                  For example a picture of a person, a product, an animal, a car or another object
                  {' '}
                </p>
              </div>
            ) : (
              null
            )
          }
        </div>

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
                    {cutoutProCreditAvailableBalance <= 0
                      ? (
                        null
                      )
                      : (
                        <button onClick={processImage} className="btn  btn-outline-danger  btn-sm">
                          Process Cutout Face
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image</p>

                <div className=" ">
                  {isLoading ? <div className="progressState">
                      <Progress
                        className=""
                        animated
                        color="danger"
                        value={progressState}
                        style={{
                          height: '40px',
                        }}
                      >
                        {progressState}
                        {' '}
                        %
                      </Progress>
                    </div>: (
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

                {cutoutProCreditAvailableBalance <= 0
                  ? (
                    null
                  )
                  : (
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
                      itemsToShow={10}
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
                      <button onClick={() => changeBackgroundColor('F1FBEF')} className="color-btn" style={{ backgroundColor: '#F1FBEF' }} />
                      <button onClick={() => changeBackgroundColor('D8D9D8')} className="color-btn" style={{ backgroundColor: '#D8D9D8' }} />
                      <button onClick={() => changeBackgroundColor('BEE1E6')} className="color-btn" style={{ backgroundColor: '#BEE1E6' }} />
                      <button onClick={() => changeBackgroundColor('97F5E1')} className="color-btn" style={{ backgroundColor: '#97F5E1' }} />
                      <button onClick={() => changeBackgroundColor('EB5054')} className="color-btn" style={{ backgroundColor: '#EB5054' }} />
                      <button onClick={() => changeBackgroundColor('E8C1CA')} className="color-btn" style={{ backgroundColor: '#E8C1CA' }} />
                      <button onClick={() => changeBackgroundColor('CFDFC2')} className="color-btn" style={{ backgroundColor: '#CFDFC2' }} />
                      <button onClick={() => changeBackgroundColor('E82055')} className="color-btn" style={{ backgroundColor: '#E82055' }} />
                      <button onClick={() => changeBackgroundColor('23ef56')} className="color-btn" style={{ backgroundColor: '#23ef56' }} />
                      <button onClick={() => changeBackgroundColor('ffed45')} className="color-btn" style={{ backgroundColor: '#ffed45' }} />
                    </Carousel>
                  )}

              </div>
            </div>


            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={() => triggerBase64Download(base64, 'my_download')} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                  Download Image
                </button>
              )}
            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={() => onLoadImage(newImage)} className="btn btn-danger btn-xl mt-5 w-full  w-100">
                  Save to Canvas
                </button>
              )}

          </div>


        </div>

      </div>
    </>
  );
});

FaceCutOut.propTypes = {
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

FaceCutOut.defaultProps = {
  noCrop: false,
};

export default FaceCutOut;
