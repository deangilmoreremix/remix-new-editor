/* eslint-disable no-var */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { triggerBase64Download } from 'react-base64-downloader';
import Carousel from 'react-simply-carousel';
import PropTypes from '../../../lib/PropTypes';
import useUserStore from '../../hooks/useUserStore';
import { showError } from '../../../lib/services/alertService';
import useMediaStore from '../../hooks/useMediaStore';
import useUIStore from '../../hooks/useUIStore';
import config from '../../../config/config';
import transparent from '../../../public/static/AdvanceImageSvg/background.png';
import { tabItems } from '../../../lib/constants/library';
import { ERROR_CUTOUTPRO_TEXT_SYMBOLS } from '../../../lib/constants/text-info';
import PercentageProgressBar from '../../media/PercentageProgressBar';
import FieldBuilder from '../../form/FieldBuilder';


const BackgroundDeffusion = observer(({
  imageData,
  onImageEdited,
  handleClose,
  startUpload,
  endUpload,
  noCrop,
}) => {
  const { uploadMedia, storeAsset, uploadImageUrl } = useMediaStore();
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
  const [currentState, setCurrentState] = useState('original');
  const [isProcessImage, setIsProcessImage] = useState(false);
  const [newImage, setNewImage] = useState('');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isError, setError] = useState(null);
  const [val, setVal] = useState(null);
  const { source } = useMemo(() => imageData, [imageData]);
  const [progressState, setProgressState] = useState(1);
  const quantify = () => {
    userCutOutProBalance()
      .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
  };
  useEffect(() => quantify(), []);

  const saveTocanvasHandler = () => {
    if (currentState == 'removedBackground' || currentState == 'facecutout' || currentState == 'describedImage') {
      onLoadImage(newImage)
    }
  }

  const onLoadImage = useCallback(async (image) => {
    let media;
    let hasError;
    let base64Response;
    let blob;
    if(currentState == 'removedBackground' || currentState == 'facecutout') {
      base64Response = await fetch(`data:image/jpeg;base64,${image}`);
      blob = await base64Response.blob();
    }
  


    if (!newImage) {
      return;
    }



    try {
      setIsLoading(true);
      startUpload();
      if(currentState == 'removedBackground' || currentState == 'facecutout') {
        media = await uploadMedia({ data: blob, isCrop: true });
      }
      if(currentState == 'describedImage') {
        const data = {
          url : image
        }
        media = await uploadImageUrl(data);
      }
      const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
      console.log(fileExtension,"fileExtension")
      let fileType = activeTab;
      console.log(fileType,"fileType")
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
  const processAIImage = async (val) => {
    const total = cutoutProCreditUserUsed + 2;
    setIsLoading(true);
    await fetch(`https://www.cutout.pro/api/v1/getPaintResult?taskId=${val}`, {
        method: 'get',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Accept: 'application/json',
            APIKEY: 'f8215a0e6b3b40b78a2ce62ce89c5d9e',
        },
    }).then((data) =>
        data.json(),
    ).then(async resp => {
        if (resp?.code == 9010) {
            setIsLoading(false);
            setError('The description information has failed the review and contains illegal content')
        }
        if (resp.data.status == 3 || resp.data.status == 0) {
            setProgressState(100 - resp.data.waitNumber)
            processAIImage(val)
        }
        if(resp.data.resultList[0].percentage != 100) {
            setProgressState(resp.data.resultList[0].percentage);
            processAIImage(val)

        }
        if (resp.data.resultList[0].percentage == 100) {
            setIsLoading(false);
            setIsProcessImage(true);
            setProgressState(0);
            setCurrentState('describedImage')
            setError(null);
            console.log(resp.data.resultList[0].preview,"resp.data.url")
            console.log(resp.data.resultList[0].result,"res")
            setNewImage(resp.data.resultList[0].preview);
            updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }

    })
    .catch((error) => {
      setIsLoading(false);
      showError('Something went wrong. Please try again later.');
    });
}

  const imageGenerateHandler = async () => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
    const data = {
      text: val,
    }
    currentState == 'original' ? data.imgUrl = source : data.imgBase64 = newImage
    fetch(`https://www.cutout.pro/api/v1/paintAsync`, {
      method: 'post',
      body: JSON.stringify(data),
      headers: {
        'Content-type': 'application/json',
        // 'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
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
          processAIImage(resp.data);
          setError(null);
          // talk to backend to reduce the use cutoutpro credit
          updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
        }
      })
      // eslint-disable-next-line no-unused-vars
      .catch((error) => {
        setIsLoading(false);
        showError('Something went wrong. Please try again later.');
      });
  };

  const processImage = async () => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
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
        showError('Something went wrong. Please try again later.');
      });
  };


  const processImageFaceCoutOut = async () => {
    setIsLoading(true);
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


  useEffect(() => {
    if (currentState == 'removedBackground') {
      processImage();
    }
    if (currentState == 'facecutout') {
      processImageFaceCoutOut();
    }
  }, [currentState])

  const downloadHandler = (base64) => {
    console.log("call download==")
    if (currentState == 'removedBackground' || currentState == 'facecutout') {
      triggerBase64Download(base64, 'my_download')
    }
  }

  const changeBackgroundColor = (val) => {
    setIsLoading(true);
    const total = cutoutProCreditUserUsed + 2;
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


  const onChange = (event) => {
    const { value } = event.target;
    setVal(value);
  };
  useEffect(() => {
    console.log(val, "val========??")
  }, [val])

  const base64 = `data:image/png;base64,${newImage}`;
  // const imageUrl  = currentState == 'removedBackground' || currentState == 'facecutout' ? base64 : newImage;
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
          <div className="content-container-bgdeffusion">
            <div className="flex justify-content-center items-center  ">
              <div>
                <div className="button-container">
                  <button onClick={() => setCurrentState('original')} className="btn  btn-outline-danger  btn-sm">
                    Original
                  </button>
                  <button onClick={() => setCurrentState('removedBackground')} className="btn  btn-outline-danger  btn-sm">
                    Removed Background
                  </button>
                  <button onClick={() => setCurrentState('facecutout')} className="btn  btn-outline-danger  btn-sm">
                    Face Cutout
                  </button>
                </div>

                <div className=" flex justify-content-center ">
                  {currentState == 'original' &&
                    <img className="editor-image-bgdeffusion" src={source} />
                  }
                  {console.log(currentState,"current state",newImage)}
                  {currentState == 'removedBackground' || currentState == 'facecutout' ?
                    isLoading ? <div className="progressState">
                      <PercentageProgressBar />
                    </div> : isProcessImage
                      ? (
                        <img
                          className="editor-image-bgdeffusion"
                          src={`data:image/png;base64,${newImage}`}
                          style={{ backgroundImage: 'url(https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/background/transparent.jpg)' }}
                        />
                      )
                      : <img className="editor-image-bgdeffusion" src={transparent} /> : null}
                    {currentState == 'describedImage'  ?
                    isLoading ? <div className="progressState">
                      <PercentageProgressBar />
                    </div> : isProcessImage
                      ? (
                        <img
                          className="editor-image-bgdeffusion"
                          src={`${newImage}`}
                        />
                      )
                      : <img className="editor-image-bgdeffusion" src={transparent} /> : null}
                </div>

              </div>

              {/* <div className="result-image-container">
                <p className="text-center font-weight-bold"> Result Image </p>
                <div className=" ">
                  {isLoading ? <div className="progressState">
                    <PercentageProgressBar />
                  </div> : (
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
              </div> */}
            </div>
          </div>


          <div className="download-container-bgdeffusion">
            <div>
              <p className='font-weight-bold'>Erase unwanted parts and describe</p>
              <textarea
                rows={5}
                // {...getRootProps()}
                className="text-input full-width-container"
                value={val}
                // onKeyPress={onKeyPress}
                onChange={onChange}
              // placeholder={placeholder}
              />
              {/* <p className="text-sm text-muted font-weight-light text-sm-left  font-smaller">Change Background</p>
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
                  )}

              </div> */}
            </div>
            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={imageGenerateHandler} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                  Generate
                </button>
              )}
            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={() => downloadHandler(base64)} className="btn btn-outline-danger btn-xl mt-5 w-full  w-100">
                  Download Image
                </button>
              )}
            {cutoutProCreditAvailableBalance <= 0
              ? (
                null
              )
              : (
                <button onClick={() => saveTocanvasHandler()} className="btn btn-danger btn-xl mt-5 w-full  w-100">
                  Save to Canvas
                </button>
              )}
          </div>
        </div>

      </div>
    </>
  );
});

BackgroundDeffusion.propTypes = {
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

BackgroundDeffusion.defaultProps = {
  noCrop: false,
};

export default BackgroundDeffusion;
